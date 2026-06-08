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
    return {
      error: "Could not parse AI response",
      suggested_updates: [],
      confidence: "low",
      notes: raw.slice(0, 500),
      benefit_ids: [],
      deductible_pct: 1,
      form_line: null
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return normalizeExtractionResult(parsed);
  } catch (error) {
    return {
      error: `Could not parse AI response: ${(error as Error).message}`,
      suggested_updates: [],
      confidence: "low",
      notes: raw.slice(0, 500),
      benefit_ids: [],
      deductible_pct: 1,
      form_line: null
    };
  }
}

export function missingApiKeyResult(): NormalizedAiExtraction {
  return {
    error: "ANTHROPIC_API_KEY not set",
    suggested_updates: [],
    confidence: "low",
    notes: "Set ANTHROPIC_API_KEY to enable AI extraction.",
    benefit_ids: [],
    deductible_pct: 1,
    form_line: null
  };
}

export function missingAnthropicPackageResult(): NormalizedAiExtraction {
  return {
    error: "anthropic package not installed",
    suggested_updates: [],
    confidence: "low",
    notes: "Run: npm install @anthropic-ai/sdk",
    benefit_ids: [],
    deductible_pct: 1,
    form_line: null
  };
}

export function anthropicApiErrorResult(message: string, statusCode: number | undefined, model: string): NormalizedAiExtraction {
  const notes = statusCode === 400 || statusCode === 404
    ? `Model '${model}' was rejected by the API. Set the CLAUDE_MODEL environment variable to a valid model ID.`
    : "Extraction failed — see error.";

  return {
    error: message,
    suggested_updates: [],
    confidence: "low",
    notes,
    benefit_ids: [],
    deductible_pct: 1,
    form_line: null
  };
}

export function genericExtractionErrorResult(message: string): NormalizedAiExtraction {
  return {
    error: message,
    suggested_updates: [],
    confidence: "low",
    notes: "Extraction failed — see error.",
    benefit_ids: [],
    deductible_pct: 1,
    form_line: null
  };
}