export const INCOME_FORM_KEYWORDS = ["w2", "w-2", "1099", "1098", "k-1", "k1", "ssa", "social security"];

export const EXPENSE_CATEGORIES = {
  BUSINESS_EXPENSE: "business_expense",
  PERSONAL_EXPENSE: "personal_expense",
  MIXED_USE: "mixed_use",
  RENTAL_EXPENSE: "rental_expense",
  CAPITAL_IMPROVEMENT: "capital_improvement",
  REPAIR: "repair",
  MEDICAL: "medical",
  CHARITABLE: "charitable",
  EDUCATION: "education",
  NEEDS_REVIEW: "needs_review"
} as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[keyof typeof EXPENSE_CATEGORIES];

export type ClassifiedFilename = {
  file: string;
  file_id: string | null;
  category: string;
  confidence: "low" | "medium" | "high";
  size: number;
  note: string;
};

export type InferredExtraction = {
  document_type: string;
  tax_category: string;
  form_line: string | null;
  deductible_pct: number;
  notes: string;
};

const FORM_LINES: Readonly<Record<string, string>> = {
  business_expense: "Schedule C Line 28 (other expenses)",
  rental_expense: "Schedule E Line 19 (other)",
  mortgage_interest: "Schedule A Line 8a / Form 1098",
  medical: "Schedule A Line 1 (medical/dental)",
  charitable: "Schedule A Line 11 (cash) / Line 12 (non-cash)",
  education_credit: "Form 8863",
  w2_wages: "Form 1040 Line 1a",
  self_employment: "Schedule C Line 1 (gross receipts)",
  rental_income: "Schedule E Line 3 (rents received)",
  interest_income: "Schedule B / Form 1040 Line 2b",
  dividends: "Schedule B / Form 1040 Line 3b",
  child_care: "Form 2441"
};

const INCOME_FORM_TYPES = new Set([
  "w2", "1099_nec", "1099_misc", "1099_int", "1099_div",
  "1099_b", "1099_r", "1098", "1098t", "1098e", "k1", "ssa1099"
]);

const KEYWORD_MAP: Readonly<Record<ExpenseCategory, readonly string[]>> = {
  business_expense: [
    "software", "subscription", "office supply", "office supplies",
    "advertising", "marketing", "business meal", "client", "conference",
    "professional development", "training", "equipment", "computer",
    "phone", "internet", "postage", "shipping", "legal", "accounting"
  ],
  personal_expense: [],
  mixed_use: [],
  rental_expense: [
    "repair", "maintenance", "pest control", "landscaping", "cleaning",
    "property management", "appliance", "hvac", "plumbing", "electrical",
    "painting", "flooring"
  ],
  capital_improvement: [
    "renovation", "addition", "new roof", "remodel", "upgrade",
    "replacement window", "new hvac", "solar panel"
  ],
  repair: [],
  medical: [
    "pharmacy", "prescription", "doctor", "dental", "vision", "hospital",
    "medical", "health", "clinic", "urgent care", "copay"
  ],
  charitable: [
    "donation", "charity", "nonprofit", "church", "tithe", "contribution"
  ],
  education: [
    "tuition", "textbook", "school", "university", "college", "course",
    "certification", "exam fee"
  ],
  needs_review: []
};

export function classifyByKeywords(description: string): ExpenseCategory {
  const descriptionLower = description.toLowerCase();
  for (const [category, keywords] of Object.entries(KEYWORD_MAP) as Array<[ExpenseCategory, readonly string[]]>) {
    if (keywords.some((keyword) => descriptionLower.includes(keyword))) {
      return category;
    }
  }

  return EXPENSE_CATEGORIES.NEEDS_REVIEW;
}

export function classifyFilename(filename: string, size = 0): ClassifiedFilename {
  const stem = filename.replace(/\.[^.]+$/, "");
  const text = stem.replace(/_/g, " ").replace(/-/g, " ");
  const textLower = text.toLowerCase();

  if (INCOME_FORM_KEYWORDS.some((keyword) => textLower.includes(keyword))) {
    return {
      file: filename,
      file_id: null,
      category: "income_document",
      confidence: "medium",
      size,
      note: "Detected as income form. Use 'Extract with AI' for box-level data."
    };
  }

  const category = classifyByKeywords(text);
  const confidence = category === EXPENSE_CATEGORIES.NEEDS_REVIEW ? "low" : "medium";
  const note = category === EXPENSE_CATEGORIES.NEEDS_REVIEW
    ? "Could not classify from filename — add a description or review manually."
    : "Classified from filename. Use 'Extract with AI' for detailed data extraction.";

  return {
    file: filename,
    file_id: null,
    category,
    confidence,
    size,
    note
  };
}

export function inferDocumentType(filename: string): string {
  const lower = filename.toLowerCase();

  if (lower.includes("mileage") || lower.includes("miles")) {
    return "mileage_log";
  }
  if (/(^|[^\d])w-?2([^\d]|$)/.test(lower)) {
    return "w2";
  }
  if (lower.includes("1099-nec") || lower.includes("1099_nec")) {
    return "1099_nec";
  }
  if (lower.includes("1099-misc") || lower.includes("1099_misc")) {
    return "1099_misc";
  }
  if (lower.includes("1099-int") || lower.includes("1099_int")) {
    return "1099_int";
  }
  if (lower.includes("1099-div") || lower.includes("1099_div")) {
    return "1099_div";
  }
  if (lower.includes("ssa") || lower.includes("social security")) {
    return "ssa1099";
  }
  if (lower.includes("1099-b") || lower.includes("1099_b")) {
    return "1099_b";
  }
  if (lower.includes("1099-r") || lower.includes("1099_r")) {
    return "1099_r";
  }
  if (lower.includes("1098-t") || lower.includes("1098_t")) {
    return "1098t";
  }
  if (lower.includes("1098-e") || lower.includes("1098_e")) {
    return "1098e";
  }
  if (lower.includes("1098")) {
    return "1098";
  }
  if (lower.includes("k-1") || lower.includes("k1")) {
    return "k1";
  }
  if (lower.includes("receipt")) {
    return "receipt";
  }
  if (lower.includes("invoice")) {
    return "invoice";
  }

  return "other";
}

export function inferExtractionFromFilename(filename: string, size = 0): InferredExtraction {
  const classified = classifyFilename(filename, size);
  const documentType = inferDocumentType(filename);

  if (documentType === "mileage_log") {
    return {
      document_type: documentType,
      tax_category: EXPENSE_CATEGORIES.BUSINESS_EXPENSE,
      form_line: FORM_LINES.business_expense,
      deductible_pct: 1,
      notes: "Mileage log detected from filename."
    };
  }

  if (INCOME_FORM_TYPES.has(documentType)) {
    switch (documentType) {
      case "w2":
        return {
          document_type: documentType,
          tax_category: "w2_income",
          form_line: FORM_LINES.w2_wages,
          deductible_pct: 1,
          notes: "Detected as income form. Use 'Extract with AI' for box-level data."
        };
      case "1099_nec":
        return {
          document_type: documentType,
          tax_category: "self_employment_income",
          form_line: FORM_LINES.self_employment,
          deductible_pct: 1,
          notes: "Detected as income form. Use 'Extract with AI' for box-level data."
        };
      case "1099_int":
        return {
          document_type: documentType,
          tax_category: "interest_income",
          form_line: FORM_LINES.interest_income,
          deductible_pct: 1,
          notes: "Detected as income form. Use 'Extract with AI' for box-level data."
        };
      case "1099_div":
        return {
          document_type: documentType,
          tax_category: "dividend_income",
          form_line: FORM_LINES.dividends,
          deductible_pct: 1,
          notes: "Detected as income form. Use 'Extract with AI' for box-level data."
        };
      case "1099_r":
        return {
          document_type: documentType,
          tax_category: "retirement_distribution",
          form_line: null,
          deductible_pct: 1,
          notes: "Detected as income form. Use 'Extract with AI' for box-level data."
        };
      case "1098":
        return {
          document_type: documentType,
          tax_category: EXPENSE_CATEGORIES.NEEDS_REVIEW,
          form_line: FORM_LINES.mortgage_interest,
          deductible_pct: 1,
          notes: "Detected as income form. Use 'Extract with AI' for box-level data."
        };
      case "1098t":
        return {
          document_type: documentType,
          tax_category: EXPENSE_CATEGORIES.EDUCATION,
          form_line: FORM_LINES.education_credit,
          deductible_pct: 1,
          notes: "Detected as income form. Use 'Extract with AI' for box-level data."
        };
      case "1098e":
        return {
          document_type: documentType,
          tax_category: EXPENSE_CATEGORIES.EDUCATION,
          form_line: null,
          deductible_pct: 1,
          notes: "Detected as income form. Use 'Extract with AI' for box-level data."
        };
      case "ssa1099":
        return {
          document_type: documentType,
          tax_category: "retirement_distribution",
          form_line: null,
          deductible_pct: 1,
          notes: "Detected as income form. Use 'Extract with AI' for box-level data."
        };
      default:
        return {
          document_type: documentType,
          tax_category: "other_income",
          form_line: null,
          deductible_pct: 1,
          notes: "Detected as income form. Use 'Extract with AI' for box-level data."
        };
    }
  }

  const formLine = classified.category === EXPENSE_CATEGORIES.RENTAL_EXPENSE
    ? FORM_LINES.rental_expense
    : classified.category === EXPENSE_CATEGORIES.MEDICAL
      ? FORM_LINES.medical
      : classified.category === EXPENSE_CATEGORIES.CHARITABLE
        ? FORM_LINES.charitable
        : classified.category === EXPENSE_CATEGORIES.BUSINESS_EXPENSE
          ? FORM_LINES.business_expense
          : null;

  return {
    document_type: documentType,
    tax_category: classified.category,
    form_line: formLine,
    deductible_pct: classified.category === EXPENSE_CATEGORIES.PERSONAL_EXPENSE ? 0 : 1,
    notes: classified.note
  };
}