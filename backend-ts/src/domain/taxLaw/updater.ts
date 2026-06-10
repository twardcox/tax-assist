import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import yaml from "js-yaml";
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
