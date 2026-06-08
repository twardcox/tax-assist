import { describe, expect, test } from "vitest";
import {
  anthropicApiErrorResult,
  genericExtractionErrorResult,
  missingAnthropicPackageResult,
  missingApiKeyResult,
  parseAiResponseText
} from "../src/domain/documents/aiResponse";

describe("documents AI response parity", () => {
  test("parses json object embedded in model text", () => {
    const result = parseAiResponseText(`Here you go:\n{\n  "document_type": "receipt",\n  "deductible_pct": 1.5\n}`);
    expect(result.document_type).toBe("receipt");
    expect(result.deductible_pct).toBe(1);
    expect(result.suggested_updates).toEqual([]);
    expect(result.benefit_ids).toEqual([]);
    expect(result.form_line).toBeNull();
  });

  test("returns parse failure payload when no json object exists", () => {
    expect(parseAiResponseText("not json response")).toEqual({
      error: "Could not parse AI response",
      suggested_updates: [],
      confidence: "low",
      notes: "not json response",
      benefit_ids: [],
      deductible_pct: 1,
      form_line: null
    });
  });

  test("returns parse failure payload when json is invalid", () => {
    const result = parseAiResponseText('{"document_type": "receipt", }');
    expect(result.error).toContain("Could not parse AI response:");
    expect(result.confidence).toBe("low");
    expect(result.deductible_pct).toBe(1);
  });

  test("provides missing dependency and auth failure payloads", () => {
    expect(missingApiKeyResult()).toEqual({
      error: "ANTHROPIC_API_KEY not set",
      suggested_updates: [],
      confidence: "low",
      notes: "Set ANTHROPIC_API_KEY to enable AI extraction.",
      benefit_ids: [],
      deductible_pct: 1,
      form_line: null
    });

    expect(missingAnthropicPackageResult()).toEqual({
      error: "anthropic package not installed",
      suggested_updates: [],
      confidence: "low",
      notes: "Run: npm install anthropic",
      benefit_ids: [],
      deductible_pct: 1,
      form_line: null
    });
  });

  test("formats anthropic api and generic errors like python", () => {
    expect(anthropicApiErrorResult("bad request", 400, "bad-model")).toEqual({
      error: "bad request",
      suggested_updates: [],
      confidence: "low",
      notes: "Model 'bad-model' was rejected by the API. Set the CLAUDE_MODEL environment variable to a valid model ID.",
      benefit_ids: [],
      deductible_pct: 1,
      form_line: null
    });

    expect(genericExtractionErrorResult("boom")).toEqual({
      error: "boom",
      suggested_updates: [],
      confidence: "low",
      notes: "Extraction failed — see error.",
      benefit_ids: [],
      deductible_pct: 1,
      form_line: null
    });
  });
});