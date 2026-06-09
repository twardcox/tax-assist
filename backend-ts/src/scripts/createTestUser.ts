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

const sections: Record<string, Record<string, unknown>> = {
  household: {
    filing_status: "mfj",
    estimated_agi: 190000,
    residence: { state: "TX" },
    taxpayer: { age: 42, dob: "1983-03-15" },
    spouse: { present: true, age: 40, employed_in_business: false },
    dependents: { count: 2 },
    itemizing_deductions: false,
    has_electric_vehicle: true
  },
  income: {
    w2_employment: [
      {
        employer_name: "Meridian Technologies Inc.",
        employer_ein: "45-1234567",
        wages: 155000,
        federal_withheld: 28000,
        state_withheld: 0,
        hsa_contributions_through_payroll: 0,
        retirement_contributions_through_payroll: 12000,
        dependent_care_fsa: 3000
      }
    ],
    self_employment: [
      {
        business_name: "Carter Consulting LLC",
        gross_revenue: 38000,
        net_profit: 21500,
        se_tax_estimated: 3035
      }
    ],
    rental_income: [],
    investment_income: {
      qualified_dividends: 1800,
      ordinary_dividends: 2200,
      interest: 650,
      short_term_capital_gains: 0,
      long_term_capital_gains: 6500,
      qualified_opportunity_zone_gains: 0
    },
    retirement_distributions: {
      traditional_ira: 0,
      roth_ira: 0,
      "401k": 0,
      pension: 0,
      annuity: 0,
      required_minimum_distribution: false
    },
    social_security: { gross_benefits: 0, taxable_portion: 0 },
    adjustments_to_income: {
      student_loan_interest: 0,
      educator_expenses: 0,
      hsa_contributions_outside_payroll: 0,
      self_employed_health_insurance: 7200,
      self_employed_se_tax_deduction: 1518,
      alimony_paid: 0,
      ira_deduction: 0,
      moving_expenses_military: 0
    }
  },
  businesses: {
    businesses: [
      {
        name: "Carter Consulting LLC",
        entity_type: "llc_single",
        ein: "",
        industry: "Professional Services",
        start_date: "2020-06-01",
        financials: {
          gross_revenue: 38000,
          operating_expenses: 16500,
          net_profit_loss: 21500
        },
        employees: { has_w2_employees: false, w2_employees_count: 0 },
        home_office: {
          claimed: true,
          square_footage: 280,
          home_total_sqft: 2200
        },
        vehicle: {
          business_vehicle: true,
          business_miles: 8400,
          total_miles: 14000,
          fuel_type: "gasoline"
        },
        health_insurance: {
          premium_amount: 7200,
          owner_health_insurance_deducted: true
        },
        specified_service_trade: false,
        qbi_eligible: true,
        owner_draws: 18000,
        retirement_plan_type: null,
        depreciation: { assets: [], assets_placed_in_service: false }
      }
    ]
  },
  real_estate: {
    properties: [
      {
        address: "4821 Mockingbird Lane, Austin, TX 78701",
        property_type: "primary_residence",
        acquisition: {
          purchase_date: "2019-04-10",
          purchase_price: 395000,
          current_market_value: 548000
        },
        primary_residence: { years_lived_in: 6 },
        rental: { months_rented_ytd: 0 },
        gross_rents: 0,
        net_income_loss: 0,
        financing: {
          mortgage_interest_paid: 17800,
          property_tax_paid: 8200
        },
        homestead_exemption_applied: true,
        in_opportunity_zone: false,
        improvements: { solar_panels_installed: false }
      }
    ]
  },
  investments: {
    taxable_accounts: [
      {
        institution: "Fidelity",
        current_value: 52000,
        cost_basis: 33000,
        unrealized_gains: 19000,
        has_startup_stock: false,
        holdings: { individual_stocks: false }
      }
    ],
    "529_plans": [],
    has_qualified_small_business_stock: false
  },
  retirement: {
    employer_plans: {
      traditional_401k: {
        employer_name: "Meridian Technologies Inc.",
        employee_contribution_ytd: 12000,
        employer_match_ytd: 4800,
        balance: 91000
      }
    },
    individual_retirement_accounts: {
      traditional_ira: {
        accounts: [{ balance: 24500 }],
        contributions_ytd: 0
      },
      roth_ira: {
        accounts: [],
        contributions_ytd: 0
      }
    },
    self_employed_plans: {
      sep_ira: {
        established: false,
        contributions_ytd: 0,
        max_allowed: 5375
      },
      solo_401k: {
        established: false,
        contributions_ytd: 0,
        employee_contributions_ytd: 0,
        max_allowed: 21500
      }
    }
  },
  healthcare: {
    coverage_type: "employer",
    hdhp_enrolled: false,
    health_savings_account: {
      contributions_ytd: 0,
      existing_balance: 0,
      investment_account_within_hsa: false
    },
    flexible_spending_accounts: {
      dependent_care_fsa: { election_amount: 3000 }
    },
    out_of_pocket_expenses: 3200,
    insurance: {
      type: "employer",
      monthly_premium: 380,
      hdhp_enrolled: false,
      owner_health_insurance_deducted: true
    },
    marketplace_coverage: false
  },
  dependents: {
    dependents: [
      {
        name: "Emma Carter",
        relationship: "child",
        age_at_year_end: 8,
        months_in_home: 12,
        ssn_obtained: true,
        full_time_student: false,
        disability: false,
        education: { school_level: "elementary", tuition_paid: 0 },
        care_expenses: {
          daycare_cost: 0,
          after_school_care_cost: 2400,
          summer_camp_cost: 800
        }
      },
      {
        name: "Noah Carter",
        relationship: "child",
        age_at_year_end: 5,
        months_in_home: 12,
        ssn_obtained: true,
        full_time_student: false,
        disability: false,
        education: { school_level: "elementary", tuition_paid: 0 },
        care_expenses: {
          daycare_cost: 8400,
          after_school_care_cost: 0,
          summer_camp_cost: 0
        }
      }
    ]
  },
  goals: {
    primary_goal: "reduce_taxes",
    secondary_goals: ["build_wealth", "retirement_security"],
    timeline: "long_term",
    risk_tolerance: "moderate",
    transfer_wealth_to_heirs: true,
    has_estate_plan: false,
    anticipated_changes: ["may start hiring employees in 2026"],
    life_events: []
  }
};

function printSummaryLine(status: string, count: number): void {
  const label = status.replaceAll("_", " ").toUpperCase();
  process.stdout.write(`${label}: ${count}\n`);
}

function main(): void {
  ensureRequiredDirectories();
  initDb();

  const existing = getUserByEmail(EMAIL);
  const userId = existing ? existing.id : createUser(EMAIL, hashPassword(PASSWORD), DISPLAY_NAME);

  if (existing) {
    process.stdout.write(`User ${EMAIL} already exists (id: ${userId}) - updating sections.\n`);
  } else {
    process.stdout.write(`Created user ${EMAIL} (id: ${userId}).\n`);
  }

  for (const [section, data] of Object.entries(sections)) {
    saveSectionData(userId, TAX_YEAR, section, data);
    process.stdout.write(`Saved ${section}.\n`);
  }

  const scan = runScan(TAX_YEAR, userId);
  process.stdout.write("\nScan summary:\n");
  printSummaryLine("eligible_now", scan.counts.eligible_now ?? 0);
  printSummaryLine("nearly_eligible", scan.counts.nearly_eligible ?? 0);
  printSummaryLine("eligible_if_changed", scan.counts.eligible_if_changed ?? 0);
}

main();