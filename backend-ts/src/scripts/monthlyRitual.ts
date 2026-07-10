// Monthly books ritual (M3 / EP-003): one command — validate books CSV, recompute business
// aggregates, write them to the owner's businesses section, run the scan, surface the report.
// Usage: npm run ritual -- --user you@example.com [--year 2026] [--file path/to.csv]
// Runs in-process (no backend server needed); DB via the same repos the API uses, so the
// data_json-canonical + typed-column sync in saveSectionData is preserved.
import fs from "node:fs";
import path from "node:path";
import { initDb } from "../db/init";
import { getUserByEmail } from "../db/authRepo";
import { getSectionData, saveSectionData } from "../db/sectionRepo";
import { runScan } from "../domain/scanner/scan";
import { writeOpportunityReport } from "../domain/scanner/report";
import { parseBooksCsv, computeAggregates, BooksValidationError } from "../domain/books/booksLedger";
import { ensureRequiredDirectories, projectPaths } from "../lib/paths";

function parseArgs(argv: string[]): { user: string; year: number; file: string } {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      args[argv[i].slice(2)] = argv[i + 1] ?? "";
      i++;
    }
  }
  if (!args.user) {
    throw new Error(
      "Missing required --user <email>. The ritual writes to a specific account — it never guesses. " +
        "Example: npm run ritual -- --user you@example.com"
    );
  }
  const year = args.year ? Number(args.year) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Invalid --year "${args.year}"`);
  }
  const file =
    args.file ?? path.join(projectPaths.userData, "private", "books", `${year}-transactions.csv`);
  return { user: args.user, year, file };
}

function fmtCurrency(value: number): string {
  const abs = Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return value < 0 ? `-$${abs}` : `$${abs}`;
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const { user: email, year, file } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(file)) {
    throw new Error(`Books CSV not found: ${file}`);
  }

  // 1. Validate — any problem aborts before anything is written.
  const rows = parseBooksCsv(fs.readFileSync(file, "utf8"));
  const agg = computeAggregates(rows);
  process.stdout.write(
    `Books OK: ${agg.row_count} rows — revenue ${fmtCurrency(agg.gross_revenue)}, ` +
      `cash spend ${fmtCurrency(agg.cash_operating_spend)}, net ${fmtCurrency(agg.net_profit_loss)}\n`
  );

  // 2. Write aggregates to the user's businesses section.
  ensureRequiredDirectories();
  await initDb();
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error(`No account for ${email}. Register in the app first (see docs/my-data-entry-checklist.md).`);
  }

  const businessesSection = await getSectionData(user.id, year, "businesses");
  const businesses = Array.isArray(businessesSection.businesses)
    ? (businessesSection.businesses as Array<Record<string, unknown>>)
    : [];
  if (businesses.length === 0) {
    throw new Error(
      `No business recorded for ${email} (tax year ${year}). ` +
        "Complete the entry checklist (docs/my-data-entry-checklist.md) before running the ritual."
    );
  }

  // ponytail: books are the single LLC's ledger — aggregates land on businesses[0];
  // per-business books files if a second business ever exists. COGS stays manual.
  const financials = {
    ...(businesses[0].financials as Record<string, unknown> | undefined),
    gross_revenue: agg.gross_revenue,
    operating_expenses: agg.cash_operating_spend,
    net_profit_loss: agg.net_profit_loss
  };
  businesses[0] = { ...businesses[0], financials };
  await saveSectionData(user.id, year, "businesses", { ...businessesSection, businesses });
  process.stdout.write(`Aggregates written to businesses[0] for ${email} (tax year ${year}).\n`);

  // 3. Scan + report.
  const scan = await runScan(year, user.id);
  writeOpportunityReport(scan);

  const triggerRows = scan.results.filter((r) => r.trigger);
  if (triggerRows.length > 0) {
    process.stdout.write("\nTrigger Watch:\n");
    for (const r of triggerRows) {
      const t = r.trigger!;
      const state = t.fired ? "FIRED — evaluate with CPA" : `not fired (distance ${fmtCurrency(t.distance)})`;
      process.stdout.write(
        `  ${r.benefit_name}: ${t.label} ${fmtCurrency(t.current_value)} vs ` +
          `${t.comparison === "lte" ? "≤" : "≥"} ${fmtCurrency(t.threshold)} → ${state}\n`
      );
    }
  }

  const reportPath = path.join(projectPaths.reports, "opportunity_report.md");
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  process.stdout.write(
    `\nReport: ${reportPath}\n` +
      `Done in ${seconds}s. Remaining ritual steps: receipts into documents/receipts/, ` +
      `then backup: npm run backup:db\n`
  );
  process.exit(0);
}

void main().catch((error) => {
  if (error instanceof BooksValidationError) {
    process.stderr.write(`${error.message}\nNothing was written.\n`);
  } else {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.exit(1);
});
