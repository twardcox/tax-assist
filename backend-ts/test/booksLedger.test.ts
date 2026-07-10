import { describe, expect, test } from "vitest";
import {
  parseBooksCsv,
  computeAggregates,
  BooksValidationError
} from "../src/domain/books/booksLedger";

const HEADER = "date,amount,category,project,description,receipt";

// Synthetic fixtures only — never real values (public repo rule).
const VALID_CSV = [
  HEADER,
  "2026-01-05,12.34,llm-api,utbis,API usage January,2026-01-anthropic.pdf",
  '2026-02-10,99.00,subscriptions,overhead,"IDE license, annual",2026-02-vendor.pdf',
  "2026-03-15,250.00,revenue,consulting-acme,First invoice paid,2026-03-invoice.pdf"
].join("\n");

describe("parseBooksCsv", () => {
  test("parses valid rows including quoted description with comma", () => {
    const rows = parseBooksCsv(VALID_CSV);
    expect(rows).toHaveLength(3);
    expect(rows[1].description).toBe("IDE license, annual");
    expect(rows[2].category).toBe("revenue");
  });

  test("malformed amount fails naming the file row; nothing returned", () => {
    const csv = [HEADER, "2026-01-05,12.34,llm-api,utbis,ok,r.pdf", "2026-01-06,abc,llm-api,utbis,bad,r.pdf"].join("\n");
    expect(() => parseBooksCsv(csv)).toThrowError(BooksValidationError);
    try {
      parseBooksCsv(csv);
    } catch (e) {
      expect((e as BooksValidationError).problems).toEqual([
        expect.stringContaining('row 3: non-numeric amount "abc"')
      ]);
    }
  });

  test("unknown category fails naming the category and row", () => {
    const csv = [HEADER, "2026-01-05,5.00,groceries,utbis,nope,r.pdf"].join("\n");
    expect(() => parseBooksCsv(csv)).toThrowError(/row 2: unknown category "groceries"/);
  });

  test("unparseable date fails naming the row", () => {
    const csv = [HEADER, "01/05/2026,5.00,llm-api,utbis,bad date,r.pdf"].join("\n");
    expect(() => parseBooksCsv(csv)).toThrowError(/row 2: unparseable date/);
  });

  test("negative amount fails (direction comes from category)", () => {
    const csv = [HEADER, "2026-01-05,-5.00,llm-api,utbis,refund?,r.pdf"].join("\n");
    expect(() => parseBooksCsv(csv)).toThrowError(/row 2: amount must be positive/);
  });

  test("wrong field count and header mismatch fail", () => {
    expect(() => parseBooksCsv([HEADER, "2026-01-05,5.00,llm-api"].join("\n"))).toThrowError(
      /row 2: expected 6 fields, got 3/
    );
    expect(() => parseBooksCsv("date,amount\n2026-01-05,5")).toThrowError(/header mismatch/);
    expect(() => parseBooksCsv("")).toThrowError(/file is empty/);
  });

  test("collects every problem across rows in one error", () => {
    const csv = [
      HEADER,
      "2026-01-05,abc,llm-api,utbis,bad amount,r.pdf",
      "2026-01-06,5.00,groceries,utbis,bad category,r.pdf"
    ].join("\n");
    try {
      parseBooksCsv(csv);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as BooksValidationError).problems).toHaveLength(2);
    }
  });
});

describe("computeAggregates", () => {
  test("revenue category counts as income; everything else is cash spend", () => {
    const agg = computeAggregates(parseBooksCsv(VALID_CSV));
    expect(agg).toEqual({
      gross_revenue: 250,
      cash_operating_spend: 111.34,
      net_profit_loss: 138.66,
      row_count: 3
    });
  });

  test("expense-only books yield a net loss (current reality)", () => {
    const csv = [HEADER, "2026-01-05,3.41,llm-api,utbis,synthetic spend,r.pdf"].join("\n");
    const agg = computeAggregates(parseBooksCsv(csv));
    expect(agg.gross_revenue).toBe(0);
    expect(agg.net_profit_loss).toBe(-3.41);
  });

  test("empty row set aggregates to zeros", () => {
    const agg = computeAggregates(parseBooksCsv(HEADER));
    expect(agg).toEqual({ gross_revenue: 0, cash_operating_spend: 0, net_profit_loss: 0, row_count: 0 });
  });
});
