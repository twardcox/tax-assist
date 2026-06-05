"""
Federal tax form package generator for CPA review.

Downloads official IRS fillable PDFs (public domain), fills them with
user data via pypdf, and bundles them with a reportlab data-summary PDF
into a single ZIP for the CPA.

Usage (CLI):
    python scripts/generate_tax_forms.py --user-id <id> --tax-year 2025
"""

import argparse
import concurrent.futures
import io
import json
import sys
import urllib.request
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from api.db import init_db, get_all_user_data, get_user_by_id, get_filing_details  # noqa: E402

FORM_CACHE = ROOT / "state" / "form_cache"
PKG_DIR    = ROOT / "state" / "tax_form_packages"

# Official IRS fillable PDF URLs (public domain)
IRS_FORM_URLS: dict[str, str] = {
    "f1040":    "https://www.irs.gov/pub/irs-pdf/f1040.pdf",
    "f1040s1":  "https://www.irs.gov/pub/irs-pdf/f1040s1.pdf",
    "f1040sa":  "https://www.irs.gov/pub/irs-pdf/f1040sa.pdf",
    "f1040sb":  "https://www.irs.gov/pub/irs-pdf/f1040sb.pdf",
    "f1040sc":  "https://www.irs.gov/pub/irs-pdf/f1040sc.pdf",
    "f1040sd":  "https://www.irs.gov/pub/irs-pdf/f1040sd.pdf",
    "f1040se":  "https://www.irs.gov/pub/irs-pdf/f1040se.pdf",
    "f1040sse": "https://www.irs.gov/pub/irs-pdf/f1040sse.pdf",
}

FORM_TITLES: dict[str, str] = {
    "f1040":    "Form 1040 — U.S. Individual Income Tax Return",
    "f1040s1":  "Schedule 1 — Additional Income and Adjustments",
    "f1040sa":  "Schedule A — Itemized Deductions",
    "f1040sb":  "Schedule B — Interest and Ordinary Dividends",
    "f1040sc":  "Schedule C — Profit or Loss From Business",
    "f1040sd":  "Schedule D — Capital Gains and Losses",
    "f1040se":  "Schedule E — Supplemental Income and Loss",
    "f1040sse": "Schedule SE — Self-Employment Tax",
}

# ── Tax parameters by year ───────────────────────────────────────────────────

_TAX_PARAMS: dict[int, dict] = {
    2024: {
        "standard_deduction": {
            "single":                      14600,
            "married_filing_jointly":      29200,
            "married_filing_separately":   14600,
            "head_of_household":           21900,
            "qualifying_surviving_spouse": 29200,
        },
        "extra_deduction_65": {"single": 1950, "married": 1550},
        "brackets": {
            "single": [
                (11600, .10), (47150, .12), (100525, .22),
                (191950, .24), (243725, .32), (609350, .35), (1e18, .37),
            ],
            "married_filing_jointly": [
                (23200, .10), (94300, .12), (201050, .22),
                (383900, .24), (487450, .32), (731200, .35), (1e18, .37),
            ],
            "married_filing_separately": [
                (11600, .10), (47150, .12), (100525, .22),
                (191950, .24), (243725, .32), (365600, .35), (1e18, .37),
            ],
            "head_of_household": [
                (16550, .10), (63100, .12), (100500, .22),
                (191950, .24), (243700, .32), (609350, .35), (1e18, .37),
            ],
            "qualifying_surviving_spouse": [
                (23200, .10), (94300, .12), (201050, .22),
                (383900, .24), (487450, .32), (731200, .35), (1e18, .37),
            ],
        },
        "ltcg_thresholds": {         # (0%→15%, 15%→20%) taxable income breakpoints
            "single":                      (47025,  518900),
            "married_filing_jointly":      (94050,  583750),
            "married_filing_separately":   (47025,  291850),
            "head_of_household":           (63000,  551350),
            "qualifying_surviving_spouse": (94050,  583750),
        },
        "se_ss_wage_base":  168600,
        "child_tax_credit": 2000,
        "ctc_phaseout":    {"single": 200000, "married_filing_jointly": 400000},
        "niit_threshold":  {"single": 200000, "married_filing_jointly": 250000},
        "amt_exemption":   {"single": 85700,  "married_filing_jointly": 133300},
    },
    2025: {
        "standard_deduction": {
            "single":                      15000,
            "married_filing_jointly":      30000,
            "married_filing_separately":   15000,
            "head_of_household":           22500,
            "qualifying_surviving_spouse": 30000,
        },
        "extra_deduction_65": {"single": 2000, "married": 1600},
        "brackets": {
            "single": [
                (11925, .10), (48475, .12), (103350, .22),
                (197300, .24), (250525, .32), (626350, .35), (1e18, .37),
            ],
            "married_filing_jointly": [
                (23850, .10), (96950, .12), (206700, .22),
                (394600, .24), (501050, .32), (751600, .35), (1e18, .37),
            ],
            "married_filing_separately": [
                (11925, .10), (48475, .12), (103350, .22),
                (197300, .24), (250525, .32), (375800, .35), (1e18, .37),
            ],
            "head_of_household": [
                (17000, .10), (64850, .12), (103350, .22),
                (197300, .24), (250500, .32), (626350, .35), (1e18, .37),
            ],
            "qualifying_surviving_spouse": [
                (23850, .10), (96950, .12), (206700, .22),
                (394600, .24), (501050, .32), (751600, .35), (1e18, .37),
            ],
        },
        "ltcg_thresholds": {
            "single":                      (48350,  533400),
            "married_filing_jointly":      (96700,  600050),
            "married_filing_separately":   (48350,  300000),
            "head_of_household":           (64750,  566700),
            "qualifying_surviving_spouse": (96700,  600050),
        },
        "se_ss_wage_base":  176100,
        "child_tax_credit": 2000,
        "ctc_phaseout":    {"single": 200000, "married_filing_jointly": 400000},
        "niit_threshold":  {"single": 200000, "married_filing_jointly": 250000},
        "amt_exemption":   {"single": 88100,  "married_filing_jointly": 137000},
    },
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _f(val) -> float:
    try:
        return float(val or 0)
    except (TypeError, ValueError):
        return 0.0


def _fmt(val: float) -> str:
    """Format dollar amount: blank for zero, comma-separated otherwise."""
    if val == 0:
        return ""
    return f"{val:,.0f}"


def _params(tax_year: int) -> dict:
    return _TAX_PARAMS.get(tax_year, _TAX_PARAMS[2025])


# ── Tax Calculator ────────────────────────────────────────────────────────────

class TaxCalculator:
    """
    Computes all federal income-tax figures from UTBIS user data.
    Mirrors the Form 1040 line-by-line structure.
    """

    def __init__(self, data: dict, tax_year: int):
        self.data = data
        self.tax_year = tax_year
        self.p = _params(tax_year)
        self.c: dict = {}

    def compute(self) -> dict:
        self.c = {}
        self._income()
        self._adjustments()
        self._agi()
        self._deductions()
        self._taxable_income()
        self._tax()
        self._credits()
        self._payments()
        self._balance()
        return self.c

    # ── INCOME ───────────────────────────────────────────────────────────────

    def _income(self):
        c = self.c
        inc = self.data.get("income", {}) or {}

        # W-2 wages (1040 Line 1a)
        w2s = inc.get("w2_employment", []) or []
        c["wages"]            = sum(_f(w.get("wages")) for w in w2s)
        c["federal_withheld"] = sum(_f(w.get("federal_withheld")) for w in w2s)
        c["state_withheld"]   = sum(_f(w.get("state_withheld")) for w in w2s)
        c["hsa_payroll"]      = sum(_f(w.get("hsa_contributions_through_payroll")) for w in w2s)
        c["w2_retirement"]    = sum(_f(w.get("retirement_contributions_through_payroll")) for w in w2s)
        c["dependent_care_fsa"] = sum(_f(w.get("dependent_care_fsa")) for w in w2s)
        c["w2_records"]       = w2s

        # Investment income (Lines 2b, 3a, 3b, 7)
        inv = inc.get("investment_income", {}) or {}
        c["taxable_interest"]    = _f(inv.get("interest"))
        c["qualified_dividends"] = _f(inv.get("qualified_dividends"))
        c["ordinary_dividends"]  = _f(inv.get("ordinary_dividends"))
        c["stcg"]                = _f(inv.get("short_term_capital_gains"))
        c["ltcg"]                = _f(inv.get("long_term_capital_gains"))
        c["capital_gains_net"]   = c["stcg"] + c["ltcg"]

        # Retirement distributions (Lines 4a/4b, 5a/5b)
        ret = inc.get("retirement_distributions", {}) or {}
        c["ira_gross"]    = _f(ret.get("traditional_ira"))
        c["ira_taxable"]  = c["ira_gross"]                      # Roth not taxable
        c["pension_gross"]   = _f(ret.get("pension")) + _f(ret.get("annuity")) + _f(ret.get("traditional_401k"))
        c["pension_taxable"] = c["pension_gross"]

        # Social security (Lines 6a/6b)
        ss = inc.get("social_security", {}) or {}
        c["ss_gross"]   = _f(ss.get("gross_benefits"))
        c["ss_taxable"] = self._ss_taxable(c["ss_gross"])

        # Schedule C — business income (flows to Sch 1 Line 3)
        se_list  = inc.get("self_employment", []) or []
        biz_list = (self.data.get("businesses", {}) or {}).get("businesses", []) or []
        c["schedule_c_records"] = self._build_sch_c(biz_list, se_list)
        c["schedule_c_profit"]  = sum(r["net_profit_loss"] for r in c["schedule_c_records"])

        # Schedule E — rental income (flows to Sch 1 Line 5)
        rental = inc.get("rental_income", []) or []
        c["schedule_e_records"] = rental
        c["schedule_e_net"]     = sum(_f(r.get("net_income_loss")) for r in rental)

        # Passive / K-1 (Sch 1 Line 5)
        passive = inc.get("passive_income", {}) or {}
        c["k1_ordinary"]            = _f(passive.get("k1_ordinary"))
        c["k1_rental"]              = _f(passive.get("k1_rental"))
        c["k1_guaranteed"]          = _f(passive.get("k1_guaranteed_payments"))

        # Other income (Sch 1 Lines 1–8)
        other = inc.get("other_income", {}) or {}
        c["alimony_received"]  = _f(other.get("alimony_received"))
        c["gambling_winnings"] = _f(other.get("gambling_winnings"))
        c["prizes_awards"]     = _f(other.get("prizes_awards"))
        c["canceled_debt"]     = _f(other.get("canceled_debt"))
        c["other_income_misc"] = _f(other.get("other_amount"))
        c["other_income_desc"] = other.get("other_description", "")

        # Schedule 1 additional income total
        c["schedule1_additional"] = (
            c["schedule_c_profit"]  + c["schedule_e_net"] +
            c["k1_ordinary"]        + c["k1_rental"]       + c["k1_guaranteed"] +
            c["alimony_received"]   + c["gambling_winnings"] +
            c["prizes_awards"]      + c["canceled_debt"]    + c["other_income_misc"]
        )

        # Total income (1040 Line 9)
        c["total_income"] = (
            c["wages"]            + c["taxable_interest"]  + c["ordinary_dividends"] +
            c["ira_taxable"]      + c["pension_taxable"]   + c["ss_taxable"] +
            c["capital_gains_net"] + c["schedule1_additional"]
        )

    def _build_sch_c(self, biz_list: list, se_list: list) -> list:
        out = []
        for biz in biz_list:
            name = biz.get("name") or biz.get("business_name", "")
            se   = next((s for s in se_list
                         if (s.get("business_name") or "").lower() == name.lower()), {})
            if not se and len(biz_list) == 1 and se_list:
                se = se_list[0]
            gross_rev = _f(se.get("gross_revenue") or biz.get("gross_revenue"))
            net_pl    = _f(se.get("net_profit")    or biz.get("net_profit_loss"))
            out.append({
                "business_name":   name,
                "entity_type":     biz.get("entity_type", ""),
                "ein":             biz.get("ein", ""),
                "naics":           biz.get("naics_code", ""),
                "gross_revenue":   gross_rev,
                "expenses":        gross_rev - net_pl if gross_rev else 0.0,
                "net_profit_loss": net_pl,
                "home_office":     bool(biz.get("home_office")),
            })
        # Also include SE income entries without a matching business record
        listed_names = {r["business_name"].lower() for r in out}
        for se in se_list:
            n = (se.get("business_name") or "").lower()
            if n and n not in listed_names:
                net = _f(se.get("net_profit"))
                out.append({
                    "business_name":   se.get("business_name", ""),
                    "entity_type":     "sole_prop",
                    "ein":             "",
                    "naics":           "",
                    "gross_revenue":   _f(se.get("gross_revenue")),
                    "expenses":        _f(se.get("gross_revenue")) - net,
                    "net_profit_loss": net,
                    "home_office":     False,
                })
        return out

    def _ss_taxable(self, gross: float) -> float:
        """85% / 50% / 0% combined income rule (IRC §86)."""
        if gross <= 0:
            return 0.0
        c = self.c
        combined = (
            c.get("wages", 0)           + c.get("taxable_interest", 0) +
            c.get("ordinary_dividends", 0) + c.get("ira_taxable", 0)   +
            c.get("pension_taxable", 0) + c.get("capital_gains_net", 0) +
            c.get("schedule1_additional", 0) + gross * 0.5
        )
        fs = self._fs()
        base  = 25000 if "jointly" not in fs else 32000
        upper = 34000 if "jointly" not in fs else 44000
        if combined <= base:
            return 0.0
        if combined <= upper:
            return min(gross, (combined - base) * 0.5)
        return min(gross * 0.85, (upper - base) * 0.5 + (combined - upper) * 0.85)

    # ── ADJUSTMENTS (Schedule 1 Part II) ─────────────────────────────────────

    def _adjustments(self):
        c = self.c
        inc = self.data.get("income", {}) or {}
        adj = inc.get("adjustments_to_income", {}) or {}

        # SE tax — computed from Schedule C profit
        se_profit = c.get("schedule_c_profit", 0)
        if se_profit > 0:
            se_net   = se_profit * 0.9235
            ss_base  = self.p["se_ss_wage_base"]
            ss_wages = min(c.get("wages", 0), ss_base)      # SS already paid via W-2
            ss_se    = max(0.0, min(se_net, ss_base - ss_wages) * 0.124)
            med_se   = se_net * 0.029
            c["se_tax"]           = ss_se + med_se
            c["se_tax_deduction"] = c["se_tax"] / 2.0
        else:
            c["se_tax"]           = 0.0
            c["se_tax_deduction"] = 0.0

        c["student_loan_interest"]   = _f(adj.get("student_loan_interest"))
        c["educator_expenses"]       = min(_f(adj.get("educator_expenses")), 300.0)
        c["hsa_outside_payroll"]     = _f(adj.get("hsa_contributions_outside_payroll"))
        c["se_health_insurance"]     = _f(adj.get("self_employed_health_insurance"))
        c["ira_deduction"]           = _f(adj.get("ira_deduction"))
        c["alimony_paid"]            = _f(adj.get("alimony_paid"))    # pre-2019 divorces
        c["moving_expenses_military"]= _f(adj.get("moving_expenses_military"))

        c["total_adjustments"] = (
            c["se_tax_deduction"]        + c["student_loan_interest"] +
            c["educator_expenses"]       + c["hsa_outside_payroll"]   +
            c["se_health_insurance"]     + c["ira_deduction"]          +
            c["alimony_paid"]            + c["moving_expenses_military"]
        )

    # ── AGI ──────────────────────────────────────────────────────────────────

    def _agi(self):
        c = self.c
        c["agi"] = max(0.0, c["total_income"] - c["total_adjustments"])

    # ── DEDUCTIONS ────────────────────────────────────────────────────────────

    def _deductions(self):
        c   = self.c
        fs  = self._fs()
        p   = self.p
        agi = c["agi"]

        # Standard deduction (with extra for age ≥65 / blind)
        std = p["standard_deduction"].get(fs, 15000)
        tp  = (self.data.get("household", {}) or {}).get("taxpayer", {}) or {}
        age = _f(tp.get("age"))
        married = "jointly" in fs or "separately" in fs
        extra_key = "married" if married else "single"
        if age >= 65:
            std += p["extra_deduction_65"][extra_key]
        if tp.get("blind"):
            std += p["extra_deduction_65"][extra_key]
        c["standard_deduction"] = std

        # Schedule A — itemized deductions
        c["itemized"] = self._schedule_a()
        c["using_standard"] = c["standard_deduction"] >= c["itemized"]
        c["deduction"]      = max(c["standard_deduction"], c["itemized"])

        # QBI deduction — 20% of qualified business income (§199A simplified)
        qbi = max(0.0, c.get("schedule_c_profit", 0) + c.get("k1_ordinary", 0))
        # QBI deduction limited to 20% of (taxable income before QBI - net cap gains)
        ti_before_qbi = max(0.0, agi - c["deduction"])
        ordinary_ti   = max(0.0, ti_before_qbi - c.get("qualified_dividends", 0) - c.get("ltcg", 0))
        c["qbi_deduction"] = min(qbi * 0.20, ordinary_ti * 0.20) if qbi > 0 else 0.0

    def _schedule_a(self) -> float:
        """Basic Schedule A calculation."""
        c   = self.c
        agi = c.get("agi", 0)
        data = self.data

        # SALT — capped at $10,000 (or $5,000 MFS)
        state_tax = c.get("state_withheld", 0)
        prop_tax  = sum(
            _f(p.get("property_tax_annual"))
            for p in ((data.get("real_estate", {}) or {}).get("properties", []) or [])
        )
        fs   = self._fs()
        salt_cap = 5000 if "separately" in fs else 10000
        c["salt"]              = min(state_tax + prop_tax, salt_cap)
        c["prop_tax_paid"]     = prop_tax
        c["state_tax_paid"]    = state_tax

        # Mortgage interest
        c["mortgage_interest"] = sum(
            _f(p.get("mortgage_interest_paid"))
            for p in ((data.get("real_estate", {}) or {}).get("properties", []) or [])
        )

        # Charitable contributions
        c["charitable"]        = _f((data.get("goals", {}) or {}).get("charitable_giving_annual"))

        # Medical — above 7.5% AGI floor
        c["medical_total"]     = _f((data.get("healthcare", {}) or {}).get("out_of_pocket_expenses"))
        c["medical_deductible"]= max(0.0, c["medical_total"] - agi * 0.075)

        return c["salt"] + c["mortgage_interest"] + c["charitable"] + c["medical_deductible"]

    # ── TAXABLE INCOME ────────────────────────────────────────────────────────

    def _taxable_income(self):
        c = self.c
        c["taxable_income"] = max(0.0, c["agi"] - c["deduction"] - c["qbi_deduction"])

    # ── TAX ───────────────────────────────────────────────────────────────────

    def _tax(self):
        c  = self.c
        fs = self._fs()
        ti = c["taxable_income"]

        # Preferential income (LTCG + qualified dividends) taxed at lower rates
        pref = c.get("qualified_dividends", 0) + c.get("ltcg", 0)
        ordinary = max(0.0, ti - pref)

        c["ordinary_tax"]   = self._bracket_tax(ordinary, fs)
        c["ltcg_tax"]       = self._ltcg_tax(ti, pref, fs)

        # Additional Medicare Tax 0.9% (wages + SE income above threshold)
        niit_thresh = self.p["niit_threshold"].get(
            "married_filing_jointly" if "jointly" in fs else "single", 200000
        )
        wages_and_se = c["wages"] + c.get("schedule_c_profit", 0)
        c["addl_medicare_tax"] = max(0.0, wages_and_se - niit_thresh) * 0.009

        # Net Investment Income Tax 3.8%
        nii       = (c["taxable_interest"] + c["ordinary_dividends"] +
                     c["capital_gains_net"] + c.get("schedule_e_net", 0))
        agi_over  = max(0.0, c["agi"] - niit_thresh)
        c["niit"] = min(nii, agi_over) * 0.038 if nii > 0 and agi_over > 0 else 0.0

        c["income_tax_before_credits"] = (
            c["ordinary_tax"] + c["ltcg_tax"] +
            c["addl_medicare_tax"] + c["niit"]
        )
        c["total_tax_before_credits"] = c["income_tax_before_credits"] + c["se_tax"]

    def _bracket_tax(self, income: float, fs: str) -> float:
        brackets = self.p["brackets"].get(fs, self.p["brackets"]["single"])
        tax, prev = 0.0, 0.0
        for upper, rate in brackets:
            if income <= prev:
                break
            taxable = min(income, upper) - prev
            tax    += taxable * rate
            prev    = upper
        return tax

    def _ltcg_tax(self, total_ti: float, pref: float, fs: str) -> float:
        if pref <= 0:
            return 0.0
        z_thresh, hi_thresh = self.p["ltcg_thresholds"].get(fs, (48350, 533400))
        ordinary_base = max(0.0, total_ti - pref)
        pref_start    = ordinary_base
        pref_end      = ordinary_base + pref
        tax = 0.0
        # 15% band
        band15_start = max(pref_start, z_thresh)
        band15_end   = min(pref_end,   hi_thresh)
        if band15_end > band15_start:
            tax += (band15_end - band15_start) * 0.15
        # 20% band
        band20_start = max(pref_start, hi_thresh)
        if pref_end > band20_start:
            tax += (pref_end - band20_start) * 0.20
        return max(0.0, tax)

    # ── CREDITS ───────────────────────────────────────────────────────────────

    def _credits(self):
        c   = self.c
        fs  = self._fs()
        agi = c["agi"]
        deps = (self.data.get("dependents", {}) or {}).get("dependents", []) or []

        # Child Tax Credit (§24)
        qualifying = [d for d in deps if isinstance(d, dict) and _f(d.get("age_at_year_end")) < 17]
        c["qualifying_children"]    = len(qualifying)
        ctc_raw    = len(qualifying) * self.p["child_tax_credit"]
        ctc_thresh = self.p["ctc_phaseout"].get(
            "married_filing_jointly" if "jointly" in fs else "single", 200000
        )
        phaseout   = max(0, int((agi - ctc_thresh + 999) / 1000)) * 50
        c["child_tax_credit"] = max(0.0, ctc_raw - phaseout)

        # Other dependents credit ($500 per dependent who doesn't qualify for CTC)
        other_deps = [d for d in deps if isinstance(d, dict) and _f(d.get("age_at_year_end")) >= 17]
        c["other_dependent_credit"] = min(len(other_deps) * 500, 1500)

        # Child & Dependent Care Credit (§21) — simplified
        care = sum(
            _f(d.get("daycare_cost", 0)) + _f(d.get("after_school_cost", 0)) +
            _f(d.get("summer_camp_cost", 0))
            for d in deps if isinstance(d, dict)
        )
        c["care_expenses"]    = care
        fsa_offset            = c.get("dependent_care_fsa", 0)
        eligible_care         = max(0.0, min(care - fsa_offset, 3000 if len(qualifying) == 1 else 6000))
        c["child_care_credit"]= eligible_care * 0.20   # 20% rate; income-dependent IRL

        # American Opportunity Tax Credit (§25A) — simplified
        tuition = sum(
            _f(d.get("tuition_paid", 0))
            for d in deps if isinstance(d, dict) and d.get("full_time_student")
        )
        c["tuition_expenses"]  = tuition
        c["education_credit"]  = min(tuition * 0.20, 2500)  # simplified

        # EV credit (§30D) — $7,500 new clean vehicle
        hh = self.data.get("household", {}) or {}
        c["ev_credit"] = 7500.0 if hh.get("has_electric_vehicle") else 0.0

        # Retirement Savings Credit (§25B) — placeholder
        c["saver_credit"] = 0.0

        c["total_credits"] = (
            c["child_tax_credit"]   + c["other_dependent_credit"] +
            c["child_care_credit"]  + c["education_credit"]        +
            c["ev_credit"]          + c["saver_credit"]
        )

        c["income_tax_after_credits"] = max(0.0,
            c["income_tax_before_credits"] - c["total_credits"]
        )
        c["total_tax"] = max(0.0, c["income_tax_after_credits"] + c["se_tax"])

    # ── PAYMENTS ──────────────────────────────────────────────────────────────

    def _payments(self):
        c = self.c
        hh = self.data.get("household", {}) or {}
        payments = hh.get("payments") or {}
        c["w2_withholding"]         = c["federal_withheld"]
        c["estimated_tax_payments"] = _f(hh.get("estimated_tax_payments") or payments.get("estimated_tax_payments"))
        c["other_withholding"]      = _f(hh.get("other_withholding") or payments.get("other_withholding"))
        c["total_payments"] = (
            c["w2_withholding"] + c["estimated_tax_payments"] + c["other_withholding"]
        )

    # ── BALANCE ───────────────────────────────────────────────────────────────

    def _balance(self):
        c = self.c
        net               = c["total_payments"] - c["total_tax"]
        c["refund"]       = max(0.0,  net)
        c["amount_owed"]  = max(0.0, -net)
        c["effective_rate"]  = round(c["total_tax"] / c["agi"] * 100, 2) if c["agi"] else 0.0
        c["marginal_rate"]   = self._marginal_rate()

    def _marginal_rate(self) -> float:
        fs  = self._fs()
        ti  = self.c.get("taxable_income", 0)
        for upper, rate in self.p["brackets"].get(fs, self.p["brackets"]["single"]):
            if ti <= upper:
                return round(rate * 100, 1)
        return 37.0

    def _fs(self) -> str:
        raw   = (self.data.get("household", {}) or {}).get("filing_status") or "single"
        valid = {"single", "married_filing_jointly", "married_filing_separately",
                 "head_of_household", "qualifying_surviving_spouse"}
        return raw if raw in valid else "single"


# ── IRS PDF download & fill ───────────────────────────────────────────────────

def _fetch_irs_pdf(form_key: str) -> Optional[bytes]:
    """Download an IRS fillable PDF, caching it locally. 10-second hard timeout."""
    FORM_CACHE.mkdir(parents=True, exist_ok=True)
    cached = FORM_CACHE / f"{form_key}.pdf"
    if cached.exists() and cached.stat().st_size > 5_000:
        return cached.read_bytes()
    url = IRS_FORM_URLS[form_key]
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": "UTBIS-TaxAssist/1.0 (+https://github.com)"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read()
        if len(data) < 5_000:
            raise ValueError(f"Suspiciously small response ({len(data)} bytes)")
        cached.write_bytes(data)
        return data
    except Exception as exc:
        print(f"[tax_forms] Could not download {form_key}: {exc}", file=sys.stderr)
        return None


def _fetch_all_parallel(form_keys: list[str], log) -> dict[str, Optional[bytes]]:
    """Download a set of unique IRS form keys in parallel; returns {key: bytes|None}."""
    unique = list(dict.fromkeys(form_keys))   # dedupe, preserve order
    results: dict[str, Optional[bytes]] = {}

    # Anything already cached comes back immediately without a thread
    uncached = []
    for key in unique:
        cached = FORM_CACHE / f"{key}.pdf"
        if cached.exists() and cached.stat().st_size > 5_000:
            results[key] = cached.read_bytes()
            log(f"  {key} — cached ({len(results[key]):,} bytes)")
        else:
            uncached.append(key)

    if uncached:
        log(f"Downloading {len(uncached)} IRS form(s) in parallel…")
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            futs = {pool.submit(_fetch_irs_pdf, k): k for k in uncached}
            for fut in concurrent.futures.as_completed(futs, timeout=30):
                k = futs[fut]
                try:
                    results[k] = fut.result()
                    size = len(results[k]) if results[k] else 0
                    log(f"  {k} — {'OK' if results[k] else 'failed'}" +
                        (f" ({size:,} bytes)" if size else ""))
                except Exception as exc:
                    results[k] = None
                    log(f"  {k} — error: {exc}")

    return results


def _discover_fields(pdf_bytes: bytes) -> dict:
    """Return all AcroForm field names and their current values from a PDF."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        return reader.get_fields() or {}
    except Exception:
        return {}


def _fill_pdf(pdf_bytes: bytes, field_values: dict) -> bytes:
    """
    Fill an IRS AcroForm/XFA PDF using PyMuPDF.
    field_values keys are the LEAF field names (e.g. 'f1_47[0]').
    PyMuPDF matches on the full qualified name suffix, avoiding the
    short-name ambiguity that plagued the old pypdf approach.
    """
    import fitz  # PyMuPDF
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        for widget in page.widgets():
            # leaf name = last segment of the fully-qualified XFA path
            leaf = widget.field_name.split(".")[-1]
            if leaf not in field_values:
                continue
            val = field_values[leaf]
            if val is None or val == "":
                continue
            wtype = widget.field_type_string
            if wtype == "Text":
                widget.field_value = str(val)
                widget.update()
            elif wtype in ("CheckBox", "RadioButton"):
                # "Yes"/"On" selects, anything else deselects
                widget.field_value = val if val in ("Yes", "On") else "Off"
                widget.update()
    out = io.BytesIO()
    doc.save(out, garbage=4, deflate=True)
    return out.getvalue()


# ── Field-value builders ──────────────────────────────────────────────────────
# The IRS publishes AcroForm field names.  We discover them at runtime so the
# mapping stays accurate across annual PDF revisions.

def _build_1040_fields(c: dict, data: dict) -> dict:
    """
    Map computed values to 2025 IRS Form 1040 AcroForm field names.

    Field-to-line mapping verified from the PDF's own XFA template
    (semantic label names: Ln1a, Ln2b, Ln25a, etc.) combined with
    PyMuPDF coordinate analysis to confirm physical positions.

    Page 1 layout (y = pixels from top in PyMuPDF screen coords):
      y≈48  f1_01  Taxpayer first name + initial
            f1_02  Taxpayer last name
            f1_03  Taxpayer SSN (narrow field, full value stored)
      y≈60  f1_04  Spouse first name + initial  (MFJ/MFS)
            f1_05-07  Taxpayer DECEASED date MM/DD/YYYY  ← do NOT fill
            f1_08-10  Spouse DECEASED date MM/DD/YYYY   ← do NOT fill
      y≈72  f1_11  MFS/HOH text field (qualifying child or MFS spouse name)
      y≈94  f1_14-16  Additional filing-status text fields (leave blank)
      y≈118 f1_17-19  More header text fields (leave blank)
      y≈142 f1_20  Home address    f1_21  Apt. no
      y≈166 f1_22  City   f1_23  State   f1_24  ZIP
      y≈190 f1_25-27  Foreign address (blank)
      y≈240 f1_28  MFS spouse's full name  (label: MarriedSeparately)
      y≈309 f1_31-46  Dependents table (4 rows × 4 cols)
      y≈450 f1_47  Ln1a  → f1_75  Ln11a  Income through AGI

    Page 2 (XFA label → field):
      Ln11b→f2_01  Ln12e→f2_02  Ln13a→f2_03  Ln13b→f2_04  Ln14→f2_05
      Ln15→f2_06   Ln16→f2_08   Ln17→f2_09   Ln18→f2_10   Ln19→f2_11
      Ln20→f2_12   Ln21→f2_13   Ln22→f2_14   Ln23→f2_15   Ln24→f2_16
      Ln25a→f2_17  Ln25b→f2_18  Ln25c→f2_19  Ln25d→f2_20  Ln26→f2_21
      Ln27a→f2_23  Ln28→f2_24   Ln29→f2_25   Ln30→f2_26   Ln31→f2_27
      Ln32→f2_28   Ln33→f2_29   Ln34→f2_30   Ln35a→f2_31
      routing→f2_32  account→f2_33
      Ln36→f2_34   Ln37→f2_35   Ln38→f2_36
      DesigneeName→f2_37  Phone→f2_38  PIN→f2_39
    """
    hh   = data.get("household", {}) or {}
    tp   = hh.get("taxpayer", {}) or {}
    sp   = hh.get("spouse", {}) or {}
    res  = hh.get("residence", {}) or {}
    deps = (data.get("dependents", {}) or {}).get("dependents") or []

    def m(val) -> str:
        return _fmt(val) if val else ""

    fs    = c.get("_fs", "")
    joint = bool(sp.get("present")) and fs == "married_filing_jointly"
    mfs   = fs == "married_filing_separately"
    hoh   = fs == "head_of_household"

    fields: dict = {}

    # ── PAGE 1 — Identity ───────────────────────────────────────────────────────

    fields["f1_01[0]"] = tp.get("first_name", "")   # Taxpayer first name + initial
    fields["f1_02[0]"] = tp.get("last_name", "")    # Taxpayer last name
    fields["f1_03[0]"] = tp.get("ssn", "")          # Taxpayer SSN (narrow field)

    # Spouse first name — MFJ or MFS both show a spouse name on row 2
    fields["f1_04[0]"] = sp.get("first_name", "") if (joint or mfs) else ""

    # f1_05-f1_10 are DECEASED DATE boxes (MM/DD/YYYY × 2) — leave blank

    # Filing-status text fields
    if mfs:
        # "Married filing separately — enter spouse's full name here"
        sp_full = " ".join(filter(None, [sp.get("first_name"), sp.get("last_name")]))
        fields["f1_28[0]"] = sp_full       # label: MarriedSeparately (y≈240)
    if hoh:
        # "If qualifying person is a child but not your dependent, enter name"
        fields["f1_11[0]"] = ""            # leave blank (we don't track this)

    # ── PAGE 1 — Filing status checkboxes ───────────────────────────────────────

    fs_map = {
        "c1_1[0]": "single",
        "c1_2[0]": "married_filing_jointly",
        "c1_3[0]": "married_filing_separately",
        "c1_4[0]": "head_of_household",
        "c1_5[0]": "qualifying_surviving_spouse",
    }
    for key, val in fs_map.items():
        fields[key] = "Yes" if fs == val else "Off"

    # Digital assets — c1_6=Yes answer, c1_7=No answer
    if hh.get("digital_assets"):
        fields["c1_6[0]"] = "Yes";  fields["c1_7[0]"] = "Off"
    else:
        fields["c1_6[0]"] = "Off";  fields["c1_7[0]"] = "Yes"

    # ── PAGE 1 — Address ────────────────────────────────────────────────────────

    fields["f1_20[0]"] = res.get("street_address", "")  # Home address
    # f1_21 = Apt. no — not separately tracked, leave blank
    fields["f1_22[0]"] = res.get("city", "")
    fields["f1_23[0]"] = res.get("state", "")
    fields["f1_24[0]"] = res.get("zip", "")
    # f1_25-27 = foreign address fields — leave blank

    # ── PAGE 1 — Dependents table (4 rows × first/last/SSN/relationship) ───────

    dep_rows = [
        ("f1_31[0]", "f1_32[0]", "f1_33[0]", "f1_34[0]"),
        ("f1_35[0]", "f1_36[0]", "f1_37[0]", "f1_38[0]"),
        ("f1_39[0]", "f1_40[0]", "f1_41[0]", "f1_42[0]"),
        ("f1_43[0]", "f1_44[0]", "f1_45[0]", "f1_46[0]"),
    ]
    for i, (fn, ln, ssn_f, rel) in enumerate(dep_rows):
        if i < len(deps):
            d = deps[i]
            name_parts = ((d.get("name") or "")).strip().split(None, 1)
            fields[fn]    = name_parts[0] if name_parts else ""
            fields[ln]    = name_parts[1] if len(name_parts) > 1 else ""
            fields[ssn_f] = d.get("ssn", "")
            fields[rel]   = (d.get("relationship") or "").replace("_", " ").title()

    # ── PAGE 1 — Income (XFA labels confirmed: Ln1a → f1_47 … Ln11a → f1_75) ──

    fields["f1_47[0]"] = m(c.get("wages"))                # Ln1a  W-2 wages
    fields["f1_57[0]"] = m(c.get("wages"))                # Ln1z  Total wages (= 1a for most)
    fields["f1_58[0]"] = ""                               # Ln2a  Tax-exempt interest (blank)
    fields["f1_59[0]"] = m(c.get("taxable_interest"))     # Ln2b  Taxable interest
    fields["f1_60[0]"] = m(c.get("qualified_dividends"))  # Ln3a  Qualified dividends
    fields["f1_61[0]"] = m(c.get("ordinary_dividends"))   # Ln3b  Ordinary dividends
    fields["f1_62[0]"] = m(c.get("ira_gross"))            # Ln4a  IRA gross
    fields["f1_63[0]"] = m(c.get("ira_taxable"))          # Ln4b  IRA taxable
    fields["f1_65[0]"] = m(c.get("pension_gross"))        # Ln5a  Pensions & annuities gross
    fields["f1_66[0]"] = m(c.get("pension_taxable"))      # Ln5b  Pensions taxable
    fields["f1_68[0]"] = m(c.get("ss_gross"))             # Ln6a  Social security gross
    fields["f1_69[0]"] = m(c.get("ss_taxable"))           # Ln6b  Social security taxable
    fields["f1_70[0]"] = m(c.get("capital_gains_net"))    # Ln7a  Capital gains
    fields["f1_72[0]"] = m(c.get("schedule1_additional")) # Ln8   Additional income (Sch 1)
    fields["f1_73[0]"] = m(c.get("total_income"))         # Ln9   Total income
    fields["f1_74[0]"] = m(c.get("total_adjustments"))    # Ln10  Adjustments to income
    fields["f1_75[0]"] = m(c.get("agi"))                  # Ln11a AGI

    # ── PAGE 2 — Tax and deductions (XFA confirmed) ─────────────────────────────

    fields["f2_01[0]"] = m(c.get("agi"))                  # Ln11b  AGI (carry-over)

    # Standard deduction extra checkboxes
    dob  = tp.get("dob") or ""
    sdob = (sp.get("dob") or "") if (joint or mfs) else ""
    fields["c2_5[0]"] = "Yes" if (dob  and dob  < "1961-01-02") else "Off"
    fields["c2_6[0]"] = "Yes" if (sdob and sdob < "1961-01-02") else "Off"
    fields["c2_7[0]"] = "Yes" if tp.get("blind") else "Off"
    fields["c2_8[0]"] = "Yes" if (sp.get("blind") if (joint or mfs) else False) else "Off"

    deduction     = c.get("itemized") if not c.get("using_standard", True) else c.get("standard_deduction")
    total_deduct  = (deduction or 0) + (c.get("qbi_deduction") or 0)

    fields["f2_02[0]"] = m(deduction)                          # Ln12e Standard or itemized
    fields["f2_03[0]"] = m(c.get("qbi_deduction"))             # Ln13a QBI deduction
    # f2_04 = Ln13b (additional deductions from Sch 1-A) — not tracked
    fields["f2_05[0]"] = m(total_deduct)                       # Ln14  Total deductions
    fields["f2_06[0]"] = m(c.get("taxable_income"))            # Ln15  Taxable income
    fields["f2_08[0]"] = m(c.get("income_tax_before_credits")) # Ln16  Tax
    # f2_09 = Ln17 (Sch 2 line 3 additional tax) — zero for standard returns
    fields["f2_10[0]"] = m(c.get("income_tax_before_credits")) # Ln18  Lines 16+17
    fields["f2_11[0]"] = m(c.get("total_credits"))             # Ln19  Credits from Sch 8812
    # f2_12 = Ln20 (Sch 3 line 8) — zero for standard returns
    fields["f2_13[0]"] = m(c.get("total_credits"))             # Ln21  Total credits
    fields["f2_14[0]"] = m(c.get("income_tax_after_credits"))  # Ln22  Tax after credits
    fields["f2_15[0]"] = m(c.get("se_tax"))                    # Ln23  Other taxes (SE tax)
    fields["f2_16[0]"] = m(c.get("total_tax"))                 # Ln24  Total tax

    # ── PAGE 2 — Payments (XFA confirmed: f2_28=Ln32, f2_29=Ln33, etc.) ────────

    total_withholding = (c.get("w2_withholding") or 0) + (c.get("other_withholding") or 0)

    fields["f2_17[0]"] = m(c.get("w2_withholding"))            # Ln25a W-2 withholding
    fields["f2_18[0]"] = m(c.get("other_withholding"))         # Ln25b 1099/other withholding
    # f2_19 = Ln25c (other forms) — leave blank
    fields["f2_20[0]"] = m(total_withholding)                  # Ln25d Total withholding
    fields["f2_21[0]"] = m(c.get("estimated_tax_payments"))    # Ln26  Estimated payments
    # f2_22 = former-spouse SSN instruction text field (skip)
    # f2_23 = Ln27a EIC, f2_24 = Ln28 ACTC, f2_25 = Ln29 AOC (not computed)
    # f2_26 = Ln30 refundable adoption, f2_27 = Ln31 Sch 3 line 15 (not computed)
    fields["f2_28[0]"] = ""                                    # Ln32  Other refundable credits total
    fields["f2_29[0]"] = m(c.get("total_payments"))            # Ln33  TOTAL PAYMENTS
    fields["f2_30[0]"] = m(c.get("refund") or 0)              # Ln34  Amount overpaid
    fields["f2_31[0]"] = m(c.get("refund"))                    # Ln35a Refund amount

    # Direct deposit (y≈504/516, confirmed by PyMuPDF coordinate analysis)
    fields["f2_32[0]"] = c.get("_routing", "")                # Ln35b Routing number
    fields["f2_33[0]"] = c.get("_account", "")                # Ln35d Account number
    # c2_16 = Line 35c checking/savings radio
    fields["c2_16[0]"] = "Yes" if c.get("_dd_type") == "checking" else "Off"
    fields["c2_16[1]"] = "Yes" if c.get("_dd_type") == "savings"  else "Off"

    fields["f2_34[0]"] = ""                                    # Ln36  Applied to 2026 est tax
    fields["f2_35[0]"] = m(c.get("amount_owed"))               # Ln37  Amount owed
    fields["f2_36[0]"] = ""                                    # Ln38  Penalty (not computed)

    # Third-party designee (y≈594, label: DesigneesName / PhoneNo / PersonalIdentificationNo)
    fields["f2_37[0]"] = c.get("_designee_name", "")
    fields["f2_38[0]"] = c.get("_designee_phone", "")
    fields["f2_39[0]"] = c.get("_designee_pin", "")

    return fields


def _build_sch_se_fields(c: dict) -> dict:
    se_profit = c.get("schedule_c_profit", 0)
    se_net    = se_profit * 0.9235
    return {
        "f1_01[0]": _fmt(se_profit),   # Part I Line 2 (short form for most)
        "f1_02[0]": _fmt(se_net),
        "f1_03[0]": _fmt(c.get("se_tax", 0)),
        "f1_04[0]": _fmt(c.get("se_tax_deduction", 0)),
    }


def _build_sch_c_fields(biz: dict) -> dict:
    return {
        "f1_01[0]": biz.get("business_name", ""),
        "f1_03[0]": biz.get("naics", ""),
        "f1_05[0]": biz.get("ein", ""),
        "f1_11[0]": _fmt(biz["gross_revenue"]),
        "f1_28[0]": _fmt(biz["expenses"]),
        "f1_29[0]": _fmt(biz["net_profit_loss"]),
    }


def _build_sch_e_fields(c: dict) -> dict:
    fields = {}
    for i, prop in enumerate(c.get("schedule_e_records", [])[:3]):
        prefix = f"f1_{(i * 10 + 1):02d}[0]"
        fields[f"f1_{(i + 1):02d}[0]"] = prop.get("property_address", "")
        fields[f"f1_{(i + 10):02d}[0]"] = _fmt(_f(prop.get("gross_rents")))
        fields[f"f1_{(i + 20):02d}[0]"] = _fmt(_f(prop.get("net_income_loss")))
    fields["f2_01[0]"] = _fmt(c.get("schedule_e_net", 0))
    return fields


def _build_sch_b_fields(c: dict) -> dict:
    return {
        "f1_01[0]": _fmt(c.get("taxable_interest")),
        "f1_02[0]": _fmt(c.get("ordinary_dividends")),
        "f1_03[0]": _fmt(c.get("qualified_dividends")),
    }


# ── Reportlab summary PDF ─────────────────────────────────────────────────────

def _build_summary_pdf(c: dict, data: dict, tax_year: int, display_name: str) -> bytes:
    """
    Generate a professional data-summary PDF using reportlab.
    This is the primary CPA-ready deliverable.
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        HRFlowable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )

    buf  = io.BytesIO()
    doc  = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=0.85*inch, rightMargin=0.85*inch,
        topMargin=0.85*inch,  bottomMargin=0.85*inch,
    )
    styles = getSampleStyleSheet()
    hh     = data.get("household", {}) or {}

    # ── Custom paragraph styles ───────────────────────────────────────────────
    title_style = ParagraphStyle(
        "Title2", parent=styles["Title"], fontSize=20, spaceAfter=4,
        textColor=colors.HexColor("#1a1a2e"),
    )
    h1 = ParagraphStyle(
        "H1", parent=styles["Heading1"], fontSize=13, spaceBefore=14, spaceAfter=4,
        textColor=colors.HexColor("#1e3a5f"),
    )
    h2 = ParagraphStyle(
        "H2", parent=styles["Heading2"], fontSize=11, spaceBefore=10, spaceAfter=3,
        textColor=colors.HexColor("#2c5f8a"),
    )
    body = ParagraphStyle(
        "Body2", parent=styles["Normal"], fontSize=9, leading=13,
    )
    caption = ParagraphStyle(
        "Caption", parent=styles["Normal"], fontSize=8, textColor=colors.gray,
    )
    warn = ParagraphStyle(
        "Warn", parent=styles["Normal"], fontSize=8,
        textColor=colors.HexColor("#b84b00"), leading=12,
    )

    story = []

    # ── Cover page ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("Federal Tax Return Data Package", title_style))
    story.append(Paragraph(f"Tax Year {tax_year} — For CPA Review", h2))
    story.append(Spacer(1, 0.2*inch))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1e3a5f")))
    story.append(Spacer(1, 0.15*inch))

    tp = hh.get("taxpayer") or {}
    sp = hh.get("spouse") or {}
    tp_name = " ".join(filter(None, [tp.get("first_name"), tp.get("last_name")])) or display_name or "Taxpayer"
    sp_name = " ".join(filter(None, [sp.get("first_name"), sp.get("last_name")]))
    tp_ssn  = tp.get("ssn") or ""
    sp_ssn  = sp.get("ssn") or ""
    res     = hh.get("residence") or {}
    address_parts = filter(None, [
        res.get("street_address"),
        res.get("city"),
        res.get("state"),
        res.get("zip"),
    ])
    address_str = ", ".join(address_parts) or "—"

    meta_data = [
        ["Taxpayer:",      tp_name + (f"  SSN: {tp_ssn}" if tp_ssn else "")],
    ]
    if sp_name or sp_ssn:
        meta_data.append(["Spouse:",   sp_name + (f"  SSN: {sp_ssn}" if sp_ssn else "")])
    meta_data += [
        ["Address:",       address_str],
        ["Filing Status:", (c.get("_fs") or hh.get("filing_status") or "—").replace("_", " ").title()],
        ["Tax Year:",      str(tax_year)],
        ["Generated:",     datetime.now().strftime("%B %d, %Y at %I:%M %p")],
        ["Software:",      "UTBIS — Universal Tax Benefit Intelligence System"],
    ]
    meta_tbl = Table(meta_data, colWidths=[1.6*inch, 4.5*inch])
    meta_tbl.setStyle(TableStyle([
        ("FONTSIZE",    (0,0), (-1,-1), 9),
        ("FONTNAME",    (0,0), (0,-1), "Helvetica-Bold"),
        ("TEXTCOLOR",   (0,0), (0,-1), colors.HexColor("#1e3a5f")),
        ("ROWBACKGROUNDS",(0,0),(-1,-1),[colors.white, colors.HexColor("#f4f7fb")]),
        ("TOPPADDING",  (0,0), (-1,-1), 4),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
        ("LEFTPADDING", (0,0), (0,-1), 4),
        ("GRID",        (0,0), (-1,-1), 0.25, colors.HexColor("#d0d8e4")),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph(
        "⚠️  IMPORTANT: This document is a data summary prepared for professional review. "
        "All figures are based on information entered by the taxpayer and require CPA "
        "verification before filing. Items marked [CPA REVIEW] require professional judgment.",
        warn,
    ))
    story.append(PageBreak())

    # ── Helper: line-item table ───────────────────────────────────────────────
    def _section_table(rows, highlight_total=True):
        tbl_data = []
        for row in rows:
            if len(row) == 3:
                line, desc, amt = row
                tbl_data.append([
                    Paragraph(str(line), caption),
                    Paragraph(str(desc), body),
                    Paragraph(str(amt),  body),
                ])
            elif len(row) == 2:
                tbl_data.append([
                    "",
                    Paragraph(str(row[0]), body),
                    Paragraph(str(row[1]), body),
                ])
        tbl = Table(tbl_data, colWidths=[0.55*inch, 4.5*inch, 1.2*inch])
        ts  = [
            ("FONTSIZE",    (0,0), (-1,-1), 9),
            ("TOPPADDING",  (0,0), (-1,-1), 3),
            ("BOTTOMPADDING",(0,0),(-1,-1), 3),
            ("ALIGN",       (2,0), (2,-1), "RIGHT"),
            ("GRID",        (0,0), (-1,-1), 0.25, colors.HexColor("#e0e4ec")),
            ("ROWBACKGROUNDS",(0,0),(-1,-1),[colors.white, colors.HexColor("#f8f9fc")]),
        ]
        if highlight_total and tbl_data:
            ts += [
                ("FONTNAME",    (0,-1), (-1,-1), "Helvetica-Bold"),
                ("BACKGROUND",  (0,-1), (-1,-1), colors.HexColor("#eaf0fb")),
            ]
        tbl.setStyle(TableStyle(ts))
        return tbl

    # ── Form 1040 Summary ─────────────────────────────────────────────────────
    story.append(Paragraph("Form 1040 — Income Tax Summary", h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#aac4e0")))

    story.append(Paragraph("INCOME", h2))
    income_rows = [
        ["1a",  "Wages, salaries, tips (W-2)",                              _fmt(c.get("wages"))],
        ["2b",  "Taxable interest income",                                   _fmt(c.get("taxable_interest"))],
        ["3a",  "Qualified dividends",                                        _fmt(c.get("qualified_dividends"))],
        ["3b",  "Ordinary dividends",                                         _fmt(c.get("ordinary_dividends"))],
        ["4a/b","IRA distributions (gross / taxable)",                        f"{_fmt(c.get('ira_gross'))} / {_fmt(c.get('ira_taxable'))}"],
        ["5a/b","Pensions & annuities (gross / taxable)",                     f"{_fmt(c.get('pension_gross'))} / {_fmt(c.get('pension_taxable'))}"],
        ["6a/b","Social security (gross / taxable)",                          f"{_fmt(c.get('ss_gross'))} / {_fmt(c.get('ss_taxable'))}"],
        ["7",   "Capital gain or (loss)  [ST: " + _fmt(c.get("stcg")) + "  LT: " + _fmt(c.get("ltcg")) + "]",
                                                                              _fmt(c.get("capital_gains_net"))],
        ["8",   "Other income (Schedule 1)",                                  _fmt(c.get("schedule1_additional"))],
        ["9",   "TOTAL INCOME",                                               _fmt(c.get("total_income"))],
    ]
    story.append(_section_table(income_rows))

    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph("ADJUSTMENTS TO INCOME (Schedule 1, Part II)", h2))
    adj_rows = [
        ["",  "½ self-employment tax deduction",                          _fmt(c.get("se_tax_deduction"))],
        ["",  "Self-employed health insurance deduction",                   _fmt(c.get("se_health_insurance"))],
        ["",  "Student loan interest deduction",                            _fmt(c.get("student_loan_interest"))],
        ["",  "Educator expenses",                                          _fmt(c.get("educator_expenses"))],
        ["",  "HSA contributions (outside payroll)",                        _fmt(c.get("hsa_outside_payroll"))],
        ["",  "IRA deduction",                                              _fmt(c.get("ira_deduction"))],
        ["",  "Alimony paid (pre-2019 divorce)  [CPA REVIEW]",             _fmt(c.get("alimony_paid"))],
        ["",  "Moving expenses (military only)",                            _fmt(c.get("moving_expenses_military"))],
        ["10","TOTAL ADJUSTMENTS",                                          _fmt(c.get("total_adjustments"))],
        ["11","ADJUSTED GROSS INCOME (AGI)",                                _fmt(c.get("agi"))],
    ]
    story.append(_section_table(adj_rows))

    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph("DEDUCTIONS & TAXABLE INCOME", h2))
    fs_label = (c.get("_fs") or hh.get("filing_status") or "").replace("_", " ").title()
    std_note = f"Standard (${c.get('standard_deduction', 0):,.0f} — {fs_label})"
    item_note = f"Itemized (${c.get('itemized', 0):,.0f} — Schedule A)"
    deduction_used = std_note if c.get("using_standard") else item_note
    ded_rows = [
        ["12", f"Deduction used: {deduction_used}",                         _fmt(c.get("deduction"))],
        ["13", "Qualified Business Income (QBI) deduction (§199A)",          _fmt(c.get("qbi_deduction"))],
        ["15", "TAXABLE INCOME",                                              _fmt(c.get("taxable_income"))],
    ]
    story.append(_section_table(ded_rows))

    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph("TAX COMPUTATION", h2))
    tax_rows = [
        ["16", "Income tax (ordinary brackets)",                              _fmt(c.get("ordinary_tax"))],
        ["",   f"Long-term capital gains / qualified dividend tax",           _fmt(c.get("ltcg_tax"))],
        ["",   "Additional Medicare Tax (0.9%) — wages/SE over threshold",    _fmt(c.get("addl_medicare_tax"))],
        ["",   "Net Investment Income Tax (3.8%)",                            _fmt(c.get("niit"))],
        ["17", "Income tax before credits",                                   _fmt(c.get("income_tax_before_credits"))],
        ["",   "Self-employment tax (Schedule SE)",                           _fmt(c.get("se_tax"))],
        ["24", "TOTAL TAX BEFORE CREDITS",                                    _fmt(c.get("total_tax_before_credits"))],
    ]
    story.append(_section_table(tax_rows))

    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph("CREDITS", h2))
    credit_rows = [
        ["19", f"Child Tax Credit ({c.get('qualifying_children', 0)} qualifying children × ${c.get('p_ctc', 2000):,})",
                                                                              _fmt(c.get("child_tax_credit"))],
        ["",   "Credit for other dependents",                                 _fmt(c.get("other_dependent_credit"))],
        ["",   f"Child and Dependent Care Credit (qualified expenses: ${c.get('care_expenses', 0):,.0f})",
                                                                              _fmt(c.get("child_care_credit"))],
        ["",   f"Education credit (AOTC — tuition paid: ${c.get('tuition_expenses', 0):,.0f})  [CPA REVIEW]",
                                                                              _fmt(c.get("education_credit"))],
        ["",   "Clean Vehicle Credit (§30D)",                                 _fmt(c.get("ev_credit"))],
        ["",   "Retirement Savings Credit (Saver's Credit)  [CPA REVIEW]",   _fmt(c.get("saver_credit"))],
        ["21", "TOTAL CREDITS",                                               _fmt(c.get("total_credits"))],
        ["24", "INCOME TAX AFTER CREDITS",                                    _fmt(c.get("income_tax_after_credits"))],
        ["",   "Self-employment tax",                                         _fmt(c.get("se_tax"))],
        ["24", "TOTAL TAX",                                                   _fmt(c.get("total_tax"))],
    ]
    story.append(_section_table(credit_rows))

    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph("PAYMENTS & BALANCE DUE", h2))
    payment_rows = [
        ["25a", "Federal income tax withheld (W-2)",                          _fmt(c.get("w2_withholding"))],
        ["25b", "Federal income tax withheld (1099s / other)",                _fmt(c.get("other_withholding"))],
        ["26",  "Estimated tax payments",                                      _fmt(c.get("estimated_tax_payments"))],
        ["33",  "TOTAL PAYMENTS",                                              _fmt(c.get("total_payments"))],
        ["34",  "REFUND" if c.get("refund") else "Amount owed",
                                                                              ("+" if c.get("refund") else "−") +
                                                                               _fmt(c.get("refund") or c.get("amount_owed"))],
    ]
    story.append(_section_table(payment_rows))

    # Summary box
    story.append(Spacer(1, 0.15*inch))
    summary_data = [
        ["Effective Tax Rate", f"{c.get('effective_rate', 0):.1f}%"],
        ["Marginal Tax Rate",  f"{c.get('marginal_rate', 0):.1f}%"],
        ["AGI",                f"${c.get('agi', 0):,.0f}"],
        ["Total Tax",          f"${c.get('total_tax', 0):,.0f}"],
        ["RESULT", ("REFUND  $" + f"{c.get('refund', 0):,.0f}") if c.get("refund")
                   else ("DUE    $" + f"{c.get('amount_owed', 0):,.0f}")],
    ]
    sum_tbl = Table(summary_data, colWidths=[2.5*inch, 2*inch])
    sum_tbl.setStyle(TableStyle([
        ("FONTSIZE",    (0,0), (-1,-1), 10),
        ("FONTNAME",    (0,0), (-1,-1), "Helvetica-Bold"),
        ("TEXTCOLOR",   (0,0), (0,-1), colors.HexColor("#1e3a5f")),
        ("BACKGROUND",  (0,-1), (-1,-1), colors.HexColor(
            "#d4edda" if c.get("refund") else "#f8d7da"
        )),
        ("ROWBACKGROUNDS",(0,0),(-2,-2),[colors.HexColor("#eaf0fb"), colors.HexColor("#f4f7fb")]),
        ("GRID",        (0,0), (-1,-1), 0.5, colors.HexColor("#aac4e0")),
        ("TOPPADDING",  (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 5),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
    ]))
    story.append(sum_tbl)

    # ── Schedule A (itemized) ─────────────────────────────────────────────────
    if not c.get("using_standard") or c.get("itemized", 0) > 0:
        story.append(PageBreak())
        story.append(Paragraph("Schedule A — Itemized Deductions", h1))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#aac4e0")))
        sa_rows = [
            ["1",  "Medical and dental expenses (total)",                     _fmt(c.get("medical_total"))],
            ["3",  "Medical expenses above 7.5% AGI floor",                   _fmt(c.get("medical_deductible"))],
            ["5e", "State and local income taxes withheld",                    _fmt(c.get("state_tax_paid"))],
            ["5b", "Real estate taxes",                                        _fmt(c.get("prop_tax_paid"))],
            ["5d", "SALT total (capped $10,000 / $5,000 MFS)",               _fmt(c.get("salt"))],
            ["8a", "Home mortgage interest",                                   _fmt(c.get("mortgage_interest"))],
            ["12", "Charitable contributions  [CPA REVIEW — substantiation]", _fmt(c.get("charitable"))],
            ["17", "TOTAL ITEMIZED DEDUCTIONS",                               _fmt(c.get("itemized"))],
        ]
        story.append(_section_table(sa_rows))
        if c.get("using_standard"):
            story.append(Spacer(1, 0.08*inch))
            story.append(Paragraph(
                "Note: Standard deduction used because it exceeds itemized total. "
                "Itemized detail is provided for CPA review only.",
                caption,
            ))

    # ── Schedule B ────────────────────────────────────────────────────────────
    if c.get("taxable_interest", 0) + c.get("ordinary_dividends", 0) > 0:
        story.append(PageBreak())
        story.append(Paragraph("Schedule B — Interest and Ordinary Dividends", h1))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#aac4e0")))
        sb_rows = [
            ["Part I", "Taxable interest income",          _fmt(c.get("taxable_interest"))],
            ["Part II","Ordinary dividends",               _fmt(c.get("ordinary_dividends"))],
            ["",       "  of which qualified dividends",   _fmt(c.get("qualified_dividends"))],
        ]
        story.append(_section_table(sb_rows, highlight_total=False))
        story.append(Spacer(1, 0.08*inch))
        story.append(Paragraph(
            "[CPA REVIEW] Enter payer names, EINs, and individual amounts on the "
            "official Schedule B. Foreign account and trust questions on Schedule B Part III "
            "require taxpayer answers.",
            warn,
        ))

    # ── Schedule C (one per business) ─────────────────────────────────────────
    for biz in c.get("schedule_c_records", []):
        story.append(PageBreak())
        story.append(Paragraph(
            f"Schedule C — Profit or Loss From Business: {biz['business_name']}", h1
        ))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#aac4e0")))
        sc_rows = [
            ["A",   "Business name",           biz.get("business_name", "")],
            ["B",   "Principal business code (NAICS)", biz.get("naics", "[CPA: enter code]")],
            ["C",   "Entity type",             biz.get("entity_type", "").replace("_", " ").title()],
            ["D",   "EIN",                     biz.get("ein") or "[not provided]"],
            ["1",   "Gross receipts / sales",  _fmt(biz.get("gross_revenue"))],
            ["28",  "Total expenses",          _fmt(biz.get("expenses"))],
            ["31",  "Net profit or (loss)",    _fmt(biz.get("net_profit_loss"))],
        ]
        if biz.get("home_office"):
            sc_rows.append(["", "⚑ Home office deduction may apply — Form 8829 required  [CPA REVIEW]", ""])
        story.append(_section_table(sc_rows, highlight_total=False))
        story.append(Spacer(1, 0.08*inch))
        story.append(Paragraph(
            "[CPA REVIEW] Expense line items (advertising, car/truck, depreciation, insurance, "
            "meals, supplies, utilities, etc.) must be populated from receipts and records. "
            "Business-use vehicle mileage logs should be provided.",
            warn,
        ))

    # ── Schedule D ────────────────────────────────────────────────────────────
    if c.get("capital_gains_net", 0) != 0 or c.get("stcg", 0) != 0 or c.get("ltcg", 0) != 0:
        story.append(PageBreak())
        story.append(Paragraph("Schedule D — Capital Gains and Losses", h1))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#aac4e0")))
        sd_rows = [
            ["Part I",  "Short-term net gain / (loss)",    _fmt(c.get("stcg"))],
            ["Part II", "Long-term net gain / (loss)",     _fmt(c.get("ltcg"))],
            ["16",      "Net capital gain / (loss) total", _fmt(c.get("capital_gains_net"))],
        ]
        story.append(_section_table(sd_rows, highlight_total=False))
        story.append(Spacer(1, 0.08*inch))
        story.append(Paragraph(
            "[CPA REVIEW] Individual transaction detail must be entered on Schedule D / Form 8949. "
            "Brokerage 1099-B statements and cost-basis records are required.",
            warn,
        ))

    # ── Schedule E ────────────────────────────────────────────────────────────
    if c.get("schedule_e_records"):
        story.append(PageBreak())
        story.append(Paragraph("Schedule E — Supplemental Income and Loss (Rental)", h1))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#aac4e0")))
        for prop in c.get("schedule_e_records", []):
            se_rows = [
                ["A",  "Property address",     prop.get("property_address", "")],
                ["3",  "Gross rents received", _fmt(_f(prop.get("gross_rents")))],
                ["21", "Net income / (loss)",  _fmt(_f(prop.get("net_income_loss")))],
            ]
            story.append(_section_table(se_rows, highlight_total=False))
            story.append(Spacer(1, 0.08*inch))
        story.append(Paragraph(
            "[CPA REVIEW] Itemized expense detail (advertising, insurance, mortgage interest, "
            "repairs, taxes, depreciation, etc.) must be completed. Depreciation schedules and "
            "Form 4562 may be required.",
            warn,
        ))

    # ── Schedule SE ───────────────────────────────────────────────────────────
    if c.get("se_tax", 0) > 0:
        story.append(PageBreak())
        story.append(Paragraph("Schedule SE — Self-Employment Tax", h1))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#aac4e0")))
        se_profit = c.get("schedule_c_profit", 0)
        se_net    = se_profit * 0.9235
        sse_rows = [
            ["2",  "Net profit from Schedule C",                   _fmt(se_profit)],
            ["3",  "Net earnings subject to SE tax (× 0.9235)",    _fmt(se_net)],
            ["5",  "Self-employment tax (15.3% / 12.4% SS + 2.9%)",_fmt(c.get("se_tax"))],
            ["6",  "Deduction for ½ of SE tax (→ Schedule 1)",     _fmt(c.get("se_tax_deduction"))],
        ]
        story.append(_section_table(sse_rows))

    # ── CPA Notes ─────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("Items Requiring CPA Judgment", h1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#aac4e0")))
    notes = [
        "GENERAL",
        "• All figures are taxpayer-provided estimates. Reconcile against actual W-2s, 1099s, and brokerage statements.",
        "• This package does not include state return calculations. Prepare state return based on federal AGI.",
        "• AMT (Form 6251) applicability should be evaluated — estimated AGI may trigger analysis.",
        "INCOME",
        "• Verify all employer EINs and W-2 box amounts match official employer records.",
        "• Social security taxable portion calculated using combined income rule (IRC §86); verify with SSA-1099.",
        "• Retirement distribution taxability depends on prior nondeductible IRA basis (Form 8606) — confirm.",
        "DEDUCTIONS",
        "• Charitable deduction requires contemporaneous written acknowledgment for gifts ≥ $250.",
        "• Mortgage interest deduction subject to acquisition debt limits (§163(h)); verify against Form 1098.",
        "• QBI deduction (§199A) simplified here — W-2 wages and UBIA of qualified property tests may apply at higher income levels.",
        "CREDITS",
        "• Education credits (AOTC/LLC) subject to income phase-outs; Form 1098-T required; CPA to choose optimal credit.",
        "• Child care credit rate (20% used here) is income-dependent — adjust per §21 tables.",
        "• Saver's Credit (§25B) may apply if income is within limits — not computed; CPA to evaluate.",
        "• EV credit subject to MSRP limits, taxpayer income limits, and dealer attestation requirements.",
        "SCHEDULES",
        "• Schedule C expense detail must be completed from receipts; home office requires Form 8829.",
        "• Schedule D requires Form 8949 transaction detail; wash-sale rules apply.",
        "• Schedule E depreciation must continue from prior-year schedules; Form 4562 required.",
        "ESTIMATED TAXES",
        "• Evaluate 2026 estimated tax payment obligation based on final tax liability.",
        "• Penalty for underpayment (Form 2210) should be computed if applicable.",
    ]
    for note in notes:
        if note == note.upper() and not note.startswith("•"):
            story.append(Spacer(1, 0.08*inch))
            story.append(Paragraph(note, h2))
        else:
            story.append(Paragraph(note, body if note.startswith("•") else body))

    doc.build(story)
    return buf.getvalue()


# ── Compute-only helper (no PDF generation, instant) ─────────────────────────

def generate_preview_pdf(user_id: str, tax_year: int) -> bytes:
    """
    Return a filled Form 1040 PDF as bytes.
    Uses the cached IRS base form if available (~instant); downloads on first call (~10 s).
    Raises ValueError if the IRS PDF cannot be fetched.
    """
    init_db()
    data = get_all_user_data(user_id, tax_year)

    calc = TaxCalculator(data, tax_year)
    c    = calc.compute()
    c["_fs"]   = calc._fs()
    c["p_ctc"] = _params(tax_year)["child_tax_credit"]

    fd = get_filing_details(user_id, tax_year)
    c["_routing"]        = fd.get("direct_deposit_routing", "")
    c["_account"]        = fd.get("direct_deposit_account", "")
    c["_dd_type"]        = fd.get("direct_deposit_type", "")
    c["_designee_name"]  = fd.get("designee_name", "") if fd.get("allow_third_party") else ""
    c["_designee_phone"] = fd.get("designee_phone", "") if fd.get("allow_third_party") else ""
    c["_designee_pin"]   = fd.get("designee_pin", "") if fd.get("allow_third_party") else ""

    fields    = _build_1040_fields(c, data)
    pdf_bytes = _fetch_irs_pdf("f1040")
    if not pdf_bytes:
        raise ValueError(
            "Could not retrieve Form 1040 from IRS. "
            "Check your internet connection or generate the full ZIP first to populate the cache."
        )
    return _fill_pdf(pdf_bytes, fields)


def compute_tax_figures(user_id: str, tax_year: int) -> dict:
    """
    Run TaxCalculator against the DB and return the full computed dict.
    No PDFs are generated — suitable for the review-before-download flow.
    """
    init_db()
    data = get_all_user_data(user_id, tax_year)
    user = get_user_by_id(user_id) or {}

    calc = TaxCalculator(data, tax_year)
    c    = calc.compute()
    fs   = calc._fs()
    c["_fs"]   = fs
    c["p_ctc"] = _params(tax_year)["child_tax_credit"]

    # Flags consumed by the frontend to know which schedules are relevant
    c["_need_sch_a"]  = not c.get("using_standard", True)
    c["_need_sch_b"]  = c.get("taxable_interest", 0) + c.get("ordinary_dividends", 0) > 0
    c["_need_sch_c"]  = bool(c.get("schedule_c_records"))
    c["_need_sch_d"]  = c.get("capital_gains_net", 0) != 0 or c.get("stcg", 0) != 0 or c.get("ltcg", 0) != 0
    c["_need_sch_e"]  = bool(c.get("schedule_e_records"))
    c["_need_sch_se"] = c.get("se_tax", 0) > 0

    return {
        "tax_year":     tax_year,
        "display_name": user.get("display_name") or user.get("email", ""),
        "filing_status": fs.replace("_", " ").title(),
        "computed":     c,
    }


# ── Main generator ────────────────────────────────────────────────────────────

class FormPackageGenerator:
    """
    Orchestrates downloading IRS PDFs, filling them, generating the summary,
    and bundling everything into a ZIP.
    """

    def __init__(self, user_id: str, tax_year: int):
        self.user_id  = user_id
        self.tax_year = tax_year

    def generate(self, progress_cb=None) -> str:
        """
        Generate the full tax form package.
        Returns the absolute path to the created ZIP file.
        """
        PKG_DIR.mkdir(parents=True, exist_ok=True)

        def _log(msg: str):
            print(f"[tax_forms] {msg}", file=sys.stderr)
            if progress_cb:
                progress_cb(msg)

        _log("Loading user data…")
        init_db()
        data = get_all_user_data(self.user_id, self.tax_year)
        user = get_user_by_id(self.user_id) or {}
        display_name = user.get("display_name") or user.get("email", "")

        _log("Computing tax figures…")
        calc = TaxCalculator(data, self.tax_year)
        c    = calc.compute()
        fs   = calc._fs()
        c["_fs"]   = fs
        c["p_ctc"] = _params(self.tax_year)["child_tax_credit"]

        # Inject filing details (direct deposit, designee) for PDF field filling
        fd = get_filing_details(self.user_id, self.tax_year)
        c["_routing"]        = fd.get("direct_deposit_routing", "")
        c["_account"]        = fd.get("direct_deposit_account", "")
        c["_dd_type"]        = fd.get("direct_deposit_type", "")
        c["_designee_name"]  = fd.get("designee_name", "") if fd.get("allow_third_party") else ""
        c["_designee_phone"] = fd.get("designee_phone", "") if fd.get("allow_third_party") else ""
        c["_designee_pin"]   = fd.get("designee_pin", "") if fd.get("allow_third_party") else ""

        _log("Generating data summary PDF…")
        summary_bytes = _build_summary_pdf(c, data, self.tax_year, display_name)

        # Determine which IRS schedules are needed
        need_sch1  = c["total_adjustments"] > 0 or c["schedule1_additional"] != 0
        need_sch_a = not c.get("using_standard", True)
        need_sch_b = c["taxable_interest"] + c["ordinary_dividends"] > 1500
        need_sch_c = bool(c.get("schedule_c_records"))
        need_sch_d = c["capital_gains_net"] != 0 or c["stcg"] != 0 or c["ltcg"] != 0
        need_sch_e = bool(c.get("schedule_e_records"))
        need_sch_se= c["se_tax"] > 0

        forms_to_fetch: list[tuple[str, dict]] = [("f1040", _build_1040_fields(c, data))]
        if need_sch1:  forms_to_fetch.append(("f1040s1", {}))
        if need_sch_a: forms_to_fetch.append(("f1040sa", {}))
        if need_sch_b: forms_to_fetch.append(("f1040sb", _build_sch_b_fields(c)))
        if need_sch_c:
            for biz in c.get("schedule_c_records", []):
                forms_to_fetch.append(("f1040sc", _build_sch_c_fields(biz)))
        if need_sch_d: forms_to_fetch.append(("f1040sd", {}))
        if need_sch_e: forms_to_fetch.append(("f1040se", _build_sch_e_fields(c)))
        if need_sch_se:forms_to_fetch.append(("f1040sse",_build_sch_se_fields(c)))

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_name  = f"tax_forms_{self.tax_year}_{timestamp}.zip"
        zip_path  = PKG_DIR / zip_name

        # Download all unique form keys in parallel before opening the ZIP
        unique_keys = list(dict.fromkeys(fk for fk, _ in forms_to_fetch))
        pdf_cache   = _fetch_all_parallel(unique_keys, _log)

        field_discovery: dict[str, list[str]] = {}

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            # Summary PDF (always present — primary deliverable)
            zf.writestr(f"00_data_summary_{self.tax_year}.pdf", summary_bytes)

            # Official IRS forms (filled best-effort, using pre-fetched cache)
            seen_keys: dict[str, int] = {}
            for form_key, field_values in forms_to_fetch:
                pdf_bytes = pdf_cache.get(form_key)

                idx = seen_keys.get(form_key, 0)
                seen_keys[form_key] = idx + 1
                suffix = f"_{idx + 1}" if idx else ""

                short_title = FORM_TITLES.get(form_key, form_key).split("—")[0].strip().replace(" ", "_")
                arc_name = f"{short_title}{suffix}_filled.pdf"

                if pdf_bytes:
                    fields = _discover_fields(pdf_bytes)
                    field_discovery[arc_name] = sorted(fields.keys())
                    if field_values:
                        try:
                            pdf_bytes = _fill_pdf(pdf_bytes, field_values)
                        except Exception as exc:
                            _log(f"  Fill error for {form_key}: {exc}")
                    zf.writestr(arc_name, pdf_bytes)
                    _log(f"  {arc_name} — {len(pdf_bytes):,} bytes, {len(fields)} fields")
                else:
                    _log(f"  {form_key} not available — skipped")

            # Field discovery manifest (transparency for CPA)
            discovery_txt = json.dumps(field_discovery, indent=2)
            zf.writestr("field_manifest.json", discovery_txt)

            # CPA instructions
            zf.writestr("INSTRUCTIONS_FOR_CPA.txt", _instructions(
                display_name, self.tax_year, c, forms_to_fetch, field_discovery
            ))

        _log(f"Package ready: {zip_path}")
        return str(zip_path)


def _instructions(
    display_name: str,
    tax_year: int,
    c: dict,
    forms: list,
    fields: dict,
) -> str:
    form_list = "\n".join(
        f"  • {FORM_TITLES.get(fk, fk)}" for fk, _ in forms
    )
    return f"""UTBIS — TAX FORM PACKAGE INSTRUCTIONS FOR CPA
================================================================================
Client:    {display_name}
Tax Year:  {tax_year}
Generated: {datetime.now().strftime('%B %d, %Y')}

PACKAGE CONTENTS
----------------
  00_data_summary_{tax_year}.pdf
      Primary deliverable. Contains all computed tax figures organized
      by form line number. Read this first.

{form_list}
      Official IRS fillable PDFs downloaded from irs.gov.
      Key numeric fields are pre-filled using taxpayer data.
      Review and complete all remaining fields.

  field_manifest.json
      Lists all AcroForm field names discovered in each PDF.
      Use this to verify which fields were auto-populated.

  INSTRUCTIONS_FOR_CPA.txt
      This file.

SUMMARY OF KEY FIGURES
-----------------------
  Filing Status:      {(c.get('_fs') or '').replace('_', ' ').title()}
  AGI:               ${c.get('agi', 0):>12,.0f}
  Taxable Income:    ${c.get('taxable_income', 0):>12,.0f}
  Total Tax:         ${c.get('total_tax', 0):>12,.0f}
  Total Payments:    ${c.get('total_payments', 0):>12,.0f}
  {'REFUND:' if c.get('refund') else 'AMOUNT DUE:':18s}${(c.get('refund') or c.get('amount_owed', 0)):>12,.0f}
  Effective Rate:    {c.get('effective_rate', 0):>11.1f}%
  Marginal Rate:     {c.get('marginal_rate', 0):>11.1f}%

IMPORTANT NOTES
---------------
1. The data-summary PDF is computer-generated from taxpayer input. All figures
   must be reconciled against official source documents (W-2s, 1099s, K-1s,
   brokerage statements).

2. IRS PDF fields are pre-filled on a best-effort basis. Field names vary
   between annual revisions; verify all auto-populated values.

3. Items flagged [CPA REVIEW] in the summary PDF require professional judgment
   before filing.

4. This package covers FEDERAL returns only. Prepare state returns separately
   using the federal AGI as the starting point.

5. Do not file these forms without CPA review and client signature.

CONTACT / QUESTIONS
-------------------
Generated by: UTBIS — Universal Tax Benefit Intelligence System
================================================================================
"""


# ── CLI entry point ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate federal tax form package")
    parser.add_argument("--user-id",  required=True, help="User UUID from the DB")
    parser.add_argument("--tax-year", type=int, default=2025)
    args = parser.parse_args()

    gen = FormPackageGenerator(args.user_id, args.tax_year)
    path = gen.generate(progress_cb=lambda m: print(m))
    print(f"\nZIP package: {path}")


if __name__ == "__main__":
    main()
