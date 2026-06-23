import { withClient } from "./client";

const TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    is_active SMALLINT NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti TEXT PRIMARY KEY,
    revoked_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS household_data (
    user_id TEXT NOT NULL,
    tax_year INTEGER NOT NULL,
    data_json TEXT NOT NULL DEFAULT '{}',
    filing_status TEXT NOT NULL DEFAULT '',
    estimated_agi DOUBLE PRECISION,
    prior_year_agi DOUBLE PRECISION,
    itemizing_deductions SMALLINT,
    digital_assets SMALLINT,
    has_electric_vehicle SMALLINT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, tax_year),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS income_data (
    user_id TEXT NOT NULL,
    tax_year INTEGER NOT NULL,
    data_json TEXT NOT NULL DEFAULT '{}',
    w2_employment TEXT NOT NULL DEFAULT '[]',
    other_wages TEXT NOT NULL DEFAULT '{}',
    self_employment TEXT NOT NULL DEFAULT '[]',
    rental_income TEXT NOT NULL DEFAULT '[]',
    investment_income TEXT NOT NULL DEFAULT '{}',
    retirement_distributions TEXT NOT NULL DEFAULT '{}',
    social_security TEXT NOT NULL DEFAULT '{}',
    passive_income TEXT NOT NULL DEFAULT '{}',
    other_income TEXT NOT NULL DEFAULT '{}',
    farm TEXT NOT NULL DEFAULT '{}',
    adjustments_to_income TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, tax_year),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS businesses_data (
    user_id TEXT NOT NULL,
    tax_year INTEGER NOT NULL,
    data_json TEXT NOT NULL DEFAULT '{}',
    businesses TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, tax_year),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS real_estate_data (
    user_id TEXT NOT NULL,
    tax_year INTEGER NOT NULL,
    data_json TEXT NOT NULL DEFAULT '{}',
    properties TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, tax_year),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS investments_data (
    user_id TEXT NOT NULL,
    tax_year INTEGER NOT NULL,
    data_json TEXT NOT NULL DEFAULT '{}',
    taxable_accounts TEXT NOT NULL DEFAULT '[]',
    plans_529 TEXT NOT NULL DEFAULT '[]',
    opportunity_zone_investments TEXT NOT NULL DEFAULT '[]',
    crypto TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, tax_year),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS retirement_data (
    user_id TEXT NOT NULL,
    tax_year INTEGER NOT NULL,
    data_json TEXT NOT NULL DEFAULT '{}',
    employer_plans TEXT NOT NULL DEFAULT '{}',
    individual_retirement_accounts TEXT NOT NULL DEFAULT '{}',
    self_employed_plans TEXT NOT NULL DEFAULT '{}',
    roth_conversion TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, tax_year),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS healthcare_data (
    user_id TEXT NOT NULL,
    tax_year INTEGER NOT NULL,
    data_json TEXT NOT NULL DEFAULT '{}',
    insurance TEXT NOT NULL DEFAULT '{}',
    health_savings_account TEXT NOT NULL DEFAULT '{}',
    flexible_spending_accounts TEXT NOT NULL DEFAULT '{}',
    long_term_care TEXT NOT NULL DEFAULT '{}',
    medical_expenses TEXT NOT NULL DEFAULT '{}',
    self_employed_health_insurance TEXT NOT NULL DEFAULT '{}',
    premium_tax_credit TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, tax_year),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS dependents_data (
    user_id TEXT NOT NULL,
    tax_year INTEGER NOT NULL,
    data_json TEXT NOT NULL DEFAULT '{}',
    dependents TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, tax_year),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS goals_data (
    user_id TEXT NOT NULL,
    tax_year INTEGER NOT NULL,
    data_json TEXT NOT NULL DEFAULT '{}',
    primary_goals TEXT NOT NULL DEFAULT '{}',
    timeline TEXT NOT NULL DEFAULT '{}',
    risk_tolerance TEXT NOT NULL DEFAULT '{}',
    professional_advisors TEXT NOT NULL DEFAULT '{}',
    major_life_events_this_year TEXT NOT NULL DEFAULT '{}',
    anticipated_changes_next_year TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, tax_year),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS section_data (
    user_id TEXT NOT NULL,
    tax_year INTEGER NOT NULL,
    section TEXT NOT NULL,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, tax_year, section),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS households (
    user_id TEXT NOT NULL,
    tax_year INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    pec_fund_taxpayer SMALLINT NOT NULL DEFAULT 0,
    pec_fund_spouse SMALLINT NOT NULL DEFAULT 0,
    direct_deposit_routing TEXT,
    direct_deposit_account TEXT,
    direct_deposit_type TEXT,
    allow_third_party SMALLINT NOT NULL DEFAULT 0,
    designee_name TEXT,
    designee_phone TEXT,
    designee_pin TEXT,
    PRIMARY KEY (user_id, tax_year),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    date TEXT,
    merchant TEXT,
    total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    deductible_pct DOUBLE PRECISION NOT NULL DEFAULT 1,
    deductible_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    tax_category TEXT,
    benefit_ids TEXT NOT NULL DEFAULT '[]',
    form_line TEXT,
    section TEXT,
    dot_path TEXT,
    status TEXT NOT NULL DEFAULT 'applied',
    applied_at TEXT NOT NULL,
    label TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    subdir TEXT NOT NULL,
    path TEXT NOT NULL,
    category TEXT,
    confidence TEXT,
    document_type TEXT,
    note TEXT,
    size INTEGER NOT NULL DEFAULT 0,
    extracted SMALLINT NOT NULL DEFAULT 0,
    extraction_json TEXT,
    content BYTEA,
    uploaded_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_household_user_year ON household_data(user_id, tax_year)`,
  `CREATE INDEX IF NOT EXISTS idx_income_user_year ON income_data(user_id, tax_year)`,
  `CREATE INDEX IF NOT EXISTS idx_businesses_user_year ON businesses_data(user_id, tax_year)`,
  `CREATE INDEX IF NOT EXISTS idx_real_estate_user_year ON real_estate_data(user_id, tax_year)`,
  `CREATE INDEX IF NOT EXISTS idx_section_data_user_year ON section_data(user_id, tax_year)`,
  `CREATE INDEX IF NOT EXISTS idx_txn_user ON transactions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_txn_status ON transactions(user_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, uploaded_at)`,
];

const SECTION_TABLES = [
  "household_data",
  "income_data",
  "businesses_data",
  "real_estate_data",
  "investments_data",
  "retirement_data",
  "healthcare_data",
  "dependents_data",
  "goals_data",
] as const;

export async function initDb(): Promise<void> {
  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      for (const stmt of TABLE_STATEMENTS) {
        await client.query(stmt);
      }

      for (const table of SECTION_TABLES) {
        await client.query(
          `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS data_json TEXT NOT NULL DEFAULT '{}'`
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  });
}
