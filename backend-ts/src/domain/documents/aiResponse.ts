export type NormalizedAiExtraction = {
  document_type?: string;
  merchant_or_payer?: string | null;
  payer_ein?: string | null;
  date?: string | null;
  total_amount?: number;
  description?: string;
  tax_category?: string;
  deductible_pct: number;
  benefit_ids: unknown[];
  form_line: string | null;
  suggested_updates: unknown[];
  confidence?: string;
  notes?: string;
  error?: string;
};

function clampDeductiblePct(value: unknown): number {
  const numeric = Number(value ?? 1);
  if (!Number.isFinite(numeric)) {
    return 1;
  }

  return Math.max(0, Math.min(1, numeric));
}

function normalizeExtractionResult(value: Record<string, unknown>): NormalizedAiExtraction {
  return {
    ...value,
    suggested_updates: Array.isArray(value.suggested_updates) ? value.suggested_updates : [],
    benefit_ids: Array.isArray(value.benefit_ids) ? value.benefit_ids : [],
    deductible_pct: clampDeductiblePct(value.deductible_pct),
    form_line: typeof value.form_line === "string" ? value.form_line : null
  };
}

export function parseAiResponseText(raw: string): NormalizedAiExtraction {
  const jsonMatch = raw.match(/\{.*\}/s);
  if (!jsonMatch) {
    return errorResult("Could not parse AI response", raw.slice(0, 500));
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return normalizeExtractionResult(parsed);
  } catch (error) {
    return errorResult(`Could not parse AI response: ${(error as Error).message}`, raw.slice(0, 500));
  }
}

function errorResult(error: string, notes: string): NormalizedAiExtraction {
  return { error, notes, suggested_updates: [], confidence: "low", benefit_ids: [], deductible_pct: 1, form_line: null };
}

export function missingApiKeyResult(): NormalizedAiExtraction {
  return errorResult("ANTHROPIC_API_KEY not set", "Set ANTHROPIC_API_KEY to enable AI extraction.");
}

export function missingAnthropicPackageResult(): NormalizedAiExtraction {
  return errorResult("anthropic package not installed", "Run: npm install @anthropic-ai/sdk");
}

export function anthropicApiErrorResult(message: string, statusCode: number | undefined, model: string): NormalizedAiExtraction {
  const notes = statusCode === 400 || statusCode === 404
    ? `Model '${model}' was rejected by the API. Set the CLAUDE_MODEL environment variable to a valid model ID.`
    : "Extraction failed — see error.";
  return errorResult(message, notes);
}

export function genericExtractionErrorResult(message: string): NormalizedAiExtraction {
  return errorResult(message, "Extraction failed — see error.");
}