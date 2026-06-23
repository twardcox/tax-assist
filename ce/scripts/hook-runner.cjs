#!/usr/bin/env node

/**
 * Hook dispatcher - the architectural centerpiece.
 *
 * Every husky hook in the user's project calls this script:
 *   node ".ce/scripts/hook-runner.cjs" <hookName> [args...]
 *
 * On every invocation it loads config via loadConfig() (which loads `.env` then
 * `.env.local` once), resolves toolkit settings, checks if the hook is enabled,
 * and dispatches to the right handler. Disabling a hook in config takes effect immediately.
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const { loadConfig } = require("../lib/load-config.cjs");
const log = require("../lib/log.cjs");

// ---------------------------------------------------------------------------
// Map git hook names → config keys and handler functions
// ---------------------------------------------------------------------------

const HOOK_MAP = {
  "pre-commit": {
    configKey: "preCommit",
    run: runPreCommit,
  },
  "commit-msg": {
    configKey: "commitMsg",
    run: runCommitMsg,
  },
  "pre-push": {
    configKey: "prePush",
    run: runPrePush,
  },
  "post-checkout": {
    configKey: "postCheckout",
    run: runPostCheckout,
  },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const hookName = process.argv[2];
  const hookArgs = process.argv.slice(3);

  if (!hookName || !HOOK_MAP[hookName]) {
    log.error(
      `Unknown hook: "${hookName}". Expected one of: ${Object.keys(HOOK_MAP).join(", ")}`,
    );
    process.exit(1);
  }

  const config = loadConfig();
  const entry = HOOK_MAP[hookName];
  const hookConfig = config.hooks?.[entry.configKey];

  // Global kill-switch: if the hook section is missing or disabled, skip.
  if (!hookConfig || hookConfig.enabled === false) {
    log.dim(`[hook-runner] ${hookName} is disabled in config - skipping`);
    process.exit(0);
  }

  try {
    await entry.run(config, hookConfig, hookArgs);
  } catch (err) {
    log.error(`${hookName} hook failed: ${err.message}`);
    // post-checkout is advisory - never block checkout
    if (hookName === "post-checkout") {
      process.exit(0);
    }
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Hook handlers
// ---------------------------------------------------------------------------

async function runPreCommit(config, hookConfig) {
  log.dim("[pre-commit]");

  // 1. Lint-staged (ESLint + Prettier on staged files only)
  if (hookConfig.lintStaged) {
    log.info("Running lint-staged...");
    execSync("pnpm exec lint-staged", { stdio: "inherit" });
    log.success("✓ lint-staged passed");
  } else {
    log.dim("[pre-commit] lintStaged disabled - skipping");
  }

  // 2. TypeScript type check (if enabled)
  if (hookConfig.typeCheck) {
    log.info("Running TypeScript type check...");
    try {
      execSync("pnpm exec tsc --noEmit", { stdio: "inherit" });
      log.success("✓ Type check passed");
    } catch (err) {
      log.error("Type check failed");
      throw err;
    }
  }

  // 3. Run unit tests (if enabled)
  if (hookConfig.runTests) {
    log.info("Running unit tests...");
    try {
      // Check if test:unit script exists
      const pkgPath = path.join(process.cwd(), "package.json");
      let testCmd = "pnpm exec vitest run";

      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg.scripts?.["test:unit"]) {
          testCmd = "pnpm run test:unit";
        }
      }

      execSync(testCmd, { stdio: "inherit" });
      log.success("✓ Tests passed");
    } catch (err) {
      log.error("Tests failed");
      throw err;
    }
  }
}

async function runCommitMsg(config, hookConfig, args) {
  const msgFile = args[0];
  if (!msgFile) {
    log.error("commit-msg hook requires a message file argument");
    process.exit(1);
  }

  log.dim("[commit-msg]");

  // Delegate to the dedicated validator
  const validatorPath = path.join(__dirname, "validate-commit-msg.cjs");
  execSync(`node "${validatorPath}" "${msgFile}"`, {
    stdio: "inherit",
    env: {
      ...process.env,
      // Pass config values so the validator doesn't need to re-read config
      TOOLKIT_REQUIRE_TICKET: hookConfig.requireTicket ? "1" : "0",
      TOOLKIT_TICKET_PATTERN: config.jira?.ticketPattern || "",
    },
  });
}

async function runPrePush(config, hookConfig) {
  log.dim("[pre-push]");

  if (hookConfig.validateBranch) {
    const validatorPath = path.join(__dirname, "validate-branch.cjs");
    execSync(`node "${validatorPath}"`, {
      stdio: "inherit",
      env: {
        ...process.env,
        TOOLKIT_BRANCH_PATTERN: config.jira?.branchPattern || "",
        TOOLKIT_ALLOWED_BRANCHES: (config.jira?.allowedBranches || []).join(
          ",",
        ),
      },
    });
  } else {
    log.dim("[pre-push] branch validation disabled - skipping");
  }
}

async function runPostCheckout(config, hookConfig) {
  log.dim("[post-checkout]");

  log.dim("[post-checkout] branch tracking disabled - skipping");
}

// ---------------------------------------------------------------------------

main().catch((err) => {
  log.error(`hook-runner failed: ${err.message}`);
  process.exit(1);
});
