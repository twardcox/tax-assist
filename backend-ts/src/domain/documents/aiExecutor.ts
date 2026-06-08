import { env } from "../../config/env";
import { buildAiExtractionRequest, unsupportedExtractionResult, type AiExtractionRequest } from "./aiRequest";
import {
  anthropicApiErrorResult,
  genericExtractionErrorResult,
  missingAnthropicPackageResult,
  missingApiKeyResult,
  parseAiResponseText
} from "./aiResponse";

type AnthropicResponseBlock = {
  text?: string;
};

type AnthropicResponse = {
  content?: AnthropicResponseBlock[];
};

type AnthropicClient = {
  messages: {
    create: (request: AiExtractionRequest) => Promise<AnthropicResponse>;
  };
};

type AnthropicSdkModule = {
  Anthropic: new (options: { apiKey: string }) => AnthropicClient;
  APIError?: new (message?: string) => Error;
};

type ExtractionDeps = {
  loadSdk?: () => Promise<AnthropicSdkModule>;
  createClient?: (sdk: AnthropicSdkModule, apiKey: string) => AnthropicClient;
};

type TestExtractionOverride = ((content: Buffer, filename: string) => Promise<Record<string, unknown>>) | null;

let testExtractionOverride: TestExtractionOverride = null;

function extractionModel(): string {
  return process.env.CLAUDE_MODEL ?? env.CLAUDE_MODEL ?? "claude-haiku-4-5-20251001";
}

async function loadAnthropicSdk(): Promise<AnthropicSdkModule> {
  const loaded = await import("@anthropic-ai/sdk");
  return (loaded.default ? loaded : loaded) as unknown as AnthropicSdkModule;
}

function createAnthropicClient(sdk: AnthropicSdkModule, apiKey: string): AnthropicClient {
  return new sdk.Anthropic({ apiKey });
}

function getStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const value = (error as { status?: unknown; statusCode?: unknown }).status
    ?? (error as { status?: unknown; statusCode?: unknown }).statusCode;
  return typeof value === "number" ? value : undefined;
}

function isMissingSdkError(error: unknown): boolean {
  return error instanceof Error
    && (error.message.includes("@anthropic-ai/sdk") || error.message.includes("Cannot find module"));
}

function isApiError(error: unknown, sdk: AnthropicSdkModule): boolean {
  return Boolean(sdk.APIError && error instanceof sdk.APIError) || typeof getStatusCode(error) === "number";
}

export function __setDocumentAiExtractionOverrideForTest(
  override: ((content: Buffer, filename: string) => Promise<Record<string, unknown>>) | null
): void {
  testExtractionOverride = override;
}

export async function extractWithAiBytes(
  content: Buffer,
  filename: string,
  deps: ExtractionDeps = {}
): Promise<Record<string, unknown>> {
  if (testExtractionOverride) {
    return testExtractionOverride(content, filename);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return missingApiKeyResult();
  }

  const request = buildAiExtractionRequest(content, filename);
  if (!request) {
    const suffix = filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
    return unsupportedExtractionResult(suffix);
  }

  const loadSdk = deps.loadSdk ?? loadAnthropicSdk;
  const createClient = deps.createClient ?? createAnthropicClient;

  let sdk: AnthropicSdkModule;
  try {
    sdk = await loadSdk();
  } catch (error) {
    if (isMissingSdkError(error)) {
      return missingAnthropicPackageResult();
    }
    return genericExtractionErrorResult((error as Error).message);
  }

  try {
    const client = createClient(sdk, apiKey);
    const response = await client.messages.create(request);
    const raw = response.content?.find((block) => typeof block.text === "string")?.text ?? "";
    return parseAiResponseText(raw);
  } catch (error) {
    if (isApiError(error, sdk)) {
      return anthropicApiErrorResult(String((error as Error).message), getStatusCode(error), extractionModel());
    }
    return genericExtractionErrorResult(String((error as Error).message));
  }
}