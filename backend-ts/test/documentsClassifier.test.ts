import { describe, expect, test } from "vitest";
import {
  EXPENSE_CATEGORIES,
  classifyByKeywords,
  classifyFilename
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
});