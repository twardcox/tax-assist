import { getDb } from "./client";

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeJson(raw: string | null | undefined, fallback: Record<string, unknown>): Record<string, unknown> {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : fallback;
  } catch {
    return fallback;
  }
}

function jArr(val: unknown): string {
  return JSON.stringify(Array.isArray(val) ? val : []);
}

function jObj(val: unknown): string {
  return JSON.stringify(val && typeof val === "object" && !Array.isArray(val) ? val : {});
}

function numOrNull(val: unknown): number | null {
  const n = Number(val);
  return val == null || val === "" ? null : Number.isFinite(n) ? n : null;
}

function boolCol(val: unknown): number {
  return val ? 1 : 0;
}


// ── Canonical getter: always read from data_json ──────────────────────────────

function readDataJson(table: string, userId: string, taxYear: number): Record<string, unknown> {
  const db = getDb();
  const row = db
    .prepare(`SELECT data_json FROM ${table} WHERE user_id = ? AND tax_year = ?`)
    .get(userId, taxYear) as { data_json: string } | undefined;
  return row ? safeJson(row.data_json, {}) : {};
}

// ── household_data ────────────────────────────────────────────────────────────

function getHousehold(userId: string, taxYear: number): Record<string, unknown> {
  return readDataJson("household_data", userId, taxYear);
}

function saveHousehold(userId: string, taxYear: number, data: Record<string, unknown>): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO household_data (
      user_id, tax_year, data_json,
      filing_status, estimated_agi, prior_year_agi,
      itemizing_deductions, digital_assets, has_electric_vehicle,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = excluded.data_json,
      filing_status = excluded.filing_status,
      estimated_agi = excluded.estimated_agi,
      prior_year_agi = excluded.prior_year_agi,
      itemizing_deductions = excluded.itemizing_deductions,
      digital_assets = excluded.digital_assets,
      has_electric_vehicle = excluded.has_electric_vehicle,
      updated_at = excluded.updated_at
  `).run(
    userId, taxYear,
    JSON.stringify(data),
    String(data["filing_status"] ?? ""),
    numOrNull(data["estimated_agi"]),
    numOrNull(data["prior_year_agi"]),
    boolCol(data["itemizing_deductions"]),
    boolCol(data["digital_assets"]),
    boolCol(data["has_electric_vehicle"]),
    now,
  );
}

// ── income_data ───────────────────────────────────────────────────────────────

function getIncome(userId: string, taxYear: number): Record<string, unknown> {
  return readDataJson("income_data", userId, taxYear);
}

function saveIncome(userId: string, taxYear: number, data: Record<string, unknown>): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO income_data (
      user_id, tax_year, data_json,
      w2_employment, other_wages, self_employment,
      rental_income, investment_income, retirement_distributions,
      social_security, passive_income, other_income, farm,
      adjustments_to_income, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = excluded.data_json,
      w2_employment = excluded.w2_employment,
      other_wages = excluded.other_wages,
      self_employment = excluded.self_employment,
      rental_income = excluded.rental_income,
      investment_income = excluded.investment_income,
      retirement_distributions = excluded.retirement_distributions,
      social_security = excluded.social_security,
      passive_income = excluded.passive_income,
      other_income = excluded.other_income,
      farm = excluded.farm,
      adjustments_to_income = excluded.adjustments_to_income,
      updated_at = excluded.updated_at
  `).run(
    userId, taxYear,
    JSON.stringify(data),
    jArr(data["w2_employment"]),
    jObj(data["other_wages"]),
    jArr(data["self_employment"]),
    jArr(data["rental_income"]),
    jObj(data["investment_income"]),
    jObj(data["retirement_distributions"]),
    jObj(data["social_security"]),
    jObj(data["passive_income"]),
    jObj(data["other_income"]),
    jObj(data["farm"]),
    jObj(data["adjustments_to_income"]),
    now,
  );
}

// ── businesses_data ───────────────────────────────────────────────────────────

function getBusinesses(userId: string, taxYear: number): Record<string, unknown> {
  return readDataJson("businesses_data", userId, taxYear);
}

function saveBusinesses(userId: string, taxYear: number, data: Record<string, unknown>): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO businesses_data (user_id, tax_year, data_json, businesses, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = excluded.data_json,
      businesses = excluded.businesses,
      updated_at = excluded.updated_at
  `).run(userId, taxYear, JSON.stringify(data), jArr(data["businesses"]), now);
}

// ── real_estate_data ──────────────────────────────────────────────────────────

function getRealEstate(userId: string, taxYear: number): Record<string, unknown> {
  return readDataJson("real_estate_data", userId, taxYear);
}

function saveRealEstate(userId: string, taxYear: number, data: Record<string, unknown>): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO real_estate_data (user_id, tax_year, data_json, properties, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = excluded.data_json,
      properties = excluded.properties,
      updated_at = excluded.updated_at
  `).run(userId, taxYear, JSON.stringify(data), jArr(data["properties"]), now);
}

// ── investments_data ──────────────────────────────────────────────────────────

function getInvestments(userId: string, taxYear: number): Record<string, unknown> {
  return readDataJson("investments_data", userId, taxYear);
}

function saveInvestments(userId: string, taxYear: number, data: Record<string, unknown>): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO investments_data (
      user_id, tax_year, data_json,
      taxable_accounts, plans_529, opportunity_zone_investments, crypto,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = excluded.data_json,
      taxable_accounts = excluded.taxable_accounts,
      plans_529 = excluded.plans_529,
      opportunity_zone_investments = excluded.opportunity_zone_investments,
      crypto = excluded.crypto,
      updated_at = excluded.updated_at
  `).run(
    userId, taxYear,
    JSON.stringify(data),
    jArr(data["taxable_accounts"]),
    jArr(data["529_plans"]),
    jArr(data["opportunity_zone_investments"]),
    jObj(data["crypto"]),
    now,
  );
}

// ── retirement_data ───────────────────────────────────────────────────────────

function getRetirement(userId: string, taxYear: number): Record<string, unknown> {
  return readDataJson("retirement_data", userId, taxYear);
}

function saveRetirement(userId: string, taxYear: number, data: Record<string, unknown>): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO retirement_data (
      user_id, tax_year, data_json,
      employer_plans, individual_retirement_accounts,
      self_employed_plans, roth_conversion, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = excluded.data_json,
      employer_plans = excluded.employer_plans,
      individual_retirement_accounts = excluded.individual_retirement_accounts,
      self_employed_plans = excluded.self_employed_plans,
      roth_conversion = excluded.roth_conversion,
      updated_at = excluded.updated_at
  `).run(
    userId, taxYear,
    JSON.stringify(data),
    jObj(data["employer_plans"]),
    jObj(data["individual_retirement_accounts"]),
    jObj(data["self_employed_plans"]),
    jObj(data["roth_conversion"]),
    now,
  );
}

// ── healthcare_data ───────────────────────────────────────────────────────────

function getHealthcare(userId: string, taxYear: number): Record<string, unknown> {
  return readDataJson("healthcare_data", userId, taxYear);
}

function saveHealthcare(userId: string, taxYear: number, data: Record<string, unknown>): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO healthcare_data (
      user_id, tax_year, data_json,
      insurance, health_savings_account, flexible_spending_accounts,
      long_term_care, medical_expenses, self_employed_health_insurance,
      premium_tax_credit, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = excluded.data_json,
      insurance = excluded.insurance,
      health_savings_account = excluded.health_savings_account,
      flexible_spending_accounts = excluded.flexible_spending_accounts,
      long_term_care = excluded.long_term_care,
      medical_expenses = excluded.medical_expenses,
      self_employed_health_insurance = excluded.self_employed_health_insurance,
      premium_tax_credit = excluded.premium_tax_credit,
      updated_at = excluded.updated_at
  `).run(
    userId, taxYear,
    JSON.stringify(data),
    jObj(data["insurance"]),
    jObj(data["health_savings_account"]),
    jObj(data["flexible_spending_accounts"]),
    jObj(data["long_term_care"]),
    jObj(data["medical_expenses"]),
    jObj(data["self_employed_health_insurance"]),
    jObj(data["premium_tax_credit"]),
    now,
  );
}

// ── dependents_data ───────────────────────────────────────────────────────────

function getDependents(userId: string, taxYear: number): Record<string, unknown> {
  return readDataJson("dependents_data", userId, taxYear);
}

function saveDependents(userId: string, taxYear: number, data: Record<string, unknown>): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO dependents_data (user_id, tax_year, data_json, dependents, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = excluded.data_json,
      dependents = excluded.dependents,
      updated_at = excluded.updated_at
  `).run(userId, taxYear, JSON.stringify(data), jArr(data["dependents"]), now);
}

// ── goals_data ────────────────────────────────────────────────────────────────

function getGoals(userId: string, taxYear: number): Record<string, unknown> {
  return readDataJson("goals_data", userId, taxYear);
}

function saveGoals(userId: string, taxYear: number, data: Record<string, unknown>): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO goals_data (
      user_id, tax_year, data_json,
      primary_goals, timeline, risk_tolerance,
      professional_advisors, major_life_events_this_year,
      anticipated_changes_next_year, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = excluded.data_json,
      primary_goals = excluded.primary_goals,
      timeline = excluded.timeline,
      risk_tolerance = excluded.risk_tolerance,
      professional_advisors = excluded.professional_advisors,
      major_life_events_this_year = excluded.major_life_events_this_year,
      anticipated_changes_next_year = excluded.anticipated_changes_next_year,
      updated_at = excluded.updated_at
  `).run(
    userId, taxYear,
    JSON.stringify(data),
    jObj(data["primary_goals"]),
    jObj(data["timeline"]),
    jObj(data["risk_tolerance"]),
    jObj(data["professional_advisors"]),
    jObj(data["major_life_events_this_year"]),
    jObj(data["anticipated_changes_next_year"]),
    now,
  );
}

// ── section_data fallback (documents_index, etc.) ─────────────────────────────

function getSectionBlob(userId: string, taxYear: number, section: string): Record<string, unknown> {
  const db = getDb();
  const row = db
    .prepare("SELECT data_json FROM section_data WHERE user_id = ? AND tax_year = ? AND section = ?")
    .get(userId, taxYear, section) as { data_json: string } | undefined;

  if (!row) return {};
  try {
    return (JSON.parse(row.data_json) as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

function saveSectionBlob(userId: string, taxYear: number, section: string, data: object): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO section_data (user_id, tax_year, section, data_json, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, tax_year, section) DO UPDATE SET
      data_json = excluded.data_json,
      updated_at = excluded.updated_at
  `).run(userId, taxYear, section, JSON.stringify(data), now);
}

// ── Dispatch table ────────────────────────────────────────────────────────────

type SectionHandler = {
  get: (userId: string, taxYear: number) => Record<string, unknown>;
  save: (userId: string, taxYear: number, data: Record<string, unknown>) => void;
};

const HANDLERS: Record<string, SectionHandler> = {
  household:   { get: getHousehold,   save: saveHousehold   },
  income:      { get: getIncome,      save: saveIncome      },
  businesses:  { get: getBusinesses,  save: saveBusinesses  },
  real_estate: { get: getRealEstate,  save: saveRealEstate  },
  investments: { get: getInvestments, save: saveInvestments },
  retirement:  { get: getRetirement,  save: saveRetirement  },
  healthcare:  { get: getHealthcare,  save: saveHealthcare  },
  dependents:  { get: getDependents,  save: saveDependents  },
  goals:       { get: getGoals,       save: saveGoals       },
};

// ── Public API (unchanged from callers' perspective) ──────────────────────────

export function getSectionData(userId: string, taxYear: number, section: string): Record<string, unknown> {
  const handler = HANDLERS[section];
  if (handler) return handler.get(userId, taxYear);
  return getSectionBlob(userId, taxYear, section);
}

export function saveSectionData(userId: string, taxYear: number, section: string, data: object): void {
  const handler = HANDLERS[section];
  if (handler) {
    handler.save(userId, taxYear, data as Record<string, unknown>);
    return;
  }
  saveSectionBlob(userId, taxYear, section, data);
}

function assignPath(target: Record<string, unknown>, dotPath: string, operation: string, value: unknown): boolean {
  const parts = dotPath.split(".").filter(Boolean);
  if (parts.length === 0) return false;

  let current: unknown = target;
  for (const part of parts.slice(0, -1)) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return false;
    const obj = current as Record<string, unknown>;
    if (!(part in obj) || obj[part] == null || typeof obj[part] !== "object") {
      obj[part] = {};
    }
    current = obj[part];
  }

  const last = parts[parts.length - 1];
  if (!current || typeof current !== "object" || Array.isArray(current)) return false;

  const obj = current as Record<string, unknown>;
  if (operation === "add") {
    obj[last] = Number(obj[last] ?? 0) + Number(value ?? 0);
  } else {
    obj[last] = value;
  }
  return true;
}

export function applyDotPathToSection(
  userId: string,
  taxYear: number,
  section: string,
  dotPath: string,
  operation: string,
  value: unknown
): boolean {
  const data = getSectionData(userId, taxYear, section);
  const updated = { ...data };
  if (!assignPath(updated, dotPath, operation, value)) return false;
  saveSectionData(userId, taxYear, section, updated);
  return true;
}
