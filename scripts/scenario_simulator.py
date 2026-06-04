"""
scenario_simulator.py

Applies hypothetical fact changes to user data, re-runs the opportunity scanner,
and shows which benefits change — with optional AI interpretation via Claude.

Usage:
    python scripts/scenario_simulator.py --list
    python scripts/scenario_simulator.py --scenario start_llc
    python scripts/scenario_simulator.py --scenario start_llc --ai
    python scripts/scenario_simulator.py --scenario buy_rental_property --tax-year 2025
"""

import argparse
import copy
import os
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from scan_opportunities import (
    ANTHROPIC_AVAILABLE,
    AIAdvisor,
    BenefitLibrary,
    EligibilityStatus,
    OpportunityScanner,
    RulesEngine,
    STATUS_SORT,
    UserFacts,
)


SCENARIOS = {
    "buy_rental_property": {
        "description": "What if I purchase a rental property?",
        "fact_changes": {
            "real_estate.properties": [
                {
                    "property_type": "rental_residential",
                    "acquisition": {
                        "purchase_price": 350000,
                        "current_market_value": 370000,
                    },
                    "rental_use": {
                        "rental_days": 365,
                        "gross_rental_income": 18000,
                    },
                    "financing": {
                        "mortgage_interest_paid": 12000,
                        "property_tax_paid": 4000,
                    },
                }
            ]
        },
    },
    "start_llc": {
        "description": "What if I start an LLC for my side income?",
        "fact_changes": {
            "businesses.businesses": [
                {
                    "entity_type": "llc_single",
                    "tax_classification": "disregarded",
                    "financials": {
                        "gross_revenue": 50000,
                        "net_profit_loss": 30000,
                    },
                    "home_office": {"claimed": True, "square_footage": 200},
                }
            ]
        },
    },
    "elect_s_corp": {
        "description": "What if I elect S Corp status for my existing business?",
        "fact_changes": {
            "businesses.businesses": [
                {
                    "entity_type": "s_corp",
                    "tax_classification": "s_corp",
                    "financials": {
                        "gross_revenue": 150000,
                        "net_profit_loss": 90000,
                    },
                    "employees": {
                        "owner_w2_salary": 60000,
                        "w2_employees_count": 0,
                    },
                }
            ]
        },
    },
    "buy_ev": {
        "description": "What if I buy a qualifying electric vehicle?",
        "fact_changes": {},
    },
    "max_hsa": {
        "description": "What if I switch to an HDHP and maximize HSA contributions?",
        "fact_changes": {
            "healthcare.hdhp_enrolled": True,
            "healthcare.hdhp_coverage_level": "family",
        },
    },
    "move_no_tax_state": {
        "description": "What if I move to a no-income-tax state (TX, FL, NV)?",
        "fact_changes": {
            "household.residence.state": "TX",
        },
    },
    "hire_spouse": {
        "description": "What if I hire my spouse in the business?",
        "fact_changes": {
            "household.spouse.employed_in_business": True,
        },
    },
    "buy_home": {
        "description": "What if I purchase a primary residence?",
        "fact_changes": {
            "real_estate.properties": [
                {
                    "property_type": "primary_residence",
                    "acquisition": {
                        "purchase_price": 500000,
                        "current_market_value": 520000,
                    },
                    "financing": {
                        "mortgage_interest_paid": 18000,
                        "property_tax_paid": 6000,
                    },
                    "primary_residence": {
                        "years_lived_in": 3,
                    },
                }
            ],
            "household.itemizing_deductions": True,
        },
    },
}


# ── Fact override helpers ─────────────────────────────────────────────────

def _set_nested(node, segments: list[str], value):
    """Recursively walk `node` via `segments` and set the final value."""
    seg = segments[0]
    m = re.match(r'^(\w+)\[(\d+)\]$', seg)

    if len(segments) == 1:
        if m:
            key, idx = m.group(1), int(m.group(2))
            lst = node.setdefault(key, [])
            while len(lst) <= idx:
                lst.append({})
            lst[idx] = value
        else:
            node[seg] = value
        return

    if m:
        key, idx = m.group(1), int(m.group(2))
        lst = node.setdefault(key, [])
        while len(lst) <= idx:
            lst.append({})
        _set_nested(lst[idx], segments[1:], value)
    else:
        next_seg = segments[1]
        next_is_idx = bool(re.match(r'^(\w+)\[(\d+)\]$', next_seg)) or next_seg.isdigit()
        if seg not in node:
            node[seg] = [] if next_is_idx else {}
        child = node[seg]
        if not isinstance(child, (dict, list)):
            node[seg] = [] if next_is_idx else {}
            child = node[seg]
        _set_nested(child, segments[1:], value)


def apply_overrides(base_data: dict, overrides: dict) -> dict:
    """Return a deep copy of base_data with dot-path overrides applied."""
    result = copy.deepcopy(base_data)
    for path, value in overrides.items():
        segments = path.split('.')
        _set_nested(result, segments, value)
    return result


# ── Scenario-patched UserFacts ────────────────────────────────────────────

class ScenarioUserFacts(UserFacts):
    """UserFacts initialized from a pre-patched data dict instead of YAML files."""

    def __init__(self, data: dict, tax_year: int = 2025, user_id: str | None = None):
        self._preloaded = data
        super().__init__(tax_year, user_id=user_id)

    def _load(self):
        self._data = self._preloaded


# ── Diff logic ────────────────────────────────────────────────────────────

STATUS_LABEL = {
    EligibilityStatus.ELIGIBLE_NOW: "eligible now",
    EligibilityStatus.NEARLY_ELIGIBLE: "nearly eligible",
    EligibilityStatus.ELIGIBLE_IF_CHANGED: "eligible if changed",
    EligibilityStatus.FUTURE_OPPORTUNITY: "future opportunity",
    EligibilityStatus.HIGH_RISK: "high risk",
    EligibilityStatus.UNKNOWN: "unknown",
}


def diff_results(baseline: list, scenario: list) -> dict:
    """Compare two result sets; return categorized changes."""
    b_map = {r.benefit_id: r for r in baseline}
    s_map = {r.benefit_id: r for r in scenario}

    newly_added = []
    improved = []
    degraded = []
    removed = []

    for bid, sr in s_map.items():
        br = b_map.get(bid)
        if br is None:
            newly_added.append(sr)
        else:
            si = STATUS_SORT.index(sr.status) if sr.status in STATUS_SORT else 99
            bi = STATUS_SORT.index(br.status) if br.status in STATUS_SORT else 99
            if si < bi:
                improved.append((br, sr))
            elif si > bi:
                degraded.append((br, sr))

    for bid, br in b_map.items():
        if bid not in s_map:
            removed.append(br)

    return {
        "newly_added": newly_added,
        "improved": improved,
        "degraded": degraded,
        "removed": removed,
    }


def _count_by_status(results: list) -> dict:
    counts = {}
    for r in results:
        counts[r.status.value] = counts.get(r.status.value, 0) + 1
    return counts


# ── Scenario runner ───────────────────────────────────────────────────────

def run_scenario(scenario_key: str, tax_year: int = 2025, use_ai: bool = False,
                 model: str = "claude-opus-4-8"):
    if scenario_key not in SCENARIOS:
        print(f"Unknown scenario: '{scenario_key}'")
        print(f"Available: {', '.join(SCENARIOS.keys())}")
        return

    scenario = SCENARIOS[scenario_key]
    description = scenario["description"]
    overrides = scenario["fact_changes"]

    print(f"\nScenario: {description}")
    print("=" * 60)

    # ── Baseline scan ─────────────────────────────────────────────
    baseline_scanner = OpportunityScanner(tax_year=tax_year)
    baseline_scanner.scan()
    baseline = baseline_scanner.results

    b_counts = _count_by_status(baseline)
    print("\nBASELINE (current facts):")
    for status in STATUS_SORT:
        count = b_counts.get(status.value, 0)
        if count:
            print(f"  {status.value:<33} {count}")

    # ── Scenario scan ─────────────────────────────────────────────
    patched_data = apply_overrides(baseline_scanner.facts._data, overrides)
    scenario_facts = ScenarioUserFacts(patched_data, tax_year=tax_year)
    scenario_scanner = OpportunityScanner(tax_year=tax_year, facts=scenario_facts)
    scenario_scanner.scan()
    scenario_results = scenario_scanner.results

    s_counts = _count_by_status(scenario_results)
    print("\nAFTER SCENARIO:")
    for status in STATUS_SORT:
        count = s_counts.get(status.value, 0)
        if count:
            print(f"  {status.value:<33} {count}")

    # ── Diff ──────────────────────────────────────────────────────
    diff = diff_results(baseline, scenario_results)
    changes_for_ai = []

    print("\nOPPORTUNITY CHANGES:")

    if diff["newly_added"]:
        print(f"\n  NEW OPPORTUNITIES unlocked by this scenario ({len(diff['newly_added'])}):")
        for r in diff["newly_added"]:
            tag = STATUS_LABEL.get(r.status, r.status.value)
            val = f" — {r.estimated_value}" if r.estimated_value else ""
            print(f"    + {r.benefit_name} [{tag}]{val}")
            changes_for_ai.append(
                f"NEW: {r.benefit_name} [{r.status.value}]{val} | {r.message[:120]}"
            )

    if diff["improved"]:
        print(f"\n  STATUS IMPROVEMENTS ({len(diff['improved'])}):")
        for br, sr in diff["improved"]:
            print(f"    ^ {sr.benefit_name}: {br.status.value} -> {sr.status.value}")
            changes_for_ai.append(
                f"IMPROVED: {sr.benefit_name}: {br.status.value} -> {sr.status.value}"
            )

    if diff["degraded"]:
        print(f"\n  STATUS DEGRADED ({len(diff['degraded'])}):")
        for br, sr in diff["degraded"]:
            print(f"    v {sr.benefit_name}: {br.status.value} -> {sr.status.value}")
            changes_for_ai.append(
                f"DEGRADED: {sr.benefit_name}: {br.status.value} -> {sr.status.value}"
            )

    if diff["removed"]:
        print(f"\n  REMOVED (no longer applicable) ({len(diff['removed'])}):")
        for r in diff["removed"]:
            print(f"    - {r.benefit_name}")
            changes_for_ai.append(f"REMOVED: {r.benefit_name} (was {r.status.value})")

    if not any(diff.values()):
        print("  No material changes — the scenario doesn't affect evaluated benefits.")

    print()

    # ── AI interpretation ─────────────────────────────────────────
    if use_ai:
        if not ANTHROPIC_AVAILABLE:
            print("AI interpretation skipped — run: pip install anthropic")
        elif not os.environ.get("ANTHROPIC_API_KEY"):
            print("AI interpretation skipped — set ANTHROPIC_API_KEY environment variable")
        else:
            print("Generating AI scenario interpretation...")
            advisor = AIAdvisor(model=model)
            narrative = advisor.analyze_scenario(
                description=description,
                changes=changes_for_ai,
                tax_year=tax_year,
            )
            print("\n" + "─" * 60)
            print(narrative)
            print("─" * 60)


# ── Entry point ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="UTBIS Scenario Simulator")
    parser.add_argument("--scenario", type=str, default=None)
    parser.add_argument("--tax-year", type=int, default=2025)
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--ai", action="store_true",
                        help="Add AI interpretation of the scenario diff (requires ANTHROPIC_API_KEY)")
    parser.add_argument("--model", type=str, default="claude-opus-4-8",
                        help="Claude model for AI interpretation")
    args = parser.parse_args()

    if args.list or not args.scenario:
        print("\nAvailable scenarios:")
        for key, s in SCENARIOS.items():
            print(f"  {key:<30} {s['description']}")
        return

    run_scenario(args.scenario, tax_year=args.tax_year, use_ai=args.ai, model=args.model)


if __name__ == "__main__":
    main()
