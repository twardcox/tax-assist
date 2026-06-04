import sys
import threading
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query

ROOT = Path(__file__).parent.parent.parent
REPORTS = ROOT / "reports"
sys.path.insert(0, str(ROOT / "scripts"))

from generate_cpa_packet import generate_ai_executive_summary, generate_packet  # noqa: E402
from scan_opportunities import OpportunityScanner, UserFacts                     # noqa: E402
from api.auth import get_current_user_optional                                   # noqa: E402

router = APIRouter(tags=["reports"])

_cpa_jobs: dict[str, dict] = {}


def _run_cpa_packet(job_id: str, tax_year: int, with_ai: bool, user_id: str | None = None) -> None:
    try:
        facts = UserFacts(tax_year, user_id=user_id)
        scanner = OpportunityScanner(tax_year=tax_year, facts=facts)
        scanner.scan()
        ai_summary = generate_ai_executive_summary(scanner, "claude-opus-4-8") if with_ai else ""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"cpa_packet_{timestamp}.md"
        output_path = REPORTS / filename
        REPORTS.mkdir(exist_ok=True)
        generate_packet(scanner, output_path, ai_summary)
        _cpa_jobs[job_id] = {"status": "complete", "report_name": filename, "error": None}
    except Exception as exc:
        _cpa_jobs[job_id] = {"status": "error", "report_name": None, "error": str(exc)}


@router.get("/reports")
def list_reports():
    files = sorted(REPORTS.glob("*.md"), key=lambda f: f.stat().st_mtime, reverse=True)
    reports = [
        {"name": f.name, "size": f.stat().st_size, "mtime": f.stat().st_mtime}
        for f in files
        if f.stat().st_size > 0
    ]
    return {"reports": reports}


@router.get("/reports/{name}")
def get_report(name: str):
    if ".." in name or "/" in name or "\\" in name:
        raise HTTPException(400, "Invalid report name")
    path = REPORTS / name
    if not path.exists() or path.suffix != ".md":
        raise HTTPException(404, f"Report '{name}' not found")
    return {"name": name, "content": path.read_text(encoding="utf-8")}


@router.post("/reports/cpa-packet")
def trigger_cpa_packet(
    tax_year: int = Query(default=2025),
    with_ai: bool = Query(default=False),
    current_user: dict | None = Depends(get_current_user_optional),
):
    user_id = current_user["id"] if current_user else None
    job_id = str(uuid.uuid4())
    _cpa_jobs[job_id] = {"status": "running", "report_name": None, "error": None}
    threading.Thread(target=_run_cpa_packet, args=(job_id, tax_year, with_ai, user_id), daemon=True).start()
    return {"job_id": job_id}


@router.get("/reports/cpa-packet/{job_id}")
def get_cpa_packet_status(job_id: str):
    job = _cpa_jobs.get(job_id)
    if job is None:
        raise HTTPException(404, f"Job '{job_id}' not found")
    return job
