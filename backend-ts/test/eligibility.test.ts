import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { beforeAll, describe, expect, test } from "vitest";
import { initDb } from "../src/db/init";
import { loadBenefitLibrary } from "../src/domain/scanner/benefitLoader";
import { runScan } from "../src/domain/scanner/scan";
import { UserFacts } from "../src/domain/scanner/userFacts";

const repoRoot = path.resolve(process.cwd(), "..");
const userDataDir = path.join(repoRoot, "user_data");

beforeAll(async () => {
  await initDb();
});

describe("eligibility parity", () => {
  test("all user data yaml files are parseable", () => {
    for (const filename of fs.readdirSync(userDataDir)) {
      if (!filename.endsWith(".yaml")) {
        continue;
      }

      const filePath = path.join(userDataDir, filename);
      const data = yaml.load(fs.readFileSync(filePath, "utf8"));
      expect(data === null || typeof data === "object").toBe(true);
    }
  });

  test("benefit library loads a non-empty set of benefits", () => {
    const library = loadBenefitLibrary();

    expect(library.length).toBeGreaterThan(0);
    expect(library.some((benefit) => benefit.id === "home-office-deduction")).toBe(true);
  });

  test("missing user facts behave like blank eligibility input", async () => {
    const facts = await UserFacts.fromUserSections("missing-user", 2025);

    expect(facts.hasSelfEmployment()).toBe(false);
    expect(facts.hasRentalProperty()).toBe(false);
    expect(facts.hasAnyRealEstate()).toBe(false);
  });

  test("scanner runs against blank user sections without error", async () => {
    const scan = await runScan(2025, "missing-user");

    expect(scan.results.length).toBeLessThanOrEqual(loadBenefitLibrary().length);
    expect(scan.results.every((r) => r.status !== "unknown")).toBe(true);
    expect(scan.counts.eligible_now).toBe(0);
  });
});
