import { describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

// Guards real financial data in a public repo: user_data/private/ and backups/ must stay gitignored.
describe("private data locations are gitignored", () => {
  test("git check-ignore passes for files under user_data/private/ and backups/", () => {
    const repoRoot = path.resolve(__dirname, "..", "..");
    // check-ignore exits 0 if ignored, 1 if not — execFileSync throws on non-zero
    const out = execFileSync(
      "git",
      [
        "check-ignore",
        "user_data/private/anyfile",
        "user_data/private/books/anyfile.csv",
        "backups/utbis-2026-01-01-0000.dump"
      ],
      { cwd: repoRoot, encoding: "utf8" }
    );
    expect(out).toContain("user_data/private/anyfile");
    expect(out).toContain("backups/");
  });
});
