#!/usr/bin/env node

/**
 * Branch name validator.
 * Called by hook-runner during pre-push.
 *
 * Validates the current branch name against the configured pattern.
 * Protected branches (main, develop, etc.) always pass.
 */

const { execSync } = require("child_process");
const { loadConfig } = require("../lib/load-config.cjs");
const log = require("../lib/log.cjs");

function getBranch() {
  try {
    return execSync("git symbolic-ref --short HEAD", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null; // detached HEAD
  }
}

function main() {
  const config = loadConfig();

  const branchPattern =
    process.env.TOOLKIT_BRANCH_PATTERN || config.jira?.branchPattern || "";
  const allowedBranches = process.env.TOOLKIT_ALLOWED_BRANCHES
    ? process.env.TOOLKIT_ALLOWED_BRANCHES.split(",").filter(Boolean)
    : config.jira?.allowedBranches || ["main", "develop", "staging"];

  const branch = getBranch();

  if (!branch) {
    log.dim("Detached HEAD - skipping branch validation");
    process.exit(0);
  }

  // Protected branches always pass
  if (allowedBranches.includes(branch)) {
    log.success(`Branch "${branch}" is a protected branch - OK`);
    process.exit(0);
  }

  // No pattern configured - nothing to enforce
  if (!branchPattern) {
    log.dim("No branch pattern configured - skipping validation");
    process.exit(0);
  }

  const regex = new RegExp(branchPattern);
  if (regex.test(branch)) {
    log.success(`Branch "${branch}" matches pattern - OK`);
    process.exit(0);
  }

  log.error(`Branch name "${branch}" does not match required pattern.`);
  log.info(`Expected pattern: ${branchPattern}`);
  log.info("Examples:");
  log.info("  feature/TASK-123-add-login");
  log.info("  bugfix/TASK-456-fix-header");
  log.info("  chore/TASK-789-update-deps");
  process.exit(1);
}

main();
