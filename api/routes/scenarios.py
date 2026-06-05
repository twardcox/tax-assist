import sys
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from api.auth import get_current_user_optional
from api.routes.utils import count_by_status, serialize_result
from scan_opportunities import UserFacts

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from scan_opportunities import OpportunityScanner  # noqa: E402
from scenario_simulator import (  # noqa: E402
    SCENARIOS,
    ScenarioUserFacts,
    apply_overrides,
    diff_results,
)

router = APIRouter(tags=["scenarios"])


@router.get("/scenarios")
def list_scenarios():
    return {
        "scenarios": [
            {"key": k, "description": v["description"]}
            for k, v in SCENARIOS.items()
        ]
    }


@router.post("/scenarios/{key}")
def run_scenario(key: str, tax_year: int = Query(default=2025),
                 current_user: dict | None = Depends(get_current_user_optional)):
    if key not in SCENARIOS:
        raise HTTPException(404, f"Scenario '{key}' not found")

    scenario = SCENARIOS[key]
    user_id = current_user["id"] if current_user else None

    try:
        facts = UserFacts(tax_year, user_id=user_id)
        baseline_scanner = OpportunityScanner(tax_year=tax_year, facts=facts)
        baseline_scanner.scan()
        baseline = baseline_scanner.results

        patched = apply_overrides(baseline_scanner.facts._data, scenario["fact_changes"])
        scenario_facts = ScenarioUserFacts(patched, tax_year=tax_year, user_id=user_id)
        scenario_scanner = OpportunityScanner(tax_year=tax_year, facts=scenario_facts)
        scenario_scanner.scan()
        scenario_results = scenario_scanner.results
    except Exception as exc:
        raise HTTPException(422, f"Scenario failed: {exc}") from exc

    diff = diff_results(baseline, scenario_results)

    return {
        "scenario": key,
        "description": scenario["description"],
        "baseline_counts": count_by_status(baseline),
        "scenario_counts": count_by_status(scenario_results),
        "diff": {
            "newly_added": [serialize_result(r) for r in diff["newly_added"]],
            "improved": [
                {"before": serialize_result(b), "after": serialize_result(a)}
                for b, a in diff["improved"]
            ],
            "degraded": [
                {"before": serialize_result(b), "after": serialize_result(a)}
                for b, a in diff["degraded"]
            ],
            "removed": [serialize_result(r) for r in diff["removed"]],
        },
    }
