#!/usr/bin/env node

/**
 * Fetches a URL and prints the response body to stdout (HTTP 200 only).
 * Used by load-config.cjs via execFileSync so callers stay synchronous.
 *
 * Args: node fetch-project-config-http.cjs <url>
 * Env: CE_PROJECT_TOKEN - optional Bearer token
 *
 * Timeouts: 2s for 127.0.0.1/localhost, 20s otherwise (AbortController).
 * Exits: 0 on success, 1 on network/HTTP error, 2 on bad usage
 */

"use strict";

const url = process.argv[2];
if (!url) {
  process.stderr.write("fetch-project-config-http: missing URL argument\n");
  process.exit(2);
}

const LOCAL_CE_PATH_RE = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i;
const timeoutMs = LOCAL_CE_PATH_RE.test(url) ? 2000 : 20000;

async function run() {
  const token = process.env.CE_PROJECT_TOKEN?.trim();
  const controller = new AbortController();
  const kill = setTimeout(() => controller.abort(), timeoutMs);
  try {
    /** @type {Record<string, string>} */
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(url, {
      signal: controller.signal,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
    if (!res.ok) {
      process.stderr.write(
        `CE project config HTTP: ${res.status} ${res.statusText} - ${url}\n`,
      );
      if (res.status === 401) {
        process.stderr.write(
          "  → Use CE_PROJECT_TOKEN with a valid bearer for this server (see https://coherence-engine.fly.dev/ce/docs/mcp-auth-setup).\n",
        );
      }
      if (res.status === 404) {
        process.stderr.write(
          "  → No config on server for this key - run upload_project_config on the MCP server or use repo-root .ce-project.json.\n",
        );
      }
      process.exit(1);
    }
    const text = await res.text();
    process.stdout.write(text);
  } catch (e) {
    const hint =
      e && e.name === "AbortError"
        ? "timeout (check CE_SERVER_URL / network)"
        : String(e?.message || e);
    process.stderr.write(`CE project config fetch failed: ${hint} - ${url}\n`);
    process.exit(1);
  } finally {
    clearTimeout(kill);
  }
}

(async () => {
  await run();
})().catch(() => {
  process.exit(1);
});
