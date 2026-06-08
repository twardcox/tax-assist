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