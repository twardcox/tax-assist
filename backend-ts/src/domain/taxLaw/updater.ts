import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { projectPaths } from "../../lib/paths";

const STATE_FILE = path.join(projectPaths.state, "update_state.json");
const FUTURE_LAW_DIR = path.join(projectPaths.taxLibrary, "future_law");
const REPORT_FILE = path.join(projectPaths.reports, "tax_law_updates.md");
const FEDERAL_REGISTER_API = "https://www.federalregister.gov/api/v1/documents.json";
const FEDERAL_REGISTER_FIELDS = [
  "title",
  "abstract",
  "html_url",
  "publication_date",
  "type",
  "document_number",
  "action",
  "agencies"
];

export const SUPPORTED_TAX_LAW_SOURCES = [
  "federal_register",
  "irs_news",
  "irs_publications",
  "internal_revenue_bulletin",
  "treasury_regulations",
  "congress_legislation",
  "tax_court",
  "state_ca",
  "state_ny",
  "state_il",
  "state_ma",
  "state_nj",
  "state_co",
  "state_or",
  "state_pa",
  "state_oh",
  "state_ga"
] as const;

type TaxLawSource = (typeof SUPPORTED_TAX_LAW_SOURCES)[number];

const CHANGE_TYPE_PATTERNS: Record<string, string[]> = {
  new_benefit: [
    "new (credit|deduction|exclusion|benefit)",
    "(establishes?|creates?|enacts?)\\s+(a\\s+)?new",
    "inflation reduction act"
  ],
  changed_threshold: [
    "(adjust|increas|decreas)\\w+ for inflation",
    "inflation[- ]adjusted",
    "(annual|contribution|income|dollar)\\s+limit",
    "phaseout|phase-out|phase out",
    "indexed to inflation",
    "\\$[\\d,]+\\s+(limit|threshold|maximum|minimum|cap)",
    "2026\\s+(inflation|amount|limit)"
  ],
  expired_benefit: [
    "(expire[sd]?|sunset|terminated|no longer\\s+(available|effective))",
    "(credit|deduction|provision)\\s+expired"
  ],
  future_effective_law: [
    "effective\\s+(date|for tax year)",
    "will take effect",
    "beginning\\s+(in|with)\\s+(tax year|january|20\\d\\d)"
  ],
  new_form: [
    "(new|revised|updated)\\s+form\\s+\\d+",
    "form\\s+\\d+\\s+(revised|updated|replaced|redesigned)",
    "schedule\\s+[A-Z]+\\s+(revised|new|updated)"
  ],
  deadline_change: [
    "(filing\\s+)?deadline",
    "due date\\s+(changed|extended|modified)",
    "extended\\s+to\\s+(april|march|october)",
    "automatic\\s+extension"
  ],
  risk_change: [
    "(increased?\\s+)?(audit|examination|enforcement|scrutiny)",
    "compliance\\s+(initiative|program|campaign)",
    "listed\\s+transaction",
    "(identified|targeted)\\s+for\\s+(audit|examination)",
    "abusive\\s+(tax\\s+)?shelter"
  ],
  new_interpretation: [
    "(clarif|interpret)\\w+",
    "\\bguidance\\s+on\\b",
    "(rules?|regulations?)\\s+under\\s+(section|§)\\s*\\d+",
    "frequently\\s+asked\\s+questions"
  ],
  proposed_rule: [
    "proposed\\s+rule",
    "notice\\s+of\\s+proposed\\s+rulemaking",
    "\\bNPRM\\b",
    "\\bREG-\\d{6}-\\d{2}\\b"
  ],
  revenue_ruling: [
    "revenue\\s+ruling",
    "\\bRev\\.?\\s*Rul\\.?\\b"
  ],
  revenue_procedure: [
    "revenue\\s+procedure",
    "\\bRev\\.?\\s*Proc\\.?\\b"
  ],
  final_rule: [
    "final\\s+(rule|regulations?)",
    "\\bT\\.?D\\.?\\s*\\d{4,}\\b",
    "Treasury\\s+Decision",
    "TD\\s+\\d{4,}"
  ]
};

const BENEFIT_KEYWORDS: Record<string, string[]> = {
  "federal-qbi-deduction": ["qbi", "199a", "qualified business income", "pass-through deduction"],
  "federal-s-corp-election": ["s corp", "s-corp", "s corporation", "form 2553", "reasonable compensation"],
  "federal-sep-ira": ["sep-ira", "sep ira", "simplified employee pension"],
  "federal-solo-401k": ["solo 401k", "solo 401(k)", "individual 401k", "one-participant 401"],
  "federal-self-employed-health-insurance": ["self-employed health", "se health insurance"],
  "federal-hsa": ["hsa", "health savings account", "high deductible health", "hdhp"],
  "federal-section-179": ["section 179", "§ 179", "179 expensing", "first-year expensing"],
  "federal-bonus-depreciation": ["bonus depreciation", "additional first year", "168(k)"],
  "federal-business-vehicle": ["vehicle", "automobile", "mileage rate", "listed property", "luxury auto"],
  "federal-real-estate-depreciation": ["residential rental", "27.5 year", "rental depreciation", "rental property"],
  "federal-passive-activity-loss": ["passive activity", "passive loss", "material participation"],
  "federal-1031-exchange": ["1031", "like-kind exchange", "deferred exchange"],
  "federal-augusta-rule": ["augusta rule", "14-day rule", "section 280a", "home rental"],
  "federal-charitable-contribution": ["charitable", "donation", "501(c)(3)", "qualified charitable distribution", "qcd"],
  "federal-backdoor-roth": ["backdoor roth", "roth ira", "roth conversion", "nondeductible ira"],
  "federal-child-tax-credit": ["child tax credit", "ctc", "additional child tax credit", "actc"],
  "federal-child-care-credit": ["child care credit", "dependent care", "form 2441", "child and dependent"],
  "federal-eitc": ["earned income credit", "eitc", "earned income tax credit"],
  "federal-american-opportunity-credit": ["american opportunity", "aotc", "hope credit", "tuition credit"],
  "federal-lifetime-learning-credit": ["lifetime learning", "llc", "education credit", "qualified education"],
  "federal-clean-energy-credit": ["clean energy", "solar", "residential clean energy", "section 25d", "25d credit"],
  "federal-ev-credit": ["electric vehicle", "clean vehicle credit", "section 30d", "plug-in", "ev credit"],
  "federal-mortgage-interest": ["mortgage interest", "home mortgage", "acquisition debt", "home equity"],
  "federal-salt-deduction": ["state and local tax", "salt deduction", "property tax deduction", "$10,000 cap"],
  "federal-section-121-exclusion": ["section 121", "home sale exclusion", "primary residence exclusion"],
  "federal-foreign-earned-income": ["foreign earned income", "feie", "form 2555", "foreign housing"],
  "federal-opportunity-zone": ["opportunity zone", "qualified opportunity zone", "qoz", "qualified opportunity fund"],
  "federal-annual-gift-exclusion": ["annual gift exclusion", "gift tax exclusion", "annual exclusion amount"],
  "federal-real-estate-professional": ["real estate professional", "rep status", "750 hours", "material participation real estate"],
  "federal-cost-segregation": ["cost segregation", "component depreciation", "accelerated depreciation study"]
};

export interface ChangeRecordInput {
  id: string;
  source: string;
  source_name: string;
  title: string;
  url: string;
  publication_date: string;
  change_types: string[];
  affected_benefits: string[];
  summary: string;
  document_number?: string;
  document_type?: string;
  raw_abstract?: string;
  detected_at?: string;
  ai_classified?: boolean;
  ai_summary?: string;
}

export class ChangeRecord {
  id: string;
  source: string;
  source_name: string;
  title: string;
  url: string;
  publication_date: string;
  change_types: string[];
  affected_benefits: string[];
  summary: string;
  document_number: string;
  document_type: string;
  raw_abstract: string;
  detected_at: string;
  ai_classified: boolean;
  ai_summary: string;

  constructor(input: ChangeRecordInput) {
    this.id = input.id;
    this.source = input.source;
    this.source_name = input.source_name;
    this.title = input.title;
    this.url = input.url;
    this.publication_date = input.publication_date;
    this.change_types = input.change_types;
    this.affected_benefits = input.affected_benefits;
    this.summary = input.summary;
    this.document_number = input.document_number ?? "";
    this.document_type = input.document_type ?? "";
    this.raw_abstract = input.raw_abstract ?? "";
    this.detected_at = input.detected_at ?? new Date().toISOString().slice(0, 19);
    this.ai_classified = input.ai_classified ?? false;
    this.ai_summary = input.ai_summary ?? "";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

export function loadSources(): Record<string, unknown> {
  const sourcesPath = path.join(projectPaths.root, "config", "sources.yaml");
  const parsed = yaml.load(fs.readFileSync(sourcesPath, "utf8"));
  return asRecord(parsed);
}

export function classifyChangeTypes(title: string, abstract = ""): string[] {
  const text = `${title} ${abstract}`.toLowerCase();
  const matched: string[] = [];

  for (const [changeType, patterns] of Object.entries(CHANGE_TYPE_PATTERNS)) {
    if (patterns.some((pattern) => new RegExp(pattern, "i").test(text))) {
      matched.push(changeType);
    }
  }

  return matched.length > 0 ? matched : ["new_interpretation"];
}

export function detectAffectedBenefits(title: string, abstract = ""): string[] {
  const text = `${title} ${abstract}`.toLowerCase();

  return Object.entries(BENEFIT_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword.toLowerCase())))
    .map(([benefitId]) => benefitId);
}

export function makeSlug(title: string): string {
  let slug = title.toLowerCase().replace(/[^\w\s-]/g, "");
  slug = slug.replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.slice(0, 50);
}

export function updateFederalRegisterState(state: Record<string, unknown>, records: ChangeRecord[]): void {
  const source = asRecord(state.federal_register);
  const seenRaw = source.seen_document_numbers;
  const seen = new Set<string>(Array.isArray(seenRaw) ? seenRaw.map((value) => String(value)) : []);

  for (const record of records) {
    if (record.document_number) {
      seen.add(record.document_number);
    }
  }

  source.seen_document_numbers = Array.from(seen);
  source.last_checked = new Date().toISOString().slice(0, 19);
  state.federal_register = source;
}

export function _parseRssDate(dateStr: string): string | null {
  const trimmed = dateStr.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) {
    return null;
  }

  return new Date(ms).toISOString().slice(0, 10);
}

export function updateIrsNewsState(state: Record<string, unknown>, records: ChangeRecord[]): void {
  const source = asRecord(state.irs_news);
  const seenRaw = source.seen_item_ids;
  const seen = new Set<string>(Array.isArray(seenRaw) ? seenRaw.map((value) => String(value)) : []);

  for (const record of records) {
    seen.add(record.id);
  }

  source.seen_item_ids = Array.from(seen);
  source.last_checked = new Date().toISOString().slice(0, 19);
  state.irs_news = source;
}

function loadState(): Record<string, unknown> {
  if (!fs.existsSync(STATE_FILE)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return asRecord(parsed);
  } catch {
    return {};
  }
}

function saveState(state: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function saveChangeRecord(record: ChangeRecord, dryRun: boolean): void {
  if (dryRun) {
    return;
  }

  fs.mkdirSync(FUTURE_LAW_DIR, { recursive: true });
  const filename = `${record.publication_date}-${makeSlug(record.title)}.yaml`;
  const outPath = path.join(FUTURE_LAW_DIR, filename);
  fs.writeFileSync(outPath, yaml.dump(record, { sortKeys: false }), "utf8");
}

function writeSummaryReport(records: ChangeRecord[], dryRun: boolean): void {
  if (dryRun) {
    return;
  }

  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });

  const lines: string[] = [];
  lines.push("# Tax Law Updates");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")}`);
  lines.push(`New changes: ${records.length}`);
  lines.push("");

  for (const record of records) {
    lines.push(`## ${record.title}`);
    lines.push(`- Source: ${record.source_name}`);
    lines.push(`- Date: ${record.publication_date}`);
    lines.push(`- URL: ${record.url}`);
    lines.push(`- Change types: ${record.change_types.join(", ") || "none"}`);
    if (record.affected_benefits.length > 0) {
      lines.push(`- Affected benefits: ${record.affected_benefits.join(", ")}`);
    }
    lines.push(`- Summary: ${record.summary}`);
    lines.push("");
  }

  fs.writeFileSync(REPORT_FILE, `${lines.join("\n")}\n`, "utf8");
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function parseFederalRegisterResults(payload: unknown): Array<Record<string, unknown>> {
  const obj = asRecord(payload);
  const results = obj.results;
  return Array.isArray(results)
    ? results.filter((value) => value && typeof value === "object") as Array<Record<string, unknown>>
    : [];
}

async function fetchFederalRegister(sinceDate: string, state: Record<string, unknown>): Promise<ChangeRecord[]> {
  const sourceState = asRecord(state.federal_register);
  const seenRaw = sourceState.seen_document_numbers;
  const seen = new Set<string>(Array.isArray(seenRaw) ? seenRaw.map((value) => String(value)) : []);

  const params = new URLSearchParams();
  params.append("conditions[agencies][]", "internal-revenue-service");
  params.append("conditions[publication_date][gte]", sinceDate);
  params.append("per_page", "100");
  params.append("order", "newest");
  for (const field of FEDERAL_REGISTER_FIELDS) {
    params.append("fields[]", field);
  }

  try {
    const response = await fetch(`${FEDERAL_REGISTER_API}?${params.toString()}`);
    if (!response.ok) {
      return [];
    }

    const results = parseFederalRegisterResults(await response.json());
    const records: ChangeRecord[] = [];

    for (const doc of results) {
      const title = String(doc.title ?? "").trim();
      if (!title) {
        continue;
      }

      const documentNumber = String(doc.document_number ?? "").trim();
      if (documentNumber && seen.has(documentNumber)) {
        continue;
      }

      const rawAbstract = String(doc.abstract ?? "").trim();
      const publicationDate = String(doc.publication_date ?? sinceDate);
      records.push(
        new ChangeRecord({
          id: `federal-register-${documentNumber || makeSlug(title)}`,
          source: "federal_register",
          source_name: "Federal Register - Treasury/IRS Rules",
          title,
          url: String(doc.html_url ?? ""),
          publication_date: publicationDate,
          change_types: classifyChangeTypes(title, rawAbstract),
          affected_benefits: detectAffectedBenefits(title, rawAbstract),
          summary: rawAbstract ? rawAbstract.slice(0, 500) : title,
          document_number: documentNumber,
          document_type: String(doc.type ?? ""),
          raw_abstract: rawAbstract
        })
      );
    }

    return records;
  } catch {
    return [];
  }
}

async function fetchIrsNews(_sinceDate: string, _state: Record<string, unknown>): Promise<ChangeRecord[]> {
  return [];
}

async function fetchBySource(
  source: TaxLawSource,
  sinceDate: string,
  state: Record<string, unknown>
): Promise<ChangeRecord[]> {
  if (source === "federal_register") {
    return fetchFederalRegister(sinceDate, state);
  }
  if (source === "irs_news") {
    return fetchIrsNews(sinceDate, state);
  }
  return [];
}

function updateSourceState(source: TaxLawSource, state: Record<string, unknown>, records: ChangeRecord[]): void {
  if (source === "federal_register") {
    updateFederalRegisterState(state, records);
    return;
  }
  if (source === "irs_news") {
    updateIrsNewsState(state, records);
  }
}

export type RunTaxLawUpdateOptions = {
  source?: TaxLawSource | null;
  days?: number;
  sinceDate?: string | null;
  dryRun?: boolean;
};

export type RunTaxLawUpdateResult = {
  since_date: string;
  source: string | null;
  dry_run: boolean;
  new_changes: number;
};

export async function runTaxLawUpdate(options: RunTaxLawUpdateOptions = {}): Promise<RunTaxLawUpdateResult> {
  const dryRun = options.dryRun === true;
  const days = Number.isFinite(options.days) ? Number(options.days) : 30;
  const sinceDate = options.sinceDate ?? daysAgoIso(days);
  const state = loadState();
  const sources: TaxLawSource[] = options.source ? [options.source] : [...SUPPORTED_TAX_LAW_SOURCES];

  const allNewRecords: ChangeRecord[] = [];

  for (const source of sources) {
    const records = await fetchBySource(source, sinceDate, state);
    if (records.length > 0) {
      for (const record of records) {
        saveChangeRecord(record, dryRun);
      }
      allNewRecords.push(...records);
    }
    updateSourceState(source, state, records);
  }

  if (!dryRun) {
    saveState(state);
    writeSummaryReport(allNewRecords, dryRun);
  }

  return {
    since_date: sinceDate,
    source: options.source ?? null,
    dry_run: dryRun,
    new_changes: allNewRecords.length
  };
}
