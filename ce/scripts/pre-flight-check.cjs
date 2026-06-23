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

async function runPreFlight() {
  console.log("\n🚀 Running pre-flight checks...\n");

  const config = loadConfig();
  const framework = detectFramework();

  const checks = [];

  // 1. ESLint
  if (config.ci?.linting !== false) {
    if (framework === "nextjs") {
      checks.push({
        name: "ESLint (Next.js)",
        cmd: "pnpm run lint",
        emoji: "🔍",
      });
    } else {
      checks.push({ name: "ESLint", cmd: "pnpm exec eslint .", emoji: "🔍" });
    }
  }

  // 2. Prettier
  if (config.ci?.formatting !== false) {
    checks.push({
      name: "Prettier",
      cmd: "pnpm exec prettier --check .",
      emoji: "💅",
    });
  }

  // 3. TypeScript
  if (config.ci?.typeCheck !== false) {
    checks.push({
      name: "TypeScript",
      cmd: "pnpm exec tsc --noEmit",
      emoji: "📘",
    });
  }

  // 4. Vitest
  if (config.ci?.unitTests !== false) {
    const testCmd = hasScript("test:unit")
      ? "pnpm run test:unit"
      : "pnpm exec vitest run";
    checks.push({
      name: "Vitest",
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
  log.info("  2. (Optional) Run AI review: pnpm run ai:review");
  log.info('  3. Commit: git commit -m "YOUR-123: Your message"\n');
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
