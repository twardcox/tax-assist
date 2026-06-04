import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

import yaml
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

ROOT = Path(__file__).parent.parent.parent

router = APIRouter(tags=["tax-law"])

_update_running = False

KNOWN_SOURCES = {
    "federal_register", "irs_news", "irs_publications",
    "internal_revenue_bulletin", "treasury_regulations",
    "congress_legislation", "tax_court",
    "state_ca", "state_ny", "state_il", "state_ma", "state_nj",
    "state_co", "state_or", "state_pa", "state_oh", "state_ga",
}


@router.get("/tax-law/changes")
def list_changes(limit: int = Query(default=20, ge=1, le=100)):
    future_dir = ROOT / "tax_library" / "future_law"
    if not future_dir.exists():
        return {"changes": [], "total": 0}

    files = sorted(future_dir.glob("*.yaml"), reverse=True)[:limit]
    changes = []
    for f in files:
        try:
            with open(f, encoding="utf-8") as fh:
                data = yaml.safe_load(fh) or {}
            data["filename"] = f.name
            changes.append(data)
        except Exception:
            pass

    return {"changes": changes, "total": len(list(future_dir.glob("*.yaml")))}


@router.post("/tax-law/update")
def trigger_update(
    background_tasks: BackgroundTasks,
    source: str = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
    dry_run: bool = Query(default=False),
):
    if source and source not in KNOWN_SOURCES:
        raise HTTPException(400, f"Unknown source '{source}'. Known: {sorted(KNOWN_SOURCES)}")

    global _update_running

    def _run():
        global _update_running
        _update_running = True
        try:
            cmd = [
                sys.executable,
                str(ROOT / "scripts" / "update_tax_law.py"),
                "--days", str(days),
            ]
            if source:
                cmd += ["--source", source]
            if dry_run:
                cmd.append("--dry-run")
            subprocess.run(cmd, cwd=str(ROOT), capture_output=True)
        finally:
            _update_running = False

    background_tasks.add_task(_run)
    return {"status": "started", "dry_run": dry_run, "days": days, "source": source}


@router.get("/tax-law/status")
def update_status():
    return {"running": _update_running}


@router.get("/tax-law/alert-count")
def alert_count(since_days: int = Query(default=30, ge=1, le=365)):
    future_dir = ROOT / "tax_library" / "future_law"
    if not future_dir.exists():
        return {"count": 0, "since_days": since_days}
    cutoff = (datetime.now() - timedelta(days=since_days)).strftime("%Y-%m-%d")
    count = sum(
        1 for f in future_dir.glob("*.yaml")
        if f.name[:10] >= cutoff
    )
    return {"count": count, "since_days": since_days}
