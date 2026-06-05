"""
scan_opportunities.py

Reads user facts from user_data/, benefit records from tax_library/,
and eligibility rules from rules/eligibility_rules/, then produces
an opportunity report at reports/opportunity_report.md.

Usage:
    python scripts/scan_opportunities.py
    python scripts/scan_opportunities.py --tax-year 2025
    python scripts/scan_opportunities.py --output json
    python scripts/scan_opportunities.py --min-value 500
"""

import argparse
import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

import yaml

try:
    import anthropic as _anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    _anthropic = None
    ANTHROPIC_AVAILABLE = False

ROOT = Path(__file__).parent.parent


class EligibilityStatus(str, Enum):
    ELIGIBLE_NOW = "eligible_now"
    NEARLY_ELIGIBLE = "nearly_eligible"
    ELIGIBLE_IF_CHANGED = "eligible_if_changed"
    FUTURE_OPPORTUNITY = "future_opportunity"
    NOT_APPLICABLE = "not_applicable"
    EXPIRED = "expired"
    HIGH_RISK = "high_risk"
    UNKNOWN = "unknown"


STATUS_SORT = [
    EligibilityStatus.ELIGIBLE_NOW,
    EligibilityStatus.NEARLY_ELIGIBLE,
    EligibilityStatus.ELIGIBLE_IF_CHANGED,
    EligibilityStatus.FUTURE_OPPORTUNITY,
    EligibilityStatus.HIGH_RISK,
    EligibilityStatus.UNKNOWN,
    EligibilityStatus.NOT_APPLICABLE,
    EligibilityStatus.EXPIRED,
]


@dataclass
class OpportunityResult:
    benefit_id: str
    benefit_name: str
    category: str
    jurisdiction: str
    status: EligibilityStatus
    message: str
    estimated_value: str = ""
    risk_level: str = "low"
    forms_required: list = field(default_factory=list)
    documents_needed: list = field(default_factory=list)
    next_steps: list = field(default_factory=list)
    missing_facts: list = field(default_factory=list)
    changes_needed: list = field(default_factory=list)
    review_required: bool = False
    phaseout_note: str = ""


class UserFacts:
    """Loads user data from DB (when user_id provided) or YAML files (CLI fallback)."""

    def __init__(self, tax_year: int = 2025, user_id: str | None = None):
        self.tax_year = tax_year
        self.user_id = user_id
        self._data: dict = {}
        self._load()

    def _load(self):
        if self.user_id is not None:
            self._load_from_db()
        else:
            self._load_from_yaml()

    def _load_from_yaml(self):
        data_dir = ROOT / "user_data"
        for f in data_dir.glob("*.yaml"):
            with open(f, encoding="utf-8") as fh:
                self._data[f.stem] = yaml.safe_load(fh) or {}

    def _load_from_db(self):
        try:
            from api.db import get_all_user_data
            self._data = get_all_user_data(self.user_id, self.tax_year)
        except Exception:
            self._load_from_yaml()  # fallback if DB unavailable

    def get(self, path: str, default=None):
        """Dot-path accessor: 'household.filing_status'"""
        parts = path.replace("[0]", ".0").split(".")
        node = self._data
        for part in parts:
            if node is None:
                return default
            if isinstance(node, dict):
                node = node.get(part)
            elif isinstance(node, list):
                try:
                    node = node[int(part)]
                except (IndexError, ValueError):
                    return default
            else:
                return default
        return node if node is not None else default

    # ── convenience helpers ────────────────────────────────────────────────

    def filing_status(self) -> Optional[str]:
        return self._data.get("household", {}).get("filing_status")

    def estimated_agi(self) -> Optional[float]:
        val = self._data.get("household", {}).get("estimated_agi")
        return _to_float(val)

    def has_self_employment(self) -> bool:
        businesses = self._data.get("businesses", {}).get("businesses", []) or []
        se_types = {"sole_prop", "llc_single", "llc_multi", "s_corp", "partnership"}
        return any(b.get("entity_type") in se_types for b in businesses)

    def has_any_business(self) -> bool:
        return bool(self._data.get("businesses", {}).get("businesses"))

    def businesses(self) -> list:
        return self._data.get("businesses", {}).get("businesses", []) or []

    def first_business(self) -> dict:
        bs = self.businesses()
        return bs[0] if bs else {}

    def has_rental_property(self) -> bool:
        props = self._data.get("real_estate", {}).get("properties", []) or []
        rental = {"rental_residential", "rental_commercial", "mixed_use"}
        return any(p.get("property_type") in rental for p in props)

    def has_any_real_estate(self) -> bool:
        return bool(self._data.get("real_estate", {}).get("properties"))

    def first_property(self) -> dict:
        props = self._data.get("real_estate", {}).get("properties", []) or []
        return props[0] if props else {}

    def hdhp_enrolled(self) -> bool:
        return self._data.get("healthcare", {}).get("hdhp_enrolled") is True

    def healthcare_coverage(self) -> Optional[str]:
        return self._data.get("healthcare", {}).get("coverage_type")

    def has_dependents(self) -> bool:
        deps = self._data.get("dependents", {}).get("dependents", []) or []
        return bool(deps)

    def dependents(self) -> list:
        return self._data.get("dependents", {}).get("dependents", []) or []

    def itemizing(self) -> Optional[bool]:
        val = self._data.get("household", {}).get("itemizing_deductions")
        if val is True:
            return True
        if val is False:
            return False
        return None

    def has_w2_income(self) -> bool:
        w2s = self._data.get("income", {}).get("w2_employment", []) or []
        return bool(w2s) and any(_to_float(w.get("wages")) for w in w2s)

    def total_investment_income(self) -> float:
        inv = self._data.get("income", {}).get("investment_income", {}) or {}
        return sum(
            _to_float(inv.get(k))
            for k in ("qualified_dividends", "ordinary_dividends", "interest",
                      "short_term_capital_gains", "long_term_capital_gains")
        )

    def long_term_capital_gains(self) -> float:
        inv = self._data.get("income", {}).get("investment_income", {}) or {}
        return _to_float(inv.get("long_term_capital_gains"))

    def transfer_wealth_goal(self) -> Optional[bool]:
        return self._data.get("goals", {}).get("transfer_wealth_to_heirs")

    def taxpayer_age(self) -> Optional[int]:
        age = self._data.get("household", {}).get("taxpayer", {})
        if isinstance(age, dict):
            return age.get("age")
        return None

    def goals(self) -> dict:
        return self._data.get("goals", {}) or {}

    def state(self) -> Optional[str]:
        val = self._data.get("household", {}).get("residence", {}).get("state")
        return str(val).strip().upper() if val else None

    def business_nexus_states(self) -> set:
        """Union of all operating_states across every business, plus the residence state."""
        states = set()
        res = self.state()
        if res:
            states.add(res)
        for biz in self.businesses():
            ops = biz.get("operating_states") or []
            if isinstance(ops, list):
                states.update(s.strip().upper() for s in ops if s)
            elif isinstance(ops, str):
                states.update(s.strip().upper() for s in ops.split(",") if s.strip())
        return states

    def county(self) -> Optional[str]:
        val = self._data.get("household", {}).get("residence", {}).get("county")
        return str(val).strip() if val else None

    def is_veteran(self) -> bool:
        tp = self._data.get("household", {}).get("taxpayer", {})
        return bool(tp.get("veteran")) if isinstance(tp, dict) else False

    def is_disabled(self) -> bool:
        tp = self._data.get("household", {}).get("taxpayer", {})
        return bool(tp.get("disabled")) if isinstance(tp, dict) else False

    def has_retirement_distributions(self) -> bool:
        inc = self._data.get("household", {}).get("income_sources", []) or []
        if isinstance(inc, list):
            for item in inc:
                if isinstance(item, dict) and item.get("retirement_distributions"):
                    return True
        ret_dist = self._data.get("income", {}).get("retirement_distributions", {}) or {}
        if isinstance(ret_dist, dict):
            return any(_to_float(v) > 0 for v in ret_dist.values() if v not in (None, False))
        return False

    def has_social_security(self) -> bool:
        inc = self._data.get("household", {}).get("income_sources", []) or []
        if isinstance(inc, list):
            for item in inc:
                if isinstance(item, dict) and item.get("social_security"):
                    return True
        ss = self._data.get("income", {}).get("social_security", {}) or {}
        return _to_float(ss.get("gross_benefits")) > 0

    def has_529_account(self) -> bool:
        plans = self._data.get("investments", {}).get("529_plans", []) or []
        if isinstance(plans, list):
            return any(
                isinstance(p, dict) and (p.get("beneficiary") or _to_float(p.get("balance")) > 0)
                for p in plans
            )
        return False

    def primary_residence(self) -> dict:
        props = self._data.get("real_estate", {}).get("properties", []) or []
        for p in props:
            if isinstance(p, dict) and p.get("property_type") in ("primary_residence", "primary"):
                return p
        return {}

    def has_ev(self) -> bool:
        for biz in self.businesses():
            vehicle = biz.get("vehicle") or {}
            fuel = vehicle.get("fuel_type", "")
            if fuel and str(fuel).lower() in ("electric", "ev", "bev", "phev", "plug-in hybrid"):
                return True
        return self._data.get("household", {}).get("has_electric_vehicle") is True

    def has_retirement_contributions(self) -> bool:
        ret = self._data.get("retirement", {}) or {}
        employer = ret.get("employer_plans", {}) or {}
        for plan_name in ("traditional_401k", "403b", "457b", "simple_ira"):
            plan = employer.get(plan_name) or {}
            if isinstance(plan, dict):
                contrib = plan.get("employee_contribution_ytd") or plan.get("contribution_ytd")
                if _to_float(contrib) > 0:
                    return True
        ira = ret.get("individual_retirement_accounts", {}) or {}
        for acct_name in ("traditional_ira", "roth_ira"):
            acct = ira.get(acct_name) or {}
            if isinstance(acct, dict) and _to_float(acct.get("contributions_ytd")) > 0:
                return True
        se = ret.get("self_employed_plans", {}) or {}
        for plan_name, keys in (
            ("sep_ira", ("contributions_ytd",)),
            ("solo_401k", ("employee_contributions_ytd", "employer_contributions_ytd")),
        ):
            plan = se.get(plan_name) or {}
            if isinstance(plan, dict) and any(_to_float(plan.get(k)) > 0 for k in keys):
                return True
        return False

    def household_size(self) -> int:
        hh = self._data.get("household", {}) or {}
        size = 1
        if (hh.get("spouse") or {}).get("present"):
            size += 1
        deps = hh.get("dependents", {})
        if isinstance(deps, dict):
            size += int(deps.get("count") or 0)
        else:
            size += len(self.dependents())
        return max(1, size)

    def has_startup_equity(self) -> bool:
        if self._data.get("investments", {}).get("has_qualified_small_business_stock") is True:
            return True
        accs = self._data.get("investments", {}).get("taxable_accounts", []) or []
        for acc in accs:
            if isinstance(acc, dict):
                holdings = acc.get("holdings", {}) or {}
                if holdings.get("individual_stocks") or acc.get("has_startup_stock"):
                    return True
        return False


def _to_float(val) -> float:
    if val is None:
        return 0.0
    try:
        return float(str(val).replace(",", "").replace("$", ""))
    except (ValueError, TypeError):
        return 0.0


# ── Phaseout calculators ──────────────────────────────────────────────────

def phaseout_range(agi: float, full_below: float, zero_above: float) -> str:
    """Returns a human note about AGI vs phaseout range."""
    if agi is None:
        return ""
    if agi < full_below:
        return ""
    if agi >= zero_above:
        return f"AGI ${agi:,.0f} is above phaseout — benefit fully phased out"
    pct_through = (agi - full_below) / (zero_above - full_below) * 100
    return f"AGI ${agi:,.0f} is {pct_through:.0f}% through phaseout range (${full_below:,.0f}–${zero_above:,.0f})"


def phaseout_cliff(agi: float, cliff: float) -> str:
    if agi is None:
        return ""
    if agi > cliff:
        return f"AGI ${agi:,.0f} exceeds limit of ${cliff:,.0f} — benefit not available"
    return ""


# ── Rules Engine ─────────────────────────────────────────────────────────

class RulesEngine:
    def __init__(self, facts: UserFacts):
        self.f = facts

    def evaluate(self, benefit: dict) -> OpportunityResult:
        bid = benefit.get("id", "")
        handler = getattr(self, f"_rule_{bid.replace('-', '_')}", None)
        if handler:
            return handler(benefit)
        return self._unknown(benefit)

    def _base(self, b: dict, **kwargs) -> dict:
        forms = [
            (f.get("form") if isinstance(f, dict) else f)
            for f in (b.get("required_forms") or [])
        ]
        docs = [
            (d.get("document") if isinstance(d, dict) else d)
            for d in (b.get("required_documents") or [])
        ]
        rv = b.get("review_required") or {}
        review = rv.get("cpa", False) if isinstance(rv, dict) else False
        base = dict(
            benefit_id=b.get("id", ""),
            benefit_name=b.get("name", ""),
            category=b.get("category", ""),
            jurisdiction=b.get("jurisdiction", "federal"),
            risk_level=b.get("risk_level", "low"),
            forms_required=forms,
            documents_needed=docs,
            review_required=bool(review),
            estimated_value=b.get("estimated_value", {}).get("typical_range", "") if isinstance(b.get("estimated_value"), dict) else "",
        )
        base.update(kwargs)
        return base

    def _result(self, base: dict, status: EligibilityStatus, message: str, **kwargs) -> OpportunityResult:
        return OpportunityResult(status=status, message=message, **{**base, **kwargs})

    def _unknown(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        return OpportunityResult(
            **base,
            status=EligibilityStatus.UNKNOWN,
            message="Eligibility rule not yet implemented for this benefit.",
        )

    # ── Business / Self-Employment Benefits ──────────────────────────────

    def _rule_home_office_deduction(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_self_employment():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "No self-employment income found. Home office requires self-employment or required employer home office.")
        biz = self.f.first_business()
        ho = biz.get("home_office") or {}
        claimed = ho.get("claimed")
        sqft = ho.get("square_footage")
        if claimed and sqft:
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                "Home office deduction available. Verify exclusive-use documentation.",
                next_steps=[
                    "Calculate office sq ft as % of total home sq ft",
                    "Gather utility, insurance, and mortgage/rent receipts",
                    "Photograph workspace for audit file",
                    "Choose simplified ($5/sq ft, max $1,500) vs. regular method on Form 8829",
                ])
        if claimed and not sqft:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Home office confirmed but square footage missing — needed to calculate deduction.",
                missing_facts=["businesses.home_office.square_footage"],
                next_steps=["Measure and record office square footage in businesses.yaml"])
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            "Self-employment present — confirm whether you have an exclusive-use workspace.",
            missing_facts=["businesses.home_office.claimed", "businesses.home_office.square_footage"],
            next_steps=[
                "Designate a space used exclusively for business",
                "Set home_office.claimed: true in businesses.yaml",
                "Measure and record square footage",
            ])

    def _rule_qbi_deduction(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_self_employment():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "QBI deduction requires pass-through business income (self-employment, partnership, S Corp, or LLC).")
        biz = self.f.first_business()
        net_profit = _to_float(biz.get("financials", {}).get("net_profit_loss"))
        agi = self.f.estimated_agi()
        fs = self.f.filing_status() or "single"

        thresholds = {
            "single": (197300, 247300),
            "mfj":    (394600, 494600),
            "married_filing_jointly": (394600, 494600),
            "hoh":    (197300, 247300),
            "head_of_household": (197300, 247300),
            "mfs":    (197300, 247300),
        }
        lo, hi = thresholds.get(fs.lower(), (197300, 247300))

        if net_profit <= 0:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Has self-employment but net profit not recorded. QBI deduction requires positive net profit.",
                missing_facts=["businesses.financials.net_profit_loss"])

        phaseout_note = ""
        if agi:
            phaseout_note = phaseout_range(agi, lo, hi)
            if agi > hi:
                sstb = biz.get("specified_service_trade")
                if sstb is True:
                    return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                        f"SSTB business + AGI ${agi:,.0f} above phaseout — QBI deduction fully phased out.",
                        phaseout_note=phaseout_note)
                return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                    f"QBI deduction available but W-2 wage / qualified property limitation applies (AGI above threshold).",
                    phaseout_note=phaseout_note,
                    next_steps=[
                        "Calculate W-2 wage limitation (50% of W-2 wages, or 25% wages + 2.5% property)",
                        "Use Form 8995-A (not simplified Form 8995)",
                        "Review with CPA — optimization of salary/distribution split matters here",
                    ])

        msg = f"QBI deduction available — estimated 20% of ~${net_profit:,.0f} net profit."
        if phaseout_note:
            msg += f" Note: {phaseout_note}"
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW, msg,
            estimated_value=f"~${net_profit * 0.20:,.0f}/year (before taxable income cap)",
            next_steps=[
                "Use Form 8995 if below income thresholds",
                "Confirm business is not a Specified Service Trade (SSTB)",
                "Model home office and retirement contribution impact on QBI",
            ])

    def _rule_s_corp_election(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_self_employment():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "S Corp election requires an existing business entity with self-employment income.")
        biz = self.f.first_business()
        entity = biz.get("entity_type", "")
        if entity == "s_corp":
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Business is already taxed as an S Corp.")
        net_profit = _to_float(biz.get("financials", {}).get("net_profit_loss"))
        if net_profit <= 0:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Has business but no net profit recorded. S Corp savings depend on profit level.",
                missing_facts=["businesses.financials.net_profit_loss"])
        if net_profit < 40000:
            return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
                f"Net profit ~${net_profit:,.0f} — S Corp payroll overhead (~$600–1,200/year) may offset savings at this level.",
                changes_needed=[
                    f"Grow net profit above ~$50,000 where S Corp savings clearly exceed costs",
                    "Model: SE tax savings vs. payroll costs at current profit level",
                ])
        se_savings = (net_profit * 0.9235 - min(net_profit * 0.4, 60000)) * 0.153
        return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
            f"S Corp election could save ~${se_savings:,.0f}/year in SE taxes at current profit.",
            estimated_value=f"~${se_savings:,.0f}/year",
            changes_needed=[
                "File Form 2553 before March 15 (or get late election relief)",
                "Set up payroll with reasonable W-2 compensation",
                "Open business bank account and corporate records if not done",
                "Hire a payroll provider (Gusto, ADP, Paychex) — ~$600–1,200/year",
            ],
            next_steps=["Review with CPA — state tax/fee implications vary significantly"])

    def _rule_sep_ira_contribution(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_self_employment():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "SEP-IRA requires self-employment income.")
        biz = self.f.first_business()
        net_profit = _to_float(biz.get("financials", {}).get("net_profit_loss"))
        if net_profit <= 0:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Has self-employment but net profit not provided — needed to calculate SEP contribution limit.",
                missing_facts=["businesses.financials.net_profit_loss"])
        # SEP limit: 20% of net profit after SE tax deduction, max $70,000
        se_deduction = net_profit * 0.9235 * 0.5 * 0.153
        net_earnings = net_profit - se_deduction
        max_contrib = min(net_earnings * 0.25, 70000)
        ret = self.f._data.get("retirement", {}).get("sep_ira", {}) or {}
        established = ret.get("established", False)
        contrib_ytd = _to_float(ret.get("contributions_ytd"))
        remaining = max(0, max_contrib - contrib_ytd)
        if not established:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                f"SEP-IRA not yet established. Can contribute up to ${max_contrib:,.0f} for tax year {self.f.tax_year}.",
                estimated_value=f"Up to ${max_contrib:,.0f} deductible contribution",
                next_steps=[
                    "Open SEP-IRA at Fidelity, Vanguard, or Schwab (takes 15 minutes)",
                    "Can establish and fund up to October 15 (with extension)",
                    f"Max contribution: ${max_contrib:,.0f}",
                ])
        if remaining > 0:
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                f"SEP-IRA established. ${remaining:,.0f} of contribution room remaining (${contrib_ytd:,.0f} contributed of ${max_contrib:,.0f} max).",
                estimated_value=f"Up to ${remaining:,.0f} additional deductible contribution",
                next_steps=[f"Contribute up to ${remaining:,.0f} before October 15"])
        return self._result(base, EligibilityStatus.NOT_APPLICABLE,
            f"SEP-IRA fully funded for the year (${contrib_ytd:,.0f} of ${max_contrib:,.0f} max contributed).")

    def _rule_solo_401k(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_self_employment():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Solo 401(k) requires self-employment with no full-time W-2 employees (other than spouse).")
        biz = self.f.first_business()
        employees = _to_float(biz.get("employees", {}).get("w2_employees_count"))
        if employees > 0:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Solo 401(k) not available when business has W-2 employees (other than owner's spouse).",
                changes_needed=["Consider SIMPLE IRA or Safe Harbor 401(k) for businesses with employees"])
        net_profit = _to_float(biz.get("financials", {}).get("net_profit_loss"))
        age = self.f.taxpayer_age()
        employee_limit = 31000 if (age and age >= 50) else 23500
        max_employer = min(net_profit * 0.9235 * 0.25, 70000 - employee_limit)
        max_total = min(employee_limit + max_employer, 77500 if (age and age >= 50) else 70000)
        ret = self.f._data.get("retirement", {}).get("solo_401k", {}) or {}
        established = ret.get("established", False)
        if not established:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                f"Solo 401(k) not yet established. Must be set up by December 31 to contribute for {self.f.tax_year}.",
                estimated_value=f"Up to ${max_total:,.0f} in combined contributions" if net_profit > 0 else "Depends on net profit",
                next_steps=[
                    "Open Solo 401(k) at Fidelity (free plan, no admin fees)",
                    "MUST be established by December 31 — cannot retroactively create",
                    "Employee deferrals also due by December 31",
                    "Employer profit-sharing contribution can be made up to October 15",
                ])
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
            f"Solo 401(k) established. Max combined contribution: ~${max_total:,.0f}.",
            estimated_value=f"Up to ${max_total:,.0f} tax-deferred",
            next_steps=[
                f"Employee deferral: up to ${employee_limit:,.0f} — must elect by December 31",
                f"Employer contribution: up to ${max_employer:,.0f} — can fund by October 15",
                "Consider Roth Solo 401(k) option for tax-free growth",
            ])

    def _rule_self_employed_health_insurance(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_self_employment():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Self-employed health insurance deduction requires self-employment income.")
        coverage = self.f.healthcare_coverage()
        if coverage == "employer":
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Covered by employer plan — self-employed health insurance deduction not available in months with employer coverage.")
        biz = self.f.first_business()
        premium = _to_float(biz.get("health_insurance", {}).get("premium_amount"))
        claimed = biz.get("health_insurance", {}).get("owner_health_insurance_deducted")
        if premium > 0 and claimed:
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                f"Self-employed health insurance deduction available — ~${premium:,.0f}/year in premiums.",
                estimated_value=f"~${premium:,.0f}/year above-the-line deduction",
                next_steps=["Report on Schedule 1, Line 17", "Verify S Corp W-2 inclusion if applicable"])
        if self.f.has_self_employment():
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Has self-employment — confirm health insurance premium amount and coverage structure.",
                missing_facts=["businesses.health_insurance.premium_amount", "businesses.health_insurance.owner_health_insurance_deducted"],
                next_steps=[
                    "Record monthly premium in businesses.yaml",
                    "Confirm policy is in business name or owner is reimbursed",
                ])
        return self._result(base, EligibilityStatus.NOT_APPLICABLE, "Not eligible.")

    def _rule_hsa_triple_tax_advantage(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        coverage = self.f.healthcare_coverage()
        if coverage in ("medicare", "medicaid"):
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Cannot contribute to HSA while enrolled in Medicare or Medicaid.")
        if self.f.hdhp_enrolled():
            hsa = self.f._data.get("healthcare", {}).get("health_savings_account", {}) or {}
            level = self.f._data.get("healthcare", {}).get("hdhp_coverage_level", "self")
            limit = 8550 if level == "family" else 4300
            age = self.f.taxpayer_age()
            if age and age >= 55:
                limit += 1000
            contrib = _to_float(hsa.get("contributions_ytd"))
            remaining = max(0, limit - contrib)
            balance = _to_float(hsa.get("existing_balance"))
            invest = hsa.get("investment_account_within_hsa", False)
            msg = f"HDHP enrolled — HSA contribution available. ${remaining:,.0f} of ${limit:,.0f} limit remaining."
            tips = [f"Contribute up to ${remaining:,.0f} more (can contribute until April 15, {self.f.tax_year + 1})"]
            if not invest and balance > 1000:
                tips.append(f"Invest HSA balance (${balance:,.0f}) — don't leave it in cash")
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW, msg,
                estimated_value=f"${remaining:,.0f} deductible contribution + tax-free growth",
                next_steps=tips)
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            "Not confirmed on HDHP. Switching to a qualifying HDHP unlocks the HSA triple tax advantage.",
            missing_facts=["healthcare.hdhp_enrolled"],
            changes_needed=[
                "Switch to a High Deductible Health Plan (min deductible $1,650 self / $3,300 family for 2025)",
                "Open HSA account at Fidelity (no fees) after HDHP enrollment",
            ])

    def _rule_section_179_expensing(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_self_employment():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Section 179 requires an active business.")
        biz = self.f.first_business()
        assets = biz.get("depreciation", {}).get("assets_placed_in_service") or []
        if assets:
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                "Business assets placed in service — Section 179 immediate expensing available.",
                next_steps=["Complete Form 4562", "Apply Section 179 before bonus depreciation on same assets"])
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            "Has business — Section 179 available if equipment or vehicles are purchased this year.",
            missing_facts=["businesses.depreciation.assets_placed_in_service"],
            next_steps=[
                "Record any business assets purchased in businesses.yaml",
                "Consider whether needed equipment purchase makes sense before year-end",
            ])

    def _rule_bonus_depreciation(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_self_employment() and not self.f.has_rental_property():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Bonus depreciation requires a business or rental real estate.")
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            "Bonus depreciation available (40% in 2025) on qualifying assets placed in service. Rate drops to 20% in 2026.",
            next_steps=[
                "Identify qualifying asset purchases this year",
                "Apply Section 179 first, bonus on remainder",
                "Consider cost segregation study on real estate for QIP reclassification",
            ])

    def _rule_business_vehicle_deduction(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_self_employment():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Business vehicle deduction requires self-employment.")
        biz = self.f.first_business()
        vehicle = biz.get("vehicle") or {}
        has_vehicle = vehicle.get("business_vehicle")
        biz_miles = _to_float(vehicle.get("business_miles"))
        if has_vehicle and biz_miles > 0:
            std_deduction = biz_miles * 0.67
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                f"Business vehicle: {biz_miles:,.0f} miles × $0.67 = ~${std_deduction:,.0f} (standard mileage).",
                estimated_value=f"~${std_deduction:,.0f}+ per year",
                next_steps=[
                    "Ensure contemporaneous mileage log exists (date, destination, purpose)",
                    "Compare standard mileage vs. actual expense method",
                    "If vehicle GVWR > 6,000 lbs: evaluate Section 179 deduction",
                ])
        if has_vehicle and biz_miles == 0:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Business vehicle confirmed but no mileage recorded.",
                missing_facts=["businesses.vehicle.business_miles"],
                next_steps=["Record business miles driven in businesses.yaml", "Start mileage log going forward"])
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            "Has self-employment — confirm whether a vehicle is used for business.",
            missing_facts=["businesses.vehicle.business_vehicle", "businesses.vehicle.business_miles"])

    # ── Real Estate Benefits ──────────────────────────────────────────────

    def _rule_real_estate_depreciation(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_rental_property():
            if self.f.has_any_real_estate():
                return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                    "Real estate held but not classified as rental — depreciation applies only to rental/business property.")
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "No rental real estate found. Depreciation applies to rental or business property.")
        prop = self.f.first_property()
        purchase_price = _to_float(prop.get("acquisition", {}).get("purchase_price"))
        if purchase_price == 0:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Has rental property but purchase price not recorded — needed to calculate depreciation basis.",
                missing_facts=["real_estate.acquisition.purchase_price"])
        annual_depreciation = purchase_price * 0.75 / 27.5
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
            f"Rental property depreciation available — estimated ~${annual_depreciation:,.0f}/year (27.5-year residential).",
            estimated_value=f"~${annual_depreciation:,.0f}/year non-cash deduction",
            next_steps=[
                "Verify depreciation has been tracked since purchase date",
                "Allocate purchase price: ~75-80% to building (depreciable), 20-25% to land (not depreciable)",
                "Consider cost segregation study to accelerate depreciation",
                "File Form 3115 if depreciation was not taken in prior years (catch-up without amending)",
            ])

    def _rule_passive_activity_loss(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_rental_property():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Passive activity loss rules apply to rental real estate only.")
        agi = self.f.estimated_agi()
        if agi is None:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Has rental property but AGI not provided — needed to determine passive loss allowance.",
                missing_facts=["household.estimated_agi"])
        if agi <= 100000:
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                f"AGI ${agi:,.0f} qualifies for full $25,000 rental loss allowance against ordinary income.",
                estimated_value="Up to $25,000 rental loss against ordinary income",
                next_steps=["Track all rental expenses to maximize allowable loss", "Report on Schedule E and Form 8582"])
        if agi < 150000:
            allowance = 25000 - (agi - 100000) * 0.5
            note = phaseout_range(agi, 100000, 150000)
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                f"Partial rental loss allowance available — ~${allowance:,.0f} of the $25,000 limit (AGI ${agi:,.0f}).",
                estimated_value=f"~${allowance:,.0f} rental loss against ordinary income",
                phaseout_note=note,
                next_steps=["Consider whether Real Estate Professional status applies"])
        return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
            f"AGI ${agi:,.0f} — $25,000 rental loss allowance fully phased out. Losses carry forward.",
            changes_needed=[
                "Qualify as Real Estate Professional (750+ hours) to deduct losses without limit",
                "Use short-term rentals (avg stay < 7 days) with material participation as alternative",
                "Carry forward losses to offset future rental income or sale gains",
            ])

    def _rule_1031_exchange(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_rental_property():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "1031 exchange applies to investment or business real property only (not primary residence).")
        prop = self.f.first_property()
        purchase = _to_float(prop.get("acquisition", {}).get("purchase_price"))
        current = _to_float(prop.get("acquisition", {}).get("current_market_value"))
        if purchase == 0 or current == 0:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Has rental property — confirm current value to assess potential gain for 1031 planning.",
                missing_facts=["real_estate.acquisition.purchase_price", "real_estate.acquisition.current_market_value"])
        gain = current - purchase
        if gain <= 0:
            return self._result(base, EligibilityStatus.FUTURE_OPPORTUNITY,
                f"No unrealized gain at current values. 1031 becomes relevant when you sell at a gain.",
                next_steps=["Revisit when property has appreciated or before any planned sale"])
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
            f"Estimated gain of ~${gain:,.0f} on rental property — 1031 exchange would defer this tax on sale.",
            estimated_value=f"Deferred tax on ~${gain:,.0f} gain + depreciation recapture",
            next_steps=[
                "Engage a Qualified Intermediary (QI) BEFORE listing the property for sale",
                "Do NOT receive any proceeds — all funds must go directly to QI",
                "Identify replacement property within 45 days of closing",
                "Close replacement property within 180 days",
            ])

    def _rule_augusta_rule(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_self_employment():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Augusta Rule requires a separate business entity to rent from the homeowner.")
        props = self.f._data.get("real_estate", {}).get("properties", []) or []
        has_home = any(p.get("property_type") in ("primary_residence", "second_home") for p in props)
        if not has_home:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Has business but no primary residence or second home recorded.",
                missing_facts=["real_estate.properties (primary_residence)"])
        return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
            "Augusta Rule available — rent your home to your business for up to 14 days/year tax-free.",
            estimated_value="$5,000 – $25,000/year (14 days × fair market daily rate)",
            changes_needed=[
                "Schedule legitimate business meeting(s) or events at your home",
                "Create a written rental agreement between yourself and your business",
                "Invoice your business at fair market rental rate (document comparable rates)",
                "Ensure payment is actually made from business account to your personal account",
                "Document the meeting agenda and attendees",
                "Keep total rental days at 14 or fewer — the 15th day eliminates the exclusion",
            ])

    def _rule_real_estate_professional_status(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_rental_property():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Real Estate Professional status requires rental real estate.")
        agi = self.f.estimated_agi()
        if agi and agi <= 150000:
            return self._result(base, EligibilityStatus.FUTURE_OPPORTUNITY,
                f"AGI ${agi:,.0f} still within $25,000 rental loss allowance range — REP status becomes more critical above $150,000.",
                next_steps=["Revisit if AGI grows above $150,000"])
        return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
            "Real Estate Professional status would unlock unlimited rental loss deductions against ordinary income.",
            estimated_value="Depends on suspended losses — potentially $10,000–$200,000+ unlocked",
            changes_needed=[
                "Spend more than 750 hours per year in real property activities",
                "Ensure real estate hours exceed hours in any other profession",
                "Maintain detailed hourly activity logs throughout the year",
                "File material participation statement or aggregation election",
            ])

    def _rule_cost_segregation(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_rental_property():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Cost segregation applies to owned commercial or residential rental property.")
        prop = self.f.first_property()
        price = _to_float(prop.get("acquisition", {}).get("purchase_price"))
        if price == 0:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Has rental property but purchase price not provided — needed to assess cost segregation ROI.",
                missing_facts=["real_estate.acquisition.purchase_price"])
        if price < 500000:
            return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
                f"Property value ~${price:,.0f} — cost segregation study may not be cost-effective below $500,000.",
                changes_needed=["Acquire higher-value properties where study ROI is clear (typically $1M+)"])
        accelerated = price * 0.25 * 0.40
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
            f"Cost segregation study on ${price:,.0f} property could generate ~${accelerated:,.0f} in accelerated first-year deductions (at 40% bonus rate).",
            estimated_value=f"~${accelerated:,.0f} accelerated deduction (2025 bonus rate)",
            next_steps=[
                "Commission a cost segregation study from a qualified engineering firm",
                "Expect study cost of $5,000–$20,000; typical ROI is 5–10×",
                "If property acquired in prior years: lookback study + Form 3115 (no amended returns needed)",
                "Act in 2025 or 2026 — bonus depreciation drops to 20% in 2026, 0% in 2027",
            ])

    # ── Individual / Personal Benefits ───────────────────────────────────

    def _rule_charitable_contribution_deduction(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        itemizing = self.f.itemizing()
        if itemizing is False:
            return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
                "Not currently itemizing — charitable deduction only applies when itemizing.",
                changes_needed=[
                    "Calculate total itemized deductions (mortgage interest + SALT + charitable)",
                    "If total exceeds standard deduction ($30,000 MFJ / $15,000 Single), itemize",
                    "Consider bunching 2-3 years of giving via a Donor-Advised Fund",
                ])
        if itemizing is None:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Itemization status not confirmed — charitable deduction valuable if itemizing.",
                missing_facts=["household.itemizing_deductions"],
                next_steps=["Compare total itemized deductions to standard deduction amount"])
        inv = self.f._data.get("investments", {}).get("taxable_accounts", []) or []
        has_appreciated_stock = any(_to_float(a.get("unrealized_gains")) > 0 for a in inv)
        msg = "Charitable contribution deduction available (itemizing confirmed)."
        tips = ["Document all contributions — written acknowledgment required for gifts over $250"]
        if has_appreciated_stock:
            tips.insert(0, "Donate appreciated stock directly instead of cash — avoid capital gains AND get full FMV deduction")
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW, msg, next_steps=tips)

    def _rule_mortgage_interest_deduction(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        prop = self.f.first_property()
        interest = _to_float(prop.get("financing", {}).get("mortgage_interest_paid"))
        if interest == 0 and not self.f.has_any_real_estate():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "No real estate or mortgage interest recorded.")
        itemizing = self.f.itemizing()
        if itemizing is False:
            return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
                "Has mortgage interest but not itemizing — deduction only applies when itemizing.",
                changes_needed=["Calculate if total itemized deductions exceed standard deduction"])
        if interest > 0:
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                f"Mortgage interest ~${interest:,.0f} deductible if itemizing.",
                estimated_value=f"~${interest:,.0f}/year deduction",
                next_steps=["Collect Form 1098 from lender", "Report on Schedule A"])
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            "Has real estate but mortgage interest amount not recorded.",
            missing_facts=["real_estate.financing.mortgage_interest_paid"])

    def _rule_salt_deduction(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        itemizing = self.f.itemizing()
        if itemizing is False:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Not itemizing — SALT deduction only applies when itemizing.")
        if itemizing is None:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Itemization status not confirmed — SALT deduction (up to $10,000) available if itemizing.",
                missing_facts=["household.itemizing_deductions"])
        prop = self.f.first_property()
        ptax = _to_float(prop.get("financing", {}).get("property_tax_paid"))
        state = (self.f._data.get("household", {}).get("residence") or {}).get("state")
        msg = "SALT deduction available (capped at $10,000). "
        if ptax > 0:
            msg += f"Property tax: ${ptax:,.0f}/year."
        if self.f.has_self_employment():
            msg += " Evaluate state PTE tax election to bypass the SALT cap on pass-through income."
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW, msg,
            estimated_value="Up to $10,000/year",
            next_steps=["Report state income tax + property tax on Schedule A (combined cap $10,000)",
                        "If self-employed in high-tax state: ask CPA about Pass-Through Entity (PTE) tax election"])

    def _rule_backdoor_roth_ira(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        agi = self.f.estimated_agi()
        fs = self.f.filing_status() or "single"
        roth_limits = {"mfj": 236000, "married_filing_jointly": 236000,
                       "single": 150000, "hoh": 150000, "head_of_household": 150000}
        limit = roth_limits.get(fs.lower(), 150000)
        if agi is None:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "AGI not recorded — needed to determine Roth IRA eligibility and whether backdoor strategy applies.",
                missing_facts=["household.estimated_agi"])
        if agi <= limit:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"AGI ${agi:,.0f} is below Roth IRA income limit — contribute directly to Roth IRA (no backdoor needed).")
        trad = self.f._data.get("retirement", {}).get("traditional_ira", {}) or {}
        balance = _to_float(trad.get("accounts", [{}])[0].get("balance") if trad.get("accounts") else 0)
        if balance > 0:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                f"Backdoor Roth available but pro-rata rule applies — traditional IRA balance of ~${balance:,.0f} makes conversion partially taxable.",
                changes_needed=[
                    "Roll pre-tax traditional IRA balance into employer 401(k) to clear the pro-rata issue",
                    "Then execute backdoor Roth on clean slate",
                ],
                next_steps=["Confirm employer 401(k) plan accepts incoming rollovers"])
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
            f"Income above Roth limit — backdoor Roth IRA strategy available. Contribute $7,000 (2025) as nondeductible traditional IRA, then convert.",
            estimated_value="$7,000/year ($8,000 if 50+) into Roth — tax-free growth forever",
            next_steps=[
                "Make nondeductible traditional IRA contribution ($7,000 or $8,000 if 50+)",
                "Convert to Roth IRA immediately (Roth conversion has no income limit)",
                "File Form 8606 tracking nondeductible basis — file every year",
                "Confirm no existing pre-tax IRA balance (pro-rata rule)",
            ])

    def _rule_child_tax_credit(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_dependents():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "No dependents recorded. Child Tax Credit requires qualifying children under age 17.")
        agi = self.f.estimated_agi()
        fs = self.f.filing_status() or "single"
        cliff = 400000 if fs.lower() in ("mfj", "married_filing_jointly") else 200000
        qualifying = [d for d in self.f.dependents()
                      if (d.get("age_at_year_end") or 99) < 17 and d.get("ssn_obtained")]
        qualifying_no_ssn = [d for d in self.f.dependents()
                             if (d.get("age_at_year_end") or 99) < 17 and not d.get("ssn_obtained")]
        if not qualifying and not qualifying_no_ssn:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "No qualifying children under 17 found.")
        phaseout_note = ""
        if agi:
            if agi > cliff:
                excess = agi - cliff
                reduction = (excess // 1000 + 1) * 50
                credit = max(0, len(qualifying) * 2000 - reduction)
                if credit == 0:
                    return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                        f"AGI ${agi:,.0f} — Child Tax Credit fully phased out.")
                phaseout_note = f"Partial credit: ~${credit:,.0f} remaining after phaseout."
        if qualifying_no_ssn:
            credit_val = len(qualifying) * 2000
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                f"{len(qualifying_no_ssn)} child(ren) missing SSN — credit requires SSN by return due date.",
                estimated_value=f"~${credit_val:,.0f}/year if all SSNs obtained",
                next_steps=["Apply for SSN at Social Security Administration immediately"])
        credit_val = len(qualifying) * 2000
        msg = f"Child Tax Credit: {len(qualifying)} qualifying child(ren) × $2,000 = ~${credit_val:,.0f}."
        if phaseout_note:
            msg += f" {phaseout_note}"
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW, msg,
            estimated_value=f"~${credit_val:,.0f}/year",
            next_steps=["Report on Schedule 8812", "Up to $1,700 per child is refundable (ACTC)"])

    def _rule_child_dependent_care_credit(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        young = [d for d in self.f.dependents() if (d.get("age_at_year_end") or 99) < 13]
        if not young:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Child and Dependent Care Credit requires children under age 13.")
        care_expenses = sum(_to_float(d.get("care_expenses", {}).get("daycare_cost"))
                            + _to_float(d.get("care_expenses", {}).get("after_school_care_cost"))
                            + _to_float(d.get("care_expenses", {}).get("summer_camp_cost"))
                            for d in young)
        fsa = self.f._data.get("healthcare", {}).get("flexible_spending_accounts", {}).get("dependent_care_fsa", {}) or {}
        fsa_amount = _to_float(fsa.get("election_amount"))
        expense_base = min(max(0, (6000 if len(young) >= 2 else 3000) - fsa_amount), care_expenses or (3000 if len(young) == 1 else 6000))
        credit = expense_base * 0.20
        if care_expenses == 0:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                f"Has {len(young)} child(ren) under 13 — record care expenses to calculate CDCC.",
                missing_facts=["dependents.care_expenses"],
                next_steps=["Record daycare, after-school, and summer camp costs in dependents.yaml"])
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
            f"Child and Dependent Care Credit: ~${credit:,.0f} (20% of ${expense_base:,.0f} qualifying expenses).",
            estimated_value=f"~${credit:,.0f}/year",
            next_steps=[
                "Report on Form 2441",
                "Collect care provider TIN (EIN or SSN)",
                f"Note: Dependent Care FSA (${fsa_amount:,.0f}) reduces CDCC expense base",
            ])

    def _rule_earned_income_tax_credit(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        agi = self.f.estimated_agi()
        fs = self.f.filing_status() or "single"
        deps = len(self.f.dependents())
        # EITC upper phaseout limits (2025 approximate)
        upper = {
            ("single", 0): 19524, ("mfj", 0): 26214,
            ("single", 1): 46560, ("mfj", 1): 53502,
            ("single", 2): 52952, ("mfj", 2): 59898,
            ("single", 3): 59899, ("mfj", 3): 66819,
        }
        fs_key = "mfj" if fs.lower() in ("mfj", "married_filing_jointly") else "single"
        dep_key = min(deps, 3)
        agi_limit = upper.get((fs_key, dep_key), 19524)
        invest = self.f.total_investment_income()
        if invest > 11950:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"Investment income ${invest:,.0f} exceeds $11,950 limit — EITC disqualified.")
        if agi and agi > agi_limit:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"AGI ${agi:,.0f} above EITC limit of ${agi_limit:,.0f} for {fs} with {deps} dependent(s).")
        if not self.f.has_self_employment() and not self.f.has_w2_income():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "No earned income found. EITC requires wages or self-employment income.")
        max_credits = {(0,): 649, (1,): 4328, (2,): 7152, (3,): 8046}
        credit = max_credits.get((dep_key,), 8046)
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
            f"EITC potentially available — up to ${credit:,.0f} with {dep_key} qualifying child(ren).",
            estimated_value=f"Up to ${credit:,.0f}/year (fully refundable)",
            next_steps=["Confirm qualifying child details on Schedule EIC", "Verify all children have SSNs"])

    def _rule_american_opportunity_credit(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        college_deps = [d for d in self.f.dependents()
                        if d.get("education", {}).get("school_level") == "undergraduate"
                        and d.get("education", {}).get("tuition_paid")]
        if not college_deps and not self.f.has_dependents():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "No dependents in undergraduate education with tuition recorded.")
        if not college_deps:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Has dependents — confirm if any are enrolled in first 4 years of college.",
                missing_facts=["dependents.education.school_level", "dependents.education.tuition_paid"])
        agi = self.f.estimated_agi()
        fs = self.f.filing_status() or "single"
        lo, hi = (160000, 180000) if fs.lower() in ("mfj", "married_filing_jointly") else (80000, 90000)
        phaseout_note = phaseout_range(agi, lo, hi) if agi else ""
        if agi and agi > hi:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"AGI ${agi:,.0f} above AOTC limit of ${hi:,.0f} — credit fully phased out.")
        credit = min(len(college_deps) * 2500, 2500)
        msg = f"American Opportunity Credit: up to ${credit:,.0f} for college tuition expenses."
        if phaseout_note:
            msg += f" Note: {phaseout_note}"
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW, msg,
            estimated_value=f"Up to ${credit:,.0f}/year ($1,000 refundable)",
            next_steps=["Collect Form 1098-T from school", "Coordinate with 529 distributions (cannot double-count)"])

    def _rule_lifetime_learning_credit(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_dependents():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "No dependents with education expenses recorded.")
        agi = self.f.estimated_agi()
        fs = self.f.filing_status() or "single"
        lo, hi = (160000, 180000) if fs.lower() in ("mfj", "married_filing_jointly") else (80000, 90000)
        if agi and agi > hi:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"AGI ${agi:,.0f} above Lifetime Learning Credit limit.")
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            "Lifetime Learning Credit available for any post-secondary education (grad school, professional courses).",
            missing_facts=["dependents.education.tuition_paid"],
            next_steps=["Record tuition expenses in dependents.yaml", "Collect Form 1098-T"])

    def _rule_residential_clean_energy_credit(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        props = self.f._data.get("real_estate", {}).get("properties", []) or []
        has_home = any(p.get("property_type") in ("primary_residence", "second_home") for p in props)
        if not has_home:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Residential Clean Energy Credit requires a home you own (primary or secondary).")
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            "Homeowner qualifies for 30% credit on solar panels, battery storage, wind, or geothermal installed at your home.",
            next_steps=[
                "Get solar quotes from 3+ installers — 30% credit applies through 2032",
                "Battery storage (3 kWh+) qualifies even without solar",
                "Check state and utility rebates that stack on top of federal credit",
            ])

    def _rule_clean_vehicle_credit(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        agi = self.f.estimated_agi()
        fs = self.f.filing_status() or "single"
        clips = {"mfj": 300000, "married_filing_jointly": 300000,
                 "single": 150000, "hoh": 225000, "head_of_household": 225000}
        clip = clips.get(fs.lower(), 150000)
        if agi and agi > clip:
            note = phaseout_cliff(agi, clip)
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"AGI ${agi:,.0f} exceeds income limit of ${clip:,.0f} for Clean Vehicle Credit.")
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            f"Income qualifies for EV credit (up to $7,500 new / $4,000 used). Check vehicle eligibility at fueleconomy.gov.",
            next_steps=[
                "Verify vehicle VIN qualifies at fueleconomy.gov before purchasing",
                "Use point-of-sale transfer option to receive credit as immediate discount at dealer",
                "Check MSRP limits: SUV/truck/van ≤ $80,000; sedan ≤ $55,000",
            ])

    def _rule_section_121_exclusion(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        props = self.f._data.get("real_estate", {}).get("properties", []) or []
        primary = next((p for p in props if p.get("property_type") == "primary_residence"), None)
        if not primary:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "No primary residence found. Section 121 exclusion applies to sale of primary residence only.")
        years = primary.get("primary_residence", {}).get("years_lived_in")
        price = _to_float(primary.get("acquisition", {}).get("purchase_price"))
        current = _to_float(primary.get("acquisition", {}).get("current_market_value"))
        if years and years < 2:
            return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
                f"Only {years} year(s) in home — need 2 of last 5 years as primary residence for exclusion.",
                changes_needed=[f"Wait until {2 - years} more year(s) before selling to qualify"])
        gain = max(0, current - price) if current > 0 and price > 0 else None
        fs = self.f.filing_status() or "single"
        exclusion = 500000 if fs.lower() in ("mfj", "married_filing_jointly") else 250000
        msg = f"Section 121 exclusion available — up to ${exclusion:,.0f} gain excluded on home sale."
        if gain and gain > exclusion:
            msg += f" Estimated gain ~${gain:,.0f} exceeds exclusion — ${gain - exclusion:,.0f} would be taxable."
        elif gain:
            msg += f" Estimated gain ~${gain:,.0f} is fully within exclusion."
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW, msg,
            estimated_value=f"Up to ${exclusion:,.0f} gain excluded",
            next_steps=["Track all capital improvements to increase basis", "Document rental period (if any) — depreciation recapture applies"])

    def _rule_foreign_earned_income_exclusion(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        state = (self.f._data.get("household", {}).get("residence") or {}).get("state")
        if state:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "US state residence recorded — FEIE applies to taxpayers living and working abroad.")
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            "No US state recorded — may qualify for Foreign Earned Income Exclusion ($130,000 for 2025) if living abroad.",
            missing_facts=["household.residence.state or foreign country confirmation"])

    def _rule_opportunity_zone_investment(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        ltcg = self.f.long_term_capital_gains()
        if ltcg > 0:
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                f"Capital gains of ~${ltcg:,.0f} recorded — Opportunity Zone investment would defer this tax.",
                estimated_value=f"Deferred tax on ${ltcg:,.0f} + potential 10-year exclusion on QOF appreciation",
                next_steps=[
                    "Identify and invest in a Qualified Opportunity Fund (QOF) within 180 days of gain recognition",
                    "Note: deferred gain recognized December 31, 2026 — plan for that tax event",
                    "10+ year hold permanently excludes QOF appreciation from income",
                ])
        return self._result(base, EligibilityStatus.FUTURE_OPPORTUNITY,
            "No realized capital gains recorded. Opportunity Zone deferral becomes relevant when selling appreciated assets.",
            next_steps=["Revisit before any planned sale of stocks, real estate, or business assets"])

    def _rule_annual_gift_tax_exclusion(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        goal = self.f.transfer_wealth_goal()
        if goal is False:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Wealth transfer is not a stated goal. Update goals.yaml if estate planning becomes a priority.")
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW if goal else EligibilityStatus.NEARLY_ELIGIBLE,
            "Annual gift tax exclusion: $19,000 per recipient per year (2025) — $38,000 per recipient for married couples.",
            estimated_value="$19,000–$38,000 per recipient per year removed from taxable estate",
            next_steps=[
                "Identify recipients: children, grandchildren, siblings, etc.",
                "Make gifts by December 31",
                "Direct tuition/medical payments to institutions are additionally excluded (no dollar limit)",
                "Consider 529 superfunding: 5 years of exclusion at once ($95,000 single / $190,000 MFJ per beneficiary)",
            ])

    # ── Phase 7: Missing Federal Benefits ─────────────────────────────────

    def _rule_25c_energy_home_improvement(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        primary = self.f.primary_residence()
        if not primary and not self.f.has_any_real_estate():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "§25C requires improvements to an existing primary residence. No primary residence recorded.")
        if not primary:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Real estate found but no primary residence classified — §25C applies to primary residences.",
                missing_facts=["real_estate.properties (property_type: primary_residence)"])
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
            "§25C Energy Efficient Home Improvement Credit: 30% credit on eligible improvements. "
            "Heat pump: up to $2,000/year; insulation, windows, doors, energy audit: up to $1,200/year ($3,200 combined cap).",
            estimated_value="$600 – $3,200/year",
            next_steps=[
                "Get ENERGY STAR or §25C certification from manufacturer before purchase",
                "Heat pump HVAC or water heater = up to $2,000 30% credit",
                "Insulation, exterior doors, windows = up to $1,200 30% credit",
                "Home energy audit = up to $150 toward $1,200 cap",
                "Spread improvements across multiple years to use the $3,200 annual cap each year",
            ])

    def _rule_savers_credit(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        agi = self.f.estimated_agi()
        fs = (self.f.filing_status() or "single").lower()
        age = self.f.taxpayer_age()

        if age is not None and age < 18:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Saver's Credit requires taxpayer to be at least 18 years old.")

        # 2025 AGI phaseout ceilings (estimated)
        ceilings = {
            "single": 40_500,
            "mfj": 81_000, "married_filing_jointly": 81_000,
            "hoh": 60_750, "head_of_household": 60_750,
            "mfs": 40_500, "married_filing_separately": 40_500,
            "qualifying_surviving_spouse": 81_000,
        }
        # 50% credit thresholds
        fifty_pct = {
            "single": 23_500, "mfj": 47_000, "married_filing_jointly": 47_000,
            "hoh": 35_250, "head_of_household": 35_250,
            "mfs": 23_500, "married_filing_separately": 23_500,
            "qualifying_surviving_spouse": 47_000,
        }
        ceiling = ceilings.get(fs, 40_500)
        fifty = fifty_pct.get(fs, 23_500)

        if agi is not None and agi > ceiling:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"AGI ${agi:,.0f} exceeds the Saver's Credit limit for {fs} filers (${ceiling:,}). "
                "No credit available above this income level.")

        has_contributions = self.f.has_retirement_contributions()
        if agi is not None and agi <= ceiling:
            rate = "50%" if agi <= fifty else ("20%" if agi <= ceiling * 0.63 else "10%")
            if has_contributions:
                return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                    f"Saver's Credit available — AGI ${agi:,.0f} qualifies for the {rate} credit rate. "
                    "File Form 8880 to claim credit on up to $2,000 of retirement contributions ($4,000 MFJ).",
                    estimated_value=f"Up to ${2000 if 'mfj' not in fs else 4000:,} × {rate} credit",
                    next_steps=[
                        "File Form 8880 with your return",
                        "Ensure contributions were to IRA, 401k, 403b, 457b, SIMPLE IRA, or SEP-IRA",
                        "Prior-year distributions from retirement accounts reduce eligible contributions — check Form 8880 worksheet",
                    ])
            return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
                f"AGI ${agi:,.0f} qualifies for the Saver's Credit at {rate} rate, but no retirement contributions recorded.",
                changes_needed=["Make an IRA or 401k contribution this year (or by April 15 for IRA)"],
                missing_facts=["retirement contributions (retirement.yaml)"],
                next_steps=[
                    "Contribute to a Roth or Traditional IRA (up to $7,000 in 2025) by April 15",
                    "Even $400 → $200 credit at 50% rate",
                ])

        if agi is None:
            if has_contributions:
                return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                    "Has retirement contributions but AGI not provided — Saver's Credit may be available for moderate-income taxpayers.",
                    missing_facts=["household.estimated_agi"])
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Saver's Credit available for moderate-income taxpayers with retirement contributions. Enter AGI to evaluate.",
                missing_facts=["household.estimated_agi", "retirement contributions"])
        return self._result(base, EligibilityStatus.NOT_APPLICABLE,
            f"AGI ${agi:,.0f} exceeds Saver's Credit income limits.")

    def _rule_capital_gains_harvesting(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        agi = self.f.estimated_agi()
        fs = (self.f.filing_status() or "single").lower()
        ltcg = self.f.long_term_capital_gains()

        # 2025 0% LTCG bracket ceilings (taxable income = AGI - deductions)
        # We use AGI as a proxy; actual thresholds are vs. taxable income
        zero_pct_ceiling = {
            "single": 47_025,
            "mfj": 94_050, "married_filing_jointly": 94_050,
            "hoh": 63_000, "head_of_household": 63_000,
            "mfs": 47_025, "married_filing_separately": 47_025,
            "qualifying_surviving_spouse": 94_050,
        }.get(fs, 47_025)

        if agi is None:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Capital gains 0% bracket harvesting opportunity — enter AGI to evaluate if you fall within the 0% rate bracket.",
                missing_facts=["household.estimated_agi"])

        if agi >= zero_pct_ceiling * 1.15:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"AGI ${agi:,.0f} is above the 0% LTCG bracket ceiling (${zero_pct_ceiling:,} for {fs}). "
                "Gains will be taxed at 15% or 20%.")

        headroom = max(0, zero_pct_ceiling - agi)
        if ltcg > 0:
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                f"0% long-term capital gains rate applies. You have ~${headroom:,.0f} of 0% gain headroom "
                f"(AGI ${agi:,.0f} vs. ${zero_pct_ceiling:,} ceiling). "
                f"Current LTCG recorded: ${ltcg:,.0f}.",
                estimated_value=f"Permanent elimination of federal tax on up to ${min(ltcg, headroom):,.0f} of gains",
                next_steps=[
                    f"Sell appreciated positions held 12+ months to realize up to ${headroom:,.0f} in gains this year",
                    "Immediately repurchase same shares — no wash sale rule for gains (only for losses)",
                    "New cost basis eliminates deferred gain permanently",
                    "Model with tax software to stay under the ceiling — one dollar over shifts the entire gain to 15%",
                ])
        return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
            f"You are in the 0% LTCG bracket (AGI ${agi:,.0f}, ${headroom:,.0f} headroom). "
            "No long-term capital gains recorded — if you hold appreciated assets, this is a harvesting opportunity.",
            changes_needed=["Identify taxable brokerage holdings with unrealized long-term gains"],
            missing_facts=["income.investment_income.long_term_capital_gains or investments.taxable_accounts"],
            next_steps=[
                "Check brokerage for appreciated positions held 12+ months",
                f"You can realize up to ${headroom:,.0f} in gains tax-free this year",
            ])

    def _rule_premium_tax_credit(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        coverage = self.f.healthcare_coverage()
        if coverage and coverage.lower() not in ("marketplace", "aca", "exchange", "healthcare.gov"):
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"Premium Tax Credit requires ACA Marketplace insurance. Coverage type '{coverage}' does not qualify.")

        agi = self.f.estimated_agi()
        hh_size = self.f.household_size()
        # 2025 FPL base amounts (48 contiguous states + DC)
        fpl_base = 15_060 + (hh_size - 1) * 5_380
        fpl_400 = fpl_base * 4

        if not coverage:
            if not self.f.has_self_employment():
                return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                    "Premium Tax Credit applies to ACA Marketplace insurance. No coverage type recorded. "
                    "If you have employer-sponsored insurance, you likely don't qualify.")
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Self-employed without employer insurance — ACA Marketplace may provide a large Premium Tax Credit. "
                "Update healthcare.coverage_type if you purchase Marketplace insurance.",
                missing_facts=["healthcare.coverage_type"])

        if agi is None:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "ACA Marketplace coverage found — enter AGI to calculate Premium Tax Credit amount.",
                missing_facts=["household.estimated_agi"])

        if agi < fpl_base * 0.99:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"AGI ${agi:,.0f} appears to be below 100% FPL (${fpl_base:,} for household of {hh_size}). "
                "Medicaid eligibility likely — PTC requires income at or above 100% FPL.")

        if agi <= fpl_base * 1.5:
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                f"ACA Premium Tax Credit available — at {agi/fpl_base*100:.0f}% FPL, your benchmark plan premium "
                f"is $0 or near $0. Household size {hh_size} (FPL: ${fpl_base:,}).",
                estimated_value="$0 premium for benchmark Silver plan (below 150% FPL)",
                next_steps=["File Form 8962 to reconcile advance credit payments with actual credit",
                            "Ensure Form 1095-A from the exchange is received before filing"])
        cap_pct = min(8.5, (agi / fpl_base - 1.5) / (4 - 1.5) * 8.5) if agi < fpl_400 else 8.5
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
            f"ACA Premium Tax Credit available. At AGI ${agi:,.0f} ({agi/fpl_base*100:.0f}% FPL), "
            f"your premium is capped at ~{cap_pct:.1f}% of income (~${agi * cap_pct / 100:,.0f}/year).",
            estimated_value=f"Credit = benchmark plan premium minus ${agi * cap_pct / 100:,.0f}/year required contribution",
            next_steps=[
                "Receive Form 1095-A from healthcare.gov or your state exchange",
                "File Form 8962 to compute and reconcile the credit",
                "Manage MAGI carefully — income spikes trigger repayment of advance credits",
            ])

    def _rule_qsbs_exclusion(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        has_startup = self.f.has_startup_equity()
        if not has_startup:
            if not self.f.has_any_business():
                return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                    "§1202 QSBS exclusion applies to original-issue C corporation stock from qualified small businesses. "
                    "No startup equity or business activity recorded.")
            return self._result(base, EligibilityStatus.FUTURE_OPPORTUNITY,
                "If you invest in or found a qualifying C corporation startup, §1202 may exclude 100% of gains up to $10M+. "
                "Set investments.has_qualified_small_business_stock: true if applicable.",
                next_steps=[
                    "For startup founders: early exercise of options + §83(b) election starts the 5-year holding period",
                    "Ensure company is a C corp (not LLC or S corp) with assets ≤ $50M at time of investment",
                    "Document original issuance (not secondary purchase) to preserve §1202 eligibility",
                ])
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
            "QSBS (§1202) stock identified. If held 5+ years and all requirements met, up to 100% of gains "
            "may be excluded (greater of $10M or 10× basis per issuer per taxpayer).",
            estimated_value="100% federal capital gains exclusion on qualifying gains (no upper limit with 10× basis rule)",
            next_steps=[
                "Confirm: (1) original issuance from the corporation, (2) C corp status, (3) assets ≤ $50M at issuance, "
                "(4) active qualified business (not professional services, finance, hospitality)",
                "Track exact acquisition date — 5-year holding period must be met before sale",
                "Consider gifting shares to family members to multiply the per-taxpayer exclusion",
                "Note: CA and some states do not conform to §1202 — state tax may apply",
            ],
            review_required=True)

    def _rule_nol_carryforward(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_any_business() and not self.f.has_rental_property():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "NOL carryforward applies to business or investment losses. No business or rental activity recorded.")
        biz = self.f.first_business()
        net = _to_float(biz.get("financials", {}).get("net_profit_loss")) if biz else 0
        if net < 0:
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                f"Business net loss of ${abs(net):,.0f} recorded. This may create an NOL that carries forward indefinitely "
                "to offset up to 80% of taxable income in future profitable years.",
                estimated_value=f"${abs(net):,.0f} × future marginal rate (up to 80% of taxable income/year)",
                next_steps=[
                    "Compute the NOL using Publication 536 worksheet (deductions exceed income?)",
                    "Document the NOL on your return and track the carryforward balance each year",
                    "The NOL carries forward indefinitely — use it in high-income future years",
                    "Consult CPA: at-risk rules and passive activity rules may limit the NOL before it reaches the return",
                ])
        if net == 0:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Has business but net profit/loss not recorded — if business had a net loss, an NOL may exist.",
                missing_facts=["businesses.financials.net_profit_loss"])
        return self._result(base, EligibilityStatus.FUTURE_OPPORTUNITY,
            f"Business is profitable (net ${net:,.0f}). NOL carryforward becomes relevant in any future loss year. "
            "Track cumulative NOL balance if prior years had losses.",
            next_steps=["Review prior returns — any year with net loss may have created an unused NOL carryforward"])

    def _rule_529_to_roth_rollover(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        has_529 = self.f.has_529_account()
        if not has_529:
            return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
                "SECURE 2.0 §126: unused 529 funds can roll to the beneficiary's Roth IRA tax-free. "
                "No 529 account recorded. Open one now to start the 15-year account age requirement.",
                changes_needed=["Open a 529 account — the account must be at least 15 years old before rolling"],
                next_steps=[
                    "Open a 529 plan today — even a small balance starts the 15-year clock",
                    "Contributions made within the last 5 years cannot be rolled over",
                    "Lifetime limit: $35,000 per beneficiary; annual Roth IRA limit applies",
                ])
        plans = self.f._data.get("investments", {}).get("529_plans", []) or []
        balances = [_to_float(p.get("balance")) for p in plans if isinstance(p, dict)]
        total_balance = sum(balances)
        if total_balance > 0:
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                f"529 account present (total balance ~${total_balance:,.0f}). If the account is 15+ years old, "
                "unused funds can roll to the beneficiary's Roth IRA — up to $7,000/year, $35,000 lifetime.",
                estimated_value="Up to $35,000 in Roth IRA contributions without income limit",
                next_steps=[
                    "Verify account opening date — must be at least 15 years old",
                    "Contributions made in the last 5 years cannot be rolled over",
                    "Roll up to $7,000/year (2025 Roth IRA limit) into beneficiary's Roth IRA",
                    "Beneficiary must have earned income ≥ the rollover amount",
                    "No income limit applies to this rollover (bypasses normal Roth MAGI limits)",
                ])
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            "529 plan on file but no balance recorded. Once funded (15+ year account), unused funds can roll to Roth IRA.",
            missing_facts=["investments.529_plans.balance"])

    def _rule_small_employer_retirement_startup_credit(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_any_business():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "§45E small employer retirement startup credit requires a business with employees.")
        biz = self.f.first_business()
        emp_count = biz.get("employees", {}).get("w2_employees_count") or 0
        emp_count = int(emp_count) if emp_count else 0
        if emp_count == 0:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Has a business — §45E credit is available when you add employees and set up a new retirement plan. "
                "No W-2 employees recorded (solo operators do not qualify for this specific credit).",
                missing_facts=["businesses.employees.w2_employees_count"])
        if emp_count > 100:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"§45E requires ≤ 100 employees. Business has {emp_count} employees.")
        ret_plans = biz.get("retirement_plans", {}) or {}
        has_plan = any(ret_plans.get(k) for k in ("sep_ira", "simple_ira", "solo_401k", "defined_benefit"))
        if has_plan:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Business already has a qualified retirement plan. §45E credit is for new plan establishment only.")
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
            f"§45E applies — {emp_count} employee(s), no existing retirement plan. "
            "Credit = 100% of startup costs up to $5,000/year × 3 years ($15,000 total). "
            "Set up a 401k, SIMPLE IRA, or SEP-IRA this year.",
            estimated_value="$500 – $5,000/year for 3 years; additional SECURE 2.0 employer contribution credit available",
            next_steps=[
                "Engage a plan provider (Fidelity, Vanguard, etc.) — ask about §45E credit eligibility",
                "401k is preferred: higher contribution limits + employer match options",
                "Add auto-enrollment to also claim the $500/year SECURE 2.0 auto-enrollment credit",
                "File Form 8881 with the return for each of the 3 qualifying years",
            ])

    # ── State Benefits ────────────────────────────────────────────────────

    _NO_INCOME_TAX_STATES = {"AK", "FL", "NV", "SD", "TX", "WA", "WY"}
    # NH taxes only interest/dividends (phasing out); TN fully eliminated its Hall Tax in 2021
    _NH_TN_NOTE = {"NH", "TN"}

    _PTE_STATES = {"CA", "NY", "NJ", "IL", "MA", "CT", "MD", "VA", "CO", "OR",
                   "GA", "WI", "MN", "NC", "OH", "SC", "AZ", "MI", "PA", "LA",
                   "ID", "RI", "ME", "MO", "VT", "AL", "UT", "NM", "KS", "OK"}

    _529_DEDUCTION_STATES = {
        "AL", "AZ", "AR", "CO", "CT", "DC", "GA", "ID", "IL", "IN",
        "IA", "KS", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
        "MT", "NE", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR",
        "PA", "RI", "SC", "UT", "VA", "WV", "WI",
    }

    _RETIREMENT_EXEMPT_STATES = {
        # Full or substantial SS + pension exemption
        "IL", "MS", "PA", "AL",                          # exempt all retirement income
        "FL", "TX", "NV", "WA", "WY", "AK", "SD",       # no income tax (caught by other rule)
        "TN", "NH",                                       # minimal income tax
        # Partial or SS-only exemption
        "NY", "CO", "VA", "GA", "SC", "MD", "ND",
        "OH", "MI", "WI", "MO", "IA", "KS", "OK",
        "AR", "LA", "KY", "WV", "HI",
    }

    _EV_CREDIT_STATES = {"CA", "CO", "NY", "CT", "MA", "OR", "NJ", "IL", "VT", "ME"}

    def _rule_no_income_tax_state(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        state = self.f.state()
        if not state:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Set household.residence.state to see if you live in a no-income-tax state.",
                missing_facts=["household.residence.state"])
        if state in self._NO_INCOME_TAX_STATES:
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                f"{state} has no broad-based state income tax — you owe $0 in state income tax on wages, "
                f"self-employment income, and most other income.",
                next_steps=[
                    "Ensure your domicile is established in your state (driver's license, voter registration, bank address)",
                    "Part-year residents: confirm no tax owed to prior state for the portion of year lived there",
                    "Community property states (TX, NV, WA): review federal planning interactions with your CPA",
                ])
        if state in self._NH_TN_NOTE:
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                f"{state} taxes only interest and dividend income (very narrow). "
                "Wages, self-employment, and capital gains are not taxed at the state level.",
                next_steps=["Confirm investment income — only interest/dividends taxed in NH (through 2024)"])
        return self._result(base, EligibilityStatus.NOT_APPLICABLE,
            f"{state} has a broad-based state income tax. Consider this when evaluating residency planning.")

    def _rule_pte_election(self, b: dict) -> OpportunityResult:
        base = self._base(b)

        if not self.f.has_self_employment():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "PTE election requires pass-through business income (S Corp, partnership, or multi-member LLC).")

        residence = self.f.state()
        nexus_states = self.f.business_nexus_states()
        no_tax = self._NO_INCOME_TAX_STATES | self._NH_TN_NOTE

        # Determine which nexus states have an active PTE election and a meaningful income tax
        pte_nexus = {s for s in nexus_states if s in self._PTE_STATES and s not in no_tax}

        # Warn when incorporation state differs from operating states (DE/WY shell is common)
        biz = self.f.first_business()
        formation = (biz.get("formation_state") or "").strip().upper()
        formation_note = ""
        if formation and formation not in nexus_states:
            formation_note = (
                f" Note: {formation} is the formation state but does not appear in your operating "
                "states — PTE elections apply where the business earns income, not where it was formed."
            )

        if not residence and not nexus_states - {residence}:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Set household.residence.state and add operating_states to each business to evaluate "
                "PTE election applicability across all nexus states.",
                missing_facts=["household.residence.state", "businesses.operating_states"])

        if not pte_nexus:
            # Check if we simply don't have operating_states recorded yet
            has_ops = any(biz.get("operating_states") for biz in self.f.businesses())
            if not has_ops and residence and residence not in self._PTE_STATES:
                return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                    f"Residence state {residence} has not enacted a PTE election. "
                    "If this business operates in other states, add them as operating_states — "
                    "you may have a PTE opportunity in a nexus state." + formation_note,
                    missing_facts=["businesses.operating_states"])
            states_str = ", ".join(sorted(nexus_states)) if nexus_states else "your states"
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"None of your nexus states ({states_str}) have enacted a PTE election as of 2025."
                + formation_note)

        agi = self.f.estimated_agi()
        net_profit = _to_float(biz.get("financials", {}).get("net_profit_loss"))

        if net_profit <= 0:
            states_str = ", ".join(sorted(pte_nexus))
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                f"PTE election available in: {states_str}. Business net profit not yet recorded." + formation_note,
                missing_facts=["businesses.financials.net_profit_loss"],
                next_steps=["Enter business net profit to evaluate PTE tax savings"])

        # Surface all qualifying nexus states, leading with residence
        if residence in pte_nexus:
            primary = residence
            other_pte = sorted(pte_nexus - {residence})
        else:
            primary = sorted(pte_nexus)[0]
            other_pte = sorted(pte_nexus - {primary})

        multi_note = (f" Additional PTE elections also available in: {', '.join(other_pte)}." if other_pte else "")
        non_res_note = (
            f" (You reside in {residence} which has no PTE election, but your business has nexus in {primary}.)"
            if residence and residence not in pte_nexus else ""
        )

        if agi and agi < 150_000:
            return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
                f"PTE election available in {primary}.{non_res_note}{multi_note}{formation_note} "
                f"At AGI ${agi:,.0f} the SALT cap may not be your binding constraint — "
                "PTE elections produce the most benefit when state income tax exceeds $10,000.",
                next_steps=["Consult CPA to model net federal benefit vs. state credit limitations"])

        steps = [
            f"Contact your CPA to model net federal benefit for each state: {', '.join(sorted(pte_nexus))}",
            f"File the PTE election on the entity return (most states: by March 15)",
            "Get shareholder/partner consent if S Corp or multi-member LLC",
            "CA: pay estimated PTE tax by June 15 or risk losing the deduction",
        ]
        if other_pte:
            steps.append(f"File separate PTE elections in each nexus state: {', '.join(other_pte)}")
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
            f"PTE election available in {primary}.{non_res_note}{multi_note}{formation_note} "
            "Your pass-through business can pay state income tax at the entity level and deduct it "
            "federally, bypassing the $10,000 SALT cap.",
            next_steps=steps)

    def _rule_state_529_deduction(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        state = self.f.state()
        if not state:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Set household.residence.state to check if your state offers a 529 deduction.",
                missing_facts=["household.residence.state"])
        if state in self._NO_INCOME_TAX_STATES:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"{state} has no income tax — no state deduction available (federal tax-free growth still applies).")
        if state not in self._529_DEDUCTION_STATES:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"{state} does not offer a state income tax deduction or credit for 529 contributions "
                "(as of 2025). Federal tax-free growth still applies.")
        has_529 = self.f.has_529_account()
        if not has_529:
            return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
                f"{state} offers a 529 deduction — open a home-state 529 account to claim it.",
                changes_needed=["Open a 529 college savings account with your home-state plan"],
                next_steps=[
                    f"Research {state}'s 529 plan at your state treasurer's website",
                    "Open an account with a beneficiary — can be any family member",
                    "Contribute by December 31 to get the deduction for this tax year (PA allows by April 15)",
                ])
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
            f"{state} offers a state income tax deduction/credit for contributions to the home-state 529 plan. "
            "Contribute by December 31 to claim the deduction this tax year.",
            next_steps=[
                "Contribute to the home-state 529 plan (not an out-of-state plan — most states require home-state plan)",
                "Check the annual deduction limit for your state (typically $2,500–$20,000 per beneficiary)",
                "Consider superfunding: elect to spread 5 years of gifts ($95,000 single / $190,000 MFJ) into one contribution",
            ])

    def _rule_state_retirement_income_exemption(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        state = self.f.state()
        if not state:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Set household.residence.state to check if your state exempts retirement income.",
                missing_facts=["household.residence.state"])
        if state in self._NO_INCOME_TAX_STATES | self._NH_TN_NOTE:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"{state} has no/minimal income tax — retirement income is not taxed at the state level regardless.")
        has_ret = self.f.has_retirement_distributions()
        has_ss = self.f.has_social_security()
        if not has_ret and not has_ss:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "No retirement income sources found. This benefit applies to taxpayers with Social Security, "
                "pension, or IRA/401(k) distributions.")
        if state not in self._RETIREMENT_EXEMPT_STATES:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"{state} does not provide a broad retirement income exemption (as of 2025). "
                "Verify with your state's department of revenue.")
        income_type = []
        if has_ss:
            income_type.append("Social Security")
        if has_ret:
            income_type.append("retirement distributions")
        income_desc = " and ".join(income_type)
        full_exempt = state in {"IL", "MS", "PA", "AL"}
        if full_exempt:
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                f"{state} exempts ALL retirement income ({income_desc}) from state income tax — "
                "this is one of the most taxpayer-friendly retirement income rules in the country.",
                next_steps=[
                    "Confirm exemption applies to your income type on the state return",
                    "PA: exempts IRAs, 401(k)s, SS, and pension income — ensure it's claimed on PA-40",
                ])
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
            f"{state} provides a partial exemption or deduction for {income_desc}. "
            "Verify the specific exemption amounts on the state return.",
            next_steps=[
                "Review your state's retirement income worksheet on the state return",
                "Confirm whether SS income, pension income, and IRA distributions each qualify separately",
                "Consider consulting a CPA if retirement income exceeds the exemption threshold",
            ])

    def _rule_state_homestead_exemption(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        state = self.f.state()
        if not state:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Set household.residence.state to check homestead exemption availability.",
                missing_facts=["household.residence.state"])
        primary = self.f.primary_residence()
        if not primary and not self.f.has_any_real_estate():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "No primary residence recorded in real_estate.yaml.")
        applied = primary.get("homestead_exemption_applied") or primary.get("homestead_applied")
        if applied:
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                f"Homestead exemption already applied in {state}. "
                "If you have a spouse, senior, or veteran status, check for enhanced exemptions.",
                next_steps=[
                    "Verify the exemption amount on your property tax statement",
                    "Check for senior/veteran enhanced exemptions if applicable",
                ])
        age = self.f.taxpayer_age()
        senior_note = " Enhanced senior exemptions may be available for taxpayers 65+." if age and age >= 65 else ""
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            f"{state} offers a homestead property tax exemption. No evidence it has been applied — "
            f"most homeowners must file an application with the county.{senior_note}",
            missing_facts=["real_estate.properties.homestead_exemption_applied"],
            next_steps=[
                f"Apply with your {state} county property appraiser or assessor before the deadline (typically March 1)",
                "Bring: proof of ownership, government ID showing property address",
                "Set homestead_exemption_applied: true in real_estate.yaml once filed",
                "Check for senior (65+), veteran, or disability enhanced exemptions",
            ])

    def _rule_state_ev_credit(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        state = self.f.state()
        if not state:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Set household.residence.state to check state EV credit availability.",
                missing_facts=["household.residence.state"])
        if state not in self._EV_CREDIT_STATES:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"{state} does not currently offer a broad state EV purchase credit or rebate "
                "(as of 2025). The federal §30D credit still applies.")
        if not self.f.has_ev():
            return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
                f"{state} offers a state EV credit that stacks on top of the federal §30D credit. "
                "No EV recorded in your data yet.",
                changes_needed=["Purchase or lease a qualifying BEV or PHEV"],
                next_steps=[
                    f"Research {state}'s current EV program (CA CVRP, CO Form DR 0617, NY Drive Clean Rebate)",
                    "Stack with federal §30D credit for maximum incentive",
                    "CA: apply for CVRP rebate within 18 months of purchase — funding is limited",
                ])
        agi = self.f.estimated_agi()
        ca_limit = 135_000 if (self.f.filing_status() or "single").lower() in ("single", "hoh", "head_of_household") else 200_000
        if state == "CA" and agi and agi > ca_limit:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"CA CVRP income limit exceeded (AGI ${agi:,.0f} > ${ca_limit:,}). "
                "The federal §30D credit may still apply — verify MSRP and income limits.")
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
            f"{state} offers a state EV credit/rebate on top of the federal §30D credit. "
            "Apply as soon as possible — some programs (CA CVRP) have limited funding.",
            next_steps=[
                "CA: apply at cleanvehiclerebate.org within 18 months of purchase",
                "CO: claim on Form DR 0617 with your state return",
                "NY: claim on Form IT-253 with your state return",
                "Stack with federal §30D for maximum combined incentive",
            ])


    # ── County Benefits ───────────────────────────────────────────────────

    def _rule_county_homestead_exemption(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        pr = self.f.primary_residence()
        if not pr:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "County homestead exemption applies to a primary residence — no primary residence recorded.")
        county = self.f.county()
        state = self.f.state()
        location = f"{county} County, {state}" if county and state else (state or "your county")
        steps = [
            f"Search '{location} homestead exemption application' to find the county assessor portal",
            "Gather deed/mortgage statement + government ID showing current address",
            "File before the county deadline (most states: March 1)",
            "Confirm you also have the state-level exemption — both layers are required separately",
        ]
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            f"You own a primary residence and likely qualify for {location}'s county homestead "
            "exemption. Most counties administer their own exemption on top of the state exemption, "
            "but it is not automatic — you must apply with the county assessor.",
            missing_facts=[] if county else ["household.residence.county"],
            next_steps=steps)

    def _rule_county_senior_property_tax_freeze(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        age = self.f.taxpayer_age()
        pr = self.f.primary_residence()
        if not pr:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Senior property tax freeze requires owning a primary residence.")
        if age is not None and age < 60:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"Senior property tax freeze requires age 65+ (current age: {age}). "
                "Return to this once you approach that threshold.")
        if age is not None and 60 <= age < 65:
            return self._result(base, EligibilityStatus.FUTURE_OPPORTUNITY,
                f"Age {age} — most county senior freeze programs require age 65. "
                "Plan to apply as soon as you qualify to lock in the current assessed value.",
                next_steps=["Note the county assessor deadline for the year you turn 65"])
        county = self.f.county()
        state = self.f.state()
        location = f"{county} County, {state}" if county and state else (state or "your county")
        age_str = f"age {age}" if age else "your age"
        steps = [
            f"Contact {location} assessor to confirm the senior freeze program and income limits",
            "Gather proof of age (driver's license or birth certificate) and property ownership documents",
            "File before the county deadline (IL: July 1; TX/FL: April 30; others: typically March 1)",
            "Renew annually if required — missing a year can reset the frozen value",
        ]
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            f"At {age_str} you likely qualify for {location}'s senior property tax assessment freeze. "
            "This locks your assessed value so your tax bill won't rise even as home values increase — "
            "potentially saving hundreds to thousands per year in appreciating markets.",
            missing_facts=[] if (age and county) else (
                ["household.taxpayer.age"] if not age else ["household.residence.county"]),
            next_steps=steps)

    def _rule_county_veteran_property_tax_exemption(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.is_veteran():
            taxpayer = self.f._data.get("household", {}).get("taxpayer", {})
            if taxpayer.get("veteran") is None:
                return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                    "Veteran status not recorded. If you are an honorably discharged veteran who "
                    "owns a primary residence, you likely qualify for a county property tax exemption.",
                    missing_facts=["household.taxpayer.veteran"])
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "County veteran property tax exemption requires honorably discharged veteran status.")
        pr = self.f.primary_residence()
        if not pr:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Veteran status confirmed. This exemption applies when you own a primary residence — "
                "apply immediately after purchasing a home.",
                missing_facts=["real_estate.properties (primary_residence)"])
        county = self.f.county()
        state = self.f.state()
        location = f"{county} County, {state}" if county and state else (state or "your county")
        steps = [
            f"Contact {location} assessor and request the veteran property tax exemption application",
            "Bring your DD-214 and any VA disability rating award letter",
            "Apply for the highest tier your disability rating supports (100% disabled = full exemption in many states)",
            "TX 100% disabled veterans: full property tax exemption — save $5,000–$15,000+/year",
        ]
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            f"As a veteran who owns a primary residence, you qualify for {location}'s "
            "veteran property tax exemption. The savings range from a modest base exemption for "
            "any honorably discharged veteran to a full exemption for 100% service-connected disability.",
            missing_facts=[] if county else ["household.residence.county"],
            next_steps=steps)

    def _rule_county_disability_property_tax_exemption(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        taxpayer = self.f._data.get("household", {}).get("taxpayer", {})
        if taxpayer.get("disabled") is None:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Disability status not recorded. If you are permanently and totally disabled and "
                "own a primary residence, you may qualify for a county property tax exemption.",
                missing_facts=["household.taxpayer.disabled"])
        if not self.f.is_disabled():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "County disability property tax exemption requires permanent total disability.")
        pr = self.f.primary_residence()
        if not pr:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Disability confirmed. This exemption requires owning a primary residence — "
                "apply immediately after purchasing a home.",
                missing_facts=["real_estate.properties (primary_residence)"])
        county = self.f.county()
        state = self.f.state()
        location = f"{county} County, {state}" if county and state else (state or "your county")
        agi = self.f.estimated_agi()
        income_note = (f" Income limit may apply (your AGI: ${agi:,.0f})." if agi else
                       " Some counties impose income limits — verify with the assessor.")
        steps = [
            f"Contact {location} assessor and request the disability property tax exemption application",
            "Provide SSA disability award letter or licensed physician certification",
            "Ask whether the exemption stacks with the homestead and senior exemptions",
            "Check if retroactive claims are allowed — some counties accept 1–2 years back",
        ]
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            f"As a permanently disabled homeowner you likely qualify for {location}'s "
            f"disability property tax exemption.{income_note}",
            missing_facts=[] if county else ["household.residence.county"],
            next_steps=steps)

    def _rule_county_solar_exemption(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_any_real_estate():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "County solar exemption applies to property owners — no real estate recorded.")
        state = self.f.state()
        county = self.f.county()
        location = f"{county} County, {state}" if county and state else (state or "your county")
        # States with mandatory solar property tax exemptions
        mandatory_states = {"FL", "TX", "AZ", "CO", "NJ", "NY", "MA", "NC", "MN", "OR", "WA",
                            "MD", "IN", "KY", "LA", "ME", "MI", "MT", "NE", "NM", "ND", "OH",
                            "RI", "SC", "VT", "WI"}
        if state and state in mandatory_states:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                f"{state} mandates that counties exempt the added value of solar installations "
                "from property tax assessment. If you have or are considering solar panels, "
                "their value will not increase your property tax bill.",
                next_steps=[
                    "Verify your current property tax bill does not include solar panel value",
                    "In mandatory-exemption states this is typically automatic after installation",
                    "Stack with the federal 30% Residential Clean Energy Credit (Form 5695)",
                    "Factor this exemption into your solar ROI calculation before installing",
                ])
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            f"Many counties exempt solar and renewable energy installations from property reassessment. "
            f"Verify whether {location} offers this exemption before or after installing solar panels.",
            missing_facts=[] if (state and county) else (
                ["household.residence.state"] if not state else ["household.residence.county"]),
            next_steps=[
                f"Search '{location} solar property tax exemption' or call the county assessor",
                "If available, apply before or immediately after installation",
                "Stack with federal Form 5695 Residential Clean Energy Credit (30% of system cost)",
                "Leased solar systems may not qualify — confirm with installer",
            ])

    def _rule_county_agricultural_use_valuation(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        props = self.f._data.get("real_estate", {}).get("properties", []) or []
        land_types = {"land", "Land (no structure)"}
        has_land = any(p.get("property_type") in land_types or
                       str(p.get("property_type", "")).lower() == "land"
                       for p in props if isinstance(p, dict))
        if not has_land and not props:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Agricultural use valuation requires owning land or qualifying acreage — "
                "no real estate recorded.")
        if not has_land:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Agricultural use valuation requires a land-type property. "
                "Residential properties do not qualify unless they include significant acreage.")
        state = self.f.state()
        county = self.f.county()
        location = f"{county} County, {state}" if county and state else (state or "your county")
        steps = [
            f"Contact {location} assessor for the agricultural use / greenbelt application",
            "Document qualifying agricultural activity: farming records, lease to farmer, or wildlife management plan",
            "TX Wildlife Management: requires a documented WMP — qualifies with 5+ acres and 6+ beehives",
            "Understand rollback taxes (3–5 years at full rate) before selling or changing land use",
            "Consult a real estate attorney before any sale of land under ag classification",
        ]
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            f"You own land-type property that may qualify for {location}'s agricultural use "
            "valuation. This assesses land at its agricultural value rather than market value — "
            "in rapidly appreciating areas the tax savings can be $1,000–$30,000+/year.",
            missing_facts=[] if county else ["household.residence.county"],
            next_steps=steps)


    # ── Gap Benefits ─────────────────────────────────────────────────────

    def _rule_employer_childcare_credit(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_any_business():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "§45F Employer-Provided Childcare Credit requires a business with employees.")
        biz = self.f.first_business()
        emp_count = int(biz.get("employees", {}).get("w2_employees_count") or 0)
        if emp_count == 0:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Has a business — §45F credit is available if you pay for qualified childcare "
                "facilities or resource/referral services for employees. No W-2 employees recorded yet.",
                missing_facts=["businesses.employees.w2_employees_count"])
        childcare = _to_float((biz.get("financials") or {}).get("childcare_expenses"))
        if childcare == 0:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                f"Business has {emp_count} employee(s) — eligible for §45F credit on childcare "
                "facility or resource/referral expenses. Record childcare spending to compute credit.",
                missing_facts=["businesses.financials.childcare_expenses"],
                next_steps=[
                    "25% credit on qualified childcare facility expenditures",
                    "10% credit on childcare resource/referral contracts",
                    "Maximum credit $150,000/year; file Form 8882",
                ])
        credit = min(childcare * 0.25, 150_000)
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
            f"§45F Childcare Credit: ~${credit:,.0f} (25% of ${childcare:,.0f} childcare expenses).",
            estimated_value=f"~${credit:,.0f}/year",
            next_steps=["File Form 8882 with business return", "Attach to Form 3800 (General Business Credit)"])

    def _rule_work_opportunity_tax_credit(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_any_business():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Work Opportunity Tax Credit (WOTC) requires a business with employees.")
        biz = self.f.first_business()
        emp_count = int(biz.get("employees", {}).get("w2_employees_count") or 0)
        if emp_count == 0:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Has a business — WOTC is available when you hire from targeted groups "
                "(veterans, SNAP recipients, ex-felons, long-term unemployed, etc.). "
                "No W-2 employees recorded yet.",
                missing_facts=["businesses.employees.w2_employees_count"])
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            f"Business has {emp_count} employee(s). WOTC credit ($2,400–$9,600/qualifying hire) "
            "is available when hiring from WOTC target groups. Requires IRS Form 8850 "
            "filed with state workforce agency within 28 days of hire.",
            missing_facts=["businesses.employees.wotc_hires"],
            next_steps=[
                "Add Form 8850 pre-screening to all new-hire onboarding",
                "Target groups: veterans, SNAP/TANF recipients, ex-felons, long-term unemployed",
                "Disabled veteran = up to $9,600 credit per hire",
                "File Form 5884 with business return",
            ])

    def _rule_net_unrealized_appreciation(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        has_w2 = self.f.has_w2_income()
        has_dist = self.f.has_retirement_distributions()
        if not has_w2 and not has_dist:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "NUA strategy applies to employees with employer stock in a 401k/profit-sharing plan.")
        ret = self.f._data.get("retirement", {}) or {}
        employer_plans = ret.get("employer_plans", {}) or {}
        has_401k = bool(employer_plans.get("traditional_401k") or employer_plans.get("profit_sharing"))
        if not has_401k and not has_dist:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Has W-2 income — if your 401k or profit-sharing plan holds employer stock with "
                "significant appreciation, the NUA strategy can save 20–37% in taxes vs. rollover.",
                missing_facts=["retirement.employer_plans.traditional_401k"],
                next_steps=[
                    "Ask your plan administrator for the cost basis of employer stock in your plan",
                    "Compare NUA tax cost vs. rollover with your CPA before distributing",
                    "NUA is only available as a lump-sum distribution — cannot split across years",
                ])
        nua_amount = _to_float((employer_plans.get("traditional_401k") or {}).get("employer_stock_nua"))
        if nua_amount > 0:
            savings_estimate = nua_amount * 0.20
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                f"NUA strategy available — ${nua_amount:,.0f} of employer stock appreciation "
                f"could be taxed at LTCG rates (~${savings_estimate:,.0f} potential savings vs. ordinary income).",
                estimated_value=f"~${savings_estimate:,.0f}+ lifetime savings (20% × NUA)",
                next_steps=[
                    "Work with CPA to model NUA vs. IRA rollover — NUA wins when appreciation is large",
                    "Lump-sum distribution must occur in one tax year",
                    "Depreciation recapture taxed in year of distribution regardless",
                ])
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            "Has retirement plan — if plan holds appreciated employer stock, NUA strategy may apply. "
            "Record employer stock NUA amount to calculate potential savings.",
            missing_facts=["retirement.employer_plans.traditional_401k.employer_stock_nua"])

    def _rule_installment_sale(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_any_real_estate() and not self.f.has_any_business():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Installment sale method applies to sellers of real estate or business property.")
        props = self.f._data.get("real_estate", {}).get("properties", []) or []
        selling = [p for p in props if isinstance(p, dict) and
                   str(p.get("status", "")).lower() in ("for_sale", "pending_sale", "selling", "sold")]
        if selling:
            return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
                "Property marked for sale — installment method available to spread capital gains "
                "across payment years. Discuss seller-financing terms with buyer and CPA.",
                estimated_value="Varies — can save $5,000–$100,000+ depending on gain size and brackets",
                next_steps=[
                    "Negotiate installment payments in purchase agreement",
                    "Get a promissory note secured by the property",
                    "File Form 6252 with each year's return; depreciation recapture due in sale year",
                ])
        appreciated = [p for p in props if isinstance(p, dict) and
                       _to_float(p.get("current_value")) > _to_float(p.get("purchase_price"))]
        if appreciated:
            return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
                f"Has {len(appreciated)} appreciated propert(ies) — if you sell with seller financing, "
                "the installment method spreads capital gains across payment years, keeping income in lower brackets.",
                changes_needed=["Negotiate seller financing terms when selling real estate or business"],
                next_steps=[
                    "Model tax under lump-sum vs. 3–5 year installment schedule with CPA",
                    "Depreciation recapture is taxed in year of sale regardless",
                    "File Form 6252 every year payments are received",
                ])
        if self.f.has_any_business():
            return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
                "Has a business — installment sale method available if you sell the business "
                "and negotiate seller financing with the buyer.",
                changes_needed=["Negotiate installment terms in business sale agreement"],
                next_steps=["Model tax impact with CPA before agreeing to sale terms"])
        return self._result(base, EligibilityStatus.NOT_APPLICABLE,
            "No appreciated real estate or business property identified for potential sale.")

    def _rule_excess_fica_refund(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        w2s = self.f._data.get("income", {}).get("w2_employment", []) or []
        if len(w2s) < 2:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Excess FICA refund requires wages from two or more employers in the same year.")
        ss_wage_base = 176_100
        ss_max = round(ss_wage_base * 0.062, 2)  # $10,918.20 for 2025
        total_wages = sum(_to_float(w.get("wages")) for w in w2s)
        total_ss_withheld = sum(_to_float(w.get("social_security_withheld") or
                                          w.get("ss_withheld") or
                                          (min(_to_float(w.get("wages")), ss_wage_base) * 0.062))
                                for w in w2s)
        if total_wages <= ss_wage_base:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                f"Combined wages ${total_wages:,.0f} do not exceed the SS wage base "
                f"(${ss_wage_base:,}) — no excess withholding.")
        excess = round(max(0, total_ss_withheld - ss_max), 2)
        if excess <= 0:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                f"Combined wages ${total_wages:,.0f} exceed SS wage base — check each W-2 Box 4 "
                "for actual SS withheld. Record ss_withheld on each W-2 to compute exact refund.",
                missing_facts=["income.w2_employment[*].social_security_withheld"])
        return self._result(base, EligibilityStatus.ELIGIBLE_NOW,
            f"Excess Social Security withholding: ~${excess:,.0f} refundable. "
            f"Total SS withheld ${total_ss_withheld:,.0f} exceeds 2025 max of ${ss_max:,.0f}.",
            estimated_value=f"${excess:,.0f} refundable credit",
            next_steps=[
                "Claim on Schedule 3, Line 11 of Form 1040",
                "Verify Box 4 on each W-2 — sum must exceed $10,918.20 to have excess",
                "This is a refundable credit — paid even if you owe no other tax",
            ])

    def _rule_ichra_qsehra(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_any_business():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "ICHRA/QSEHRA requires a business with employees.")
        biz = self.f.first_business()
        emp_count = int(biz.get("employees", {}).get("w2_employees_count") or 0)
        if emp_count == 0:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Has a business — ICHRA/QSEHRA allows tax-free health reimbursements to employees "
                "as an alternative to group health insurance. No W-2 employees recorded yet.",
                missing_facts=["businesses.employees.w2_employees_count"])
        healthcare = self.f._data.get("healthcare", {}) or {}
        has_group_plan = healthcare.get("employer_group_plan") is True
        hra_type = "ICHRA" if emp_count >= 50 else "QSEHRA"
        annual_limit = "no dollar limit" if emp_count >= 50 else "$6,350/single, $12,800/family (2025)"
        if has_group_plan and emp_count < 50:
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "QSEHRA requires that the employer not offer a group health plan to same employees. "
                "Consider ICHRA if you want to offer both a group plan and an HRA to different classes.")
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            f"{hra_type} allows you to reimburse {emp_count} employee(s) tax-free for individual "
            f"health insurance premiums ({annual_limit}). Deductible as a business expense.",
            missing_facts=["businesses.healthcare.hra_established"],
            next_steps=[
                f"Establish {hra_type} plan document before December 31 for next year's coverage",
                "Notify eligible employees 90 days before plan year begins",
                "Use a third-party HRA administrator (PeopleKeep, Take Command) for compliance",
                "Employees must maintain qualifying individual coverage to receive reimbursements",
            ])

    def _rule_conservation_easement(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        if not self.f.has_any_real_estate():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "Conservation easement deduction requires ownership of qualifying real property.")
        props = self.f._data.get("real_estate", {}).get("properties", []) or []
        qualifying_types = {"land", "farm", "ranch", "rural", "undeveloped", "agricultural",
                            "timberland", "wetland", "open_space"}
        qualifying = [p for p in props if isinstance(p, dict) and
                      any(qt in str(p.get("property_type", "")).lower() or
                          qt in str(p.get("description", "")).lower()
                          for qt in qualifying_types)]
        if not qualifying:
            return self._result(base, EligibilityStatus.ELIGIBLE_IF_CHANGED,
                "Has real estate — conservation easement deduction (§170(h)) requires land with "
                "conservation potential (farm, ranch, undeveloped land, habitat, scenic corridor). "
                "No qualifying land type identified in your data.",
                changes_needed=["Own land with qualifying conservation purpose"],
                next_steps=[
                    "CAUTION: Only pursue with a reputable land trust — not a promoter",
                    "Syndicated easements are IRS listed transactions with heavy penalties",
                ])
        agi = self.f.estimated_agi()
        agi_limit = agi * 0.50 if agi else None
        land_value = sum(_to_float(p.get("current_value")) for p in qualifying)
        easement_estimate = land_value * 0.40 if land_value else 0
        msg = (f"Has {len(qualifying)} qualifying land parcel(s) (estimated value ${land_value:,.0f}). "
               f"Conservation easement could yield ~${easement_estimate:,.0f} deduction "
               f"(~40% of land value estimate).")
        if agi_limit:
            msg += f" Annual deduction limit: ${agi_limit:,.0f} (50% of AGI) with 15-year carryforward."
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE, msg,
            estimated_value=f"~${easement_estimate:,.0f} deduction (50% AGI/year + 15-yr carryforward)",
            next_steps=[
                "Consult with a reputable land trust — NOT a promoter offering 4:1+ deduction ratios",
                "Get a qualified appraisal from a certified appraiser (not the promoter's appraiser)",
                "Deed must be recorded by December 31; appraisal complete before return due date",
                "Review with CPA and attorney — high IRS audit rate on this deduction",
            ])

    def _rule_qlac(self, b: dict) -> OpportunityResult:
        base = self._base(b)
        ret = self.f._data.get("retirement", {}) or {}
        ira = (ret.get("individual_retirement_accounts") or {})
        trad_ira = ira.get("traditional_ira") or {}
        ira_balance = _to_float(trad_ira.get("balance"))
        employer_plans = ret.get("employer_plans") or {}
        plan_balance = sum(
            _to_float((employer_plans.get(k) or {}).get("balance"))
            for k in ("traditional_401k", "403b", "457b")
        )
        total_balance = ira_balance + plan_balance
        age = self.f.taxpayer_age()
        if total_balance == 0 and not self.f.has_retirement_contributions():
            return self._result(base, EligibilityStatus.NOT_APPLICABLE,
                "QLAC requires a Traditional IRA, 401k, 403b, or 457b account balance.")
        if age and age < 50:
            return self._result(base, EligibilityStatus.FUTURE_OPPORTUNITY,
                f"QLAC is most valuable near or in retirement. At age {age}, focus on "
                "maximizing contributions first. Revisit at age 60+.",
                next_steps=["Maximize IRA/401k contributions now to grow the balance that funds a QLAC later"])
        qlac_limit = min(total_balance * 0.25 if total_balance else 135_000, 135_000)
        if total_balance == 0:
            return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
                "Has retirement contributions — record IRA/401k balances to calculate QLAC purchase limit.",
                missing_facts=["retirement.individual_retirement_accounts.traditional_ira.balance"])
        return self._result(base, EligibilityStatus.NEARLY_ELIGIBLE,
            f"Retirement balance ${total_balance:,.0f} — QLAC purchase limit: ${qlac_limit:,.0f} "
            "(lesser of 25% of balance or $135,000). Excludes QLAC amount from RMD calculations "
            "until payments begin (max age 85).",
            estimated_value=f"${qlac_limit:,.0f} excluded from RMDs; deferred income until age 72–85",
            next_steps=[
                "Compare QLAC payouts from multiple insurers (Fidelity, New York Life, MassMutual)",
                "Model RMD reduction vs. Roth conversion — often Roth conversion is the better first step",
                "Purchase by December 31 to exclude from that year's RMD calculation",
                "SECURE 2.0: 25% limit now applies to aggregate balance across all accounts",
            ])


# ── Benefit Library ───────────────────────────────────────────────────────

class BenefitLibrary:
    def __init__(self):
        self.benefits: list[dict] = []
        self._load()

    # Only directories listed here are scanned for benefit records.
    # future_law/, archive/, and other non-benefit dirs are ignored by default.
    BENEFIT_DIRS = ["federal", "state", "county"]

    def _load(self):
        lib_dir = ROOT / "tax_library"
        for subdir in self.BENEFIT_DIRS:
            for f in (lib_dir / subdir).glob("*.yaml"):
                if "example" in f.name:
                    continue
                with open(f, encoding="utf-8") as fh:
                    record = yaml.safe_load(fh)
                    if record and record.get("id"):
                        self.benefits.append(record)


# ── AI Advisor ────────────────────────────────────────────────────────────

TAX_SYSTEM_PROMPT = """You are an expert CPA and tax planning advisor with deep knowledge of the Internal Revenue Code (IRC), Treasury Regulations, IRS Publications, and practical federal tax strategy for individuals, self-employed taxpayers, real estate investors, and closely held business owners.

You specialize in:
- Self-employment tax reduction: QBI deduction (§199A), S Corp elections (§1362), retirement plans (SEP-IRA, Solo 401k)
- Real estate tax strategy: depreciation (§168), cost segregation, passive activity rules (§469), REP status, 1031 exchanges (§1031), Section 121 exclusion
- Individual tax planning: above-the-line deductions, itemized vs. standard, HSA, FSA, IRA, Roth conversions
- Business deductions: home office (§280A), business vehicle (§179/§168), business insurance, meals
- Tax credits: Child Tax Credit (§24), EITC, AOTC, Lifetime Learning Credit, clean energy credits (§30D)
- Estate and gift planning: annual exclusion ($19,000 per recipient in 2025), Opportunity Zone investments (§1400Z-2)
- Advanced strategies: backdoor Roth IRA, Augusta Rule (§280A(g)), donor-advised funds, installment sales

Your communication principles:
- Lead with dollar impact — quantify every opportunity where data allows
- Explain the legal mechanism in one sentence — why does this strategy work?
- Give the single most important first action for each opportunity
- Flag strategy interactions — when doing one thing amplifies or constrains another
- Be conservative on risk — always flag aggressive positions and recommend CPA review
- Distinguish timing: "act now" (year-end deadlines), "any time" (flexible elections), "future planning" (multi-year build)

Key planning interactions to watch for:
- S Corp election reduces SE tax but also reduces QBI deduction basis — model the net
- Solo 401k and SEP-IRA both reduce QBI net profit — sequence matters
- Home office deduction reduces both income tax AND SE tax — high leverage for sole props
- HSA contributions are above-the-line deductions available even without itemizing
- Real estate depreciation creates phantom losses; REP status or short-term rental material participation unlocks them
- Backdoor Roth works best when traditional IRA balance is zero (avoid pro-rata rule)

You are analyzing output from UTBIS (Universal Tax Benefit Intelligence System), an automated rule engine that evaluated a taxpayer's facts against federal tax benefit rules. Translate this structured data into clear, actionable guidance for a planning meeting."""


class AIAdvisor:
    """Calls Claude API to generate plain-English tax opportunity narratives."""

    def __init__(self, model: str = "claude-opus-4-8"):
        if not ANTHROPIC_AVAILABLE:
            raise RuntimeError("anthropic package not installed — run: pip install anthropic")
        self.client = _anthropic.Anthropic()
        self.model = model
        self._system = [
            {
                "type": "text",
                "text": TAX_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ]

    def _call(self, prompt: str, max_tokens: int = 4096) -> str:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=self._system,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text

    @staticmethod
    def _format_results(results: list) -> str:
        lines = []
        for r in results:
            lines.append(f"**{r.benefit_name}** [{r.status.value}]")
            lines.append(f"  Category: {r.category} | Risk: {r.risk_level}")
            if r.estimated_value:
                lines.append(f"  Estimated Value: {r.estimated_value}")
            lines.append(f"  Summary: {r.message}")
            if r.missing_facts:
                lines.append(f"  Missing Facts: {', '.join(r.missing_facts)}")
            if r.changes_needed:
                lines.append(f"  Changes Needed: {'; '.join(r.changes_needed[:2])}")
            if r.next_steps:
                lines.append(f"  Next Step: {r.next_steps[0]}")
            lines.append("")
        return "\n".join(lines)

    def analyze_opportunities(self, results: list, tax_year: int) -> str:
        """Narrative summary of top actionable opportunities."""
        actionable = [
            r for r in results
            if r.status in (
                EligibilityStatus.ELIGIBLE_NOW,
                EligibilityStatus.NEARLY_ELIGIBLE,
                EligibilityStatus.ELIGIBLE_IF_CHANGED,
            )
        ][:12]

        if not actionable:
            return "_No actionable opportunities found. Populate user_data/ YAML files to get a personalized analysis._"

        prompt = f"""Tax Year: {tax_year}

The UTBIS rule engine identified these tax opportunities for this taxpayer:

{self._format_results(actionable)}

Please provide:

## Executive Summary
2-3 sentences: what is this taxpayer's overall situation and the headline opportunity?

## Top 5 Opportunities — Explained
For each of the 5 highest-priority items (rank by dollar impact × ease of implementation):
- What it is and why it matters (mechanism in one plain-English sentence)
- The actual dollar impact based on the data provided
- The single most important action to take right now

## Strategy Interactions
Are any of these strategies connected? Does doing one amplify or constrain another? (2-4 bullet points; omit if no meaningful interactions)

## Prioritized Action Checklist
What should this taxpayer do: this week / before year-end / next year? (bulleted, most impactful first)

Write at the level of a productive CPA client meeting. Be specific about dollar amounts where the data supports it."""

        return self._call(prompt)

    def analyze_gaps(self, results: list, tax_year: int) -> str:
        """Gap-closing action plan for nearly_eligible and eligible_if_changed items."""
        gaps = [
            r for r in results
            if r.status in (EligibilityStatus.NEARLY_ELIGIBLE, EligibilityStatus.ELIGIBLE_IF_CHANGED)
        ]

        if not gaps:
            return "_No gaps identified — all evaluated benefits are either fully eligible or not applicable._"

        prompt = f"""Tax Year: {tax_year}

These tax opportunities have gaps preventing immediate eligibility:

{self._format_results(gaps)}

Provide a **Gap Closing Priority List** ordered by (estimated value unlocked) × (ease of closing gap).

For each item:
1. **Gap**: what specific information or action is missing?
2. **Key Question**: the single most important question to ask the taxpayer
3. **Value at Stake**: estimated annual tax benefit if the gap is closed
4. **Urgency**: Act now / Before year-end / Ongoing planning
5. **Effort**: Low (< 1 hour) / Medium (1-3 days) / High (structural change)

End with a **Quick Wins** section: gaps closable in under 1 hour (usually just filling in a fact in the YAML files)."""

        return self._call(prompt, max_tokens=3000)

    def analyze_scenario(self, description: str, changes: list[str], tax_year: int) -> str:
        """Interpret a scenario diff for the taxpayer."""
        change_text = "\n".join(changes) if changes else "No material changes detected."

        prompt = f"""Tax Year: {tax_year}
Scenario: "{description}"

What changes vs. the taxpayer's current situation:

{change_text}

Please provide:

## What This Scenario Unlocks
Plain-English explanation of the tax benefits this scenario makes available. Focus on total dollar impact.

## Implementation Cost and Effort
What does it actually take to execute this scenario? Ongoing compliance requirements?

## First Concrete Steps
If the taxpayer wants to pursue this, what are the first 3 concrete actions — with any deadlines noted?

## Watch-Outs
Any downside, risk, or unintended consequence to flag before proceeding?

Be direct and specific. This is a planning meeting, not a general overview."""

        return self._call(prompt, max_tokens=2000)


# ── Scanner ───────────────────────────────────────────────────────────────

class OpportunityScanner:
    def __init__(self, tax_year: int = 2025, min_value: float = 0, facts: UserFacts = None):
        self.tax_year = tax_year
        self.min_value = min_value
        self.facts = facts if facts is not None else UserFacts(tax_year)
        self.library = BenefitLibrary()
        self.engine = RulesEngine(self.facts)
        self.results: list[OpportunityResult] = []
        self.ai_narrative: str = ""
        self.gap_analysis: str = ""

    def scan(self):
        self.results = []
        for benefit in self.library.benefits:
            if benefit.get("status") == "expired":
                continue
            result = self.engine.evaluate(benefit)
            if result.status not in (EligibilityStatus.NOT_APPLICABLE, EligibilityStatus.EXPIRED):
                self.results.append(result)
        self.results.sort(key=lambda r: STATUS_SORT.index(r.status) if r.status in STATUS_SORT else 99)

    def write_report(self, output_path=None):
        if output_path is None:
            output_path = ROOT / "reports" / "opportunity_report.md"
        output_path = Path(output_path)
        now = datetime.now().strftime("%Y-%m-%d %H:%M")
        lines = [
            "# UTBIS Opportunity Report\n",
            f"**Generated:** {now}  ",
            f"**Tax Year:** {self.tax_year}  ",
            f"**Benefits Evaluated:** {len(self.library.benefits)}  ",
            f"**Opportunities Found:** {len(self.results)}  \n",
            "---\n",
        ]

        if self.ai_narrative:
            lines.append("\n## AI Tax Advisor Analysis\n")
            lines.append(self.ai_narrative)
            lines.append("\n---\n")

        groups = [
            (EligibilityStatus.ELIGIBLE_NOW, "## Eligible Now"),
            (EligibilityStatus.NEARLY_ELIGIBLE, "## Nearly Eligible (Small Gap)"),
            (EligibilityStatus.ELIGIBLE_IF_CHANGED, "## Eligible If You Make Changes"),
            (EligibilityStatus.FUTURE_OPPORTUNITY, "## Future Opportunities"),
            (EligibilityStatus.HIGH_RISK, "## High Risk — CPA Review Required Before Claiming"),
            (EligibilityStatus.UNKNOWN, "## Needs More Facts"),
        ]
        for status, heading in groups:
            group = [r for r in self.results if r.status == status]
            if not group:
                continue
            lines.append(f"\n{heading}\n")
            for r in group:
                lines.append(f"### {r.benefit_name}")
                lines.append(f"- **Status:** `{r.status.value}`")
                lines.append(f"- **Category:** {r.category}")
                if r.estimated_value:
                    lines.append(f"- **Estimated Value:** {r.estimated_value}")
                lines.append(f"- **Risk Level:** {r.risk_level}")
                if r.forms_required:
                    lines.append(f"- **Forms:** {', '.join(str(x) for x in r.forms_required)}")
                if r.review_required:
                    lines.append("- **CPA Review:** recommended")
                if r.phaseout_note:
                    lines.append(f"- **Phaseout:** {r.phaseout_note}")
                lines.append(f"\n{r.message}\n")
                if r.next_steps:
                    lines.append("**Next Steps:**")
                    for s in r.next_steps:
                        lines.append(f"- {s}")
                if r.missing_facts:
                    lines.append("\n**Missing Information:**")
                    for f in r.missing_facts:
                        lines.append(f"- `{f}`")
                if r.changes_needed:
                    lines.append("\n**Changes Needed:**")
                    for c in r.changes_needed:
                        lines.append(f"- {c}")
                lines.append("\n---")

        if self.gap_analysis:
            lines.append("\n## Gap Analysis — Priority Closing Actions\n")
            lines.append(self.gap_analysis)
            lines.append("\n---\n")

        lines.append("\n_This report is for planning purposes only. Consult a licensed CPA or tax attorney before implementing any strategy._\n")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("\n".join(lines), encoding="utf-8")
        print(f"Opportunity report written to {output_path}")

    def print_summary(self):
        by_status: dict[str, int] = {}
        for r in self.results:
            by_status[r.status.value] = by_status.get(r.status.value, 0) + 1
        print(f"\nUTBIS Opportunity Scan — Tax Year {self.tax_year}")
        print(f"{'Benefits in library:':<35} {len(self.library.benefits)}")
        print(f"{'Opportunities found:':<35} {len(self.results)}")
        for status in STATUS_SORT:
            count = by_status.get(status.value, 0)
            if count:
                print(f"  {status.value:<33} {count}")

    def generate_ai_analysis(self, include_gaps: bool = True, model: str = "claude-opus-4-8"):
        """Call Claude API to populate self.ai_narrative and self.gap_analysis."""
        if not ANTHROPIC_AVAILABLE:
            print("  Skipping AI analysis — run: pip install anthropic")
            return
        if not os.environ.get("ANTHROPIC_API_KEY"):
            print("  Skipping AI analysis — set ANTHROPIC_API_KEY environment variable")
            return
        advisor = AIAdvisor(model=model)
        print("Generating AI opportunity analysis...")
        self.ai_narrative = advisor.analyze_opportunities(self.results, self.tax_year)
        if include_gaps:
            print("Generating AI gap analysis...")
            self.gap_analysis = advisor.analyze_gaps(self.results, self.tax_year)


def main():
    parser = argparse.ArgumentParser(description="UTBIS Opportunity Scanner")
    parser.add_argument("--tax-year", type=int, default=2025)
    parser.add_argument("--output", choices=["markdown", "json"], default="markdown")
    parser.add_argument("--min-value", type=float, default=0)
    parser.add_argument("--report-path", type=str, default=None)
    parser.add_argument("--ai", action="store_true", help="Add AI narrative analysis (requires ANTHROPIC_API_KEY)")
    parser.add_argument("--no-gaps", action="store_true", help="Skip gap analysis when using --ai")
    parser.add_argument("--model", type=str, default="claude-opus-4-8", help="Claude model for AI analysis")
    args = parser.parse_args()

    scanner = OpportunityScanner(tax_year=args.tax_year, min_value=args.min_value)
    scanner.scan()
    scanner.print_summary()

    if args.ai:
        scanner.generate_ai_analysis(include_gaps=not args.no_gaps, model=args.model)

    if args.output == "markdown":
        path = Path(args.report_path) if args.report_path else None
        scanner.write_report(path)
    elif args.output == "json":
        import json
        data = [{k: (v.value if isinstance(v, EligibilityStatus) else v)
                 for k, v in vars(r).items()} for r in scanner.results]
        print(json.dumps(data, indent=2, default=str))


if __name__ == "__main__":
    main()
