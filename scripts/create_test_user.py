"""
Creates a realistic test user for scanner verification.

Profile: Alex Carter — married, two kids, W-2 + consulting side business,
primary residence in Texas, electric vehicle, modest investments.
Triggers a mix of ELIGIBLE_NOW and NEARLY_ELIGIBLE benefits.

Run:  python scripts/create_test_user.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT))

from api.db import (
    create_user, get_user_by_email, save_section_data, init_db,
)
from api.auth import hash_password

EMAIL    = "alex.carter@example.com"
PASSWORD = "TestUser123!"
NAME     = "Alex Carter"
TAX_YEAR = 2025

HOUSEHOLD = {
    "filing_status": "mfj",
    "estimated_agi": 190000,
    "residence": {"state": "TX"},
    "taxpayer": {"age": 42, "dob": "1983-03-15"},
    "spouse": {"present": True, "age": 40, "employed_in_business": False},
    "dependents": {"count": 2},
    "itemizing_deductions": False,
    "has_electric_vehicle": True,
}

INCOME = {
    "w2_employment": [
        {
            "employer_name": "Meridian Technologies Inc.",
            "employer_ein": "45-1234567",
            "wages": 155000,
            "federal_withheld": 28000,
            "state_withheld": 0,          # TX has no income tax
            "hsa_contributions_through_payroll": 0,
            "retirement_contributions_through_payroll": 12000,
            "dependent_care_fsa": 3000,
        }
    ],
    "self_employment": [
        {
            "business_name": "Carter Consulting LLC",
            "gross_revenue": 38000,
            "net_profit": 21500,
            "se_tax_estimated": 3035,
        }
    ],
    "rental_income": [],
    "investment_income": {
        "qualified_dividends": 1800,
        "ordinary_dividends": 2200,
        "interest": 650,
        "short_term_capital_gains": 0,
        "long_term_capital_gains": 6500,
        "qualified_opportunity_zone_gains": 0,
    },
    "retirement_distributions": {
        "traditional_ira": 0,
        "roth_ira": 0,
        "401k": 0,
        "pension": 0,
        "annuity": 0,
        "required_minimum_distribution": False,
    },
    "social_security": {"gross_benefits": 0, "taxable_portion": 0},
    "adjustments_to_income": {
        "student_loan_interest": 0,
        "educator_expenses": 0,
        "hsa_contributions_outside_payroll": 0,
        "self_employed_health_insurance": 7200,
        "self_employed_se_tax_deduction": 1518,
        "alimony_paid": 0,
        "ira_deduction": 0,
        "moving_expenses_military": 0,
    },
}

BUSINESSES = {
    "businesses": [
        {
            "name": "Carter Consulting LLC",
            "entity_type": "llc_single",
            "ein": "",
            "industry": "Professional Services",
            "start_date": "2020-06-01",
            "financials": {
                "gross_revenue": 38000,
                "operating_expenses": 16500,
                "net_profit_loss": 21500,
            },
            "employees": {"has_w2_employees": False, "w2_employees_count": 0},
            "home_office": {
                "claimed": True,
                "square_footage": 280,
                "home_total_sqft": 2200,
            },
            "vehicle": {
                "business_vehicle": True,
                "business_miles": 8400,
                "total_miles": 14000,
                "fuel_type": "gasoline",
            },
            "health_insurance": {
                "premium_amount": 7200,
                "owner_health_insurance_deducted": True,
            },
            "specified_service_trade": False,
            "qbi_eligible": True,
            "owner_draws": 18000,
            "retirement_plan_type": None,
            "depreciation": {"assets": [], "assets_placed_in_service": False},
        }
    ]
}

REAL_ESTATE = {
    "properties": [
        {
            "address": "4821 Mockingbird Lane, Austin, TX 78701",
            "property_type": "primary_residence",
            "acquisition": {
                "purchase_date": "2019-04-10",
                "purchase_price": 395000,
                "current_market_value": 548000,
            },
            "primary_residence": {"years_lived_in": 6},
            "rental": {"months_rented_ytd": 0},
            "gross_rents": 0,
            "net_income_loss": 0,
            "financing": {
                "mortgage_interest_paid": 17800,
                "property_tax_paid": 8200,
            },
            "depreciation": {
                "basis": 0,
                "method": None,
                "accumulated_depreciation": 0,
            },
            "homestead_exemption_applied": True,
            "in_opportunity_zone": False,
            "improvements": {"solar_panels_installed": False},
        }
    ]
}

INVESTMENTS = {
    "taxable_accounts": [
        {
            "institution": "Fidelity",
            "current_value": 52000,
            "cost_basis": 33000,
            "unrealized_gains": 19000,
            "has_startup_stock": False,
            "holdings": {"individual_stocks": False},
        }
    ],
    "529_plans": [],
    "has_qualified_small_business_stock": False,
}

RETIREMENT = {
    "employer_plans": {
        "traditional_401k": {
            "employer_name": "Meridian Technologies Inc.",
            "employee_contribution_ytd": 12000,
            "employer_match_ytd": 4800,
            "balance": 91000,
        }
    },
    "individual_retirement_accounts": {
        "traditional_ira": {
            "accounts": [{"balance": 24500}],
            "contributions_ytd": 0,
        },
        "roth_ira": {
            "accounts": [],
            "contributions_ytd": 0,
        },
    },
    "self_employed_plans": {
        "sep_ira": {
            "established": False,
            "contributions_ytd": 0,
            "max_allowed": 5375,   # 25% of $21,500 net
        },
        "solo_401k": {
            "established": False,
            "contributions_ytd": 0,
            "employee_contributions_ytd": 0,
            "max_allowed": 21500,
        },
    },
}

HEALTHCARE = {
    "coverage_type": "employer",
    "hdhp_enrolled": False,
    "hdhp_coverage_level": None,
    "health_savings_account": {
        "contributions_ytd": 0,
        "existing_balance": 0,
        "investment_account_within_hsa": False,
    },
    "flexible_spending_accounts": {
        "dependent_care_fsa": {"election_amount": 3000},
    },
    "out_of_pocket_expenses": 3200,
    "insurance": {
        "type": "employer",
        "monthly_premium": 380,
        "hdhp_enrolled": False,
        "owner_health_insurance_deducted": True,
    },
    "marketplace_coverage": False,
}

DEPENDENTS = {
    "dependents": [
        {
            "name": "Emma Carter",
            "relationship": "child",
            "age_at_year_end": 8,
            "months_in_home": 12,
            "ssn_obtained": True,
            "full_time_student": False,
            "disability": False,
            "education": {"school_level": "elementary", "tuition_paid": 0},
            "care_expenses": {
                "daycare_cost": 0,
                "after_school_care_cost": 2400,
                "summer_camp_cost": 800,
            },
        },
        {
            "name": "Noah Carter",
            "relationship": "child",
            "age_at_year_end": 5,
            "months_in_home": 12,
            "ssn_obtained": True,
            "full_time_student": False,
            "disability": False,
            "education": {"school_level": "elementary", "tuition_paid": 0},
            "care_expenses": {
                "daycare_cost": 8400,
                "after_school_care_cost": 0,
                "summer_camp_cost": 0,
            },
        },
    ]
}

GOALS = {
    "primary_goal": "reduce_taxes",
    "secondary_goals": ["build_wealth", "retirement_security"],
    "timeline": "long_term",
    "risk_tolerance": "moderate",
    "transfer_wealth_to_heirs": True,
    "has_estate_plan": False,
    "anticipated_changes": ["may start hiring employees in 2026"],
    "life_events": [],
}


def main():
    init_db()

    existing = get_user_by_email(EMAIL)
    if existing:
        print(f"User {EMAIL} already exists (id: {existing['id']}) — skipping creation.")
        uid = existing["id"]
    else:
        uid = create_user(EMAIL, hash_password(PASSWORD), NAME)
        print(f"Created user: {EMAIL}  (id: {uid})")

    sections = {
        "household":   HOUSEHOLD,
        "income":      INCOME,
        "businesses":  BUSINESSES,
        "real_estate": REAL_ESTATE,
        "investments": INVESTMENTS,
        "retirement":  RETIREMENT,
        "healthcare":  HEALTHCARE,
        "dependents":  DEPENDENTS,
        "goals":       GOALS,
    }

    for section, data in sections.items():
        save_section_data(uid, TAX_YEAR, section, data)
        print(f"  Saved {section}")

    # Run the scanner to show what benefits this profile triggers
    print()
    print("Running scanner against new profile…")
    from scan_opportunities import OpportunityScanner, UserFacts, EligibilityStatus

    facts = UserFacts(TAX_YEAR, user_id=uid)
    scanner = OpportunityScanner(TAX_YEAR, facts=facts)
    scanner.scan()

    print()
    width = 42
    for status in ["eligible_now", "nearly_eligible", "eligible_if_changed"]:
        matches = [r for r in scanner.results if r.status.value == status]
        if matches:
            label = status.replace("_", " ").upper()
            print(f"-- {label} ({len(matches)}) " + "-" * max(0, 50 - len(label)))
            for r in matches:
                print(f"   {r.benefit_name:<{width}}  {r.estimated_value}")

    counts = {}
    for r in scanner.results: counts[r.status.value] = counts.get(r.status.value, 0) + 1
    print()
    print("Status summary:", counts)
    print()
    print("-" * 60)
    print(f"Login:    {EMAIL}")
    print(f"Password: {PASSWORD}")
    print("-" * 60)


if __name__ == "__main__":
    main()
