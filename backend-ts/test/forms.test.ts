import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { describe, expect, test } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");
const formsDir = path.join(repoRoot, "forms");

function loadForms(filename: string): Array<Record<string, unknown>> {
  const filePath = path.join(formsDir, filename);
  const parsed = yaml.load(fs.readFileSync(filePath, "utf8")) as Record<string, unknown> | null;
  const forms = (parsed ?? {}).forms;
  return Array.isArray(forms) ? (forms as Array<Record<string, unknown>>) : [];
}

describe("forms parity", () => {
  test("federal forms file exists", () => {
    expect(fs.existsSync(path.join(formsDir, "federal_forms.yaml"))).toBe(true);
  });

  test("federal forms registry is a list", () => {
    const forms = loadForms("federal_forms.yaml");
    expect(Array.isArray(forms)).toBe(true);
  });

  test("all forms include required fields", () => {
    const forms = loadForms("federal_forms.yaml");
    const requiredFields = ["form_number", "form_name", "jurisdiction", "deadline"];

    for (const form of forms) {
      for (const field of requiredFields) {
        expect(Object.prototype.hasOwnProperty.call(form, field)).toBe(true);
      }
    }
  });

  test("all forms expose related_benefits as a list", () => {
    const forms = loadForms("federal_forms.yaml");

    for (const form of forms) {
      const related = form.related_benefits ?? [];
      expect(Array.isArray(related)).toBe(true);
    }
  });

  test("form numbers are unique", () => {
    const forms = loadForms("federal_forms.yaml");
    const numbers = forms.map((form) => String(form.form_number ?? ""));
    expect(numbers.length).toBe(new Set(numbers).size);
  });

  test("key forms are present", () => {
    const forms = loadForms("federal_forms.yaml");
    const numbers = new Set(forms.map((form) => String(form.form_number ?? "")));
    const expected = new Set([
      "Schedule C",
      "Form 4562",
      "Form 8995",
      "Form 2553",
      "Form 8824",
      "Form 8582",
      "Form 8889",
      "Form 8829"
    ]);

    for (const formNumber of expected) {
      expect(numbers.has(formNumber)).toBe(true);
    }
  });

  test("jurisdictions are valid", () => {
    const forms = loadForms("federal_forms.yaml");
    const valid = new Set(["federal", "state", "local"]);

    for (const form of forms) {
      expect(valid.has(String(form.jurisdiction ?? ""))).toBe(true);
    }
  });

  test("state forms file exists", () => {
    expect(fs.existsSync(path.join(formsDir, "state_forms.yaml"))).toBe(true);
  });

  test("local forms file exists", () => {
    expect(fs.existsSync(path.join(formsDir, "local_forms.yaml"))).toBe(true);
  });
});
