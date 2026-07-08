#!/usr/bin/env node

/**
 * Package-manager detection for CE scripts.
 *
 * The bundle is project-independent: nothing may assume pnpm (or any other
 * package manager). Detection is by lockfile in the working directory, walking
 * up to the git root so scripts invoked from subfolders still resolve.
 */

const fs = require("fs");
const path = require("path");

const LOCKFILES = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
  ["package-lock.json", "npm"],
];

/** Detect the package manager for `cwd` (default: process.cwd()). */
function detectPackageManager(cwd = process.cwd()) {
  let dir = cwd;
  for (let i = 0; i < 20; i++) {
    for (const [lockfile, pm] of LOCKFILES) {
      if (fs.existsSync(path.join(dir, lockfile))) return pm;
    }
    // Stop at a repo root even if no lockfile was found there
    if (fs.existsSync(path.join(dir, ".git"))) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return "npm";
}

/** Command prefix for running a package.json script, e.g. "npm run". */
function runCmd(pm = detectPackageManager()) {
  return `${pm} run`;
}

/** Command prefix for executing a local binary, e.g. "npx" / "pnpm exec". */
function execCmd(pm = detectPackageManager()) {
  if (pm === "npm") return "npx";
  if (pm === "yarn") return "yarn";
  if (pm === "bun") return "bunx";
  return `${pm} exec`;
}

module.exports = { detectPackageManager, runCmd, execCmd };
