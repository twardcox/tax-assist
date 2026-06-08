import { beforeEach, describe, expect, test } from "vitest";
import { extractWithAiBytes } from "../src/domain/documents/aiExecutor";

describe("documents AI executor parity", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUDE_MODEL;
  });

  test("returns missing key payload when anthropic key is absent", async () => {
    await expect(extractWithAiBytes(Buffer.from("pdf"), "receipt.pdf")).resolves.toEqual({
      error: "ANTHROPIC_API_KEY not set",
      suggested_updates: [],
      confidence: "low",
      notes: "Set ANTHROPIC_API_KEY to enable AI extraction.",
      benefit_ids: [],
      deductible_pct: 1,
      form_line: null
    });
  });

  test("returns unsupported result before loading sdk", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    const result = await extractWithAiBytes(Buffer.from("heic"), "receipt.heic", {
      loadSdk: async () => {
        throw new Error("sdk should not load");
      }
    });

    expect(result).toEqual({
      document_type: "other",
      tax_category: "needs_review",
      suggested_updates: [],
      confidence: "low",
      benefit_ids: [],
      deductible_pct: 1,
      notes: "File type '.heic' is not supported for AI extraction. Convert to PDF, JPG, or PNG."
    });
  });

  test("parses json text from sdk response", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    const result = await extractWithAiBytes(Buffer.from("pdf-bytes"), "office-supplies-receipt.pdf", {
      loadSdk: async () => ({ Anthropic: class { messages = { create: async () => ({ content: [{ text: '{"document_type":"receipt","tax_category":"business_expense","deductible_pct":1.2}' }] }) }; } }),
      createClient: (sdk) => new sdk.Anthropic({ apiKey: "test-key" })
    });

    expect(result).toMatchObject({
      document_type: "receipt",
      tax_category: "business_expense",
      deductible_pct: 1,
      suggested_updates: [],
      benefit_ids: []
    });
  });

  test("formats api errors with model guidance", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.CLAUDE_MODEL = "bad-model";

    class FakeApiError extends Error {
      status = 400;
    }

    const result = await extractWithAiBytes(Buffer.from("pdf-bytes"), "w2.pdf", {
      loadSdk: async () => ({ Anthropic: class { messages = { create: async () => { throw new FakeApiError("bad request"); } }; }, APIError: FakeApiError }),
      createClient: (sdk) => new sdk.Anthropic({ apiKey: "test-key" })
    });

    expect(result).toEqual({
      error: "bad request",
      suggested_updates: [],
      confidence: "low",
      notes: "Model 'bad-model' was rejected by the API. Set the CLAUDE_MODEL environment variable to a valid model ID.",
      benefit_ids: [],
      deductible_pct: 1,
      form_line: null
    });
  });
});