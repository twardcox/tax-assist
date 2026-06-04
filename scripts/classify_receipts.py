"""
classify_receipts.py

Classifies and AI-extracts tax documents in documents/.
Supports expense receipts, income forms (W-2, 1099 family, 1098), and mileage logs.

Usage:
    python scripts/classify_receipts.py
    python scripts/classify_receipts.py --directory documents/receipts/
    python scripts/classify_receipts.py --file documents/receipts/receipt.pdf
"""

import argparse
import base64
import json
import os
import re
from pathlib import Path
from enum import Enum


ROOT = Path(__file__).parent.parent

# ── Benefit IDs from tax_library/ ─────────────────────────────────────────────
# These are the exact IDs the scanner uses. The AI picks from this list.
BENEFIT_IDS = [
    # Federal — business
    "qbi-deduction", "s-corp-election", "sep-ira-contribution", "solo-401k",
    "self-employed-health-insurance", "hsa-triple-tax-advantage",
    "section-179-expensing", "bonus-depreciation", "business-vehicle-deduction",
    "home-office-deduction",
    # Federal — real estate
    "real-estate-depreciation", "passive-activity-loss", "1031-exchange",
    "augusta-rule", "real-estate-professional-status", "cost-segregation",
    # Federal — itemized / personal
    "charitable-contribution-deduction", "mortgage-interest-deduction",
    "salt-deduction", "25c-energy-home-improvement",
    # Federal — retirement / savings
    "backdoor-roth-ira", "savers-credit", "529-to-roth-rollover",
    "small-employer-retirement-startup-credit",
    # Federal — credits
    "child-tax-credit", "child-dependent-care-credit", "earned-income-tax-credit",
    "american-opportunity-credit", "lifetime-learning-credit",
    "residential-clean-energy-credit", "clean-vehicle-credit",
    "premium-tax-credit",
    # Federal — capital / investments
    "capital-gains-harvesting", "qsbs-exclusion", "nol-carryforward",
    "opportunity-zone-investment", "annual-gift-tax-exclusion",
    # Federal — exclusions
    "section-121-exclusion", "foreign-earned-income-exclusion",
    # State
    "no-income-tax-state", "pte-election", "state-529-deduction",
    "state-retirement-income-exemption", "state-homestead-exemption",
    "state-ev-credit",
]

# ── Common IRS form line references ───────────────────────────────────────────
FORM_LINES = {
    "home_office": "Schedule C Line 30 (home office)",
    "business_expense": "Schedule C Line 28 (other expenses)",
    "office_expense": "Schedule C Line 18 (office expense)",
    "advertising": "Schedule C Line 8 (advertising)",
    "vehicle": "Schedule C Line 9 (car and truck expenses)",
    "meals": "Schedule C Line 24b (meals — 50% deductible)",
    "travel": "Schedule C Line 24a (travel)",
    "utilities": "Schedule C Line 25 (utilities)",
    "wages_paid": "Schedule C Line 26 (wages paid)",
    "legal_professional": "Schedule C Line 17 (legal and professional)",
    "depreciation": "Schedule C Line 13 (depreciation)",
    "rental_expense": "Schedule E Line 19 (other)",
    "mortgage_interest": "Schedule A Line 8a / Form 1098",
    "property_tax": "Schedule A Line 5b",
    "charitable": "Schedule A Line 11 (cash) / Line 12 (non-cash)",
    "medical": "Schedule A Line 1 (medical/dental)",
    "education_credit": "Form 8863",
    "ev_credit": "Form 8936",
    "energy_credit": "Form 5695",
    "child_care": "Form 2441",
    "w2_wages": "Form 1040 Line 1a",
    "self_employment": "Schedule C Line 1 (gross receipts)",
    "rental_income": "Schedule E Line 3 (rents received)",
    "interest_income": "Schedule B / Form 1040 Line 2b",
    "dividends": "Schedule B / Form 1040 Line 3b",
}

# ── Income form document types ─────────────────────────────────────────────────
INCOME_FORM_TYPES = {"w2", "1099_nec", "1099_misc", "1099_int", "1099_div",
                     "1099_b", "1099_r", "1098", "1098t", "1098e", "k1", "ssa1099"}

# ── Prompts ────────────────────────────────────────────────────────────────────

_BENEFIT_LIST = "\n".join(f"  - {b}" for b in BENEFIT_IDS)

RECEIPT_PROMPT = f"""You are a tax document extraction specialist. Examine this expense receipt or invoice.

Return ONLY a valid JSON object with this exact structure (no other text):
{{
  "document_type": "receipt|invoice|mileage_log|other",
  "merchant_or_payer": "string or null",
  "date": "YYYY-MM-DD or null",
  "total_amount": 0.00,
  "description": "brief one-line description",
  "tax_category": "business_expense|personal_expense|mixed_use|rental_expense|capital_improvement|repair|medical|charitable|education|needs_review",
  "deductible_pct": 1.0,
  "benefit_ids": [],
  "form_line": "IRS form and line number string or null",
  "suggested_updates": [
    {{
      "yaml_file": "businesses|income|real_estate|healthcare|investments",
      "dot_path": "dot.separated.path",
      "operation": "add|set",
      "value": 0.00,
      "label": "human-readable description"
    }}
  ],
  "confidence": "high|medium|low",
  "notes": "any important caveats"
}}

Rules for deductible_pct (0.0 to 1.0):
- 1.0 for fully deductible business expenses
- 0.5 for business meals (IRC §274)
- 0.5 or less for home office if mixed-use
- 0.0 for clearly personal expenses
- Estimate business-use percentage for mixed-use items (phone, vehicle, internet)

Rules for benefit_ids — pick ALL that apply from this list:
{_BENEFIT_LIST}

Rules for suggested_updates:
- Use "add" for cumulative amounts (expenses, revenue totals, mileage)
- Use "set" for specific named values (employer name, tax withheld)
- Only include updates you are confident about
- Apply the FULL amount in value (not scaled by deductible_pct — the system scales it)
- Common dot paths:
  - Business expenses: businesses.0.financials.operating_expenses
  - Office expense: businesses.0.financials.operating_expenses
  - Business miles: businesses.0.vehicle.business_miles
  - Rental expenses: real_estate.properties.0.expenses.repairs_maintenance
  - Medical expenses: healthcare.out_of_pocket_expenses
  - Charitable (cash): income.adjustments_to_income (if above-the-line)
  - Mortgage interest: real_estate.properties.0.financing.mortgage_interest_paid
  - Property tax: real_estate.properties.0.financing.property_tax_paid"""

INCOME_FORM_PROMPT = f"""You are a tax document extraction specialist. Examine this income tax form.

First identify the form type, then extract ALL relevant box values.

Return ONLY a valid JSON object with this exact structure (no other text):
{{
  "document_type": "w2|1099_nec|1099_misc|1099_int|1099_div|1099_b|1099_r|1098|1098t|1098e|k1|ssa1099|other",
  "merchant_or_payer": "employer or payer name",
  "payer_ein": "XX-XXXXXXX or null",
  "date": "YYYY or YYYY-MM-DD",
  "total_amount": 0.00,
  "description": "brief description e.g. W-2 from Acme Corp",
  "tax_category": "w2_income|self_employment_income|interest_income|dividend_income|retirement_distribution|rental_income|other_income",
  "deductible_pct": 1.0,
  "benefit_ids": [],
  "form_line": "IRS form and line e.g. Form 1040 Line 1a",
  "suggested_updates": [],
  "confidence": "high|medium|low",
  "notes": "any important caveats"
}}

W-2 specific — set these suggested_updates:
  - income.w2_employment.0.employer_name  (operation: set, value: employer name string)
  - income.w2_employment.0.wages           (operation: set, value: Box 1 amount)
  - income.w2_employment.0.federal_withheld (operation: set, value: Box 2 amount)
  - income.w2_employment.0.state_withheld  (operation: set, value: Box 17 amount if present)

1099-NEC specific:
  - income.self_employment.0.gross_revenue  (operation: add, value: Box 1 nonemployee comp)

1099-INT specific:
  - income.investment_income.interest       (operation: add, value: Box 1 interest income)

1099-DIV specific:
  - income.investment_income.ordinary_dividends  (operation: add, value: Box 1a)
  - income.investment_income.qualified_dividends (operation: add, value: Box 1b)

1099-R specific:
  - income.retirement_distributions.traditional_ira or .401k  (operation: add, value: Box 1)

1098 (mortgage interest) specific:
  - real_estate.properties.0.financing.mortgage_interest_paid (operation: set, value: Box 1)

1098-T (tuition) specific:
  - benefit_ids should include "american-opportunity-credit" or "lifetime-learning-credit"

1098-E (student loan interest) specific:
  - income.adjustments_to_income.student_loan_interest  (operation: add, value: Box 1)

SSA-1099 (Social Security) specific:
  - income.social_security.gross_benefits  (operation: set, value: net benefits Box 5)

Rules for benefit_ids — pick ALL that apply from this list:
{_BENEFIT_LIST}"""

MILEAGE_PROMPT = """You are a tax document extraction specialist. Examine this mileage log.

Return ONLY a valid JSON object with this exact structure (no other text):
{
  "document_type": "mileage_log",
  "merchant_or_payer": null,
  "date": "YYYY-MM-DD of first entry or null",
  "total_amount": 0.00,
  "description": "Mileage log — N business miles",
  "tax_category": "business_expense",
  "deductible_pct": 1.0,
  "benefit_ids": ["business-vehicle-deduction"],
  "form_line": "Schedule C Line 9 (car and truck expenses)",
  "suggested_updates": [
    {
      "yaml_file": "businesses",
      "dot_path": "businesses.0.vehicle.business_miles",
      "operation": "add",
      "value": 0,
      "label": "Business miles from mileage log"
    }
  ],
  "confidence": "high|medium|low",
  "notes": "IRS standard mileage rate for 2025 is $0.70/mile for business"
}

Extract total business miles from the log. Set total_amount = business_miles * 0.70 (2025 rate)."""


# ── Keyword classifier (no-AI fallback) ───────────────────────────────────────

class ExpenseCategory(str, Enum):
    BUSINESS_EXPENSE = "business_expense"
    PERSONAL_EXPENSE = "personal_expense"
    MIXED_USE = "mixed_use"
    RENTAL_EXPENSE = "rental_expense"
    CAPITAL_IMPROVEMENT = "capital_improvement"
    REPAIR = "repair"
    MEDICAL = "medical"
    CHARITABLE = "charitable"
    EDUCATION = "education"
    NEEDS_REVIEW = "needs_review"


KEYWORD_MAP = {
    ExpenseCategory.BUSINESS_EXPENSE: [
        "software", "subscription", "office supply", "office supplies",
        "advertising", "marketing", "business meal", "client", "conference",
        "professional development", "training", "equipment", "computer",
        "phone", "internet", "postage", "shipping", "legal", "accounting",
    ],
    ExpenseCategory.RENTAL_EXPENSE: [
        "repair", "maintenance", "pest control", "landscaping", "cleaning",
        "property management", "appliance", "hvac", "plumbing", "electrical",
        "painting", "flooring",
    ],
    ExpenseCategory.CAPITAL_IMPROVEMENT: [
        "renovation", "addition", "new roof", "remodel", "upgrade",
        "replacement window", "new hvac", "solar panel",
    ],
    ExpenseCategory.MEDICAL: [
        "pharmacy", "prescription", "doctor", "dental", "vision", "hospital",
        "medical", "health", "clinic", "urgent care", "copay",
    ],
    ExpenseCategory.CHARITABLE: [
        "donation", "charity", "nonprofit", "church", "tithe", "contribution",
    ],
    ExpenseCategory.EDUCATION: [
        "tuition", "textbook", "school", "university", "college", "course",
        "certification", "exam fee",
    ],
}

INCOME_FORM_KEYWORDS = ["w2", "w-2", "1099", "1098", "k-1", "k1", "ssa", "social security"]


def classify_by_keywords(description: str) -> ExpenseCategory:
    description_lower = description.lower()
    for category, keywords in KEYWORD_MAP.items():
        if any(kw in description_lower for kw in keywords):
            return category
    return ExpenseCategory.NEEDS_REVIEW


def classify_file(file_path: Path, description: str = "") -> dict:
    text = f"{file_path.stem} {description}".replace("_", " ").replace("-", " ")
    text_lower = text.lower()

    # Detect income forms by filename
    if any(kw in text_lower for kw in INCOME_FORM_KEYWORDS):
        return {
            "file": file_path.name,
            "path": str(file_path.relative_to(ROOT)),
            "category": "income_document",
            "confidence": "medium",
            "note": "Detected as income form. Use 'Extract with AI' for box-level data.",
            "size": file_path.stat().st_size if file_path.exists() else 0,
        }

    category = classify_by_keywords(text)
    if category != ExpenseCategory.NEEDS_REVIEW:
        confidence = "medium"
        note = "Classified from filename. Use 'Extract with AI' for detailed data extraction."
    else:
        confidence = "low"
        note = "Could not classify from filename — add a description or review manually."
    return {
        "file": file_path.name,
        "path": str(file_path.relative_to(ROOT)),
        "category": category.value,
        "confidence": confidence,
        "note": note,
        "size": file_path.stat().st_size if file_path.exists() else 0,
    }


def classify_directory(directory: Path) -> list[dict]:
    results = []
    extensions = {".pdf", ".jpg", ".jpeg", ".png", ".heic", ".tiff", ".csv"}
    for f in sorted(directory.iterdir()):
        if f.suffix.lower() in extensions:
            result = classify_file(f, description="")
            results.append(result)
    return results


# ── AI extraction ──────────────────────────────────────────────────────────────

def _pick_prompt(filename: str, suffix: str, text_preview: str = "") -> str:
    """Choose the right extraction prompt based on filename and content hints."""
    stem_lower = filename.lower()
    # Mileage log
    if "mileage" in stem_lower or "miles" in stem_lower:
        return MILEAGE_PROMPT
    # Income forms by filename
    if any(kw in stem_lower for kw in INCOME_FORM_KEYWORDS):
        return INCOME_FORM_PROMPT
    # CSV content hint — look for mileage columns
    if suffix == ".csv" and any(w in text_preview.lower() for w in ("miles", "odometer", "destination")):
        return MILEAGE_PROMPT
    return RECEIPT_PROMPT


def extract_with_ai(file_path: Path) -> dict:
    """Extract structured tax data from a document using Claude vision/document AI.

    Supports: .pdf (document), .jpg/.jpeg/.png (image), .csv (text).
    Returns a dict with document_type, benefit_ids, deductible_pct, suggested_updates, etc.
    """
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return {
            "error": "ANTHROPIC_API_KEY not set",
            "suggested_updates": [], "confidence": "low",
            "notes": "Set ANTHROPIC_API_KEY to enable AI extraction.",
            "benefit_ids": [], "deductible_pct": 1.0,
        }

    try:
        import anthropic as _anthropic
    except ImportError:
        return {
            "error": "anthropic package not installed",
            "suggested_updates": [], "confidence": "low",
            "notes": "Run: pip install anthropic",
            "benefit_ids": [], "deductible_pct": 1.0,
        }

    suffix = file_path.suffix.lower()
    client = _anthropic.Anthropic()

    try:
        if suffix == ".csv":
            text_content = file_path.read_text(encoding="utf-8", errors="replace")[:4000]
            prompt = _pick_prompt(file_path.name, suffix, text_preview=text_content[:500])
            content = [{"type": "text", "text": f"{prompt}\n\nDocument content (CSV):\n```\n{text_content}\n```"}]

        elif suffix == ".pdf":
            data = base64.standard_b64encode(file_path.read_bytes()).decode("utf-8")
            prompt = _pick_prompt(file_path.name, suffix)
            content = [
                {"type": "text", "text": prompt},
                {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": data}},
            ]

        elif suffix in {".jpg", ".jpeg"}:
            data = base64.standard_b64encode(file_path.read_bytes()).decode("utf-8")
            prompt = _pick_prompt(file_path.name, suffix)
            content = [
                {"type": "text", "text": prompt},
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}},
            ]

        elif suffix == ".png":
            data = base64.standard_b64encode(file_path.read_bytes()).decode("utf-8")
            prompt = _pick_prompt(file_path.name, suffix)
            content = [
                {"type": "text", "text": prompt},
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": data}},
            ]

        else:
            return {
                "document_type": "other",
                "tax_category": ExpenseCategory.NEEDS_REVIEW.value,
                "suggested_updates": [],
                "confidence": "low",
                "benefit_ids": [],
                "deductible_pct": 1.0,
                "notes": f"File type '{suffix}' is not supported for AI extraction. Convert to PDF, JPG, or PNG.",
            }

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            messages=[{"role": "user", "content": content}],
        )
        raw = response.content[0].text

        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            result.setdefault("suggested_updates", [])
            result.setdefault("benefit_ids", [])
            result.setdefault("deductible_pct", 1.0)
            result.setdefault("form_line", None)
            # Clamp deductible_pct
            result["deductible_pct"] = max(0.0, min(1.0, float(result.get("deductible_pct", 1.0))))
            return result

        return {
            "error": "Could not parse AI response", "suggested_updates": [],
            "confidence": "low", "notes": raw[:500],
            "benefit_ids": [], "deductible_pct": 1.0,
        }

    except Exception as exc:
        return {
            "error": str(exc), "suggested_updates": [],
            "confidence": "low", "notes": "Extraction failed — see error.",
            "benefit_ids": [], "deductible_pct": 1.0,
        }


def main():
    parser = argparse.ArgumentParser(description="UTBIS Receipt Classifier")
    parser.add_argument("--directory", type=str, default=None)
    parser.add_argument("--file", type=str, default=None)
    args = parser.parse_args()

    if args.file:
        f = Path(args.file)
        if not f.exists():
            print(f"File not found: {f}")
            return
        result = classify_file(f)
        print(result)
    else:
        directory = Path(args.directory) if args.directory else ROOT / "documents" / "receipts"
        if not directory.exists():
            print(f"Directory not found: {directory}")
            return
        results = classify_directory(directory)
        if not results:
            print(f"No receipt files found in {directory}")
            return
        for r in results:
            print(f"  {r['file']:<40} {r['category']:<25} ({r['confidence']})")


if __name__ == "__main__":
    main()
