#!/usr/bin/env node

/**
 * Commit message validator.
 * Called by hook-runner during commit-msg.
 *
 * Ensures the commit message contains a ticket reference.
 * Merge and revert commits are always allowed.
 */

const fs = require("fs");
const { execSync } = require("child_process");
const { loadConfig } = require("../lib/load-config.cjs");
const log = require("../lib/log.cjs");

function main() {
  const msgFile = process.argv[2];
  if (!msgFile) {
    log.error("Usage: validate-commit-msg.js <COMMIT_MSG_FILE>");
    process.exit(1);
  }

  const message = fs.readFileSync(msgFile, "utf8").trim();
  if (!message) {
    log.error("Commit message is empty.");
    process.exit(1);
  }

  // Always allow merge/revert commits
  if (
    /^Merge (branch|pull request|remote)/.test(message) ||
    /^Revert /.test(message)
  ) {
    process.exit(0);
  }

  const config = loadConfig();
  const requireTicket =
    process.env.TOOLKIT_REQUIRE_TICKET !== undefined
      ? process.env.TOOLKIT_REQUIRE_TICKET === "1"
      : config.hooks?.commitMsg?.requireTicket !== false;

  if (!requireTicket) {
    log.dim("Ticket requirement disabled - skipping");
    process.exit(0);
  }

  const ticketPattern =
    process.env.TOOLKIT_TICKET_PATTERN ||
    config.jira?.ticketPattern ||
    "[A-Z][A-Z0-9]+-[0-9]+";
  const regex = new RegExp(ticketPattern);

  if (regex.test(message)) {
    log.success("Commit message contains ticket reference - OK");
    process.exit(0);
  }

  // Try to help: extract ticket from branch name
  let branchTicket = "";
  try {
    const branch = execSync("git symbolic-ref --short HEAD", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const match = branch.match(regex);
    if (match) branchTicket = match[0];
  } catch {
    // ignore
  }

  log.error("Commit message must include a ticket reference.");
  log.info("Valid formats:");
  log.info("  [TASK-123] Your message here");
  log.info("  TASK-123: Your message here");
  if (branchTicket) {
    log.info(`\nHint: your branch contains ticket ${branchTicket}. Try:`);
    log.info(`  git commit -m "[${branchTicket}] Your message"`);
  }
  process.exit(1);
}

main();
