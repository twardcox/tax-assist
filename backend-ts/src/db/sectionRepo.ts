import { query, queryOne, execute } from "./client";

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

async function readDataJson(table: string, userId: string, taxYear: number): Promise<Record<string, unknown>> {
  const row = await queryOne<{ data_json: string }>(
    `SELECT data_json FROM ${table} WHERE user_id = $1 AND tax_year = $2`,
    [userId, taxYear]
  );
  return row ? safeJson(row.data_json, {}) : {};
}

// ── household_data ────────────────────────────────────────────────────────────

async function getHousehold(userId: string, taxYear: number): Promise<Record<string, unknown>> {
  return readDataJson("household_data", userId, taxYear);
}

async function saveHousehold(userId: string, taxYear: number, data: Record<string, unknown>): Promise<void> {
  await execute(`
    INSERT INTO household_data (
      user_id, tax_year, data_json,
      filing_status, estimated_agi, prior_year_agi,
      itemizing_deductions, digital_assets, has_electric_vehicle,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = EXCLUDED.data_json,
      filing_status = EXCLUDED.filing_status,
      estimated_agi = EXCLUDED.estimated_agi,
      prior_year_agi = EXCLUDED.prior_year_agi,
      itemizing_deductions = EXCLUDED.itemizing_deductions,
      digital_assets = EXCLUDED.digital_assets,
      has_electric_vehicle = EXCLUDED.has_electric_vehicle,
      updated_at = NOW()
  `, [
    userId, taxYear,
    JSON.stringify(data),
    String(data["filing_status"] ?? ""),
    numOrNull(data["estimated_agi"]),
    numOrNull(data["prior_year_agi"]),
    boolCol(data["itemizing_deductions"]),
    boolCol(data["digital_assets"]),
    boolCol(data["has_electric_vehicle"]),
  ]);
}

// ── income_data ───────────────────────────────────────────────────────────────

async function getIncome(userId: string, taxYear: number): Promise<Record<string, unknown>> {
  return readDataJson("income_data", userId, taxYear);
}

async function saveIncome(userId: string, taxYear: number, data: Record<string, unknown>): Promise<void> {
  await execute(`
    INSERT INTO income_data (
      user_id, tax_year, data_json,
      w2_employment, other_wages, self_employment,
      rental_income, investment_income, retirement_distributions,
      social_security, passive_income, other_income, farm,
      adjustments_to_income, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = EXCLUDED.data_json,
      w2_employment = EXCLUDED.w2_employment,
      other_wages = EXCLUDED.other_wages,
      self_employment = EXCLUDED.self_employment,
      rental_income = EXCLUDED.rental_income,
      investment_income = EXCLUDED.investment_income,
      retirement_distributions = EXCLUDED.retirement_distributions,
      social_security = EXCLUDED.social_security,
      passive_income = EXCLUDED.passive_income,
      other_income = EXCLUDED.other_income,
      farm = EXCLUDED.farm,
      adjustments_to_income = EXCLUDED.adjustments_to_income,
      updated_at = NOW()
  `, [
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
  ]);
}

// ── businesses_data ───────────────────────────────────────────────────────────

async function getBusinesses(userId: string, taxYear: number): Promise<Record<string, unknown>> {
  return readDataJson("businesses_data", userId, taxYear);
}

async function saveBusinesses(userId: string, taxYear: number, data: Record<string, unknown>): Promise<void> {
  await execute(`
    INSERT INTO businesses_data (user_id, tax_year, data_json, businesses, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = EXCLUDED.data_json,
      businesses = EXCLUDED.businesses,
      updated_at = NOW()
  `, [userId, taxYear, JSON.stringify(data), jArr(data["businesses"])]);
}

// ── real_estate_data ──────────────────────────────────────────────────────────

async function getRealEstate(userId: string, taxYear: number): Promise<Record<string, unknown>> {
  return readDataJson("real_estate_data", userId, taxYear);
}

async function saveRealEstate(userId: string, taxYear: number, data: Record<string, unknown>): Promise<void> {
  await execute(`
    INSERT INTO real_estate_data (user_id, tax_year, data_json, properties, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = EXCLUDED.data_json,
      properties = EXCLUDED.properties,
      updated_at = NOW()
  `, [userId, taxYear, JSON.stringify(data), jArr(data["properties"])]);
}

// ── investments_data ──────────────────────────────────────────────────────────

async function getInvestments(userId: string, taxYear: number): Promise<Record<string, unknown>> {
  return readDataJson("investments_data", userId, taxYear);
}

async function saveInvestments(userId: string, taxYear: number, data: Record<string, unknown>): Promise<void> {
  await execute(`
    INSERT INTO investments_data (
      user_id, tax_year, data_json,
      taxable_accounts, plans_529, opportunity_zone_investments, crypto,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = EXCLUDED.data_json,
      taxable_accounts = EXCLUDED.taxable_accounts,
      plans_529 = EXCLUDED.plans_529,
      opportunity_zone_investments = EXCLUDED.opportunity_zone_investments,
      crypto = EXCLUDED.crypto,
      updated_at = NOW()
  `, [
    userId, taxYear,
    JSON.stringify(data),
    jArr(data["taxable_accounts"]),
    jArr(data["529_plans"]),
    jArr(data["opportunity_zone_investments"]),
    jObj(data["crypto"]),
  ]);
}

// ── retirement_data ───────────────────────────────────────────────────────────

async function getRetirement(userId: string, taxYear: number): Promise<Record<string, unknown>> {
  return readDataJson("retirement_data", userId, taxYear);
}

async function saveRetirement(userId: string, taxYear: number, data: Record<string, unknown>): Promise<void> {
  await execute(`
    INSERT INTO retirement_data (
      user_id, tax_year, data_json,
      employer_plans, individual_retirement_accounts,
      self_employed_plans, roth_conversion, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = EXCLUDED.data_json,
      employer_plans = EXCLUDED.employer_plans,
      individual_retirement_accounts = EXCLUDED.individual_retirement_accounts,
      self_employed_plans = EXCLUDED.self_employed_plans,
      roth_conversion = EXCLUDED.roth_conversion,
      updated_at = NOW()
  `, [
    userId, taxYear,
    JSON.stringify(data),
    jObj(data["employer_plans"]),
    jObj(data["individual_retirement_accounts"]),
    jObj(data["self_employed_plans"]),
    jObj(data["roth_conversion"]),
  ]);
}

// ── healthcare_data ───────────────────────────────────────────────────────────

async function getHealthcare(userId: string, taxYear: number): Promise<Record<string, unknown>> {
  return readDataJson("healthcare_data", userId, taxYear);
}

async function saveHealthcare(userId: string, taxYear: number, data: Record<string, unknown>): Promise<void> {
  await execute(`
    INSERT INTO healthcare_data (
      user_id, tax_year, data_json,
      insurance, health_savings_account, flexible_spending_accounts,
      long_term_care, medical_expenses, self_employed_health_insurance,
      premium_tax_credit, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = EXCLUDED.data_json,
      insurance = EXCLUDED.insurance,
      health_savings_account = EXCLUDED.health_savings_account,
      flexible_spending_accounts = EXCLUDED.flexible_spending_accounts,
      long_term_care = EXCLUDED.long_term_care,
      medical_expenses = EXCLUDED.medical_expenses,
      self_employed_health_insurance = EXCLUDED.self_employed_health_insurance,
      premium_tax_credit = EXCLUDED.premium_tax_credit,
      updated_at = NOW()
  `, [
    userId, taxYear,
    JSON.stringify(data),
    jObj(data["insurance"]),
    jObj(data["health_savings_account"]),
    jObj(data["flexible_spending_accounts"]),
    jObj(data["long_term_care"]),
    jObj(data["medical_expenses"]),
    jObj(data["self_employed_health_insurance"]),
    jObj(data["premium_tax_credit"]),
  ]);
}

// ── dependents_data ───────────────────────────────────────────────────────────

async function getDependents(userId: string, taxYear: number): Promise<Record<string, unknown>> {
  return readDataJson("dependents_data", userId, taxYear);
}

async function saveDependents(userId: string, taxYear: number, data: Record<string, unknown>): Promise<void> {
  await execute(`
    INSERT INTO dependents_data (user_id, tax_year, data_json, dependents, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = EXCLUDED.data_json,
      dependents = EXCLUDED.dependents,
      updated_at = NOW()
  `, [userId, taxYear, JSON.stringify(data), jArr(data["dependents"])]);
}

// ── goals_data ────────────────────────────────────────────────────────────────

async function getGoals(userId: string, taxYear: number): Promise<Record<string, unknown>> {
  return readDataJson("goals_data", userId, taxYear);
}

async function saveGoals(userId: string, taxYear: number, data: Record<string, unknown>): Promise<void> {
  await execute(`
    INSERT INTO goals_data (
      user_id, tax_year, data_json,
      primary_goals, timeline, risk_tolerance,
      professional_advisors, major_life_events_this_year,
      anticipated_changes_next_year, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT(user_id, tax_year) DO UPDATE SET
      data_json = EXCLUDED.data_json,
      primary_goals = EXCLUDED.primary_goals,
      timeline = EXCLUDED.timeline,
      risk_tolerance = EXCLUDED.risk_tolerance,
      professional_advisors = EXCLUDED.professional_advisors,
      major_life_events_this_year = EXCLUDED.major_life_events_this_year,
      anticipated_changes_next_year = EXCLUDED.anticipated_changes_next_year,
      updated_at = NOW()
  `, [
    userId, taxYear,
    JSON.stringify(data),
    jObj(data["primary_goals"]),
    jObj(data["timeline"]),
    jObj(data["risk_tolerance"]),
    jObj(data["professional_advisors"]),
    jObj(data["major_life_events_this_year"]),
    jObj(data["anticipated_changes_next_year"]),
  ]);
}

// ── section_data fallback (documents_index, etc.) ─────────────────────────────

async function getSectionBlob(userId: string, taxYear: number, section: string): Promise<Record<string, unknown>> {
  const row = await queryOne<{ data_json: string }>(
    "SELECT data_json FROM section_data WHERE user_id = $1 AND tax_year = $2 AND section = $3",
    [userId, taxYear, section]
  );

  if (!row) return {};
  try {
    return (JSON.parse(row.data_json) as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

async function saveSectionBlob(userId: string, taxYear: number, section: string, data: object): Promise<void> {
  await execute(`
    INSERT INTO section_data (user_id, tax_year, section, data_json, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT(user_id, tax_year, section) DO UPDATE SET
      data_json = EXCLUDED.data_json,
      updated_at = NOW()
  `, [userId, taxYear, section, JSON.stringify(data)]);
}

// ── Dispatch table ────────────────────────────────────────────────────────────

type SectionHandler = {
  get: (userId: string, taxYear: number) => Promise<Record<string, unknown>>;
  save: (userId: string, taxYear: number, data: Record<string, unknown>) => Promise<void>;
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

// ── Public API ────────────────────────────────────────────────────────────────

export async function getSectionData(userId: string, taxYear: number, section: string): Promise<Record<string, unknown>> {
  const handler = HANDLERS[section];
  if (handler) return handler.get(userId, taxYear);
  return getSectionBlob(userId, taxYear, section);
}

export async function saveSectionData(userId: string, taxYear: number, section: string, data: object): Promise<void> {
  const handler = HANDLERS[section];
  if (handler) {
    await handler.save(userId, taxYear, data as Record<string, unknown>);
    return;
  }
  await saveSectionBlob(userId, taxYear, section, data);
}

function assignPath(target: Record<string, unknown>, dotPath: string, operation: string, value: unknown): boolean {
  const parts = dotPath.split(".").filter(Boolean);
  if (parts.length === 0) return false;

  const BANNED = new Set(["__proto__", "constructor", "prototype"]);
  if (parts.some(p => BANNED.has(p))) return false;

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

export async function applyDotPathToSection(
  userId: string,
  taxYear: number,
  section: string,
  dotPath: string,
  operation: string,
  value: unknown
): Promise<boolean> {
  const data = await getSectionData(userId, taxYear, section);
  const updated = { ...data };
  if (!assignPath(updated, dotPath, operation, value)) return false;
  await saveSectionData(userId, taxYear, section, updated);
  return true;
}
