// Books CSV contract (M3 / EP-003): user_data/private/books/<year>-transactions.csv
// Columns: date, amount, category, project, description, receipt
// Amounts are positive; direction comes from category — "revenue" counts as income,
// every other known category is cash operating spend.

export type BooksRow = {
  date: string;
  amount: number;
  category: string;
  project: string;
  description: string;
  receipt: string;
};

export type BooksAggregates = {
  gross_revenue: number;
  cash_operating_spend: number;
  net_profit_loss: number;
  row_count: number;
};

export const EXPENSE_CATEGORIES = new Set([
  "llm-api",
  "subscriptions",
  "hardware",
  "professional-fees",
  "data",
  "other"
]);
export const REVENUE_CATEGORY = "revenue";
const EXPECTED_HEADER = ["date", "amount", "category", "project", "description", "receipt"];

export class BooksValidationError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Books CSV validation failed:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "BooksValidationError";
    this.problems = problems;
  }
}

// Minimal CSV field splitter with double-quote support (descriptions may contain commas).
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

/** Parse + validate the whole file. Throws BooksValidationError listing every bad row (file line numbers). */
export function parseBooksCsv(text: string): BooksRow[] {
  const lines = text.split(/\r?\n/).filter((line, idx) => line.trim() !== "" || idx === 0);
  if (lines.length === 0 || lines[0].trim() === "") {
    throw new BooksValidationError(["file is empty — expected a header row: " + EXPECTED_HEADER.join(",")]);
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  if (header.join(",") !== EXPECTED_HEADER.join(",")) {
    throw new BooksValidationError([
      `header mismatch — expected "${EXPECTED_HEADER.join(",")}", got "${header.join(",")}"`
    ]);
  }

  const problems: string[] = [];
  const rows: BooksRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fileLine = i + 1;
    const fields = splitCsvLine(lines[i]);
    if (fields.length !== EXPECTED_HEADER.length) {
      problems.push(`row ${fileLine}: expected ${EXPECTED_HEADER.length} fields, got ${fields.length}`);
      continue;
    }

    const [date, amountText, category, project, description, receipt] = fields;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime())) {
      problems.push(`row ${fileLine}: unparseable date "${date}" (expected YYYY-MM-DD)`);
    }

    const amount = Number(amountText);
    if (!Number.isFinite(amount)) {
      problems.push(`row ${fileLine}: non-numeric amount "${amountText}"`);
    } else if (amount <= 0) {
      problems.push(`row ${fileLine}: amount must be positive (direction comes from category), got ${amountText}`);
    }

    if (!EXPENSE_CATEGORIES.has(category) && category !== REVENUE_CATEGORY) {
      problems.push(
        `row ${fileLine}: unknown category "${category}" (known: ${[...EXPENSE_CATEGORIES, REVENUE_CATEGORY].join(", ")})`
      );
    }

    rows.push({ date, amount, category, project, description, receipt });
  }

  if (problems.length > 0) {
    throw new BooksValidationError(problems);
  }

  return rows;
}

export function computeAggregates(rows: BooksRow[]): BooksAggregates {
  let revenue = 0;
  let spend = 0;
  for (const row of rows) {
    if (row.category === REVENUE_CATEGORY) {
      revenue += row.amount;
    } else {
      spend += row.amount;
    }
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    gross_revenue: round2(revenue),
    cash_operating_spend: round2(spend),
    net_profit_loss: round2(revenue - spend),
    row_count: rows.length
  };
}
