#!/usr/bin/env node

/**
 * Generates an AI code review prompt from the current git diff.
 *
 * Usage: node ai-review-prompt.js [--output <file>] [--clipboard]
 *
 * Produces a structured markdown prompt that can be pasted into
 * Claude Code, Claude.ai, Cursor, or any AI coding assistant.
 */

const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const { loadConfig } = require("../lib/load-config.cjs");
const log = require("../lib/log.cjs");

const MAX_DIFF_LINES = 500;

function getGitData() {
  const branch = execSync("git symbolic-ref --short HEAD", {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();

  const changedFiles = execSync("git diff --cached --name-only", {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  })
    .trim()
    .split("\n")
    .filter(Boolean);

  // Fall back to unstaged diff if nothing is staged
  const diffTarget = changedFiles.length > 0 ? "--cached" : "HEAD~1";
  let diff;
  try {
    diff = execSync(`git diff ${diffTarget}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 5,
    });
  } catch {
    diff = "(diff too large or unavailable)";
  }

  const files =
    changedFiles.length > 0
      ? changedFiles
      : execSync(`git diff --name-only ${diffTarget}`, {
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
        })
          .trim()
          .split("\n")
          .filter(Boolean);

  return { branch, files, diff };
}

async function findSpecFile(ticketKey) {
  const searchPaths = [
    `specs/tasks/${ticketKey}.md`,
    `docs/tasks/${ticketKey}.md`,
    `tasks/${ticketKey}.md`,
    `${ticketKey}.md`,
  ];

  for (const p of searchPaths) {
    const full = path.join(process.cwd(), p);
    if (fs.existsSync(full)) return fs.readFileSync(full, "utf8");
  }

  // Fall back to MCP server when CE_PROJECT_KEY is set
  const projectKey = process.env.CE_PROJECT_KEY;
  if (projectKey) {
    const port = process.env.CE_SERVER_PORT || "2899";
    const url = `http://127.0.0.1:${port}/task-specs/${projectKey}/${ticketKey}`;
    try {
      const helper = path.join(
        __dirname,
        "../lib/fetch-project-config-http.cjs",
      );
      const content = execFileSync(process.execPath, [helper, url], {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        env: process.env,
      });
      if (content) return content;
    } catch {
      // server unreachable or spec not found - continue without spec
    }
  }

  return null;
}

async function buildPrompt(config, gitData) {
  const ticketPattern = config.jira?.ticketPattern || "[A-Z][A-Z0-9]+-[0-9]+";
  const ticketMatch = gitData.branch.match(new RegExp(ticketPattern));
  const ticket = ticketMatch ? ticketMatch[0] : null;
  const spec = ticket ? await findSpecFile(ticket) : null;

  const diffLines = gitData.diff.split("\n");
  const truncated = diffLines.length > MAX_DIFF_LINES;
  const diffPreview = truncated
    ? diffLines.slice(0, MAX_DIFF_LINES).join("\n") + "\n\n... (truncated)"
    : gitData.diff;

  let prompt = `# Code Review Request\n\n`;

  if (ticket) {
    prompt += `**Ticket**: ${ticket}\n`;
    prompt += `**Branch**: ${gitData.branch}\n\n`;
  }

  prompt += `## Changed Files\n\n`;
  for (const f of gitData.files) {
    prompt += `- ${f}\n`;
  }

  if (spec) {
    prompt += `\n## Spec / Acceptance Criteria\n\n${spec}\n`;
  }

  prompt += `\n## Diff\n\n\`\`\`diff\n${diffPreview}\n\`\`\`\n`;

  prompt += `\n## Review Instructions\n\n`;
  prompt += `Please review the above changes for:\n\n`;
  prompt += `1. **Spec Compliance** - Do the changes satisfy the acceptance criteria?\n`;
  prompt += `2. **Code Quality** - Clean, readable, follows project conventions?\n`;
  prompt += `3. **Security** - Any vulnerabilities (XSS, injection, auth issues)?\n`;
  prompt += `4. **Testing** - Are changes adequately tested?\n`;
  prompt += `5. **Edge Cases** - Missing null checks, error handling, boundary conditions?\n`;

  prompt += `\n### Response Format\n\n`;
  prompt += `- **Pass / Needs Changes**\n`;
  prompt += `- What's good\n`;
  prompt += `- Issues (if any)\n`;
  prompt += `- Suggestions\n`;

  return prompt;
}

async function main() {
  const args = process.argv.slice(2);
  const outputIdx = args.indexOf("--output");
  const outputFile =
    outputIdx !== -1 ? args[outputIdx + 1] : ".ai-review-prompt.md";
  const useClipboard = args.includes("--clipboard");

  const config = loadConfig();

  let gitData;
  try {
    gitData = getGitData();
  } catch (err) {
    log.error(`Failed to read git data: ${err.message}`);
    process.exit(1);
  }

  if (gitData.files.length === 0) {
    log.warn("No changed files found. Stage changes or make commits first.");
    process.exit(0);
  }

  const prompt = await buildPrompt(config, gitData);

  // Write to file
  const outPath = path.resolve(process.cwd(), outputFile);
  fs.writeFileSync(outPath, prompt, "utf8");
  log.success(`Review prompt saved to ${outputFile}`);

  // Optionally copy to clipboard
  if (useClipboard) {
    try {
      const clipCmd =
        process.platform === "darwin"
          ? "pbcopy"
          : process.platform === "win32"
            ? "clip"
            : "xclip -selection clipboard";
      execSync(clipCmd, { input: prompt, stdio: ["pipe", "pipe", "pipe"] });
      log.success("Copied to clipboard");
    } catch {
      log.dim(
        "Could not copy to clipboard - install xclip or use the file instead.",
      );
    }
  }

  log.info(`Use with: claude < ${outputFile}`);
}

main().catch((err) => {
  log.error(`AI review prompt failed: ${err.message}`);
  process.exit(1);
});
