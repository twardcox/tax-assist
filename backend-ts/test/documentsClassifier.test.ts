import { describe, expect, test } from "vitest";
import {
  EXPENSE_CATEGORIES,
  classifyByKeywords,
  classifyFilename,
  inferDocumentType,
  inferExtractionFromFilename
} from "../src/domain/documents/classifier";

describe("documents classifier parity", () => {
  test("classifies income forms from filename keywords", () => {
    expect(classifyFilename("2025-w2-acme.pdf", 1234)).toEqual({
      file: "2025-w2-acme.pdf",
      file_id: null,
      category: "income_document",
      confidence: "medium",
      size: 1234,
      note: "Detected as income form. Use 'Extract with AI' for box-level data."
    });
  });

  test("classifies charitable receipts by filename keywords", () => {
    const result = classifyFilename("church-donation-receipt.pdf", 200);
    expect(result.category).toBe(EXPENSE_CATEGORIES.CHARITABLE);
    expect(result.confidence).toBe("medium");
    expect(result.note).toContain("Classified from filename");
  });

  test("classifies medical documents by filename keywords", () => {
    const result = classifyFilename("urgent-care-copay.png");
    expect(result.category).toBe(EXPENSE_CATEGORIES.MEDICAL);
  });

  test("falls back to needs_review when no keywords match", () => {
    expect(classifyFilename("random-upload.pdf")).toEqual({
      file: "random-upload.pdf",
      file_id: null,
      category: EXPENSE_CATEGORIES.NEEDS_REVIEW,
      confidence: "low",
      size: 0,
      note: "Could not classify from filename — add a description or review manually."
    });
  });

  test("keyword classifier prefers first matching category", () => {
    expect(classifyByKeywords("office supplies subscription")).toBe(EXPENSE_CATEGORIES.BUSINESS_EXPENSE);
  });

  test("infers specific income-form document types from filename", () => {
    expect(inferDocumentType("2025-1099-int-broker.pdf")).toBe("1099_int");
    expect(inferDocumentType("ssa-1099-benefits.pdf")).toBe("ssa1099");
    expect(inferDocumentType("mileage-log-jan.csv")).toBe("mileage_log");
  });

  test("builds deterministic extraction hints for income forms", () => {
    expect(inferExtractionFromFilename("2025-1099-int-broker.pdf")).toEqual({
      document_type: "1099_int",
      tax_category: "interest_income",
      form_line: "Schedule B / Form 1040 Line 2b",
      deductible_pct: 1,
      notes: "Detected as income form. Use 'Extract with AI' for box-level data."
    });
  });

  test("builds deterministic extraction hints for mileage logs", () => {
    expect(inferExtractionFromFilename("mileage-log-jan.csv")).toEqual({
      document_type: "mileage_log",
      tax_category: EXPENSE_CATEGORIES.BUSINESS_EXPENSE,
      form_line: "Schedule C Line 28 (other expenses)",
      deductible_pct: 1,
      notes: "Mileage log detected from filename."
    });
  });
});