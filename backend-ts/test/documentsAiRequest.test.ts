import { describe, expect, test } from "vitest";
import { buildAiExtractionRequest, unsupportedExtractionResult } from "../src/domain/documents/aiRequest";

describe("documents AI request builder parity", () => {
  test("builds csv text-only request and mileage prompt from content preview", () => {
    const content = Buffer.from("date,odometer,destination,miles\n2025-01-01,1200,Client Office,42\n");
    const request = buildAiExtractionRequest(content, "trip-log.csv");

    expect(request).not.toBeNull();
    expect(request?.messages[0]?.content).toHaveLength(1);
    const textBlock = request?.messages[0]?.content[0];
    expect(textBlock?.type).toBe("text");
    expect((textBlock as { text: string }).text).toContain("Mileage log");
    expect((textBlock as { text: string }).text).toContain("Document content (CSV)");
  });

  test("builds pdf document request", () => {
    const request = buildAiExtractionRequest(Buffer.from("pdf-bytes"), "w2.pdf");
    expect(request?.messages[0]?.content[1]).toMatchObject({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf"
      }
    });
  });

  test("builds jpeg image request", () => {
    const request = buildAiExtractionRequest(Buffer.from("jpeg-bytes"), "receipt.jpg");
    expect(request?.messages[0]?.content[1]).toMatchObject({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg"
      }
    });
  });

  test("builds png image request", () => {
    const request = buildAiExtractionRequest(Buffer.from("png-bytes"), "receipt.png");
    expect(request?.messages[0]?.content[1]).toMatchObject({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png"
      }
    });
  });

  test("unsupported file types return null builder result and helper payload", () => {
    expect(buildAiExtractionRequest(Buffer.from("heic"), "photo.heic")).toBeNull();
    expect(unsupportedExtractionResult(".heic")).toEqual({
      document_type: "other",
      tax_category: "needs_review",
      suggested_updates: [],
      confidence: "low",
      benefit_ids: [],
      deductible_pct: 1,
      notes: "File type '.heic' is not supported for AI extraction. Convert to PDF, JPG, or PNG."
    });
  });
});