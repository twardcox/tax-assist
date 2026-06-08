import {
  EXPENSE_CATEGORIES,
  INCOME_FORM_KEYWORDS,
  inferExtractionFromFilename,
  type InferredExtraction
} from "./classifier";

export type ExtractionPromptKind = "receipt" | "income_form" | "mileage";

function csvPreview(content: Buffer): string {
  return content.toString("utf8").slice(0, 4000);
}

export function pickPromptKind(filename: string, content: Buffer): ExtractionPromptKind {
  const suffix = filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  const stemLower = filename.toLowerCase();

  if (stemLower.includes("mileage") || stemLower.includes("miles")) {
    return "mileage";
  }

  if (INCOME_FORM_KEYWORDS.some((keyword) => stemLower.includes(keyword))) {
    return "income_form";
  }

  if (suffix === ".csv") {
    const preview = csvPreview(content).toLowerCase();
    if (["miles", "odometer", "destination"].some((term) => preview.includes(term))) {
      return "mileage";
    }
  }

  return "receipt";
}

export function inferExtractionFromUpload(filename: string, content: Buffer): InferredExtraction {
  const promptKind = pickPromptKind(filename, content);

  if (promptKind === "mileage") {
    return {
      document_type: "mileage_log",
      tax_category: EXPENSE_CATEGORIES.BUSINESS_EXPENSE,
      form_line: "Schedule C Line 9 (car and truck expenses)",
      deductible_pct: 1,
      notes: "Mileage log detected from filename or CSV content."
    };
  }

  return inferExtractionFromFilename(filename, content.length);
}