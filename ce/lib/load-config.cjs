#!/usr/bin/env node

/**
 * Load CE project config for development scripts.
 *
 * Resolution order (unchanged):
 *   1. CE_PROJECT_CONFIG_PATH - JSON file (CI may write here; highest priority)
 *   2. CE_PROJECT_KEY         - HTTP GET raw toolkit JSON (see resolveProjectConfigFetchUrls)
 *   3. CE_PROJECT_KEY         - volume mirror (/data/.ce-backup/<key>/) if all GETs fail
 *   4. .ce-project.json       - repo / cwd (local fallback)
 *   5. Defaults
 *
 * Fetch URLs when KEY is set (first success wins):
 *   - CE_PROJECT_CONFIG_URL only, else
 *   - CE_SERVER_URL + /projects/<key>/.ce-project.json only, else
 *   - Default hosted origin (https://coherence-engine.fly.dev) then http://127.0.0.1:<port>/...
 *     - deployed server first; localhost is for local MCP dev only.
 *   - Set CE_LOCAL_MCP=1 (or true/yes) to try localhost before the hosted default (old order).
 * Optional: CE_PROJECT_TOKEN as Bearer on every GET.
 *
 * Hosted Fly (e.g. https://coherence-engine.fly.dev/...) returns 401 without Authorization
 * when the server has HTTP auth enabled. For local dev, use CE_PROJECT_TOKEN,
 * point CE_SERVER_URL at a local MCP (127.0.0.1), set CE_PROJECT_CONFIG_PATH to a JSON
 * file, or keep a repo-root .ce-project.json.
 *
 * Environment: at the start of loadConfig(), `.env` then `.env.local` are loaded once
 * (override: true for .env.local; quiet: true) so CE_PROJECT_KEY in `.env` is visible
 * to hooks and scripts without requiring curl.
 *
 * Returns config with jira, hooks, ci, gdrive for pre-flight, hooks, and
 * Jira integration. All config lives under toolkit; no fallbacks to legacy
 * top-level or dev keys.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_CONFIG_FILE = ".ce-project.json";
const DEFAULT_TICKET_PATTERN = "[A-Z][A-Z0-9]+-[0-9]+";
// Tracker-neutral default: no branch-name enforcement unless a pattern is
// explicitly configured in .ce-project.json (toolkit.jira.branchPattern).
const DEFAULT_BRANCH_PATTERN = "";
/** Default hosted origin when CE_SERVER_URL is unset (matches CI E2E workflow). */
const DEFAULT_CE_SERVER_ORIGIN = "https://coherence-engine.fly.dev";

const log = require("./log.cjs");

let projectEnvLoaded = false;

/**
 * Load `.env` then `.env.local` (override) once - from cwd, or the first parent
 * directory that contains `.env` (so git hooks / scripts run from subfolders still find tokens).
 */
function ensureProjectEnvLoaded() {
  if (projectEnvLoaded) {
    return;
  }
  projectEnvLoaded = true;
  try {
    const dotenv = require("dotenv");
    let dir = process.cwd();
    for (let i = 0; i < 20; i++) {
      const envFile = path.join(dir, ".env");
      if (fs.existsSync(envFile)) {
        dotenv.config({ path: envFile, quiet: true });
        const envLocal = path.join(dir, ".env.local");
        if (fs.existsSync(envLocal)) {
          dotenv.config({ path: envLocal, override: true, quiet: true });
        }
        return;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    /* dotenv optional in odd environments - continue with process.env only */
  }
}

/** Build a merged config object from a raw project payload. */
function buildMerged(raw, source) {
  const toolkit = raw.toolkit || {};
  const tkJira = toolkit.jira || {};
  const tkGdrive = toolkit.gdrive || {};
  const jiraBaseUrl = tkJira.baseUrl || process.env.JIRA_BASE_URL || "";
  const jiraEmail = process.env.JIRA_USER_EMAIL || "";
  const jiraToken = process.env.JIRA_API_TOKEN || "";

  return {
    _configPath: source,
    jira: {
      enabled: !!(jiraToken && jiraEmail && jiraBaseUrl),
      baseUrl: jiraBaseUrl.replace(/\/+$/, ""),
      userEmail: jiraEmail,
      apiToken: jiraToken,
      projectKey: tkJira.projectKey,
      ticketPattern: tkJira.ticketPattern || DEFAULT_TICKET_PATTERN,
      branchPattern: tkJira.branchPattern || DEFAULT_BRANCH_PATTERN,
      allowedBranches: tkJira.allowedBranches || [
        "main",
        "develop",
        "staging",
        "master",
      ],
      transitions: {
        checkout: "In Progress",
        pr_opened: "Code Review",
        pr_merged: "Done",
        ...(tkJira.transitions && typeof tkJira.transitions === "object"
          ? tkJira.transitions
          : {}),
      },
    },
    hooks: {
      preCommit: {
        enabled: toolkit.hooks?.preCommit?.enabled !== false,
        lintStaged: toolkit.hooks?.preCommit?.lintStaged !== false,
        typeCheck: toolkit.hooks?.preCommit?.typeCheck === true,
        runTests: toolkit.hooks?.preCommit?.runTests === true,
      },
      commitMsg: {
        enabled: toolkit.hooks?.commitMsg?.enabled !== false,
        // Tracker-neutral default: ticket references in commit messages are
        // opt-in. Set toolkit.hooks.commitMsg.requireTicket = true in
        // .ce-project.json for projects that use a ticket tracker.
        requireTicket: toolkit.hooks?.commitMsg?.requireTicket === true,
      },
      prePush: {
        enabled: toolkit.hooks?.prePush?.enabled !== false,
        validateBranch: toolkit.hooks?.prePush?.validateBranch !== false,
      },
      postCheckout: {
        enabled: toolkit.hooks?.postCheckout?.enabled !== false,
        transitionJira: toolkit.hooks?.postCheckout?.transitionJira !== false,
      },
    },
    ci: {
      linting: toolkit.ci?.linting !== false,
      formatting: toolkit.ci?.formatting !== false,
      typeCheck: toolkit.ci?.typeCheck !== false,
      unitTests: toolkit.ci?.unitTests !== false,
      e2eTests: toolkit.ci?.e2eTests === true,
    },
    gdrive: {
      outputFolderId: tkGdrive.outputFolderId || null,
      credentialsPath: process.env.GDRIVE_CREDENTIALS_PATH || null,
      serviceAccountKey: process.env.GDRIVE_SERVICE_ACCOUNT_KEY || null,
    },
  };
}

/** Safe defaults - returned when no config source is available. */
const defaults = buildMerged({}, null);

/**
 * Site origin only - not the Streamable HTTP path (/mcp). load-config appends
 * /projects/<key>/.ce-project.json
 * @param {string} serverUrl
 */
function normalizeCEServerBase(serverUrl) {
  let s = serverUrl.replace(/\/+$/, "");
  const lower = s.toLowerCase();
  for (const suffix of ["/mcp", "/sse", "/message"]) {
    if (lower.endsWith(suffix)) {
      s = s.slice(0, -suffix.length).replace(/\/+$/, "");
      break;
    }
  }
  return s;
}

/** @param {string} projectKey @returns {string[]} */
function resolveProjectConfigFetchUrls(projectKey) {
  const explicit = process.env.CE_PROJECT_CONFIG_URL?.trim();
  if (explicit) return [explicit.replace(/\/+$/, "")];

  const serverUrl = process.env.CE_SERVER_URL?.trim();
  if (serverUrl) {
    const origin = normalizeCEServerBase(serverUrl);
    return [`${origin}/projects/${projectKey}/${DEFAULT_CONFIG_FILE}`];
  }

  const port = process.env.CE_SERVER_PORT || "2899";
  const hostedUrl = `${DEFAULT_CE_SERVER_ORIGIN}/projects/${projectKey}/${DEFAULT_CONFIG_FILE}`;
  const localUrl = `http://127.0.0.1:${port}/projects/${projectKey}/${DEFAULT_CONFIG_FILE}`;
  const preferLocal = /^(1|true|yes)$/i.test(
    String(process.env.CE_LOCAL_MCP || "").trim(),
  );
  return preferLocal ? [localUrl, hostedUrl] : [hostedUrl, localUrl];
}

/** @param {string} url */
function fetchProjectConfigBody(url) {
  const { execFileSync } = require("child_process");
  const helper = path.join(__dirname, "fetch-project-config-http.cjs");
  return execFileSync(process.execPath, [helper, url], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    env: process.env,
  });
}

function loadConfig() {
  ensureProjectEnvLoaded();

  const pathOverride = process.env.CE_PROJECT_CONFIG_PATH?.trim();
  if (pathOverride && fs.existsSync(pathOverride)) {
    try {
      const raw = JSON.parse(fs.readFileSync(pathOverride, "utf8"));
      return buildMerged(raw, pathOverride);
    } catch {
      log.dim("CE_PROJECT_CONFIG_PATH set but unreadable - continuing.");
    }
  }

  const projectKey = process.env.CE_PROJECT_KEY;

  if (projectKey) {
    const urls = resolveProjectConfigFetchUrls(projectKey);
    for (const url of urls) {
      try {
        const json = fetchProjectConfigBody(url);
        const raw = JSON.parse(json);
        return buildMerged(raw, url);
      } catch (e) {
        if (e instanceof SyntaxError) {
          log.dim(
            `CE project config: invalid JSON from ${url} - trying next URL.`,
          );
        }
        /* try next URL */
      }
    }
    log.dim(
      "CE project config HTTP fetch failed for all URLs - trying backup volume.",
    );

    // 3. Read from hourly mirror on the same Fly volume (/data/.ce-backup/<key>/)
    const backupPath = path.join(
      "/data",
      ".ce-backup",
      projectKey,
      DEFAULT_CONFIG_FILE,
    );
    if (fs.existsSync(backupPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(backupPath, "utf8"));
        log.dim(`Loaded config from backup volume: ${backupPath}`);
        return buildMerged(raw, backupPath);
      } catch {
        // ignore parse errors - fall through
      }
    }
  }

  // 4. Local .ce-project.json in cwd
  const cwd = process.cwd();
  const configPath = path.join(cwd, DEFAULT_CONFIG_FILE);
  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
      return buildMerged(raw, configPath);
    } catch {
      // ignore parse errors - fall through to defaults
    }
  }

  // 5. Defaults
  if (projectKey) {
    log.dim(
      "No CE config loaded: HTTP fetch failed (see stderr for status), no /data backup, no repo-root .ce-project.json. " +
        "Fix: valid CE_PROJECT_TOKEN for this host; CE_SERVER_URL = site origin only (e.g. https://coherence-engine.fly.dev - not …/mcp); " +
        "ensure GET /projects/" +
        projectKey +
        "/.ce-project.json returns 200 on the server; or commit .ce-project.json to the repo.",
    );
  } else {
    log.dim(
      "No CE config found - using defaults (set CE_PROJECT_KEY in .env or add .ce-project.json).",
    );
  }
  return { ...defaults, _configPath: null };
}

module.exports = { loadConfig };
