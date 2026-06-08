import { describe, expect, test } from "vitest";
import { inferExtractionFromUpload, pickPromptKind } from "../src/domain/documents/extraction";

describe("documents extraction routing parity", () => {
  test("routes income forms by filename", () => {
    const content = Buffer.from("placeholder");
    expect(pickPromptKind("2025-1099-int-broker.pdf", content)).toBe("income_form");
  });

  test("routes mileage logs by csv content preview", () => {
    const content = Buffer.from("date,odometer,destination,miles\n2025-01-01,1200,Client Office,42\n");
    expect(pickPromptKind("trip-log.csv", content)).toBe("mileage");
  });

  test("infers mileage extraction from csv content even without mileage in filename", () => {
    const content = Buffer.from("date,odometer,destination,miles\n2025-01-01,1200,Client Office,42\n");
    expect(inferExtractionFromUpload("trip-log.csv", content)).toEqual({
      document_type: "mileage_log",
      tax_category: "business_expense",
      form_line: "Schedule C Line 9 (car and truck expenses)",
      deductible_pct: 1,
      notes: "Mileage log detected from filename or CSV content."
    });
  });
});