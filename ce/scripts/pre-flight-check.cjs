#!/usr/bin/env node

/**
 * Pre-flight check script
 *
 * Runs all local validation checks before committing:
 * - ESLint (linting)
 * - Prettier (formatting)
 * - TypeScript (type checking)
 * - Vitest (unit tests)
 *
 * Usage:
 *   node .ce/scripts/pre-flight-check.cjs
 *   pnpm run pre-flight
 */

const { execSync } = require("child_process");
const path = require("path");
const { loadConfig } = require("../lib/load-config.cjs");
const log = require("../lib/log.cjs");
const { detectPackageManager, runCmd, execCmd } = require("../lib/pm.cjs");

async function runPreFlight() {
  console.log("\n🚀 Running pre-flight checks...\n");

  const config = loadConfig();
  const framework = detectFramework();
  const pm = detectPackageManager();

  const checks = [];

  // 1. ESLint
  if (config.ci?.linting !== false) {
    if (framework === "nextjs" || hasScript("lint")) {
      checks.push({
        name: "ESLint",
        cmd: `${runCmd(pm)} lint`,
        emoji: "🔍",
      });
    } else {
      checks.push({
        name: "ESLint",
        cmd: `${execCmd(pm)} eslint .`,
        emoji: "🔍",
      });
    }
  }

  // 2. Prettier
  if (config.ci?.formatting !== false) {
    checks.push({
      name: "Prettier",
      cmd: `${execCmd(pm)} prettier --check .`,
      emoji: "💅",
    });
  }

  // 3. TypeScript
  if (config.ci?.typeCheck !== false) {
    checks.push({
      name: "TypeScript",
      cmd: `${execCmd(pm)} tsc --noEmit`,
      emoji: "📘",
    });
  }

  // 4. Unit tests
  if (config.ci?.unitTests !== false) {
    const testCmd = hasScript("test:unit")
      ? `${runCmd(pm)} test:unit`
      : hasScript("test")
        ? `${runCmd(pm)} test`
        : `${execCmd(pm)} vitest run`;
    checks.push({
      name: "Unit tests",
      cmd: testCmd,
      emoji: "🧪",
    });
  }

  let failed = false;

  for (const check of checks) {
    try {
      log.info(`${check.emoji} ${check.name}...`);
      execSync(check.cmd, { stdio: "pipe", encoding: "utf8" });
      log.success(`  ✓ ${check.name} passed`);
    } catch (err) {
      log.error(`  ✗ ${check.name} failed`);
      if (err.stdout) console.log(err.stdout);
      if (err.stderr) console.error(err.stderr);
      failed = true;
    }
  }

  console.log("");

  if (failed) {
    log.error("❌ Pre-flight checks failed");
    log.info("\nFix the issues above and try again.\n");
    process.exit(1);
  }

  log.success("✅ All pre-flight checks passed!");
  log.info("\n📋 Next steps:");
  log.info("  1. Stage your changes: git add .");
  log.info(
    `  2. (Optional) Run AI review: node ce/scripts/ai-review-prompt.cjs`,
  );
  log.info('  3. Commit: git commit -m "Your message"\n');
}

function detectFramework() {
  const fs = require("fs");
  const pkgPath = path.join(process.cwd(), "package.json");

  if (!fs.existsSync(pkgPath)) return "node";

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  if (pkg.dependencies?.next || pkg.devDependencies?.next) {
    return "nextjs";
  }
  if (pkg.dependencies?.vite || pkg.devDependencies?.vite) {
    return "vite";
  }
  return "node";
}

function hasScript(scriptName) {
  const fs = require("fs");
  const pkgPath = path.join(process.cwd(), "package.json");

  if (!fs.existsSync(pkgPath)) return false;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  return pkg.scripts && pkg.scripts[scriptName];
}

runPreFlight().catch((err) => {
  log.error(`Pre-flight check failed: ${err.message}`);
  process.exit(1);
});
