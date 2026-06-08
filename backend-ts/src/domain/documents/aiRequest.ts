import { env } from "../../config/env";
import { pickPromptKind } from "./extraction";
import { INCOME_FORM_PROMPT, MILEAGE_PROMPT, RECEIPT_PROMPT } from "./prompts";

type AnthropicTextBlock = {
  type: "text";
  text: string;
};

type AnthropicBinarySource = {
  type: "base64";
  media_type: "application/pdf" | "image/jpeg" | "image/png";
  data: string;
};

type AnthropicDocumentBlock = {
  type: "document";
  source: AnthropicBinarySource;
};

type AnthropicImageBlock = {
  type: "image";
  source: AnthropicBinarySource;
};

export type AnthropicContentBlock = AnthropicTextBlock | AnthropicDocumentBlock | AnthropicImageBlock;

export type AiExtractionRequest = {
  model: string;
  max_tokens: number;
  messages: Array<{
    role: "user";
    content: AnthropicContentBlock[];
  }>;
};

export function unsupportedExtractionResult(suffix: string): Record<string, unknown> {
  return {
    document_type: "other",
    tax_category: "needs_review",
    suggested_updates: [],
    confidence: "low",
    benefit_ids: [],
    deductible_pct: 1.0,
    notes: `File type '${suffix}' is not supported for AI extraction. Convert to PDF, JPG, or PNG.`
  };
}

function promptFor(filename: string, content: Buffer): string {
  const kind = pickPromptKind(filename, content);
  if (kind === "mileage") {
    return MILEAGE_PROMPT;
  }
  if (kind === "income_form") {
    return INCOME_FORM_PROMPT;
  }
  return RECEIPT_PROMPT;
}

export function buildAiExtractionRequest(content: Buffer, filename: string): AiExtractionRequest | null {
  const suffix = filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  const prompt = promptFor(filename, content);
  const model = env.CLAUDE_MODEL ?? "claude-haiku-4-5-20251001";

  if (suffix === ".csv") {
    const textContent = content.toString("utf8").slice(0, 4000);
    return {
      model,
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: [{
          type: "text",
          text: `${prompt}\n\nDocument content (CSV):\n\`\`\`\n${textContent}\n\`\`\``
        }]
      }]
    };
  }

  if (suffix === ".pdf") {
    return {
      model,
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: content.toString("base64")
            }
          }
        ]
      }]
    };
  }

  if (suffix === ".jpg" || suffix === ".jpeg") {
    return {
      model,
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: content.toString("base64")
            }
          }
        ]
      }]
    };
  }

  if (suffix === ".png") {
    return {
      model,
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: content.toString("base64")
            }
          }
        ]
      }]
    };
  }

  return null;
}