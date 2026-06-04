import sys
from dataclasses import asdict
from datetime import date, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from api.auth import get_current_user_optional
from scan_opportunities import UserFacts

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from scan_opportunities import EligibilityStatus, OpportunityScanner  # noqa: E402

router = APIRouter(tags=["planning"])

DEADLINE_MAP: dict[str, dict] = {
    # ── December 31 hard deadlines ────────────────────────────────────────────
    "federal-solo-401k": {
        "date": "12-31",
        "action": "Establish Solo 401(k) plan with custodian",
    },
    "federal-s-corp-election": {
        "date": "12-31",
        "action": "Engage attorney to prepare S Corp election paperwork",
    },
    "federal-section-179-expensing": {
        "date": "12-31",
        "action": "Place qualifying equipment in service",
    },
    "federal-bonus-depreciation": {
        "date": "12-31",
        "action": "Place qualifying assets in service",
    },
    "federal-business-vehicle-deduction": {
        "date": "12-31",
        "action": "Purchase and place business vehicle in service",
    },
    "federal-augusta-rule": {
        "date": "12-31",
        "action": "Hold qualifying home rentals and document payments",
    },
    "federal-capital-gains-harvesting": {
        "date": "12-31",
        "action": "Execute tax-loss or gains-harvesting trades",
    },
    "federal-annual-gift-tax-exclusion": {
        "date": "12-31",
        "action": "Make annual exclusion gifts to recipients",
    },
    "federal-clean-vehicle-credit": {
        "date": "12-31",
        "action": "Purchase qualifying electric vehicle",
    },
    "federal-25c-energy-home-improvement": {
        "date": "12-31",
        "action": "Complete qualifying home energy improvements",
    },
    "federal-residential-clean-energy-credit": {
        "date": "12-31",
        "action": "Install solar, wind, or battery storage system",
    },
    "federal-529-to-roth-rollover": {
        "date": "12-31",
        "action": "Execute 529-to-Roth IRA rollover",
    },
    "federal-opportunity-zone-investment": {
        "date": "12-31",
        "action": "Make qualifying Opportunity Zone investment",
    },
    "federal-nol-carryforward": {
        "date": "12-31",
        "action": "Confirm and document net operating loss for the year",
    },
    "federal-self-employed-health-insurance": {
        "date": "12-31",
        "action": "Pay qualifying health insurance premiums before year-end",
    },
    "federal-qbi-deduction": {
        "date": "12-31",
        "action": "Review entity structure and income allocation for QBI optimization",
    },
    "state-ev-credit": {
        "date": "12-31",
        "action": "Purchase qualifying EV in your state before year-end",
    },
    "state-pte-election": {
        "date": "12-31",
        "action": "File Pass-Through Entity tax election with your state",
    },
    "state-529-deduction": {
        "date": "12-31",
        "action": "Make 529 plan contributions to capture state deduction",
    },
    # ── April 15 deadlines (some extendable to Oct 15) ────────────────────────
    "federal-sep-ira-contribution": {
        "date": "04-15",
        "action": "Fund SEP-IRA for prior year",
        "extendable": True,
    },
    "federal-backdoor-roth-ira": {
        "date": "04-15",
        "action": "Contribute to traditional IRA then convert to Roth",
    },
    "federal-hsa-triple-tax-advantage": {
        "date": "04-15",
        "action": "Make prior-year HSA contributions up to annual limit",
    },
    "federal-savers-credit": {
        "date": "04-15",
        "action": "Make qualifying retirement plan contributions",
    },
    "federal-small-employer-retirement-startup-credit": {
        "date": "04-15",
        "action": "Establish qualifying employer retirement plan",
        "extendable": True,
    },
}

_ACTIONABLE = {
    EligibilityStatus.ELIGIBLE_NOW,
    EligibilityStatus.NEARLY_ELIGIBLE,
    EligibilityStatus.ELIGIBLE_IF_CHANGED,
}


def _urgency(days: int) -> str:
    if days < 0:
        return "overdue"
    if days < 30:
        return "critical"
    if days < 90:
        return "soon"
    return "normal"


def _deadline_label(d: date) -> str:
    return f"{d.strftime('%B')} {d.day}, {d.year}"


@router.get("/planning/year-end")
def year_end_plan(tax_year: int = Query(default=2025),
                  current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["id"] if current_user else None
    facts = UserFacts(tax_year, user_id=user_id)
    scanner = OpportunityScanner(tax_year=tax_year, facts=facts)
    scanner.scan()

    today = date.today()
    dec_31 = date(tax_year, 12, 31)
    apr_15 = date(tax_year + 1, 4, 15)

    actions = []
    for result in scanner.results:
        if result.status not in _ACTIONABLE:
            continue
        entry = DEADLINE_MAP.get(result.benefit_id)
        if not entry:
            continue

        month, day = entry["date"].split("-")
        # Apr 15 uses tax_year + 1; Dec 31 uses tax_year
        dl_year = tax_year + 1 if entry["date"] == "04-15" else tax_year
        deadline = date(dl_year, int(month), int(day))
        days_remaining = (deadline - today).days

        actions.append({
            "benefit_id": result.benefit_id,
            "benefit_name": result.benefit_name,
            "action": entry["action"],
            "deadline_date": deadline.isoformat(),
            "deadline_label": _deadline_label(deadline),
            "days_remaining": days_remaining,
            "urgency": _urgency(days_remaining),
            "estimated_value": result.estimated_value or "",
            "status": result.status.value,
            "next_steps": result.next_steps,
            "extendable": entry.get("extendable", False),
        })

    actions.sort(key=lambda x: x["days_remaining"])

    urgency_counts = {"overdue": 0, "critical": 0, "soon": 0, "normal": 0}
    for a in actions:
        urgency_counts[a["urgency"]] = urgency_counts.get(a["urgency"], 0) + 1

    return {
        "tax_year": tax_year,
        "today": today.isoformat(),
        "days_until_dec_31": (dec_31 - today).days,
        "days_until_apr_15": (apr_15 - today).days,
        "actions": actions,
        "summary": {
            "total": len(actions),
            **urgency_counts,
            "dec_31_count": sum(1 for a in actions if a["deadline_date"].endswith("12-31")),
            "apr_15_count": sum(1 for a in actions if a["deadline_date"].endswith("04-15")),
        },
    }
