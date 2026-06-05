"""
Tax-forms routes:
  GET  /tax-forms/compute             — instant JSON review (no PDF generation)
  POST /reports/tax-forms             — start ZIP-generation background job
  GET  /reports/tax-forms/{job_id}    — poll job status
  GET  /reports/tax-forms/{job_id}/download — download the ZIP
"""

import sys
import threading
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "scripts"))

from api.auth import get_current_user_optional
from api.db import get_filing_details, save_filing_details

router = APIRouter(tags=["tax-forms"])

_jobs: dict[str, dict] = {}


@router.get("/filing-details")
def get_filing_details_route(
    tax_year: int = Query(default=2025),
    current_user: dict | None = Depends(get_current_user_optional),
):
    if not current_user:
        raise HTTPException(401, "Authentication required")
    return get_filing_details(current_user["id"], tax_year)


@router.put("/filing-details")
def save_filing_details_route(
    payload: dict,
    tax_year: int = Query(default=2025),
    current_user: dict | None = Depends(get_current_user_optional),
):
    if not current_user:
        raise HTTPException(401, "Authentication required")
    save_filing_details(current_user["id"], tax_year, payload)
    return {"ok": True}


@router.get("/tax-forms/preview-pdf")
def preview_tax_form_pdf(
    tax_year: int = Query(default=2025),
    current_user: dict | None = Depends(get_current_user_optional),
):
    """Return a filled Form 1040 PDF directly. Uses cached IRS base form when available."""
    if not current_user:
        raise HTTPException(401, "Authentication required")
    try:
        from generate_tax_forms import generate_preview_pdf  # noqa: E402
        pdf_bytes = generate_preview_pdf(current_user["id"], tax_year)
    except ValueError as exc:
        raise HTTPException(503, str(exc))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=form_1040_preview.pdf"},
    )


@router.get("/tax-forms/compute")
def compute_tax_forms(
    tax_year: int = Query(default=2025),
    current_user: dict | None = Depends(get_current_user_optional),
):
    """Return computed tax figures as JSON — no PDF generation, runs instantly."""
    if not current_user:
        raise HTTPException(401, "Authentication required")
    from generate_tax_forms import compute_tax_figures  # noqa: E402
    return compute_tax_figures(current_user["id"], tax_year)


def _run_job(job_id: str, user_id: str, tax_year: int) -> None:
    try:
        from generate_tax_forms import FormPackageGenerator  # noqa: E402

        messages: list[str] = []

        def _progress(msg: str):
            messages.append(msg)
            _jobs[job_id]["progress"] = msg

        gen  = FormPackageGenerator(user_id, tax_year)
        path = gen.generate(progress_cb=_progress)
        _jobs[job_id].update({
            "status":   "complete",
            "zip_path": path,
            "zip_name": Path(path).name,
            "messages": messages,
            "error":    None,
        })
    except Exception as exc:
        _jobs[job_id].update({
            "status":   "error",
            "zip_path": None,
            "zip_name": None,
            "error":    str(exc),
        })


@router.post("/reports/tax-forms")
def start_tax_forms(
    tax_year: int = Query(default=2025),
    current_user: dict | None = Depends(get_current_user_optional),
):
    if not current_user:
        raise HTTPException(401, "Authentication required to generate tax forms")
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "status":   "running",
        "progress": "Starting…",
        "zip_path": None,
        "zip_name": None,
        "error":    None,
    }
    threading.Thread(
        target=_run_job, args=(job_id, current_user["id"], tax_year), daemon=True
    ).start()
    return {"job_id": job_id}


@router.get("/reports/tax-forms/{job_id}")
def get_tax_forms_status(job_id: str):
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(404, f"Job '{job_id}' not found")
    # Return everything except the raw path for security
    return {
        "status":   job["status"],
        "progress": job.get("progress"),
        "zip_name": job.get("zip_name"),
        "error":    job.get("error"),
    }


@router.get("/reports/tax-forms/{job_id}/download")
def download_tax_forms(job_id: str):
    """
    No auth header needed — the UUID job_id is the bearer of authority.
    Called via a plain browser <a href> so Authorization header is unavailable.
    """
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    if job["status"] != "complete":
        raise HTTPException(400, f"Job status is '{job['status']}' — not ready for download")
    zip_path = Path(job["zip_path"])
    if not zip_path.exists():
        raise HTTPException(500, "Package file missing from disk")
    return FileResponse(
        path=str(zip_path),
        media_type="application/zip",
        filename=zip_path.name,
    )
