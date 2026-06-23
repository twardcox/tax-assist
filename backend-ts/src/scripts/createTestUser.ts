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
//  L1b  household emp   $111      other_wages.household_employee_wages
//  L1c  unreported tips $222      other_wages.tip_income_unreported
//  L1d  medicaid waiver $333      other_wages.medicaid_waiver_payments
//  L1h  other earned    $444      other_wages.other_earned_income
//  L2b  interest        $2,020    investment_income.interest
//  L3b  ordinary_div    $3,030    investment_income.ordinary_dividends
//  L3a  qualified_div   $2,929    investment_income.qualified_dividends (≤ L3b)
//  L4a/b IRA            $4,040    retirement_distributions.traditional_ira
//  L5a/b pension        $5,050    retirement_distributions.pension
//  L6a  SS gross        $6,060    social_security.gross_benefits
//  L6b  SS taxable      derived   ~85% of $6,060
//  L7   cap gains       $15,150   stcg $7,070 + ltcg $8,080
//  L8   Sch1 addl       $27,484   Sch C $9,009 + Sch E $3,019 + Sch F $12,012
//                                 + unemp $707 + refunds $303 + alimony $919
//                                 + gambling $808 + canceled $505 + prizes $606 − NOL $404
//  L25a withholding     $22,020   Alex $20,202 + Jordan $1,818
//  L25b other withheld  $1,515    household.payments.other_withholding
//  L26  est. tax        $2,500    household.payments.estimated_tax_payments
//  L36  apply next yr   $750      household.payments.apply_to_next_year
//
// SCH 1 ADJUSTMENTS
//  L11  educator        $300      (hard-capped at $300 by calculator)
//  L15  SE ded          derived   half of SE tax on $21,021 combined ($9,009 Sch C + $12,012 Sch F)
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
//  expenses $10,010   sum of expense_details below
//  net       $9,009   income.self_employment.net_profit
//  Line 8  advertising     $1,001  expense_details.advertising
//  Line 9  car/truck       $2,002  expense_details.car_truck_expenses
//  Line 15 insurance       $1,402  expense_details.insurance
//  Line 17 legal/prof      $1,501  expense_details.legal_professional
//  Line 18 office          $601    expense_details.office_expense
//  Line 21 repairs         $901    expense_details.repairs_maintenance
//  Line 22 supplies        $1,401  expense_details.supplies
//  Line 25 utilities       $1,201  expense_details.utilities
//
// SCH F
//  gross    $35,035   income.farm.gross_revenue
//  expenses $23,023   sum of expense_details below
//  net      $12,012   income.farm.net_profit → Sch 1 L6
//  Line 16 feed            $4,004  expense_details.feed
//  Line 17 fertilizers     $3,005  expense_details.fertilizers_lime
//  Line 19 gasoline        $2,006  expense_details.gasoline_fuel_oil
//  Line 20 insurance       $1,802  expense_details.insurance_farm
//  Line 22 labor hired     $4,201  expense_details.labor_hired
//  Line 25 repairs         $2,301  expense_details.repairs_maintenance
//  Line 28 supplies        $2,702  expense_details.supplies
//  Line 32 other expenses  $3,002  expense_details.other_expenses
//
// SCH H  (household employment taxes → 1040 L23)
//  wages    $18,000   household.household_employment.employees[0].total_wages
//  SS tax    $2,232   wages × 12.4%
//  Medicare    $522   wages × 2.9%
//  FUTA         $42   min(wages,$7k) × 0.6%
//  Total      $2,796  Sch H L26 → 1040 L23
//
// SCH D
//  row 1a  stcg  $7,070
//  row 8a  ltcg  $8,080
//  net           $15,150 (derived)
//
// SCH SE
//  net profit    $21,021   ($9,009 Sch C + $12,012 Sch F combined on Lines 1a/2)
//  × 0.9235      ~$19,412 (derived)
//  SE tax        ~$2,970 (derived)  [$2,407 SS + $563 Medicare]
//
// 1040 CHECKBOXES & TEXT FIELDS UNDER TEST
//  header         section_9100_2: true         → c1_1
//  header         combat_zone: true            → c1_2
//  header         taxpayer_deceased: true      → deceased header
//  header         taxpayer_date_of_death       → "11" / "15" / "2025"  (f1_05–f1_07)
//  header         presidential_campaign_you    → c1_6
//  header         presidential_campaign_spouse → c1_7
//  digital assets digital_assets: true         → c1_10[0] "Yes"
//  foreign addr   foreign_country: "Germany"   → addr f1_25
//  foreign addr   foreign_province: "Bavaria"  → addr f1_26
//  foreign addr   foreign_postal_code: "80331" → addr f1_27
//  p2 L12a        tp.can_be_claimed_as_dep     → c2_1
//  p2 L12a        sp.can_be_claimed_as_dep     → c2_2
//  p2 L12b        sp.itemizes_separately       → c2_3
//  p2 L12c        tp.dual_status_alien         → c2_4
//  p2 L12d        tp.blind: true               → c2_6
//  p2 L12d        sp.blind: true               → c2_8
//  p2 direct dep  routing_number: "987654321"  → RoutingNo.f2_32
//  p2 direct dep  account_number: "1112223334" → AccountNo.f2_33
//  p2 direct dep  account_type: "savings"      → c2_16[1]
//  p2 L26 fmr sp  former_spouse_ssn: "500-77-8888" → f2_16
//  L4c rollover   income.retDist.ira_rollover  → c1_33
//  L5c rollover   income.retDist.pension_roll  → c1_35
//  L6c lump-sum   income.ss.lump_sum_election  → c1_38
//  L7b no-sched-d income.invInc.sched_d_no_req → c1_40
//  L7b child cg   income.invInc.child_cg_incl  → c1_41
// ─────────────────────────────────────────────────────────────────────────────

const sections: Record<string, Record<string, unknown>> = {

  // ── Household ──────────────────────────────────────────────────────────────
  household: {
    filing_status: "married_filing_jointly",
    tax_year: TAX_YEAR,
    estimated_agi: 212000,
    prior_year_agi: 189000,
    itemizing_deductions: false,
    digital_assets: true,              // → c1_10[0] "Yes" checkbox
    has_electric_vehicle: false,

    // Header checkboxes — all enabled to verify field positions
    section_9100_2: true,              // → c1_1
    combat_zone: true,                 // → c1_2
    taxpayer_deceased: true,           // → deceased header
    taxpayer_date_of_death: "2025-11-15", // → f1_05 "11" / f1_06 "15" / f1_07 "2025"
    spouse_deceased: false,
    presidential_campaign_you: true,   // → c1_6
    presidential_campaign_spouse: true, // → c1_7

    notes: "PRIMARY earner at Meridian Technologies; side consulting practice via Carter Consulting LLC.",

    taxpayer: {
      first_name: "Alex",
      last_name: "Carter",
      ssn: "400-12-3456",
      dob: "1983-03-15",
      age: 42,
      blind: true,                        // → c2_6 "Are blind"
      disabled: false,
      active_military: false,
      veteran: false,
      student: false,
      can_be_claimed_as_dependent: true,  // → c2_1 "You as a dependent"
      dual_status_alien: true,            // → c2_4
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
      blind: true,                          // → c2_8 "Is blind"
      can_be_claimed_as_dependent: true,    // → c2_2 "Spouse as a dependent"
      itemizes_separately: true,            // → c2_3 (MFS scenario checkbox)
    },

    residence: {
      street_address: "4821 Mockingbird Lane",
      city: "Austin",
      state: "TX",
      zip: "78701",
      county: "Travis",
      // Foreign address fields — filled on form alongside domestic address for test
      foreign_country: "Germany",           // → addr f1_25
      foreign_province: "Bavaria",          // → addr f1_26
      foreign_postal_code: "80331",         // → addr f1_27
    },

    dependents: { count: 3 },

    // Household employment: nanny Maria Garcia ($18,000 wages)
    // SS tax = $18,000 × 12.4% = $2,232  Medicare = $18,000 × 2.9% = $522
    // FUTA: min($18k, $7k) × 0.6% = $42    Total Sch H = $2,796
    household_employment: {
      employees: [
        { name: "Maria Garcia", ssn: "300-55-7777", total_wages: 18000 },
      ],
      state: "TX",
      state_unemployment_paid: true,
      total_fed_tax_withheld: 0,
    },

    // est_tax → 1040 L26:  $2,500
    // other_withheld:       $1,515
    // apply_to_next_year:   $750  → L36 (splits refund if any)
    payments: {
      estimated_tax_payments: 2500,
      other_withholding: 1515,
      // EIC: test user's income is too high to qualify, but setting $0 confirms
      // the field is wired correctly (EIC users would enter their IRS table amount)
      earned_income_credit: 0,
      apply_to_next_year: 750,           // → f2_27
      routing_number: "987654321",       // → RoutingNo.f2_32
      account_number: "1112223334",      // → AccountNo.f2_33
      account_type: "savings",           // → c2_16[1] Savings checkbox
      former_spouse_ssn: "500-77-8888",  // → f2_16
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

    // Lines 1b–1h: wages not on a W-2
    other_wages: {
      household_employee_wages: 111,  // L1b → f1_48
      tip_income_unreported: 222,     // L1c → f1_49
      medicaid_waiver_payments: 333,  // L1d → f1_50
      other_earned_income: 444,       // L1h → f1_54
    },

    self_employment: [
      {
        // Sch C: gross $19,019 / expenses $10,010 / net $9,009
        business_name: "Carter Consulting LLC",
        gross_revenue: 19019,
        net_profit: 9009,
        net_profit_loss: 9009,
        se_tax_estimated: 1272,
        expense_details: {
          advertising: 1001,         // Line 8
          car_truck_expenses: 2002,  // Line 9
          insurance: 1402,           // Line 15
          legal_professional: 1501,  // Line 17
          office_expense: 601,       // Line 18
          repairs_maintenance: 901,  // Line 21
          supplies: 1401,            // Line 22
          utilities: 1201,           // Line 25
          // sum = 10,010 = gross_revenue − net_profit ✓
        },
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
      schedule_d_not_required: true,      // → c1_40[0] Line 7b checkbox
      child_capital_gain_included: true,  // → c1_41[0] Line 7b checkbox
      // Sch B Part III — foreign account question
      foreign_financial_account: true,    // → c1_1[0] Yes
      foreign_account_country: "Switzerland", // → f1_66
      foreign_trust: false,               // → c1_3[1] No
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
      ira_rollover: true,     // → c1_33[0] Line 4c "Rollover" checkbox
      pension_rollover: true, // → c1_35[0] Line 5c "Rollover" checkbox
    },

    social_security: {
      // 1040 L6a:  $6,060
      // 1040 L6b:  derived ~$5,151 (85% × $6,060 at this income level)
      gross_benefits: 6060,
      taxable_portion: 0,
      lump_sum_election: true, // → c1_38[0] Line 6c checkbox
    },

    passive_income: {
      // Sch 1 (k1 lines): $1,010
      k1_ordinary: 1010,
      // Sch 1 (k1 rental): $909
      k1_rental: 909,
      k1_guaranteed_payments: 0,
    },

    other_income: {
      // Sch 1 L1:  $303  → f1_03
      taxable_refunds: 303,
      // Sch 1 L2a: $919  → f1_04 (pre-2019 agreement = taxable)
      alimony_received: 919,
      alimony_date_of_divorce: "06/15/2017",
      // Sch 1 L7:  $707  → Line7_ReadOrder.f1_11
      unemployment_compensation: 707,
      // Sch 1 L8a: -$404 → Line8a_ReadOrder.f1_13
      net_operating_loss: -404,
      // Sch 1 L8b: $808  → f1_15
      gambling_winnings: 808,
      // Sch 1 L8c: $505  → f1_16
      canceled_debt: 505,
      // Sch 1 L8z: $606  → Line8z_ReadOrder.f1_35 + f1_36
      prizes_awards: 606,
      farm_income: 0,   // overridden by income.farm below
      other_amount: 0,
      other_description: "",
    },

    // Farm income detail — Sch F → Sch 1 L6:  net $12,012
    // gross $35,035  expenses $23,023  net $12,012
    farm: {
      farm_name: "Sundown Family Farm",
      principal_product: "Vegetable farming",
      naics_code: "111210",
      gross_revenue: 35035,
      net_profit: 12012,
      expense_details: {
        feed: 4004,                  // Line 16
        fertilizers_lime: 3005,      // Line 17
        gasoline_fuel_oil: 2006,     // Line 19
        insurance_farm: 1802,        // Line 20
        labor_hired: 4201,           // Line 22
        repairs_maintenance: 2301,   // Line 25
        supplies: 2702,              // Line 28
        other_expenses: 3002,        // Line 32 other
        // sum = 23,023 = gross_revenue − net_profit ✓
      },
    },

    adjustments_to_income: {
      // Sch 1 L11: $300 (calculator hard-caps at $300) → f2_03
      educator_expenses: 300,
      hsa_contributions_outside_payroll: 0,
      // Sch 1 L14: $0 (non-military) → f2_05
      moving_expenses_military: 0,
      // Sch 1 L15: derived (se_tax / 2) → f2_06
      self_employed_se_tax_deduction: 0,
      // Sch 1 L16: $505 → f2_07
      sep_simple_contributions: 505,
      // Sch 1 L17: $4,400 → f2_08
      self_employed_health_insurance: 4400,
      // Sch 1 L19a: $1,414 → f2_09
      alimony_paid: 1414,
      // Sch 1 L19b: recipient SSN → Line19b_CombField.f2_10
      alimony_recipient_ssn: "600-88-9999",
      // Sch 1 L20: $1,313 → f2_12
      ira_deduction: 1313,
      // Sch 1 L21: $1,212 → f2_13
      student_loan_interest: 1212,
      // Sch 1 L24z: $404 → Line24z_ReadOrder.f2_27 + f2_28
      other_adjustments_amount: 404,
      other_adjustments_description: "Repayment prior-year income",
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
        notes: "Primary home. §121 exclusion available. Solar installed 2025.",

        // Form 5695 energy credits installed in 2025
        energy_credits: {
          // Part I — §25D Residential Clean Energy Credit
          // solar_electric: 25000 × 30% = 7,500; battery: 5000 × 30% = 1,500 → §25D total = 9,000
          solar_electric_cost: 25000,
          solar_water_cost: 0,
          wind_cost: 0,
          geothermal_cost: 0,
          battery_cost: 5000,           // ≥3 kWh qualifies

          // Part II — §25C Energy Efficient Home Improvement Credit
          // insulation: 4000×30%=1200 (1200-cap item); window: 3000×30%=900→capped 600 (1200-cap item)
          // subtotal 1200-cap items = min(1200+600, 1200) = 1200
          // heat pump: 8000×30%=2400→capped 2000 (separate 2000-cap) → §25C total = 3,200
          insulation_cost: 4000,
          door_cost: 0,
          window_cost: 3000,
          central_ac_cost: 0,
          water_heater_cost: 0,
          furnace_cost: 0,
          heat_pump_cost: 8000,
          heat_pump_wh_cost: 0,
          biomass_cost: 0,
          home_energy_audit_cost: 0,
        },
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

async function main(): Promise<void> {
  ensureRequiredDirectories();
  await initDb();

  const existing = await getUserByEmail(EMAIL);
  const userId = existing
    ? existing.id
    : await createUser(EMAIL, hashPassword(PASSWORD), DISPLAY_NAME);

  if (existing) {
    process.stdout.write(`User ${EMAIL} already exists (id: ${userId}) — overwriting all sections.\n`);
  } else {
    process.stdout.write(`Created user ${EMAIL} (id: ${userId}).\n`);
  }

  for (const [section, data] of Object.entries(sections)) {
    await saveSectionData(userId, TAX_YEAR, section, data);
    process.stdout.write(`  ✓ ${section}\n`);
  }

  process.stdout.write("\nRunning scanner...\n");
  const scan = await runScan(TAX_YEAR, userId);

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

void main();
