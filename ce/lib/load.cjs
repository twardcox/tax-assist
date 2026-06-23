#!/usr/bin/env node

/**
 * Chalk-based logging for CE development scripts.
 * Uses chalk when available; falls back to plain output.
 */

const passthrough = (s) => s;

let chalk;
try {
  const mod = require("chalk");
  // Chalk 5 is ESM; CJS interop exposes the callable on `default`
  chalk = mod?.default ?? mod;
} catch {
  chalk = {
    dim: passthrough,
    blue: passthrough,
    green: passthrough,
    yellow: passthrough,
    red: passthrough,
  };
}

module.exports = {
  dim: (msg) => console.log(chalk.dim(msg)),
  info: (msg) => console.log(chalk.blue(msg)),
  success: (msg) => console.log(chalk.green(msg)),
  warn: (msg) => console.warn(chalk.yellow(msg)),
  error: (msg) => console.error(chalk.red(msg)),
};
