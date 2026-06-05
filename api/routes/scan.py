import os
import sys
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from scan_opportunities import AIAdvisor, OpportunityScanner, UserFacts  # noqa: E402
from api.auth import get_current_user_optional                             # noqa: E402
from api.routes.utils import count_by_status, serialize_result             # noqa: E402

router = APIRouter(tags=["scan"])

# job_id -> {status: "running"|"complete"|"error", report_name: str|None, error: str|None}
_ai_jobs: dict[str, dict] = {}


def _run_ai_analysis(job_id: str, tax_year: int, mode: str, user_id: str | None = None) -> None:
    try:
        facts = UserFacts(tax_year, user_id=user_id)
        scanner = OpportunityScanner(tax_year=tax_year, facts=facts)
        scanner.scan()
        advisor = AIAdvisor()
        if mode == "opportunities":
            text = advisor.analyze_opportunities(scanner.results, scanner.tax_year)
        elif mode == "gaps":
            text = advisor.analyze_gaps(scanner.results, scanner.tax_year)
        else:  # both
            opps = advisor.analyze_opportunities(scanner.results, scanner.tax_year)
            gaps = advisor.analyze_gaps(scanner.results, scanner.tax_year)
            text = f"## Opportunities Analysis\n\n{opps}\n\n---\n\n## Gap Analysis\n\n{gaps}"

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"ai_analysis_{timestamp}.md"
        report_path = ROOT / "reports" / filename
        report_path.parent.mkdir(exist_ok=True)
        report_path.write_text(
            f"# AI Analysis — Tax Year {tax_year}\n\n*Generated {datetime.now().strftime('%Y-%m-%d %H:%M')}*\n\n---\n\n{text}",
            encoding="utf-8",
        )
        _ai_jobs[job_id] = {"status": "complete", "report_name": filename, "error": None}
    except Exception as exc:
        _ai_jobs[job_id] = {"status": "error", "report_name": None, "error": str(exc)}


@router.post("/scan")
def run_scan(tax_year: int = Query(default=2025),
             current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["id"] if current_user else None
    try:
        facts = UserFacts(tax_year, user_id=user_id)
        scanner = OpportunityScanner(tax_year=tax_year, facts=facts)
        scanner.scan()
        scanner.write_report()
    except Exception as exc:
        raise HTTPException(500, f"Scan failed: {exc}") from exc

    results = [serialize_result(r) for r in scanner.results]
    return {
        "tax_year": tax_year,
        "total": len(results),
        "counts": count_by_status(scanner.results),
        "results": results,
    }


@router.post("/scan/ai-analysis")
def trigger_ai_analysis(
    tax_year: int = Query(default=2025),
    mode: Literal["opportunities", "gaps", "both"] = Query(default="opportunities"),
    current_user: dict | None = Depends(get_current_user_optional),
):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(503, "ANTHROPIC_API_KEY is not set")
    user_id = current_user["id"] if current_user else None
    job_id = str(uuid.uuid4())
    _ai_jobs[job_id] = {"status": "running", "report_name": None, "error": None}
    threading.Thread(target=_run_ai_analysis, args=(job_id, tax_year, mode, user_id), daemon=True).start()
    return {"job_id": job_id}


@router.get("/scan/ai-analysis/{job_id}")
def get_ai_analysis_status(job_id: str):
    job = _ai_jobs.get(job_id)
    if job is None:
        raise HTTPException(404, f"Job '{job_id}' not found")
    return job
