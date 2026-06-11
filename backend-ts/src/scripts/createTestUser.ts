import { initDb } from "../db/init";
import { createUser, getUserByEmail } from "../db/authRepo";
import { saveSectionData } from "../db/sectionRepo";
import { hashPassword } from "../auth/service";
import { ensureRequiredDirectories } from "../lib/paths";
import { runScan } from "../domain/scanner/scan";

const EMAIL = "alex.carter@example.com";
const PASSWORD = "TestUser123!";
const DISPLAY_NAME = "Alex Carter";
const TAX_YEAR = 2025;

// ─────────────────────────────────────────────────────────────────────────────
// TRACEABILITY SCHEME
// Every dollar amount is globally unique across the entire dataset.
// Each value has a distinctive digit pattern so you can find it instantly
// when reading a rendered form — just grep the value back to this file.
//
// 1040 LINE → SEED VALUE
//  L1a  wages total     $111,111  (Alex $100,100 + Jordan $11,011)
//  L2b  interest        $2,020    investment_income.interest
//  L3b  ordinary_div    $3,030    investment_income.ordinary_dividends
//  L3a  qualified_div   $2,929    investment_income.qualified_dividends (≤ L3b)
//  L4a/b IRA            $4,040    retirement_distributions.traditional_ira
//  L5a/b pension        $5,050    retirement_distributions.pension
//  L6a  SS gross        $6,060    social_security.gross_benefits
//  L6b  SS taxable      derived   ~85% of $6,060
//  L7   cap gains       $15,150   stcg $7,070 + ltcg $8,080
//  L8   Sch1 addl       $12,836   Sch C $9,009 + rental $1,100 + k1 $1,010
//                                 + k1 rental $909 + gambling $808
//  L25a withholding     $22,020   Alex $20,202 + Jordan $1,818
//  L26  est. tax        $2,500    household.payments.estimated_tax_payments
//
// SCH 1 ADJUSTMENTS
//  L11  educator        $300      (hard-capped at $300 by calculator)
//  L15  SE ded          derived   half of SE tax on $9,009 profit
//  L17  SE health       $4,400    adjustments_to_income.self_employed_health_insurance
//  L19  alimony paid    $1,414    adjustments_to_income.alimony_paid
//  L20  IRA deduction   $1,313    adjustments_to_income.ira_deduction
//  L21  student loan    $1,212    adjustments_to_income.student_loan_interest
//
// SCH B
//  interest payer  $2,020 — Oakwood Federal Savings Bank
//  dividend payer  $3,030 — Vanguard Total Market ETF
//
// SCH C
//  gross    $19,019   income.self_employment.gross_revenue
//  expenses $10,010   derived (gross - net)
//  net       $9,009   income.self_employment.net_profit
//
// SCH D
//  row 1a  stcg  $7,070
//  row 8a  ltcg  $8,080
//  net           $15,150 (derived)
//
// SCH SE
//  net profit    $9,009
//  × 0.9235      ~$8,316 (derived)
//  SE tax        ~$1,272 (derived)
// ─────────────────────────────────────────────────────────────────────────────

const sections: Record<string, Record<string, unknown>> = {

  // ── Household ──────────────────────────────────────────────────────────────
  household: {
    filing_status: "married_filing_jointly",
    tax_year: TAX_YEAR,
    estimated_agi: 212000,
    prior_year_agi: 189000,
    itemizing_deductions: false,
    digital_assets: false,
    has_electric_vehicle: false,
    notes: "Primary earner at Meridian Technologies; side consulting practice via Carter Consulting LLC.",

    taxpayer: {
      first_name: "Alex",
      last_name: "Carter",
      ssn: "400-12-3456",
      dob: "1983-03-15",
      age: 42,
      blind: false,
      disabled: false,
      active_military: false,
      veteran: false,
      student: false,
    },

    spouse: {
      present: true,
      first_name: "Jordan",
      last_name: "Carter",
      ssn: "400-65-4321",
      dob: "1985-07-22",
      age: 40,
      employed: true,
      self_employed: false,
    },

    residence: {
      street_address: "4821 Mockingbird Lane",
      city: "Austin",
      state: "TX",
      zip: "78701",
      county: "Travis",
    },

    dependents: { count: 3 },

    // est_tax → 1040 L26:  $2,500
    // other_withheld:       $1,515
    payments: {
      estimated_tax_payments: 2500,
      other_withholding: 1515,
    },
  },

  // ── Income ─────────────────────────────────────────────────────────────────
  income: {
    w2_employment: [
      {
        // Alex W-2 — wages + fed withheld contribute to the form totals
        // wages $100,100 + Jordan $11,011 = $111,111 (1040 L1a)
        // fed   $20,202 + Jordan  $1,818 = $22,020  (1040 L25a)
        employer_name: "Meridian Technologies Inc.",
        employer_ein: "45-1010101",
        wages: 100100,
        federal_withheld: 20202,
        state_withheld: 6006,
        hsa_contributions_through_payroll: 4150,
        retirement_contributions_through_payroll: 12012,
        dependent_care_fsa: 3000,
      },
      {
        // Jordan W-2 (teacher)
        employer_name: "Austin Independent School District",
        employer_ein: "74-2020202",
        wages: 11011,
        federal_withheld: 1818,
        state_withheld: 1001,
        hsa_contributions_through_payroll: 0,
        retirement_contributions_through_payroll: 5858,
        dependent_care_fsa: 0,
      },
    ],

    self_employment: [
      {
        // Sch C: gross $19,019 / expenses $10,010 / net $9,009
        business_name: "Carter Consulting LLC",
        gross_revenue: 19019,
        net_profit: 9009,
        net_profit_loss: 9009,
        se_tax_estimated: 1272,
      },
    ],

    rental_income: [
      {
        // Sch E line 23 → Sch 1 line 5:  $1,100
        property_address: "1102 Congress Ave, Austin, TX 78701",
        gross_rents: 21021,
        net_income_loss: 1100,
      },
    ],

    investment_income: {
      // Sch B → 1040 L2b:  $2,020
      interest: 2020,
      // Sch B → 1040 L3b:  $3,030
      ordinary_dividends: 3030,
      // 1040 L3a (must be ≤ L3b): $2,929
      qualified_dividends: 2929,
      // Sch D row 1a:  $7,070
      short_term_capital_gains: 7070,
      // Sch D row 8a:  $8,080
      long_term_capital_gains: 8080,
    },

    retirement_distributions: {
      // 1040 L4a and L4b (both = same — no cost basis tracking): $4,040
      traditional_ira: 4040,
      roth_ira: 0,
      // 1040 L5a and L5b (both = same): $5,050
      pension: 5050,
      annuity: 0,
      traditional_401k: 0,
      required_minimum_distribution: false,
    },

    social_security: {
      // 1040 L6a:  $6,060
      // 1040 L6b:  derived ~$5,151 (85% × $6,060 at this income level)
      gross_benefits: 6060,
      taxable_portion: 0,
    },

    passive_income: {
      // Sch 1 (k1 lines): $1,010
      k1_ordinary: 1010,
      // Sch 1 (k1 rental): $909
      k1_rental: 909,
      k1_guaranteed_payments: 0,
    },

    other_income: {
      alimony_received: 0,
      // Sch 1 L8b: $808
      gambling_winnings: 808,
      prizes_awards: 0,
      canceled_debt: 0,
      other_amount: 0,
      other_description: "",
    },

    adjustments_to_income: {
      // Sch 1 L21: $1,212
      student_loan_interest: 1212,
      // Sch 1 L11: $300 (calculator hard-caps at $300)
      educator_expenses: 300,
      hsa_contributions_outside_payroll: 0,
      // Sch 1 L17: $4,400
      self_employed_health_insurance: 4400,
      // Sch 1 L15: derived (se_tax / 2)
      self_employed_se_tax_deduction: 0,
      // Sch 1 L20: $1,313
      ira_deduction: 1313,
      // Sch 1 L19: $1,414
      alimony_paid: 1414,
      moving_expenses_military: 0,
    },

    notes: "Jordan is a teacher — educator expense eligible ($300 cap). SE health insurance for Alex's consulting LLC.",
  },

  // ── Businesses ─────────────────────────────────────────────────────────────
  businesses: {
    businesses: [
      {
        name: "Carter Consulting LLC",
        ein: "82-1234567",
        entity_type: "llc_single",
        tax_classification: "disregarded",
        formation_state: "TX",
        operating_states: "TX",
        industry: "Management Consulting",
        naics_code: "541611",
        qbi_eligible: true,
        specified_service_trade: true,
        notes: "SSTB — QBI deduction phases out at higher income.",

        // Matches income.self_employment for Sch C: gross $19,019 / net $9,009
        financials: {
          gross_revenue: 19019,
          cost_of_goods_sold: 0,
          operating_expenses: 10010,
          net_profit_loss: 9009,
          assets_total: 8500,
          liabilities_total: 0,
        },

        employees: {
          w2_employees_count: 0,
          w2_wages_total: 0,
          owner_w2_salary: 0,
          independent_contractors: true,
        },

        home_office: {
          claimed: true,
          method: "simplified",
          square_footage: 280,
          home_total_sqft: 2200,
        },

        vehicle: {
          business_vehicle: true,
          business_miles: 8400,
          total_miles: 14000,
          standard_mileage_method: true,
        },

        retirement_plans: {
          sep_ira: false,
          solo_401k: false,
          simple_ira: false,
          defined_benefit: false,
        },
      },
    ],
  },

  // ── Real Estate ────────────────────────────────────────────────────────────
  real_estate: {
    properties: [
      {
        address: "4821 Mockingbird Lane, Austin, TX 78701",
        property_type: "primary_residence",
        ownership_type: "joint",
        ownership_percent: 100,

        acquisition: {
          purchase_date: "2019-04-10",
          purchase_price: 395500,
          closing_costs: 7800,
          improvements_since_purchase: 42000,
          current_market_value: 548800,
        },

        financing: {
          mortgage_balance: 312000,
          // Sch A mortgage interest (if itemizing): $17,017
          mortgage_interest_paid: 17017,
          points_paid_this_year: 0,
          // Sch A property tax (contributes to SALT cap): $8,008
          property_tax_paid: 8008,
          pmi_paid: 0,
        },

        rental_use: {
          rental_days: 0,
          personal_use_days: 365,
          gross_rental_income: 0,
        },

        primary_residence: {
          years_lived_in: 6,
          used_as_primary_for_2_of_last_5: true,
          section_121_exclusion_available: true,
        },

        opportunity_zone: false,
        historic_property: false,
        homestead_exemption_applied: true,
        notes: "Primary home. §121 exclusion available. Solar panels planned 2026.",
      },
      {
        address: "1102 Congress Ave, Austin, TX 78701",
        property_type: "rental_residential",
        ownership_type: "individual",
        ownership_percent: 100,

        acquisition: {
          purchase_date: "2021-08-15",
          purchase_price: 285000,
          closing_costs: 5500,
          improvements_since_purchase: 18000,
          current_market_value: 342000,
        },

        financing: {
          mortgage_balance: 241000,
          // Sch E mortgage interest: $12,012
          mortgage_interest_paid: 12012,
          points_paid_this_year: 0,
          // Sch E property tax: $5,005
          property_tax_paid: 5005,
          pmi_paid: 0,
        },

        rental_use: {
          rental_days: 365,
          personal_use_days: 0,
          // Matches income.rental_income[0].gross_rents: $21,021
          gross_rental_income: 21021,
        },

        primary_residence: {
          years_lived_in: 0,
          used_as_primary_for_2_of_last_5: false,
          section_121_exclusion_available: false,
        },

        opportunity_zone: false,
        historic_property: false,
        notes: "Long-term residential tenant. Depreciation tracked separately.",
      },
    ],
  },

  // ── Investments ────────────────────────────────────────────────────────────
  investments: {
    taxable_accounts: [
      {
        institution: "Fidelity",
        current_value: 87000,
        cost_basis: 54000,
        unrealized_gains: 33000,
        has_startup_stock: false,
        holdings: { individual_stocks: true },
      },
      {
        institution: "Vanguard",
        current_value: 42000,
        cost_basis: 38000,
        unrealized_gains: 4000,
        has_startup_stock: false,
        holdings: { index_funds: true },
      },
    ],
    "529_plans": [
      {
        beneficiary: "Emma Carter",
        institution: "Texas College Savings Plan",
        balance: 28000,
        annual_contribution: 6000,
      },
      {
        beneficiary: "Noah Carter",
        institution: "Texas College Savings Plan",
        balance: 14000,
        annual_contribution: 3000,
      },
    ],
    has_qualified_small_business_stock: false,
    notes: "Fidelity generated $7,070 STCG and $8,080 LTCG from partial position sales this year.",
  },

  // ── Retirement ─────────────────────────────────────────────────────────────
  retirement: {
    employer_plans: {
      traditional_401k: {
        employer_name: "Meridian Technologies Inc.",
        employee_contribution_ytd: 12012,
        employer_match_ytd: 4800,
        balance: 148000,
      },
      spouse_401k: {
        employer_name: "Austin ISD",
        employee_contribution_ytd: 5858,
        employer_match_ytd: 2929,
        balance: 58000,
      },
    },

    individual_retirement_accounts: {
      traditional_ira: {
        accounts: [{ institution: "Fidelity", balance: 82000 }],
        contributions_ytd: 0,
        // 1040 L4a/4b: $4,040
        distributions_ytd: 4040,
      },
      roth_ira: {
        accounts: [{ institution: "Vanguard", balance: 31000 }],
        contributions_ytd: 0,
      },
    },

    self_employed_plans: {
      sep_ira: {
        established: false,
        contributions_ytd: 0,
        max_allowed: 5375,
      },
      solo_401k: {
        established: false,
        contributions_ytd: 0,
        employee_contributions_ytd: 0,
        max_allowed: 23500,
      },
    },

    pension: {
      has_pension: true,
      // 1040 L5a/5b: $5,050
      annual_benefit: 5050,
      employer: "Prior employer — Apex Corp",
      start_date: "2023-01-01",
    },

    notes: "IRA distribution of $4,040 taken for home improvement. SEP-IRA not yet opened — opportunity for 2025.",
  },

  // ── Healthcare ─────────────────────────────────────────────────────────────
  healthcare: {
    coverage_type: "employer",
    hdhp_enrolled: false,

    health_savings_account: {
      contributions_ytd: 4150,
      existing_balance: 9200,
      investment_account_within_hsa: true,
    },

    flexible_spending_accounts: {
      // FSA $3,000 offsets $3,000 of $4,000 care expenses → $1,000 eligible for CDCC → $200 credit
      dependent_care_fsa: { election_amount: 3000 },
      healthcare_fsa: { election_amount: 0 },
    },

    // Sch A medical (7.5% AGI floor applies): $6,800
    out_of_pocket_expenses: 6800,
    marketplace_coverage: false,

    insurance: {
      type: "employer",
      monthly_premium: 420,
      hdhp_enrolled: false,
      owner_health_insurance_deducted: true,
    },

    notes: "Alex on Meridian plan; Jordan through Austin ISD. High OOP this year (braces + surgery).",
  },

  // ── Dependents ─────────────────────────────────────────────────────────────
  dependents: {
    dependents: [
      {
        // Qualifying child — age 8, eligible for CTC ($2,000) + CDCC
        name: "Emma Carter",
        ssn: "400-11-2222",
        date_of_birth: "2016-09-12",
        relationship: "child",
        age_at_year_end: 8,
        ssn_obtained: true,
        income_this_year: 0,
        lives_with_taxpayer: true,
        months_lived_with_taxpayer: 12,
        full_time_student: false,
        disabled: false,

        // TaxCalculator reads care costs directly off dependent object (not nested)
        // care total = $4,000; FSA = $3,000 → eligible = $1,000 → credit = $200
        after_school_care_cost: 3300,
        summer_camp_cost: 700,

        education: {
          in_school: true,
          school_level: "k12",
          tuition_paid: 0,
          scholarships_received: 0,
          room_board_paid: 0,
          form_1098t_expected: false,
        },

        care_expenses: {
          daycare_provider: "Little Stars Learning Center",
          daycare_cost: 0,
          after_school_care_cost: 3300,
          summer_camp_cost: 700,
        },

        adoption: {
          adopted_this_year: false,
          adoption_expenses: 0,
        },

        notes: "After-school $3,300 + summer camp $700 = $4,000 total. FSA offsets $3,000 → $1,000 eligible for 20% CDCC = $200 credit.",
      },
      {
        // Qualifying child — age 16, CTC eligible; NOT care credit (over 13)
        name: "Noah Carter",
        ssn: "400-22-3333",
        date_of_birth: "2009-04-03",
        relationship: "child",
        age_at_year_end: 16,
        ssn_obtained: true,
        income_this_year: 3200,
        lives_with_taxpayer: true,
        months_lived_with_taxpayer: 12,
        full_time_student: true,
        disabled: false,

        after_school_care_cost: 0,
        summer_camp_cost: 0,

        education: {
          in_school: true,
          school_level: "k12",
          tuition_paid: 0,
          scholarships_received: 0,
          room_board_paid: 0,
          form_1098t_expected: false,
        },

        care_expenses: {
          daycare_provider: "",
          daycare_cost: 0,
          after_school_care_cost: 0,
          summer_camp_cost: 0,
        },

        adoption: {
          adopted_this_year: false,
          adoption_expenses: 0,
        },

        notes: "Part-time summer job $3,200. Age 16 — no CDCC. Eligible $2,000 CTC.",
      },
      {
        // Adult dependent — qualifying relative, age 71, $500 Other Dependent Credit
        name: "Margaret Carter",
        ssn: "400-33-4444",
        date_of_birth: "1954-02-28",
        relationship: "parent",
        age_at_year_end: 71,
        ssn_obtained: true,
        income_this_year: 4800,
        lives_with_taxpayer: true,
        months_lived_with_taxpayer: 12,
        full_time_student: false,
        disabled: false,

        after_school_care_cost: 0,
        summer_camp_cost: 0,

        education: {
          in_school: false,
          school_level: "k12",
          tuition_paid: 0,
          scholarships_received: 0,
          room_board_paid: 0,
          form_1098t_expected: false,
        },

        care_expenses: {
          daycare_provider: "",
          daycare_cost: 0,
          after_school_care_cost: 0,
          summer_camp_cost: 0,
        },

        adoption: {
          adopted_this_year: false,
          adoption_expenses: 0,
        },

        notes: "Qualifying relative (income $4,800 < $5,050 gross income test). Eligible $500 Other Dependent Credit.",
      },
    ],
  },

  // ── Goals ──────────────────────────────────────────────────────────────────
  goals: {
    primary_goal: "reduce_taxes",
    secondary_goals: ["build_wealth", "retirement_security", "college_funding"],
    timeline: "long_term",
    risk_tolerance: "moderate",
    // Sch A charitable (if itemizing): $4,500
    charitable_giving_annual: 4500,
    transfer_wealth_to_heirs: true,
    has_estate_plan: false,
    anticipated_changes: [
      "Jordan considering leaving teaching for private sector in 2026",
      "May hire first W-2 employee for consulting LLC",
      "Evaluating S-Corp election if consulting exceeds $60k",
    ],
    life_events: ["minor_child_in_care", "rental_property_owned"],
    notes: "Target early retirement at 55. Focus on tax-efficient investing and maxing retirement accounts.",
  },

  // ── Documents Index ────────────────────────────────────────────────────────
  documents_index: {
    notes: "Source docs in OneDrive/Tax/2025. W-2s received Jan 31 (×2). Form 1099-R Feb 10. 1099-B from Fidelity Feb 15. Schedule K-1 from LP expected by March 15.",
  },
};

const STATUS_ORDER = [
  "eligible_now",
  "nearly_eligible",
  "eligible_if_changed",
  "future_opportunity",
  "high_risk",
  "not_applicable",
  "expired",
  "unknown",
] as const;

function main(): void {
  ensureRequiredDirectories();
  initDb();

  const existing = getUserByEmail(EMAIL);
  const userId = existing
    ? existing.id
    : createUser(EMAIL, hashPassword(PASSWORD), DISPLAY_NAME);

  if (existing) {
    process.stdout.write(`User ${EMAIL} already exists (id: ${userId}) — overwriting all sections.\n`);
  } else {
    process.stdout.write(`Created user ${EMAIL} (id: ${userId}).\n`);
  }

  for (const [section, data] of Object.entries(sections)) {
    saveSectionData(userId, TAX_YEAR, section, data);
    process.stdout.write(`  ✓ ${section}\n`);
  }

  process.stdout.write("\nRunning scanner...\n");
  const scan = runScan(TAX_YEAR, userId);

  for (const status of STATUS_ORDER) {
    const group = scan.results.filter((r) => r.status === status);
    if (group.length === 0) continue;
    const label = status.replaceAll("_", " ").toUpperCase();
    process.stdout.write(`\n${label} (${group.length}):\n`);
    for (const r of group) {
      const value = r.estimated_value ? `  [${r.estimated_value}]` : "";
      process.stdout.write(`  - ${r.benefit_name}${value}\n`);
    }
  }

  process.stdout.write(`\nLogin: ${EMAIL} / ${PASSWORD}\n`);
}

main();
