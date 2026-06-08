import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { projectPaths } from "../../lib/paths";

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
