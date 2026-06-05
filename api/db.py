"""
Central SQLite database for UTBIS.

DB path: state/transactions.db  (expanded from transaction-ledger-only to full user data)
All tables use CREATE TABLE IF NOT EXISTS — safe to call init_db() on every startup.
"""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).parent.parent / "state" / "transactions.db"

# ── Schema ─────────────────────────────────────────────────────────────────────
# Split into three parts so init_db() can handle pre-existing tables gracefully:
#   1. Table DDL (CREATE TABLE IF NOT EXISTS — always safe)
#   2. Column migrations (ALTER TABLE — try/except, column may already exist)
#   3. Index DDL (CREATE INDEX IF NOT EXISTS — try/except, column may not exist yet)

_TABLE_SCHEMA = """
-- Auth
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL DEFAULT '',
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti        TEXT PRIMARY KEY,
    revoked_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

-- Household
CREATE TABLE IF NOT EXISTS households (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tax_year             INTEGER NOT NULL DEFAULT 2025,
    filing_status        TEXT,
    estimated_agi        REAL,
    state                TEXT,
    taxpayer_age         INTEGER,
    taxpayer_dob         TEXT,
    itemizing_deductions INTEGER,
    has_electric_vehicle INTEGER DEFAULT 0,
    updated_at           TEXT NOT NULL,
    UNIQUE(user_id, tax_year)
);
CREATE INDEX IF NOT EXISTS idx_households_user ON households(user_id, tax_year);

CREATE TABLE IF NOT EXISTS spouses (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id         INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    present              INTEGER DEFAULT 0,
    age                  INTEGER,
    employed_in_business INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dependents (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id      INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name              TEXT,
    relationship      TEXT,
    age_at_year_end   INTEGER,
    months_in_home    INTEGER DEFAULT 12,
    ssn_obtained      INTEGER DEFAULT 0,
    full_time_student INTEGER DEFAULT 0,
    disability        INTEGER DEFAULT 0,
    school_level      TEXT,
    tuition_paid      REAL,
    daycare_cost      REAL,
    after_school_cost REAL,
    summer_camp_cost  REAL
);

-- Income
CREATE TABLE IF NOT EXISTS w2_income (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id       INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    employer_name      TEXT,
    employer_ein       TEXT,
    wages              REAL,
    federal_withheld   REAL,
    state_withheld     REAL,
    hsa_payroll        REAL,
    retirement_payroll REAL,
    dependent_care_fsa REAL
);

CREATE TABLE IF NOT EXISTS self_employment_income (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id     INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    business_name    TEXT,
    gross_revenue    REAL,
    net_profit       REAL,
    se_tax_estimated REAL
);

CREATE TABLE IF NOT EXISTS rental_income (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id     INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    property_address TEXT,
    gross_rents      REAL,
    net_income_loss  REAL
);

CREATE TABLE IF NOT EXISTS investment_income (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id             INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    qualified_dividends      REAL,
    ordinary_dividends       REAL,
    interest                 REAL,
    short_term_capital_gains REAL,
    long_term_capital_gains  REAL,
    qoz_gains                REAL
);

CREATE TABLE IF NOT EXISTS retirement_distributions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id     INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    traditional_ira  REAL,
    roth_ira         REAL,
    traditional_401k REAL,
    pension          REAL,
    annuity          REAL,
    is_rmd           INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS social_security_income (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id    INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    gross_benefits  REAL,
    taxable_portion REAL
);

CREATE TABLE IF NOT EXISTS other_income (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id      INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    alimony_received  REAL,
    gambling_winnings REAL,
    prizes_awards     REAL,
    canceled_debt     REAL,
    other_description TEXT,
    other_amount      REAL
);

CREATE TABLE IF NOT EXISTS adjustments (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id             INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    student_loan_interest    REAL,
    educator_expenses        REAL,
    hsa_outside_payroll      REAL,
    se_health_insurance      REAL,
    se_tax_deduction         REAL,
    alimony_paid             REAL,
    ira_deduction            REAL,
    moving_expenses_military REAL
);

-- Businesses
CREATE TABLE IF NOT EXISTS businesses (
    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id              INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name                      TEXT,
    entity_type               TEXT,
    ein                       TEXT,
    industry                  TEXT,
    start_date                TEXT,
    gross_revenue             REAL,
    operating_expenses        REAL,
    net_profit_loss           REAL,
    w2_employees_count        INTEGER DEFAULT 0,
    has_employees             INTEGER DEFAULT 0,
    home_office_claimed       INTEGER DEFAULT 0,
    home_office_sqft          INTEGER,
    home_total_sqft           INTEGER,
    health_insurance_premium  REAL,
    health_insurance_deducted INTEGER DEFAULT 0,
    specified_service_trade   INTEGER DEFAULT 0,
    qbi_eligible              INTEGER DEFAULT 1,
    owner_draws               REAL,
    retirement_plan_type      TEXT,
    has_business_vehicle      INTEGER DEFAULT 0,
    vehicle_fuel_type         TEXT
);

CREATE TABLE IF NOT EXISTS business_vehicles (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id       INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    description       TEXT,
    business_miles    INTEGER,
    total_miles       INTEGER,
    purchase_date     TEXT,
    purchase_price    REAL,
    section_179_taken REAL,
    fuel_type         TEXT
);

CREATE TABLE IF NOT EXISTS business_assets (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id         INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    description         TEXT,
    placed_in_service   TEXT,
    cost                REAL,
    depreciation_method TEXT,
    useful_life_years   INTEGER,
    section_179_amount  REAL
);

-- Real estate
CREATE TABLE IF NOT EXISTS properties (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id                INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    address                     TEXT,
    property_type               TEXT,
    purchase_date               TEXT,
    purchase_price              REAL,
    current_market_value        REAL,
    years_lived_in              INTEGER,
    months_rented_ytd           INTEGER,
    gross_rents                 REAL,
    net_income_loss             REAL,
    mortgage_interest_paid      REAL,
    property_tax_paid           REAL,
    depreciation_basis          REAL,
    depreciation_method         TEXT,
    accumulated_depreciation    REAL,
    homestead_exemption_applied INTEGER DEFAULT 0,
    in_opportunity_zone         INTEGER DEFAULT 0,
    solar_installed             INTEGER DEFAULT 0
);

-- Investments
CREATE TABLE IF NOT EXISTS investment_accounts (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id      INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    institution       TEXT,
    account_type      TEXT,
    current_value     REAL,
    cost_basis        REAL,
    unrealized_gains  REAL,
    has_startup_stock INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plans_529 (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id      INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    beneficiary       TEXT,
    institution       TEXT,
    balance           REAL,
    contributions_ytd REAL,
    years_contributed INTEGER
);

-- Retirement
CREATE TABLE IF NOT EXISTS employer_retirement_plans (
    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id              INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    plan_type                 TEXT,
    employer_name             TEXT,
    employee_contribution_ytd REAL,
    employer_match_ytd        REAL,
    balance                   REAL
);

CREATE TABLE IF NOT EXISTS ira_accounts (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id      INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    ira_type          TEXT,
    institution       TEXT,
    balance           REAL,
    contributions_ytd REAL
);

CREATE TABLE IF NOT EXISTS self_employed_retirement (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id      INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    plan_type         TEXT,
    established       INTEGER DEFAULT 0,
    contributions_ytd REAL,
    max_allowed       REAL
);

-- Healthcare
CREATE TABLE IF NOT EXISTS healthcare (
    id                              INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id                    INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    coverage_type                   TEXT,
    hdhp_enrolled                   INTEGER DEFAULT 0,
    hdhp_coverage_level             TEXT,
    hsa_contributions_ytd           REAL,
    hsa_balance                     REAL,
    hsa_has_investment_account      INTEGER DEFAULT 0,
    fsa_dependent_care_election     REAL,
    out_of_pocket_expenses          REAL,
    monthly_premium                 REAL,
    owner_health_insurance_deducted INTEGER DEFAULT 0,
    marketplace_coverage            INTEGER DEFAULT 0
);

-- Goals
CREATE TABLE IF NOT EXISTS goals (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id             INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    primary_goal             TEXT,
    secondary_goals          TEXT,
    timeline                 TEXT,
    risk_tolerance           TEXT,
    transfer_wealth_to_heirs INTEGER DEFAULT 0,
    has_estate_plan          INTEGER DEFAULT 0,
    anticipated_changes      TEXT,
    life_events              TEXT
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,
    subdir          TEXT NOT NULL DEFAULT '',
    path            TEXT NOT NULL DEFAULT '',
    category        TEXT,
    confidence      TEXT,
    document_type   TEXT,
    uploaded_at     TEXT NOT NULL,
    extracted       INTEGER DEFAULT 0,
    extraction_json TEXT,
    content         BLOB,
    size            INTEGER DEFAULT 0,
    note            TEXT
);

-- Transactions (ledger) — user_id nullable so existing rows survive migration
CREATE TABLE IF NOT EXISTS transactions (
    id                TEXT PRIMARY KEY,
    user_id           TEXT,
    file_id           TEXT,
    filename          TEXT NOT NULL DEFAULT '',
    date              TEXT,
    merchant          TEXT,
    total_amount      REAL,
    deductible_pct    REAL DEFAULT 1.0,
    deductible_amount REAL,
    tax_category      TEXT,
    benefit_ids       TEXT DEFAULT '[]',
    form_line         TEXT,
    section           TEXT,
    dot_path          TEXT,
    status            TEXT DEFAULT 'applied',
    applied_at        TEXT NOT NULL,
    label             TEXT
);

CREATE TABLE IF NOT EXISTS transaction_benefits (
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    benefit_id     TEXT NOT NULL,
    PRIMARY KEY (transaction_id, benefit_id)
);
"""

# Columns added to existing tables in older DB instances
# (try/except — column may already exist)
_MIGRATIONS = [
    "ALTER TABLE transactions ADD COLUMN user_id TEXT",
    "ALTER TABLE transactions ADD COLUMN file_id TEXT",
    "ALTER TABLE transactions ADD COLUMN section TEXT",
    "ALTER TABLE documents ADD COLUMN content BLOB",
    "ALTER TABLE documents ADD COLUMN size INTEGER DEFAULT 0",
    "ALTER TABLE documents ADD COLUMN note TEXT",
    # Household taxpayer profile + county
    "ALTER TABLE households ADD COLUMN county TEXT",
    "ALTER TABLE households ADD COLUMN taxpayer_veteran INTEGER DEFAULT 0",
    "ALTER TABLE households ADD COLUMN taxpayer_disabled INTEGER DEFAULT 0",
    "ALTER TABLE households ADD COLUMN taxpayer_blind INTEGER DEFAULT 0",
    "ALTER TABLE households ADD COLUMN taxpayer_active_military INTEGER DEFAULT 0",
    # Business nexus
    "ALTER TABLE businesses ADD COLUMN formation_state TEXT",
    "ALTER TABLE businesses ADD COLUMN operating_states TEXT",  # comma-separated state codes
]

# Indexes created after migrations (some reference columns added via ALTER TABLE)
_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email)",
    "CREATE INDEX IF NOT EXISTS idx_households_user ON households(user_id, tax_year)",
    "CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_txn_user       ON transactions(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_txn_file_id    ON transactions(user_id, file_id)",
    "CREATE INDEX IF NOT EXISTS idx_txn_status     ON transactions(user_id, status)",
]


# ── Connection ─────────────────────────────────────────────────────────────────

def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row(row: sqlite3.Row | None) -> dict | None:
    return dict(row) if row else None


def init_db() -> None:
    with _conn() as c:
        # Stage 1: create new tables (IF NOT EXISTS — always safe)
        c.executescript(_TABLE_SCHEMA)
        # Stage 2: add columns to pre-existing tables (best-effort)
        for stmt in _MIGRATIONS:
            try:
                c.execute(stmt)
            except sqlite3.OperationalError:
                pass  # column already exists
        # Stage 3: create indexes (some depend on migrated columns)
        for stmt in _INDEXES:
            try:
                c.execute(stmt)
            except sqlite3.OperationalError:
                pass


# ── Users ──────────────────────────────────────────────────────────────────────

def create_user(email: str, password_hash: str, display_name: str = "") -> str:
    uid = str(uuid.uuid4())
    now = _now()
    with _conn() as c:
        c.execute(
            "INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?)",
            (uid, email.lower().strip(), password_hash, display_name, now, now),
        )
    return uid


def get_user_by_email(email: str) -> dict | None:
    with _conn() as c:
        row = c.execute("SELECT * FROM users WHERE email = ? AND is_active = 1",
                        (email.lower().strip(),)).fetchone()
    return _row(row)


def get_user_by_id(user_id: str) -> dict | None:
    with _conn() as c:
        row = c.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _row(row)


def user_count() -> int:
    with _conn() as c:
        return c.execute("SELECT COUNT(*) FROM users").fetchone()[0]


def revoke_token(jti: str, expires_at: str) -> None:
    with _conn() as c:
        c.execute("INSERT OR IGNORE INTO revoked_tokens (jti, revoked_at, expires_at) VALUES (?,?,?)",
                  (jti, _now(), expires_at))


def is_token_revoked(jti: str) -> bool:
    with _conn() as c:
        row = c.execute("SELECT jti FROM revoked_tokens WHERE jti = ?", (jti,)).fetchone()
    return row is not None


# ── Household helpers ──────────────────────────────────────────────────────────

def _get_household_id(user_id: str, tax_year: int) -> int | None:
    with _conn() as c:
        row = c.execute("SELECT id FROM households WHERE user_id=? AND tax_year=?",
                        (user_id, tax_year)).fetchone()
    return row["id"] if row else None


def _get_or_create_household_id(user_id: str, tax_year: int) -> int:
    hid = _get_household_id(user_id, tax_year)
    if hid is not None:
        return hid
    with _conn() as c:
        c.execute("INSERT INTO households (user_id, tax_year, updated_at) VALUES (?,?,?)",
                  (user_id, tax_year, _now()))
        return c.execute("SELECT last_insert_rowid()").fetchone()[0]


# ── Section save helpers (private) ─────────────────────────────────────────────

def _save_household_from_dict(user_id: str, tax_year: int, d: dict) -> None:
    now = _now()
    spouse = d.get("spouse") or {}
    deps_raw = d.get("dependents") or {}
    taxpayer = d.get("taxpayer") or {}
    residence = d.get("residence") or {}

    with _conn() as c:
        c.execute("""
            INSERT INTO households
                (user_id, tax_year, filing_status, estimated_agi, state, county,
                 taxpayer_age, taxpayer_dob, taxpayer_veteran, taxpayer_disabled,
                 taxpayer_blind, taxpayer_active_military,
                 itemizing_deductions, has_electric_vehicle, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(user_id, tax_year) DO UPDATE SET
                filing_status=excluded.filing_status,
                estimated_agi=excluded.estimated_agi,
                state=excluded.state,
                county=excluded.county,
                taxpayer_age=excluded.taxpayer_age,
                taxpayer_dob=excluded.taxpayer_dob,
                taxpayer_veteran=excluded.taxpayer_veteran,
                taxpayer_disabled=excluded.taxpayer_disabled,
                taxpayer_blind=excluded.taxpayer_blind,
                taxpayer_active_military=excluded.taxpayer_active_military,
                itemizing_deductions=excluded.itemizing_deductions,
                has_electric_vehicle=excluded.has_electric_vehicle,
                updated_at=excluded.updated_at
        """, (
            user_id, tax_year,
            d.get("filing_status"),
            d.get("estimated_agi"),
            residence.get("state") or d.get("state"),
            residence.get("county") or d.get("county"),
            taxpayer.get("age") or d.get("taxpayer_age"),
            taxpayer.get("dob") or d.get("taxpayer_dob"),
            _to_int_flag(taxpayer.get("veteran")),
            _to_int_flag(taxpayer.get("disabled")),
            _to_int_flag(taxpayer.get("blind")),
            _to_int_flag(taxpayer.get("active_military")),
            _to_int_flag(d.get("itemizing_deductions")),
            1 if d.get("has_electric_vehicle") else 0,
            now,
        ))
        hid = c.execute("SELECT id FROM households WHERE user_id=? AND tax_year=?",
                        (user_id, tax_year)).fetchone()["id"]

        # Spouse
        c.execute("DELETE FROM spouses WHERE household_id=?", (hid,))
        if spouse.get("present") is not None or spouse:
            c.execute(
                "INSERT INTO spouses (household_id, present, age, employed_in_business) VALUES (?,?,?,?)",
                (hid, 1 if spouse.get("present") else 0,
                 spouse.get("age"), 1 if spouse.get("employed_in_business") else 0),
            )

        # Dependents from household section (count only; full dependents in dependents section)
        # We don't delete dependents here — they live in the dependents section


def _save_income_from_dict(hid: int, d: dict) -> None:
    with _conn() as c:
        c.execute("DELETE FROM w2_income WHERE household_id=?", (hid,))
        for w in (d.get("w2_employment") or []):
            if not isinstance(w, dict): continue
            c.execute(
                "INSERT INTO w2_income (household_id,employer_name,employer_ein,wages,"
                "federal_withheld,state_withheld,hsa_payroll,retirement_payroll,dependent_care_fsa)"
                " VALUES (?,?,?,?,?,?,?,?,?)",
                (hid, w.get("employer_name"), w.get("employer_ein"),
                 w.get("wages"), w.get("federal_withheld"), w.get("state_withheld"),
                 w.get("hsa_contributions_through_payroll"),
                 w.get("retirement_contributions_through_payroll"),
                 w.get("dependent_care_fsa")),
            )

        c.execute("DELETE FROM self_employment_income WHERE household_id=?", (hid,))
        for s in (d.get("self_employment") or []):
            if not isinstance(s, dict): continue
            c.execute(
                "INSERT INTO self_employment_income (household_id,business_name,gross_revenue,net_profit,se_tax_estimated)"
                " VALUES (?,?,?,?,?)",
                (hid, s.get("business_name"), s.get("gross_revenue"),
                 s.get("net_profit"), s.get("se_tax_estimated")),
            )

        c.execute("DELETE FROM rental_income WHERE household_id=?", (hid,))
        for r in (d.get("rental_income") or []):
            if not isinstance(r, dict): continue
            c.execute(
                "INSERT INTO rental_income (household_id,property_address,gross_rents,net_income_loss)"
                " VALUES (?,?,?,?)",
                (hid, r.get("property_address"), r.get("gross_rents"), r.get("net_income_loss")),
            )

        inv = d.get("investment_income") or {}
        c.execute("DELETE FROM investment_income WHERE household_id=?", (hid,))
        c.execute(
            "INSERT INTO investment_income (household_id,qualified_dividends,ordinary_dividends,"
            "interest,short_term_capital_gains,long_term_capital_gains,qoz_gains) VALUES (?,?,?,?,?,?,?)",
            (hid, inv.get("qualified_dividends"), inv.get("ordinary_dividends"),
             inv.get("interest"), inv.get("short_term_capital_gains"),
             inv.get("long_term_capital_gains"), inv.get("qualified_opportunity_zone_gains")),
        )

        ret = d.get("retirement_distributions") or {}
        c.execute("DELETE FROM retirement_distributions WHERE household_id=?", (hid,))
        c.execute(
            "INSERT INTO retirement_distributions (household_id,traditional_ira,roth_ira,"
            "traditional_401k,pension,annuity,is_rmd) VALUES (?,?,?,?,?,?,?)",
            (hid, ret.get("traditional_ira"), ret.get("roth_ira"), ret.get("401k"),
             ret.get("pension"), ret.get("annuity"),
             1 if ret.get("required_minimum_distribution") else 0),
        )

        ss = d.get("social_security") or {}
        c.execute("DELETE FROM social_security_income WHERE household_id=?", (hid,))
        c.execute(
            "INSERT INTO social_security_income (household_id,gross_benefits,taxable_portion)"
            " VALUES (?,?,?)",
            (hid, ss.get("gross_benefits"), ss.get("taxable_portion")),
        )

        other = d.get("other_income") or {}
        c.execute("DELETE FROM other_income WHERE household_id=?", (hid,))
        c.execute(
            "INSERT INTO other_income (household_id,alimony_received,gambling_winnings,"
            "prizes_awards,canceled_debt,other_description,other_amount) VALUES (?,?,?,?,?,?,?)",
            (hid, other.get("alimony_received"), other.get("gambling_winnings"),
             other.get("prizes_awards"), other.get("canceled_debt"),
             other.get("other_description"), other.get("other_amount")),
        )

        adj = d.get("adjustments_to_income") or {}
        c.execute("DELETE FROM adjustments WHERE household_id=?", (hid,))
        c.execute(
            "INSERT INTO adjustments (household_id,student_loan_interest,educator_expenses,"
            "hsa_outside_payroll,se_health_insurance,se_tax_deduction,alimony_paid,"
            "ira_deduction,moving_expenses_military) VALUES (?,?,?,?,?,?,?,?,?)",
            (hid, adj.get("student_loan_interest"), adj.get("educator_expenses"),
             adj.get("hsa_contributions_outside_payroll"),
             adj.get("self_employed_health_insurance"),
             adj.get("self_employed_se_tax_deduction"),
             adj.get("alimony_paid"), adj.get("ira_deduction"),
             adj.get("moving_expenses_military")),
        )


def _save_businesses_from_dict(hid: int, d: dict) -> None:
    with _conn() as c:
        # Cascade deletes vehicles and assets
        c.execute("DELETE FROM businesses WHERE household_id=?", (hid,))
        for b in (d.get("businesses") or []):
            if not isinstance(b, dict): continue
            fin = b.get("financials") or {}
            ho = b.get("home_office") or {}
            emp = b.get("employees") or {}
            hi = b.get("health_insurance") or {}
            veh = b.get("vehicle") or {}
            dep_info = b.get("depreciation") or {}
            # Normalise operating_states to a comma-separated uppercase string
            ops_raw = b.get("operating_states") or []
            if isinstance(ops_raw, list):
                ops_str = ",".join(s.strip().upper() for s in ops_raw if s)
            else:
                ops_str = ",".join(s.strip().upper() for s in str(ops_raw).split(",") if s.strip())
            c.execute("""
                INSERT INTO businesses
                (household_id,name,entity_type,ein,industry,start_date,
                 gross_revenue,operating_expenses,net_profit_loss,
                 w2_employees_count,has_employees,
                 home_office_claimed,home_office_sqft,home_total_sqft,
                 health_insurance_premium,health_insurance_deducted,
                 specified_service_trade,qbi_eligible,owner_draws,retirement_plan_type,
                 has_business_vehicle,vehicle_fuel_type,
                 formation_state,operating_states)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                hid, b.get("name") or b.get("business_name"),
                b.get("entity_type"), b.get("ein"), b.get("industry"), b.get("start_date"),
                fin.get("gross_revenue") or b.get("gross_revenue"),
                fin.get("operating_expenses") or b.get("operating_expenses"),
                fin.get("net_profit_loss") or b.get("net_profit"),
                emp.get("w2_employees_count", 0), 1 if emp.get("has_w2_employees") else 0,
                1 if ho.get("claimed") else 0,
                ho.get("square_footage"), ho.get("home_total_sqft"),
                hi.get("premium_amount"), 1 if hi.get("owner_health_insurance_deducted") else 0,
                1 if b.get("specified_service_trade") else 0,
                1 if b.get("qbi_eligible", True) else 0,
                b.get("owner_draws"), b.get("retirement_plan_type"),
                1 if veh.get("business_vehicle") else 0,
                veh.get("fuel_type"),
                (b.get("formation_state") or "").strip().upper() or None,
                ops_str or None,
            ))
            biz_id = c.execute("SELECT last_insert_rowid()").fetchone()[0]

            # Vehicle
            if veh and veh.get("business_miles"):
                c.execute(
                    "INSERT INTO business_vehicles (business_id,business_miles,total_miles,"
                    "purchase_date,purchase_price,fuel_type) VALUES (?,?,?,?,?,?)",
                    (biz_id, veh.get("business_miles"), veh.get("total_miles"),
                     veh.get("purchase_date"), veh.get("purchase_price"),
                     veh.get("fuel_type")),
                )

            # Assets
            for asset in (dep_info.get("assets") or []):
                if not isinstance(asset, dict): continue
                c.execute(
                    "INSERT INTO business_assets (business_id,description,placed_in_service,"
                    "cost,depreciation_method,useful_life_years,section_179_amount) VALUES (?,?,?,?,?,?,?)",
                    (biz_id, asset.get("description"), asset.get("placed_in_service_date"),
                     asset.get("cost"), asset.get("method"), asset.get("useful_life"),
                     asset.get("section_179")),
                )


def _save_real_estate_from_dict(hid: int, d: dict) -> None:
    with _conn() as c:
        c.execute("DELETE FROM properties WHERE household_id=?", (hid,))
        for p in (d.get("properties") or []):
            if not isinstance(p, dict): continue
            acq = p.get("acquisition") or {}
            fin = p.get("financing") or {}
            pr = p.get("primary_residence") or {}
            dep = p.get("depreciation") or {}
            imp = p.get("improvements") or {}
            c.execute("""
                INSERT INTO properties
                (household_id,address,property_type,purchase_date,purchase_price,
                 current_market_value,years_lived_in,months_rented_ytd,
                 gross_rents,net_income_loss,mortgage_interest_paid,property_tax_paid,
                 depreciation_basis,depreciation_method,accumulated_depreciation,
                 homestead_exemption_applied,in_opportunity_zone,solar_installed)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                hid, p.get("address") or p.get("property_address"),
                p.get("property_type"),
                acq.get("purchase_date") or p.get("purchase_date"),
                acq.get("purchase_price") or p.get("purchase_price"),
                acq.get("current_market_value") or p.get("current_market_value"),
                pr.get("years_lived_in") or p.get("years_lived_in"),
                p.get("months_rented_ytd"),
                p.get("gross_rents"), p.get("net_income_loss"),
                fin.get("mortgage_interest_paid"), fin.get("property_tax_paid"),
                dep.get("basis") or dep.get("depreciation_basis"),
                dep.get("method") or dep.get("depreciation_method"),
                dep.get("accumulated_depreciation"),
                1 if p.get("homestead_exemption_applied") else 0,
                1 if p.get("in_opportunity_zone") else 0,
                1 if imp.get("solar_panels_installed") else 0,
            ))


def _save_investments_from_dict(hid: int, d: dict) -> None:
    with _conn() as c:
        c.execute("DELETE FROM investment_accounts WHERE household_id=?", (hid,))
        for acc in (d.get("taxable_accounts") or []):
            if not isinstance(acc, dict): continue
            holdings = acc.get("holdings") or {}
            c.execute(
                "INSERT INTO investment_accounts (household_id,institution,account_type,"
                "current_value,cost_basis,unrealized_gains,has_startup_stock) VALUES (?,?,?,?,?,?,?)",
                (hid, acc.get("institution"), "taxable",
                 acc.get("current_value"), acc.get("cost_basis"), acc.get("unrealized_gains"),
                 1 if (holdings.get("individual_stocks") or acc.get("has_startup_stock")) else 0),
            )

        c.execute("DELETE FROM plans_529 WHERE household_id=?", (hid,))
        for p in (d.get("529_plans") or []):
            if not isinstance(p, dict): continue
            c.execute(
                "INSERT INTO plans_529 (household_id,beneficiary,institution,balance,"
                "contributions_ytd,years_contributed) VALUES (?,?,?,?,?,?)",
                (hid, p.get("beneficiary"), p.get("institution"), p.get("balance"),
                 p.get("contributions_ytd"), p.get("years_of_contributions")),
            )


def _save_retirement_from_dict(hid: int, d: dict) -> None:
    with _conn() as c:
        c.execute("DELETE FROM employer_retirement_plans WHERE household_id=?", (hid,))
        employer = d.get("employer_plans") or {}
        for plan_type, plan_data in employer.items():
            if not isinstance(plan_data, dict): continue
            c.execute(
                "INSERT INTO employer_retirement_plans (household_id,plan_type,employer_name,"
                "employee_contribution_ytd,employer_match_ytd,balance) VALUES (?,?,?,?,?,?)",
                (hid, plan_type, plan_data.get("employer_name"),
                 plan_data.get("employee_contribution_ytd") or plan_data.get("contribution_ytd"),
                 plan_data.get("employer_match_ytd"), plan_data.get("balance")),
            )

        c.execute("DELETE FROM ira_accounts WHERE household_id=?", (hid,))
        iras = d.get("individual_retirement_accounts") or {}
        for ira_type, ira_data in iras.items():
            if not isinstance(ira_data, dict): continue
            accts = ira_data.get("accounts") or [{}]
            balance = sum(_to_float_local(a.get("balance")) for a in accts if isinstance(a, dict))
            c.execute(
                "INSERT INTO ira_accounts (household_id,ira_type,balance,contributions_ytd)"
                " VALUES (?,?,?,?)",
                (hid, ira_type, balance or ira_data.get("balance"),
                 ira_data.get("contributions_ytd")),
            )

        c.execute("DELETE FROM self_employed_retirement WHERE household_id=?", (hid,))
        se = d.get("self_employed_plans") or {}
        for plan_type, plan_data in se.items():
            if not isinstance(plan_data, dict): continue
            c.execute(
                "INSERT INTO self_employed_retirement (household_id,plan_type,established,"
                "contributions_ytd,max_allowed) VALUES (?,?,?,?,?)",
                (hid, plan_type, 1 if plan_data.get("established") else 0,
                 plan_data.get("contributions_ytd") or plan_data.get("employee_contributions_ytd"),
                 plan_data.get("max_allowed")),
            )


def _save_healthcare_from_dict(hid: int, d: dict) -> None:
    hsa = d.get("health_savings_account") or {}
    fsa = d.get("flexible_spending_accounts") or {}
    fsa_dc = fsa.get("dependent_care_fsa") or {}
    ins = d.get("insurance") or {}
    with _conn() as c:
        c.execute("DELETE FROM healthcare WHERE household_id=?", (hid,))
        c.execute("""
            INSERT INTO healthcare
            (household_id,coverage_type,hdhp_enrolled,hdhp_coverage_level,
             hsa_contributions_ytd,hsa_balance,hsa_has_investment_account,
             fsa_dependent_care_election,out_of_pocket_expenses,
             monthly_premium,owner_health_insurance_deducted,marketplace_coverage)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            hid,
            d.get("coverage_type") or ins.get("type"),
            1 if (d.get("hdhp_enrolled") or ins.get("hdhp_enrolled")) else 0,
            d.get("hdhp_coverage_level") or ins.get("hdhp_coverage_level"),
            hsa.get("contributions_ytd"), hsa.get("existing_balance"),
            1 if hsa.get("investment_account_within_hsa") else 0,
            fsa_dc.get("election_amount"),
            d.get("out_of_pocket_expenses"),
            ins.get("monthly_premium"), ins.get("owner_health_insurance_deducted"),
            1 if d.get("marketplace_coverage") else 0,
        ))


def _save_dependents_from_dict(hid: int, d: dict) -> None:
    with _conn() as c:
        c.execute("DELETE FROM dependents WHERE household_id=?", (hid,))
        for dep in (d.get("dependents") or []):
            if not isinstance(dep, dict): continue
            edu = dep.get("education") or {}
            care = dep.get("care_expenses") or {}
            c.execute("""
                INSERT INTO dependents
                (household_id,name,relationship,age_at_year_end,months_in_home,
                 ssn_obtained,full_time_student,disability,school_level,
                 tuition_paid,daycare_cost,after_school_cost,summer_camp_cost)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                hid, dep.get("name"), dep.get("relationship"),
                dep.get("age_at_year_end"), dep.get("months_in_home", 12),
                1 if dep.get("ssn_obtained") else 0,
                1 if dep.get("full_time_student") else 0,
                1 if dep.get("disability") else 0,
                edu.get("school_level"), edu.get("tuition_paid"),
                care.get("daycare_cost"), care.get("after_school_care_cost"),
                care.get("summer_camp_cost"),
            ))


def _save_goals_from_dict(hid: int, d: dict) -> None:
    with _conn() as c:
        c.execute("DELETE FROM goals WHERE household_id=?", (hid,))
        c.execute("""
            INSERT INTO goals
            (household_id,primary_goal,secondary_goals,timeline,risk_tolerance,
             transfer_wealth_to_heirs,has_estate_plan,anticipated_changes,life_events)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, (
            hid, d.get("primary_goal"),
            json.dumps(d.get("secondary_goals") or []),
            d.get("timeline"), d.get("risk_tolerance"),
            1 if d.get("transfer_wealth_to_heirs") else 0,
            1 if d.get("has_estate_plan") else 0,
            json.dumps(d.get("anticipated_changes") or []),
            json.dumps(d.get("life_events") or []),
        ))


# ── Section get helpers (private) ──────────────────────────────────────────────

def _get_household_dict(user_id: str, tax_year: int) -> dict:
    with _conn() as c:
        hh = _row(c.execute(
            "SELECT * FROM households WHERE user_id=? AND tax_year=?", (user_id, tax_year)
        ).fetchone())
        if not hh:
            return {}
        hid = hh["id"]
        spouse = _row(c.execute("SELECT * FROM spouses WHERE household_id=?", (hid,)).fetchone())
    return {
        "filing_status": hh.get("filing_status"),
        "estimated_agi": hh.get("estimated_agi"),
        "residence": {"state": hh.get("state"), "county": hh.get("county")},
        "taxpayer": {
            "age": hh.get("taxpayer_age"),
            "dob": hh.get("taxpayer_dob"),
            "veteran": _from_int_flag(hh.get("taxpayer_veteran")),
            "disabled": _from_int_flag(hh.get("taxpayer_disabled")),
            "blind": _from_int_flag(hh.get("taxpayer_blind")),
            "active_military": _from_int_flag(hh.get("taxpayer_active_military")),
        },
        "itemizing_deductions": _from_int_flag(hh.get("itemizing_deductions")),
        "has_electric_vehicle": bool(hh.get("has_electric_vehicle")),
        "spouse": {
            "present": bool(spouse.get("present")) if spouse else False,
            "age": spouse.get("age") if spouse else None,
            "employed_in_business": bool(spouse.get("employed_in_business")) if spouse else False,
        } if spouse else {"present": False},
    }


def _get_income_dict(hid: int) -> dict:
    with _conn() as c:
        w2s = [dict(r) for r in c.execute("SELECT * FROM w2_income WHERE household_id=?", (hid,)).fetchall()]
        se = [dict(r) for r in c.execute("SELECT * FROM self_employment_income WHERE household_id=?", (hid,)).fetchall()]
        ri = [dict(r) for r in c.execute("SELECT * FROM rental_income WHERE household_id=?", (hid,)).fetchall()]
        inv = _row(c.execute("SELECT * FROM investment_income WHERE household_id=?", (hid,)).fetchone()) or {}
        rd = _row(c.execute("SELECT * FROM retirement_distributions WHERE household_id=?", (hid,)).fetchone()) or {}
        ss = _row(c.execute("SELECT * FROM social_security_income WHERE household_id=?", (hid,)).fetchone()) or {}
        other = _row(c.execute("SELECT * FROM other_income WHERE household_id=?", (hid,)).fetchone()) or {}
        adj = _row(c.execute("SELECT * FROM adjustments WHERE household_id=?", (hid,)).fetchone()) or {}

    return {
        "w2_employment": [
            {"employer_name": w.get("employer_name"), "employer_ein": w.get("employer_ein"),
             "wages": w.get("wages"), "federal_withheld": w.get("federal_withheld"),
             "state_withheld": w.get("state_withheld"),
             "hsa_contributions_through_payroll": w.get("hsa_payroll"),
             "retirement_contributions_through_payroll": w.get("retirement_payroll"),
             "dependent_care_fsa": w.get("dependent_care_fsa")}
            for w in w2s
        ],
        "self_employment": [
            {"business_name": s.get("business_name"), "gross_revenue": s.get("gross_revenue"),
             "net_profit": s.get("net_profit"), "se_tax_estimated": s.get("se_tax_estimated")}
            for s in se
        ],
        "rental_income": [
            {"property_address": r.get("property_address"),
             "gross_rents": r.get("gross_rents"), "net_income_loss": r.get("net_income_loss")}
            for r in ri
        ],
        "investment_income": {
            "qualified_dividends": inv.get("qualified_dividends"),
            "ordinary_dividends": inv.get("ordinary_dividends"),
            "interest": inv.get("interest"),
            "short_term_capital_gains": inv.get("short_term_capital_gains"),
            "long_term_capital_gains": inv.get("long_term_capital_gains"),
            "qualified_opportunity_zone_gains": inv.get("qoz_gains"),
        },
        "retirement_distributions": {
            "traditional_ira": rd.get("traditional_ira"),
            "roth_ira": rd.get("roth_ira"),
            "401k": rd.get("traditional_401k"),
            "pension": rd.get("pension"),
            "annuity": rd.get("annuity"),
            "required_minimum_distribution": bool(rd.get("is_rmd")),
        },
        "social_security": {
            "gross_benefits": ss.get("gross_benefits"),
            "taxable_portion": ss.get("taxable_portion"),
        },
        "other_income": {
            "alimony_received": other.get("alimony_received"),
            "gambling_winnings": other.get("gambling_winnings"),
            "prizes_awards": other.get("prizes_awards"),
            "canceled_debt": other.get("canceled_debt"),
            "other_description": other.get("other_description"),
            "other_amount": other.get("other_amount"),
        },
        "adjustments_to_income": {
            "student_loan_interest": adj.get("student_loan_interest"),
            "educator_expenses": adj.get("educator_expenses"),
            "hsa_contributions_outside_payroll": adj.get("hsa_outside_payroll"),
            "self_employed_health_insurance": adj.get("se_health_insurance"),
            "self_employed_se_tax_deduction": adj.get("se_tax_deduction"),
            "alimony_paid": adj.get("alimony_paid"),
            "ira_deduction": adj.get("ira_deduction"),
            "moving_expenses_military": adj.get("moving_expenses_military"),
        },
    }


def _get_businesses_dict(hid: int) -> dict:
    with _conn() as c:
        bizs = [dict(r) for r in c.execute("SELECT * FROM businesses WHERE household_id=?", (hid,)).fetchall()]
        result = []
        for b in bizs:
            vehs = [dict(r) for r in c.execute("SELECT * FROM business_vehicles WHERE business_id=?", (b["id"],)).fetchall()]
            assets = [dict(r) for r in c.execute("SELECT * FROM business_assets WHERE business_id=?", (b["id"],)).fetchall()]
            veh = vehs[0] if vehs else {}
            result.append({
                "name": b.get("name"), "entity_type": b.get("entity_type"),
                "ein": b.get("ein"), "industry": b.get("industry"),
                "start_date": b.get("start_date"),
                "financials": {
                    "gross_revenue": b.get("gross_revenue"),
                    "operating_expenses": b.get("operating_expenses"),
                    "net_profit_loss": b.get("net_profit_loss"),
                },
                "home_office": {
                    "claimed": bool(b.get("home_office_claimed")),
                    "square_footage": b.get("home_office_sqft"),
                    "home_total_sqft": b.get("home_total_sqft"),
                },
                "vehicle": {
                    "business_vehicle": bool(b.get("has_business_vehicle")),
                    "business_miles": veh.get("business_miles"),
                    "total_miles": veh.get("total_miles"),
                    "purchase_date": veh.get("purchase_date"),
                    "purchase_price": veh.get("purchase_price"),
                    "fuel_type": veh.get("fuel_type") or b.get("vehicle_fuel_type"),
                },
                "employees": {
                    "has_w2_employees": bool(b.get("has_employees")),
                    "w2_employees_count": b.get("w2_employees_count", 0),
                },
                "health_insurance": {
                    "premium_amount": b.get("health_insurance_premium"),
                    "owner_health_insurance_deducted": bool(b.get("health_insurance_deducted")),
                },
                "specified_service_trade": bool(b.get("specified_service_trade")),
                "qbi_eligible": bool(b.get("qbi_eligible", 1)),
                "owner_draws": b.get("owner_draws"),
                "retirement_plan_type": b.get("retirement_plan_type"),
                "formation_state": b.get("formation_state"),
                "operating_states": ", ".join([s for s in (b.get("operating_states") or "").split(",") if s]),
                "depreciation": {
                    "assets": [
                        {"description": a.get("description"),
                         "placed_in_service_date": a.get("placed_in_service"),
                         "cost": a.get("cost"), "method": a.get("depreciation_method"),
                         "useful_life": a.get("useful_life_years"),
                         "section_179": a.get("section_179_amount")}
                        for a in assets
                    ],
                    "assets_placed_in_service": bool(assets),
                },
            })
    return {"businesses": result}


def _get_real_estate_dict(hid: int) -> dict:
    with _conn() as c:
        props = [dict(r) for r in c.execute("SELECT * FROM properties WHERE household_id=?", (hid,)).fetchall()]
    return {
        "properties": [
            {
                "address": p.get("address"), "property_type": p.get("property_type"),
                "acquisition": {
                    "purchase_date": p.get("purchase_date"),
                    "purchase_price": p.get("purchase_price"),
                    "current_market_value": p.get("current_market_value"),
                },
                "primary_residence": {"years_lived_in": p.get("years_lived_in")},
                "rental": {"months_rented_ytd": p.get("months_rented_ytd")},
                "gross_rents": p.get("gross_rents"),
                "net_income_loss": p.get("net_income_loss"),
                "financing": {
                    "mortgage_interest_paid": p.get("mortgage_interest_paid"),
                    "property_tax_paid": p.get("property_tax_paid"),
                },
                "depreciation": {
                    "basis": p.get("depreciation_basis"),
                    "depreciation_basis": p.get("depreciation_basis"),
                    "method": p.get("depreciation_method"),
                    "depreciation_method": p.get("depreciation_method"),
                    "accumulated_depreciation": p.get("accumulated_depreciation"),
                },
                "homestead_exemption_applied": bool(p.get("homestead_exemption_applied")),
                "in_opportunity_zone": bool(p.get("in_opportunity_zone")),
                "improvements": {"solar_panels_installed": bool(p.get("solar_installed"))},
                "property_address": p.get("address"),  # alias used by some rules
            }
            for p in props
        ]
    }


def _get_investments_dict(hid: int) -> dict:
    with _conn() as c:
        accs = [dict(r) for r in c.execute("SELECT * FROM investment_accounts WHERE household_id=?", (hid,)).fetchall()]
        plans = [dict(r) for r in c.execute("SELECT * FROM plans_529 WHERE household_id=?", (hid,)).fetchall()]
    has_qsbs = any(a.get("has_startup_stock") for a in accs)
    return {
        "taxable_accounts": [
            {"institution": a.get("institution"), "current_value": a.get("current_value"),
             "cost_basis": a.get("cost_basis"), "unrealized_gains": a.get("unrealized_gains"),
             "has_startup_stock": bool(a.get("has_startup_stock")),
             "holdings": {"individual_stocks": bool(a.get("has_startup_stock"))}}
            for a in accs
        ],
        "529_plans": [
            {"beneficiary": p.get("beneficiary"), "institution": p.get("institution"),
             "balance": p.get("balance"), "contributions_ytd": p.get("contributions_ytd"),
             "years_of_contributions": p.get("years_contributed")}
            for p in plans
        ],
        "has_qualified_small_business_stock": has_qsbs,
    }


def _get_retirement_dict(hid: int) -> dict:
    with _conn() as c:
        emp_plans = [dict(r) for r in c.execute(
            "SELECT * FROM employer_retirement_plans WHERE household_id=?", (hid,)).fetchall()]
        iras = [dict(r) for r in c.execute(
            "SELECT * FROM ira_accounts WHERE household_id=?", (hid,)).fetchall()]
        se_plans = [dict(r) for r in c.execute(
            "SELECT * FROM self_employed_retirement WHERE household_id=?", (hid,)).fetchall()]

    employer_dict = {}
    for p in emp_plans:
        employer_dict[p["plan_type"]] = {
            "employer_name": p.get("employer_name"),
            "employee_contribution_ytd": p.get("employee_contribution_ytd"),
            "contribution_ytd": p.get("employee_contribution_ytd"),  # alias
            "employer_match_ytd": p.get("employer_match_ytd"),
            "balance": p.get("balance"),
        }

    ira_dict: dict = {}
    for ira in iras:
        ira_type = ira.get("ira_type", "traditional_ira")
        if ira_type not in ira_dict:
            ira_dict[ira_type] = {
                "accounts": [], "contributions_ytd": 0, "balance": 0,
            }
        ira_dict[ira_type]["accounts"].append({"balance": ira.get("balance")})
        ira_dict[ira_type]["contributions_ytd"] = (
            (ira_dict[ira_type].get("contributions_ytd") or 0) + (ira.get("contributions_ytd") or 0)
        )
        ira_dict[ira_type]["balance"] = (
            (ira_dict[ira_type].get("balance") or 0) + (ira.get("balance") or 0)
        )

    se_dict = {}
    for p in se_plans:
        se_dict[p["plan_type"]] = {
            "established": bool(p.get("established")),
            "contributions_ytd": p.get("contributions_ytd"),
            "employee_contributions_ytd": p.get("contributions_ytd"),  # alias for solo 401k
            "employer_contributions_ytd": None,
            "max_allowed": p.get("max_allowed"),
        }

    return {
        "employer_plans": employer_dict,
        "individual_retirement_accounts": ira_dict,
        "self_employed_plans": se_dict,
    }


def _get_healthcare_dict(hid: int) -> dict:
    with _conn() as c:
        hc = _row(c.execute("SELECT * FROM healthcare WHERE household_id=?", (hid,)).fetchone()) or {}
    return {
        "coverage_type": hc.get("coverage_type"),
        "hdhp_enrolled": bool(hc.get("hdhp_enrolled")),
        "hdhp_coverage_level": hc.get("hdhp_coverage_level"),
        "health_savings_account": {
            "contributions_ytd": hc.get("hsa_contributions_ytd"),
            "existing_balance": hc.get("hsa_balance"),
            "investment_account_within_hsa": bool(hc.get("hsa_has_investment_account")),
        },
        "flexible_spending_accounts": {
            "dependent_care_fsa": {"election_amount": hc.get("fsa_dependent_care_election")},
        },
        "out_of_pocket_expenses": hc.get("out_of_pocket_expenses"),
        "insurance": {
            "type": hc.get("coverage_type"),
            "monthly_premium": hc.get("monthly_premium"),
            "hdhp_enrolled": bool(hc.get("hdhp_enrolled")),
            "hdhp_coverage_level": hc.get("hdhp_coverage_level"),
            "owner_health_insurance_deducted": bool(hc.get("owner_health_insurance_deducted")),
        },
        "marketplace_coverage": bool(hc.get("marketplace_coverage")),
    }


def _get_dependents_dict(hid: int) -> dict:
    with _conn() as c:
        deps = [dict(r) for r in c.execute("SELECT * FROM dependents WHERE household_id=?", (hid,)).fetchall()]
    return {
        "dependents": [
            {
                "name": d.get("name"), "relationship": d.get("relationship"),
                "age_at_year_end": d.get("age_at_year_end"),
                "months_in_home": d.get("months_in_home", 12),
                "ssn_obtained": bool(d.get("ssn_obtained")),
                "full_time_student": bool(d.get("full_time_student")),
                "disability": bool(d.get("disability")),
                "education": {
                    "school_level": d.get("school_level"),
                    "tuition_paid": d.get("tuition_paid"),
                },
                "care_expenses": {
                    "daycare_cost": d.get("daycare_cost"),
                    "after_school_care_cost": d.get("after_school_cost"),
                    "summer_camp_cost": d.get("summer_camp_cost"),
                },
            }
            for d in deps
        ]
    }


def _get_goals_dict(hid: int) -> dict:
    with _conn() as c:
        g = _row(c.execute("SELECT * FROM goals WHERE household_id=?", (hid,)).fetchone()) or {}
    return {
        "primary_goal": g.get("primary_goal"),
        "secondary_goals": json.loads(g.get("secondary_goals") or "[]"),
        "timeline": g.get("timeline"),
        "risk_tolerance": g.get("risk_tolerance"),
        "transfer_wealth_to_heirs": bool(g.get("transfer_wealth_to_heirs")),
        "has_estate_plan": bool(g.get("has_estate_plan")),
        "anticipated_changes": json.loads(g.get("anticipated_changes") or "[]"),
        "life_events": json.loads(g.get("life_events") or "[]"),
    }


# ── Public section API ─────────────────────────────────────────────────────────

_SECTION_SAVERS = {
    "household":   lambda hid, d, uid, yr: _save_household_from_dict(uid, yr, d),
    "income":      lambda hid, d, uid, yr: _save_income_from_dict(hid, d),
    "businesses":  lambda hid, d, uid, yr: _save_businesses_from_dict(hid, d),
    "real_estate": lambda hid, d, uid, yr: _save_real_estate_from_dict(hid, d),
    "investments": lambda hid, d, uid, yr: _save_investments_from_dict(hid, d),
    "retirement":  lambda hid, d, uid, yr: _save_retirement_from_dict(hid, d),
    "healthcare":  lambda hid, d, uid, yr: _save_healthcare_from_dict(hid, d),
    "dependents":  lambda hid, d, uid, yr: _save_dependents_from_dict(hid, d),
    "goals":       lambda hid, d, uid, yr: _save_goals_from_dict(hid, d),
}


def save_section_data(user_id: str, tax_year: int, section: str, data: dict) -> None:
    """Write a full section dict to the appropriate DB tables."""
    hid = _get_or_create_household_id(user_id, tax_year)
    saver = _SECTION_SAVERS.get(section)
    if saver:
        saver(hid, data, user_id, tax_year)


def get_section_data(user_id: str, tax_year: int, section: str) -> dict:
    """Read a single section as a reconstructed dict."""
    hid = _get_household_id(user_id, tax_year)
    if hid is None:
        return {}
    getters = {
        "household":   lambda: _get_household_dict(user_id, tax_year),
        "income":      lambda: _get_income_dict(hid),
        "businesses":  lambda: _get_businesses_dict(hid),
        "real_estate": lambda: _get_real_estate_dict(hid),
        "investments": lambda: _get_investments_dict(hid),
        "retirement":  lambda: _get_retirement_dict(hid),
        "healthcare":  lambda: _get_healthcare_dict(hid),
        "dependents":  lambda: _get_dependents_dict(hid),
        "goals":       lambda: _get_goals_dict(hid),
    }
    fn = getters.get(section)
    return fn() if fn else {}


def get_all_user_data(user_id: str, tax_year: int) -> dict:
    """Assemble the full _data dict that UserFacts expects.
    Keys match YAML file stems: household, income, businesses, etc."""
    hid = _get_household_id(user_id, tax_year)
    if hid is None:
        return {}
    hh = _get_household_dict(user_id, tax_year)
    # Merge dependents count into household dict (used by household_size())
    dep_dict = _get_dependents_dict(hid)
    hh["dependents"] = {"count": len(dep_dict.get("dependents", []))}
    return {
        "household":   hh,
        "income":      _get_income_dict(hid),
        "businesses":  _get_businesses_dict(hid),
        "real_estate": _get_real_estate_dict(hid),
        "investments": _get_investments_dict(hid),
        "retirement":  _get_retirement_dict(hid),
        "healthcare":  _get_healthcare_dict(hid),
        "dependents":  dep_dict,
        "goals":       _get_goals_dict(hid),
    }


def apply_dot_path_to_section(
    user_id: str, tax_year: int, section: str, dot_path: str, operation: str, value: Any
) -> bool:
    """Load section dict, apply dot-path mutation, save back. Returns True on success."""
    from api.routes.documents import _apply_dot_path  # avoid circular at module level
    data = get_section_data(user_id, tax_year, section)
    if _apply_dot_path(data, dot_path, operation, value):
        save_section_data(user_id, tax_year, section, data)
        return True
    return False


# ── Documents ──────────────────────────────────────────────────────────────────

def upsert_document(user_id: str, file_id: str, filename: str,
                    category: str = "", confidence: str = "",
                    content: bytes | None = None, size: int = 0, note: str = "") -> None:
    with _conn() as c:
        c.execute("""
            INSERT INTO documents (id, user_id, filename, category, confidence,
                                   content, size, note, uploaded_at, subdir, path)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
                category=excluded.category, confidence=excluded.confidence,
                content=excluded.content, size=excluded.size, note=excluded.note
        """, (file_id, user_id, filename, category, confidence,
              content, size, note, _now(), "", ""))


def get_documents_for_user(user_id: str) -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT id, user_id, filename, category, confidence, document_type,"
            " uploaded_at, extracted, extraction_json, size, note"
            " FROM documents WHERE user_id=? ORDER BY uploaded_at DESC",
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def get_document_content(user_id: str, file_id: str) -> tuple[bytes | None, str]:
    """Returns (content_bytes, filename). content is None if not found."""
    with _conn() as c:
        row = c.execute(
            "SELECT content, filename FROM documents WHERE id=? AND user_id=?",
            (file_id, user_id),
        ).fetchone()
    if row is None:
        return None, ""
    return row["content"], row["filename"]


def delete_document_record(user_id: str, file_id: str) -> bool:
    with _conn() as c:
        cur = c.execute("DELETE FROM documents WHERE id=? AND user_id=?", (file_id, user_id))
    return cur.rowcount > 0


def mark_document_extracted(user_id: str, file_id: str, extraction_json: str) -> None:
    with _conn() as c:
        c.execute("UPDATE documents SET extracted=1, extraction_json=? WHERE id=? AND user_id=?",
                  (extraction_json, file_id, user_id))


# ── Transactions ───────────────────────────────────────────────────────────────

def _row_to_txn(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["benefit_ids"] = json.loads(d.get("benefit_ids") or "[]")
    return d


def add_transaction(record: dict) -> str:
    record = dict(record)
    record.setdefault("id", str(uuid.uuid4()))
    record.setdefault("applied_at", _now())
    record["benefit_ids"] = json.dumps(record.get("benefit_ids") or [])
    # Map old field names to new schema
    if "yaml_file" in record and "section" not in record:
        record["section"] = record.pop("yaml_file")
    record.pop("yaml_file", None)
    with _conn() as c:
        c.execute("""
            INSERT INTO transactions
            (id, user_id, file_id, filename, date, merchant,
             total_amount, deductible_pct, deductible_amount,
             tax_category, benefit_ids, form_line,
             section, dot_path, status, applied_at, label)
            VALUES
            (:id, :user_id, :file_id, :filename, :date, :merchant,
             :total_amount, :deductible_pct, :deductible_amount,
             :tax_category, :benefit_ids, :form_line,
             :section, :dot_path, :status, :applied_at, :label)
        """, record)
    return record["id"]


def file_already_applied(user_id: str, file_id: str) -> bool:
    with _conn() as c:
        row = c.execute(
            "SELECT id FROM transactions WHERE user_id=? AND file_id=? AND status='applied' LIMIT 1",
            (user_id, file_id),
        ).fetchone()
    return row is not None


def get_transactions(
    user_id: str,
    benefit_id: str | None = None,
    tax_category: str | None = None,
    status: str | None = None,
) -> list[dict]:
    query = "SELECT * FROM transactions WHERE user_id=?"
    params: list = [user_id]
    if status:
        query += " AND status=?"; params.append(status)
    if tax_category:
        query += " AND tax_category=?"; params.append(tax_category)
    query += " ORDER BY applied_at DESC"
    with _conn() as c:
        rows = c.execute(query, params).fetchall()
    result = [_row_to_txn(r) for r in rows]
    if benefit_id:
        result = [r for r in result if benefit_id in r["benefit_ids"]]
    return result


def get_summary(user_id: str) -> dict:
    with _conn() as c:
        by_cat = c.execute("""
            SELECT tax_category, COUNT(*) AS count,
                   SUM(deductible_amount) AS total_deductible,
                   SUM(total_amount) AS total_gross
            FROM transactions WHERE user_id=? AND status='applied'
            GROUP BY tax_category ORDER BY total_deductible DESC
        """, (user_id,)).fetchall()
        total = c.execute("""
            SELECT COUNT(*) AS count, SUM(deductible_amount) AS total_deductible
            FROM transactions WHERE user_id=? AND status='applied'
        """, (user_id,)).fetchone()
    return {
        "by_category": [dict(r) for r in by_cat],
        "total_applied": dict(total),
    }


def reverse_transaction(txn_id: str, user_id: str) -> bool:
    with _conn() as c:
        cur = c.execute(
            "UPDATE transactions SET status='reversed' WHERE id=? AND user_id=?",
            (txn_id, user_id),
        )
    return cur.rowcount > 0


# ── Utilities ──────────────────────────────────────────────────────────────────

def _to_int_flag(val) -> int | None:
    if val is True: return 1
    if val is False: return 0
    return None


def _from_int_flag(val) -> bool | None:
    if val == 1: return True
    if val == 0: return False
    return None


def _to_float_local(val) -> float:
    if val is None: return 0.0
    try:
        return float(str(val).replace(",", "").replace("$", ""))
    except (ValueError, TypeError):
        return 0.0
