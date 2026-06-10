import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import yaml from "js-yaml";
import Anthropic from "@anthropic-ai/sdk";
import { projectPaths } from "../../lib/paths";

const STATE_FILE = path.join(projectPaths.state, "update_state.json");
const FUTURE_LAW_DIR = path.join(projectPaths.taxLibrary, "future_law");
const REPORT_FILE = path.join(projectPaths.reports, "tax_law_updates.md");
const FEDERAL_REGISTER_API = "https://www.federalregister.gov/api/v1/documents.json";
const IRS_NEWSROOM_URL = "https://www.irs.gov/newsroom";
const TREASURY_RSS_URL = "https://home.treasury.gov/rss.xml";
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

const TREASURY_TAX_KEYWORDS_RE = /\b(tax|IRS|Internal Revenue|Treasury|deduction|credit|depreciation|regulation|ruling|T\.D\.|REG-|Rev\. Proc|section \d+)\b/i;

const CONGRESS_API = "https://api.congress.gov/v3/bill";
const DAWSON_BASE = "https://public-api-green.dawson.ustaxcourt.gov";

const STATE_SOURCES: Partial<Record<TaxLawSource, { url: string; name: string }>> = {
  state_ca: { url: "https://www.ftb.ca.gov/about-ftb/newsroom/news-releases/", name: "California Franchise Tax Board" },
  state_ny: { url: "https://www.tax.ny.gov/press/releases/", name: "New York Department of Taxation and Finance" },
  state_il: { url: "https://tax.illinois.gov/about/newsroom.html", name: "Illinois Department of Revenue" },
  state_ma: { url: "https://www.mass.gov/lists/dor-news-and-updates", name: "Massachusetts Department of Revenue" },
  state_nj: { url: "https://www.nj.gov/treasury/taxation/news.shtml", name: "New Jersey Division of Taxation" },
  state_co: { url: "https://tax.colorado.gov/news", name: "Colorado Department of Revenue" },
  state_or: { url: "https://www.oregon.gov/dor/news/Pages/default.aspx", name: "Oregon Department of Revenue" },
  state_pa: { url: "https://www.revenue.pa.gov/GeneralTaxInformation/News/Pages/default.aspx", name: "Pennsylvania Department of Revenue" },
  state_oh: { url: "https://tax.ohio.gov/latest-news", name: "Ohio Department of Taxation" },
  state_ga: { url: "https://dor.georgia.gov/news", name: "Georgia Department of Revenue" }
};

const AI_SYSTEM_PROMPT = `You are a tax law analyst for UTBIS, a tax benefit intelligence tool.
Given a tax document title and abstract, respond with JSON only — no prose:
{
  "change_types": ["<one or more valid types>"],
  "affected_benefits": ["<zero or more benefit-id slugs from the list below>"],
  "summary": "<1-2 sentence plain-English summary for a tax professional>"
}

Valid change_types:
  new_benefit, changed_threshold, expired_benefit, future_effective_law,
  new_form, deadline_change, risk_change, new_interpretation,
  proposed_rule, revenue_ruling, revenue_procedure, final_rule

Valid benefit slugs:
  federal-qbi-deduction, federal-s-corp-election, federal-sep-ira,
  federal-solo-401k, federal-self-employed-health-insurance, federal-hsa,
  federal-section-179, federal-bonus-depreciation, federal-business-vehicle,
  federal-real-estate-depreciation, federal-passive-activity-loss,
  federal-1031-exchange, federal-augusta-rule, federal-charitable-contribution,
  federal-backdoor-roth, federal-child-tax-credit, federal-child-care-credit,
  federal-eitc, federal-american-opportunity-credit, federal-lifetime-learning-credit,
  federal-clean-energy-credit, federal-ev-credit, federal-mortgage-interest,
  federal-salt-deduction, federal-section-121-exclusion, federal-foreign-earned-income,
  federal-opportunity-zone, federal-annual-gift-exclusion,
  federal-real-estate-professional, federal-cost-segregation`;

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

const MONTH_DAY_YEAR_RE = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i;
const MONTH_MAP: Record<string, string> = {
  january: "01",
  jan: "01",
  february: "02",
  feb: "02",
  march: "03",
  mar: "03",
  april: "04",
  apr: "04",
  may: "05",
  june: "06",
  jun: "06",
  july: "07",
  jul: "07",
  august: "08",
  aug: "08",
  september: "09",
  sep: "09",
  october: "10",
  oct: "10",
  november: "11",
  nov: "11",
  december: "12",
  dec: "12"
};

function parseMonthDayYear(text: string): string | null {
  const match = MONTH_DAY_YEAR_RE.exec(text);
  if (!match) {
    return null;
  }

  const month = MONTH_MAP[match[1]?.toLowerCase() ?? ""];
  const day = (match[2] ?? "").padStart(2, "0");
  const year = match[3] ?? "";
  if (!month || !day || !year) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function parseMmDdYyyy(text: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!match) {
    return null;
  }
  const month = (match[1] ?? "").padStart(2, "0");
  const day = (match[2] ?? "").padStart(2, "0");
  const year = match[3] ?? "";
  if (!month || !day || !year) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

function parseMonthYear(text: string): string | null {
  const value = text.trim();
  if (!value) {
    return null;
  }

  const byDate = Date.parse(`1 ${value}`);
  if (!Number.isNaN(byDate)) {
    return new Date(byDate).toISOString().slice(0, 7) + "-01";
  }

  const yearMatch = /\b(20\d{2})\b/.exec(value);
  return yearMatch ? `${yearMatch[1]}-01-01` : null;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractNearestItemText(html: string, index: number): string {
  const wrappers = [
    ["<article", "</article>"],
    ["<li", "</li>"],
    ["<div", "</div>"]
  ] as const;

  for (const [openTag, closeTag] of wrappers) {
    const openIdx = html.lastIndexOf(openTag, index);
    if (openIdx < 0) {
      continue;
    }
    const closeIdx = html.indexOf(closeTag, index);
    if (closeIdx < 0) {
      continue;
    }

    const fragment = html.slice(openIdx, closeIdx + closeTag.length);
    return stripHtml(fragment);
  }

  const contextStart = Math.max(0, index - 250);
  const contextEnd = Math.min(html.length, index + 250);
  return stripHtml(html.slice(contextStart, contextEnd));
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

export function updateIrsPublicationsState(state: Record<string, unknown>, records: ChangeRecord[]): void {
  const source = asRecord(state.irs_publications);
  const seenRaw = source.seen_item_ids;
  const seen = new Set<string>(Array.isArray(seenRaw) ? seenRaw.map((value) => String(value)) : []);

  for (const record of records) {
    seen.add(record.id);
  }

  source.seen_item_ids = Array.from(seen);
  source.last_checked = new Date().toISOString().slice(0, 19);
  state.irs_publications = source;
}

export function updateInternalRevenueBulletinState(state: Record<string, unknown>, records: ChangeRecord[]): void {
  const source = asRecord(state.internal_revenue_bulletin);
  const seenRaw = source.seen_item_ids;
  const seen = new Set<string>(Array.isArray(seenRaw) ? seenRaw.map((value) => String(value)) : []);

  for (const record of records) {
    seen.add(record.id);
  }

  source.seen_item_ids = Array.from(seen);
  source.last_checked = new Date().toISOString().slice(0, 19);
  state.internal_revenue_bulletin = source;
}

export function updateTreasuryRegulationsState(state: Record<string, unknown>, records: ChangeRecord[]): void {
  const source = asRecord(state.treasury_regulations);
  const seenRaw = source.seen_item_ids;
  const seen = new Set<string>(Array.isArray(seenRaw) ? seenRaw.map((value) => String(value)) : []);

  for (const record of records) {
    seen.add(record.id);
  }

  source.seen_item_ids = Array.from(seen);
  source.last_checked = new Date().toISOString().slice(0, 19);
  state.treasury_regulations = source;
}

function updateSimpleState(sourceKey: string, state: Record<string, unknown>, records: ChangeRecord[]): void {
  const source = asRecord(state[sourceKey]);
  const seenRaw = source.seen_item_ids;
  const seen = new Set<string>(Array.isArray(seenRaw) ? seenRaw.map((value) => String(value)) : []);

  for (const record of records) {
    seen.add(record.id);
  }

  source.seen_item_ids = Array.from(seen);
  source.last_checked = new Date().toISOString().slice(0, 19);
  state[sourceKey] = source;
}

export function updateCongressLegislationState(state: Record<string, unknown>, records: ChangeRecord[]): void {
  updateSimpleState("congress_legislation", state, records);
}

export function updateTaxCourtState(state: Record<string, unknown>, records: ChangeRecord[]): void {
  updateSimpleState("tax_court", state, records);
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

export async function fetchIrsNews(sinceDate: string, state: Record<string, unknown>): Promise<ChangeRecord[]> {
  const sourceState = asRecord(state.irs_news);
  const seenRaw = sourceState.seen_item_ids;
  const seen = new Set<string>(Array.isArray(seenRaw) ? seenRaw.map((value) => String(value)) : []);

  try {
    const response = await fetch(IRS_NEWSROOM_URL);
    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const linkRegex = /<a[^>]*href=["'](\/newsroom\/irs-[a-z][^"'#?]*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const records: ChangeRecord[] = [];

    for (const match of html.matchAll(linkRegex)) {
      const href = match[1] ?? "";
      const rawTitle = match[2] ?? "";
      const title = decodeHtmlEntities(stripHtml(rawTitle));

      if (!title || title.length < 10) {
        continue;
      }

      const idx = match.index ?? 0;
      const publicationDate = parseMonthDayYear(extractNearestItemText(html, idx));
      if (!publicationDate || publicationDate < sinceDate) {
        continue;
      }

      const itemId = `irs-news-${createHash("md5").update(href).digest("hex").slice(0, 8)}`;
      if (seen.has(itemId)) {
        continue;
      }

      records.push(
        new ChangeRecord({
          id: itemId,
          source: "irs_news",
          source_name: "IRS Newsroom",
          title,
          url: `https://www.irs.gov${href}`,
          publication_date: publicationDate,
          change_types: classifyChangeTypes(title),
          affected_benefits: detectAffectedBenefits(title),
          summary: title
        })
      );
    }

    return records;
  } catch {
    return [];
  }
}

export async function fetchIrsPublications(sinceDate: string, state: Record<string, unknown>): Promise<ChangeRecord[]> {
  const sourceState = asRecord(state.irs_publications);
  const seenRaw = sourceState.seen_item_ids;
  const seen = new Set<string>(Array.isArray(seenRaw) ? seenRaw.map((value) => String(value)) : []);

  const sinceYear = Number(sinceDate.slice(0, 4));
  const currentYear = new Date().getFullYear();
  const records: ChangeRecord[] = [];

  for (let year = sinceYear; year <= currentYear; year += 1) {
    const params = new URLSearchParams({
      value: String(year),
      criteria: "postedDate",
      results: "",
      resultsPerPage: "200",
      indexOfFirstRow: "0",
      sortColumn: "postedDate",
      isDescending: "true"
    });
    const url = `https://apps.irs.gov/app/picklist/list/formsPublications.html?${params.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }

      const html = await response.text();
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

      for (const rowMatch of html.matchAll(rowRegex)) {
        const row = rowMatch[1] ?? "";
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const cells = Array.from(row.matchAll(cellRegex)).map((match) => decodeHtmlEntities(stripHtml(match[1] ?? "")));
        if (cells.length < 3) {
          continue;
        }

        const formNum = cells[0] ?? "";
        const title = cells[1] ?? "";
        const revDate = cells[2] ?? "";
        const postedDate = cells[3] ?? "";
        const publicationDate = parseMmDdYyyy(postedDate) ?? parseMonthYear(revDate);
        if (!publicationDate || publicationDate < sinceDate) {
          continue;
        }

        const hrefMatch = /<a[^>]*href=["']([^"']+)["']/i.exec(row);
        const href = hrefMatch?.[1] ?? "";
        const fullUrl = href.startsWith("/") ? `https://apps.irs.gov${href}` : href;

        const itemId = `irs-pub-${createHash("md5").update(formNum + revDate).digest("hex").slice(0, 8)}`;
        if (seen.has(itemId)) {
          continue;
        }

        records.push(
          new ChangeRecord({
            id: itemId,
            source: "irs_publications",
            source_name: "IRS Publications",
            title: `${formNum} - ${title}`,
            url: fullUrl,
            publication_date: publicationDate,
            change_types: classifyChangeTypes(title),
            affected_benefits: detectAffectedBenefits(title),
            summary: `Posted ${postedDate || revDate}: ${formNum} ${title}`
          })
        );
      }
    } catch {
      continue;
    }
  }

  return records;
}

export async function fetchInternalRevenueBulletin(
  sinceDate: string,
  state: Record<string, unknown>
): Promise<ChangeRecord[]> {
  const sourceState = asRecord(state.internal_revenue_bulletin);
  const seenRaw = sourceState.seen_item_ids;
  const seen = new Set<string>(Array.isArray(seenRaw) ? seenRaw.map((value) => String(value)) : []);

  try {
    const response = await fetch("https://www.irs.gov/irb/");
    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const linkRegex = /<a[^>]*href=["']([^"']*\/irb\/\d{4}-\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const records: ChangeRecord[] = [];
    const sinceYear = Number(sinceDate.slice(0, 4));

    for (const match of html.matchAll(linkRegex)) {
      const href = match[1] ?? "";
      const title = decodeHtmlEntities(stripHtml(match[2] ?? ""));

      const bulletinMatch = /\/irb\/(\d{4})-(\d+)/i.exec(href);
      if (!bulletinMatch) {
        continue;
      }

      const year = Number(bulletinMatch[1] ?? "0");
      const number = Number(bulletinMatch[2] ?? "0");
      if (!Number.isFinite(year) || !Number.isFinite(number) || year < sinceYear) {
        continue;
      }

      const itemId = `irb-${year}-${String(number).padStart(2, "0")}`;
      if (seen.has(itemId)) {
        continue;
      }

      const fullUrl = href.startsWith("/") ? `https://www.irs.gov${href}` : href;
      records.push(
        new ChangeRecord({
          id: itemId,
          source: "internal_revenue_bulletin",
          source_name: "Internal Revenue Bulletin",
          title: title || `IRB ${year}-${String(number).padStart(2, "0")}`,
          url: fullUrl,
          publication_date: `${year}-01-01`,
          change_types: ["revenue_ruling"],
          affected_benefits: detectAffectedBenefits(title),
          summary: `New Internal Revenue Bulletin ${year}-${String(number).padStart(2, "0")}: ${title}`
        })
      );
    }

    return records;
  } catch {
    return [];
  }
}

export async function fetchTreasuryRegulations(
  sinceDate: string,
  state: Record<string, unknown>
): Promise<ChangeRecord[]> {
  const sourceState = asRecord(state.treasury_regulations);
  const seenRaw = sourceState.seen_item_ids;
  const seen = new Set<string>(Array.isArray(seenRaw) ? seenRaw.map((value) => String(value)) : []);

  try {
    const response = await fetch(TREASURY_RSS_URL);
    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const records: ChangeRecord[] = [];

    for (const match of xml.matchAll(itemRegex)) {
      const item = match[1] ?? "";
      const title = decodeHtmlEntities(stripHtml((/<title>([\s\S]*?)<\/title>/i.exec(item)?.[1] ?? "")));
      const link = decodeHtmlEntities(stripHtml((/<link>([\s\S]*?)<\/link>/i.exec(item)?.[1] ?? "")));
      const guid = decodeHtmlEntities(stripHtml((/<guid[^>]*>([\s\S]*?)<\/guid>/i.exec(item)?.[1] ?? ""))) || link;
      const description = decodeHtmlEntities(stripHtml((/<description>([\s\S]*?)<\/description>/i.exec(item)?.[1] ?? "")));
      const pubDateRaw = decodeHtmlEntities(stripHtml((/<pubDate>([\s\S]*?)<\/pubDate>/i.exec(item)?.[1] ?? "")));
      const publicationDate = _parseRssDate(pubDateRaw) ?? sinceDate;

      if (publicationDate < sinceDate) {
        continue;
      }

      if (!TREASURY_TAX_KEYWORDS_RE.test(`${title} ${description}`)) {
        continue;
      }

      const itemId = `treasury-rss-${createHash("md5").update(guid).digest("hex").slice(0, 8)}`;
      if (seen.has(itemId)) {
        continue;
      }

      records.push(
        new ChangeRecord({
          id: itemId,
          source: "treasury_regulations",
          source_name: "Treasury Regulations",
          title,
          url: link,
          publication_date: publicationDate,
          change_types: classifyChangeTypes(title, description),
          affected_benefits: detectAffectedBenefits(title, description),
          summary: description.slice(0, 500),
          raw_abstract: description
        })
      );
    }

    return records;
  } catch {
    return [];
  }
}

export async function fetchCongressLegislation(sinceDate: string, state: Record<string, unknown>): Promise<ChangeRecord[]> {
  const sourceState = asRecord(state.congress_legislation);
  const seenRaw = sourceState.seen_item_ids;
  const seen = new Set<string>(Array.isArray(seenRaw) ? seenRaw.map((value) => String(value)) : []);

  const congressApiKey = process.env.CONGRESS_API_KEY ?? "DEMO_KEY";
  const params = new URLSearchParams({
    format: "json",
    limit: "50",
    sort: "updateDate desc",
    api_key: congressApiKey,
    fromDateTime: `${sinceDate}T00:00:00Z`
  });

  try {
    const response = await fetch(`${CONGRESS_API}?${params.toString()}`);
    if (response.status === 403 || !response.ok) {
      return [];
    }

    const data = asRecord(await response.json());
    const bills = Array.isArray(data.bills) ? (data.bills as Array<Record<string, unknown>>) : [];
    const records: ChangeRecord[] = [];

    for (const bill of bills) {
      const title = String(bill.title ?? "").trim();
      const billNum = `${String(bill.type ?? "")}${String(bill.number ?? "")}`;
      const congressNum = String(bill.congress ?? "");
      const updateDate = String(bill.updateDate ?? "").slice(0, 10);
      const originChamber = String(bill.originChamber ?? "house").toLowerCase();
      const url = `https://www.congress.gov/bill/${congressNum}th-congress/${originChamber}-bill/${String(bill.number ?? "")}`;

      if (!TREASURY_TAX_KEYWORDS_RE.test(title)) {
        const latestAction = asRecord(bill.latestAction);
        if (!TREASURY_TAX_KEYWORDS_RE.test(String(latestAction.text ?? ""))) {
          continue;
        }
      }

      if (!updateDate || updateDate < sinceDate) {
        continue;
      }

      const itemId = `congress-${congressNum}-${billNum}`;
      if (seen.has(itemId)) {
        continue;
      }

      records.push(
        new ChangeRecord({
          id: itemId,
          source: "congress_legislation",
          source_name: "Congress.gov — Tax Legislation",
          title: `${billNum}: ${title}`,
          url,
          publication_date: updateDate || sinceDate,
          change_types: classifyChangeTypes(title),
          affected_benefits: detectAffectedBenefits(title),
          summary: title
        })
      );
    }

    return records;
  } catch {
    return [];
  }
}

async function getDawsonIdToken(state: Record<string, unknown>): Promise<string | null> {
  const username = process.env.DAWSON_USERNAME;
  const password = process.env.DAWSON_PASSWORD;
  if (!username || !password) {
    return null;
  }

  const auth = asRecord(state.dawson_auth);
  const idToken = String(auth.id_token ?? "");
  const expiresAt = String(auth.expires_at ?? "");

  if (idToken && expiresAt > new Date().toISOString().slice(0, 19)) {
    return idToken;
  }

  try {
    const response = await fetch(`${DAWSON_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: username, password })
    });
    if (!response.ok) {
      return null;
    }

    const data = asRecord(await response.json());
    const token = String(data.idToken ?? data.token ?? data.id_token ?? "");
    if (!token) {
      return null;
    }

    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 55);
    state.dawson_auth = { id_token: token, expires_at: expiry.toISOString().slice(0, 19) };
    return token;
  } catch {
    return null;
  }
}

export async function fetchTaxCourt(sinceDate: string, state: Record<string, unknown>): Promise<ChangeRecord[]> {
  const idToken = await getDawsonIdToken(state);
  if (!idToken) {
    return [];
  }

  const sourceState = asRecord(state.tax_court);
  const seenRaw = sourceState.seen_item_ids;
  const seen = new Set<string>(Array.isArray(seenRaw) ? seenRaw.map((value) => String(value)) : []);

  try {
    const params = new URLSearchParams({ "dateRange.startDate": sinceDate });
    const response = await fetch(`${DAWSON_BASE}/case-documents/opinion-search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const dataObj = asRecord(data);
    const opinions: Array<Record<string, unknown>> = Array.isArray(data)
      ? (data as Array<Record<string, unknown>>)
      : Array.isArray(dataObj.results)
        ? (dataObj.results as Array<Record<string, unknown>>)
        : Array.isArray(dataObj.items)
          ? (dataObj.items as Array<Record<string, unknown>>)
          : [];

    const records: ChangeRecord[] = [];

    for (const opinion of opinions) {
      const docket = String(opinion.docketNumber ?? opinion.docketNo ?? "").trim();
      const caseTitle = String(opinion.caseTitle ?? opinion.caseName ?? opinion.title ?? "").trim();
      const docType = String(opinion.documentType ?? opinion.eventCode ?? "Opinion").trim();
      const rawDate = String(opinion.filingDate ?? opinion.receivedAt ?? "");
      const filingDate = rawDate.length >= 10 ? rawDate.slice(0, 10) : "";

      if (!docket || !caseTitle || !filingDate || filingDate < sinceDate) {
        continue;
      }

      const itemId = `tax-court-${createHash("md5").update(docket).digest("hex").slice(0, 8)}`;
      if (seen.has(itemId)) {
        continue;
      }

      const abstract = `${caseTitle} — ${docType}`;
      const url = `https://dawson.ustaxcourt.gov/case-detail/${docket.replace(/ /g, "-")}`;

      records.push(
        new ChangeRecord({
          id: itemId,
          source: "tax_court",
          source_name: "US Tax Court (DAWSON)",
          title: `${caseTitle} (${docType})`,
          url,
          publication_date: filingDate,
          change_types: classifyChangeTypes(caseTitle, abstract),
          affected_benefits: detectAffectedBenefits(caseTitle, abstract),
          summary: abstract.slice(0, 500),
          document_number: docket,
          document_type: docType,
          raw_abstract: abstract
        })
      );
    }

    return records;
  } catch {
    return [];
  }
}

async function scrapeStateNewsPage(
  url: string,
  source: string,
  sourceName: string,
  sinceDate: string,
  state: Record<string, unknown>
): Promise<ChangeRecord[]> {
  const sourceState = asRecord(state[source]);
  const seenRaw = sourceState.seen_item_ids;
  const seen = new Set<string>(Array.isArray(seenRaw) ? seenRaw.map((value) => String(value)) : []);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const candidates: Array<{ title: string; href: string; pubDate: string }> = [];

    // Pattern 1: class-named containers (article/li/div with news-like class names)
    const containerRegex = /<(article|li|div)[^>]*class="[^"]*(?:news|press|release|article-item|update|entry)[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi;
    for (const m of html.matchAll(containerRegex)) {
      const block = m[2] ?? "";
      const linkMatch = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
      if (!linkMatch) {
        continue;
      }
      const href = linkMatch[1] ?? "";
      const rawTitle = decodeHtmlEntities(stripHtml(linkMatch[2] ?? ""));
      if (!rawTitle || rawTitle.length < 10) {
        continue;
      }
      const blockText = stripHtml(block);
      const pubDate = parseMonthDayYear(blockText) ?? parseMmDdYyyy(blockText);
      if (pubDate && pubDate >= sinceDate) {
        candidates.push({ title: rawTitle, href, pubDate });
      }
    }

    // Pattern 2: headings with nearby links and date text
    if (candidates.length === 0) {
      const headingRegex = /<h[234][^>]*>([\s\S]*?)<\/h[234]>/gi;
      for (const m of html.matchAll(headingRegex)) {
        const block = m[1] ?? "";
        const linkMatch = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
        if (!linkMatch) {
          continue;
        }
        const href = linkMatch[1] ?? "";
        const rawTitle = decodeHtmlEntities(stripHtml(block));
        if (!rawTitle || rawTitle.length < 10) {
          continue;
        }
        const idx = m.index ?? 0;
        const context = stripHtml(html.slice(idx, Math.min(html.length, idx + 500)));
        const pubDate = parseMonthDayYear(context) ?? parseMmDdYyyy(context);
        if (pubDate && pubDate >= sinceDate) {
          candidates.push({ title: rawTitle, href, pubDate });
        }
      }
    }

    const baseUrl = new URL(url).origin;
    const records: ChangeRecord[] = [];

    for (const { title, href, pubDate } of candidates.slice(0, 20)) {
      const fullUrl = href.startsWith("http")
        ? href
        : href.startsWith("/")
          ? `${baseUrl}${href}`
          : `${url.replace(/\/?$/, "/")}${href.replace(/^\//, "")}`;
      const itemId = `${source}-${createHash("md5").update(href).digest("hex").slice(0, 8)}`;
      if (seen.has(itemId)) {
        continue;
      }

      records.push(
        new ChangeRecord({
          id: itemId,
          source,
          source_name: sourceName,
          title,
          url: fullUrl,
          publication_date: pubDate,
          change_types: classifyChangeTypes(title),
          affected_benefits: detectAffectedBenefits(title),
          summary: title
        })
      );
    }

    return records;
  } catch {
    return [];
  }
}

export async function aiClassifyChanges(records: ChangeRecord[]): Promise<ChangeRecord[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return records;
  }

  const client = new Anthropic({ apiKey });
  const enriched: ChangeRecord[] = [];

  for (const record of records) {
    if (record.raw_abstract.length < 50) {
      enriched.push(record);
      continue;
    }

    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: [
          {
            type: "text",
            text: AI_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" }
          }
        ],
        messages: [
          {
            role: "user",
            content: `Title: ${record.title}\n\nAbstract: ${record.raw_abstract.slice(0, 2000)}`
          }
        ]
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : "";
      const jsonMatch = /\{[\s\S]+\}/.exec(text);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          change_types?: string[];
          affected_benefits?: string[];
          summary?: string;
        };
        if (Array.isArray(parsed.change_types) && parsed.change_types.length > 0) {
          record.change_types = parsed.change_types;
        }
        if (Array.isArray(parsed.affected_benefits)) {
          record.affected_benefits = parsed.affected_benefits;
        }
        if (typeof parsed.summary === "string" && parsed.summary) {
          record.ai_summary = parsed.summary;
        }
        record.ai_classified = true;
      }
    } catch {
      // keep original classification on any error
    }

    enriched.push(record);
  }

  return enriched;
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
  if (source === "irs_publications") {
    return fetchIrsPublications(sinceDate, state);
  }
  if (source === "internal_revenue_bulletin") {
    return fetchInternalRevenueBulletin(sinceDate, state);
  }
  if (source === "treasury_regulations") {
    return fetchTreasuryRegulations(sinceDate, state);
  }
  if (source === "congress_legislation") {
    return fetchCongressLegislation(sinceDate, state);
  }
  if (source === "tax_court") {
    return fetchTaxCourt(sinceDate, state);
  }
  const stateConfig = STATE_SOURCES[source];
  if (stateConfig) {
    return scrapeStateNewsPage(stateConfig.url, source, stateConfig.name, sinceDate, state);
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
    return;
  }
  if (source === "irs_publications") {
    updateIrsPublicationsState(state, records);
    return;
  }
  if (source === "internal_revenue_bulletin") {
    updateInternalRevenueBulletinState(state, records);
    return;
  }
  if (source === "treasury_regulations") {
    updateTreasuryRegulationsState(state, records);
    return;
  }
  updateSimpleState(source, state, records);
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
    allNewRecords.push(...records);
    updateSourceState(source, state, records);
  }

  const finalRecords = await aiClassifyChanges(allNewRecords);

  if (!dryRun) {
    for (const record of finalRecords) {
      saveChangeRecord(record, dryRun);
    }
    saveState(state);
    writeSummaryReport(finalRecords, dryRun);
  }

  return {
    since_date: sinceDate,
    source: options.source ?? null,
    dry_run: dryRun,
    new_changes: finalRecords.length
  };
}
