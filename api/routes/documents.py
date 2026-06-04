import hashlib
import os
import re
import sys
import threading
import uuid
from pathlib import Path
from typing import Any

import yaml
from fastapi import APIRouter, Body, Depends, HTTPException, UploadFile, File

ROOT = Path(__file__).parent.parent.parent
DOCS_DIR = ROOT / "documents"
sys.path.insert(0, str(ROOT / "scripts"))

from classify_receipts import classify_file, extract_with_ai, ExpenseCategory  # noqa: E402
from api.auth import get_current_user, get_current_user_optional               # noqa: E402
from api.db import (                                                            # noqa: E402
    add_transaction, apply_dot_path_to_section,
    delete_document_record, file_already_applied,
    get_documents_for_user, get_summary, init_db,
    mark_document_extracted, upsert_document,
)

init_db()

router = APIRouter(tags=["documents"])

# job_id -> {status: "running"|"complete"|"error", extracted: dict|None, error: str|None}
_extract_jobs: dict[str, dict] = {}

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".heic", ".tiff", ".csv"}
SUBDIRS = ["receipts", "contracts", "cpa_reviews", "entity_docs",
           "payroll", "property_docs", "tax_returns"]

TAX_YEAR = 2025


def _safe_name(name: str) -> str:
    name = re.sub(r"[^\w.\-]", "_", name)
    return name[:200]


def _file_id(name: str) -> str:
    return hashlib.md5(name.encode()).hexdigest()[:12]


def _all_files_on_disk() -> list[dict]:
    """Scan the documents/ directories and return file metadata."""
    results = []
    for sub in SUBDIRS:
        subdir = DOCS_DIR / sub
        if not subdir.exists():
            continue
        for f in subdir.iterdir():
            if f.suffix.lower() in ALLOWED_EXTENSIONS and f.is_file():
                info = classify_file(f)
                info["file_id"] = _file_id(f.name)
                info["subdir"] = sub
                info["mtime"] = f.stat().st_mtime
                results.append(info)
    results.sort(key=lambda x: x["mtime"], reverse=True)
    return results


def _all_files(user_id: str | None) -> list[dict]:
    """Return files, filtered by user_id when authenticated."""
    disk_files = _all_files_on_disk()
    if not user_id:
        return disk_files
    # Filter to files owned by this user (or not yet in DB — legacy files)
    db_docs = {d["id"]: d for d in get_documents_for_user(user_id)}
    result = []
    for f in disk_files:
        fid = f["file_id"]
        if fid in db_docs or not db_docs:
            # Include if owned by user OR if no docs in DB yet (migration state)
            result.append(f)
    return result if db_docs else disk_files


# ── Upload / list / delete ─────────────────────────────────────────────────────

@router.post("/documents/upload")
def upload_document(file: UploadFile = File(...),
                    current_user: dict | None = Depends(get_current_user_optional)):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type '{suffix}' not allowed.")

    safe = _safe_name(file.filename)
    dest_dir = DOCS_DIR / "receipts"
    dest_dir.mkdir(parents=True, exist_ok=True)

    dest = dest_dir / safe
    counter = 1
    while dest.exists():
        dest = dest_dir / f"{Path(safe).stem}_{counter}{suffix}"
        counter += 1

    content = file.file.read()
    dest.write_bytes(content)

    info = classify_file(dest)
    fid = _file_id(dest.name)
    info["file_id"] = fid
    info["subdir"] = "receipts"

    if current_user:
        upsert_document(
            current_user["id"], fid, dest.name, "receipts",
            str(dest.relative_to(ROOT)), info.get("category", ""), info.get("confidence", ""),
        )
    return info


@router.get("/documents")
def list_documents(current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["id"] if current_user else None
    return {"files": _all_files(user_id)}


@router.delete("/documents/{file_id}")
def delete_document(file_id: str,
                    current_user: dict | None = Depends(get_current_user_optional)):
    for f_info in _all_files_on_disk():
        if f_info["file_id"] == file_id:
            path = ROOT / f_info["path"]
            if path.exists():
                path.unlink()
            if current_user:
                delete_document_record(current_user["id"], file_id)
            return {"deleted": True, "file": f_info["file"]}
    raise HTTPException(404, f"Document '{file_id}' not found")


# ── AI Extraction ──────────────────────────────────────────────────────────────

def _run_extraction(job_id: str, file_path: Path) -> None:
    try:
        result = extract_with_ai(file_path)
        _extract_jobs[job_id] = {"status": "complete", "extracted": result, "error": None}
    except Exception as exc:
        _extract_jobs[job_id] = {"status": "error", "extracted": None, "error": str(exc)}


@router.post("/documents/{file_id}/extract")
def extract_document(file_id: str,
                     current_user: dict | None = Depends(get_current_user_optional)):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(503, "ANTHROPIC_API_KEY is not set")
    target = next((f for f in _all_files_on_disk() if f["file_id"] == file_id), None)
    if not target:
        raise HTTPException(404, f"Document '{file_id}' not found")
    file_path = ROOT / target["path"]
    job_id = str(uuid.uuid4())
    _extract_jobs[job_id] = {"status": "running", "extracted": None, "error": None}
    threading.Thread(target=_run_extraction, args=(job_id, file_path), daemon=True).start()
    return {"job_id": job_id}


@router.get("/documents/extract/{job_id}")
def extraction_status(job_id: str):
    job = _extract_jobs.get(job_id)
    if job is None:
        raise HTTPException(404, f"Extraction job '{job_id}' not found")
    return job


# ── Apply extracted updates ────────────────────────────────────────────────────

def _apply_dot_path(data: Any, dot_path: str, operation: str, value: Any) -> bool:
    """Traverse dot_path in data dict and apply set/add. Pure function — no I/O."""
    parts = dot_path.split(".")
    obj = data
    try:
        for part in parts[:-1]:
            if isinstance(obj, list):
                obj = obj[int(part)]
            elif isinstance(obj, dict):
                obj = obj.setdefault(part, {})
            else:
                return False
        last = parts[-1]
        if isinstance(obj, list):
            idx = int(last)
            while len(obj) <= idx:
                obj.append(None)
            if operation == "add":
                obj[idx] = round((obj[idx] or 0) + value, 2)
            else:
                obj[idx] = value
        elif isinstance(obj, dict):
            if operation == "add":
                obj[last] = round((obj.get(last) or 0) + value, 2)
            else:
                obj[last] = value
        else:
            return False
        return True
    except (KeyError, IndexError, TypeError, ValueError):
        return False


@router.post("/documents/apply")
def apply_extraction(body: Any = Body(...),
                     current_user: dict | None = Depends(get_current_user_optional)):
    """
    Body: {
      "meta": {file_id, filename, date, merchant, total_amount,
               deductible_pct, tax_category, benefit_ids, form_line},
      "updates": [{yaml_file, dot_path, operation, value, label}]
    }
    Legacy list format also accepted.
    """
    if isinstance(body, list):
        updates = body
        meta: dict = {}
    else:
        updates = body.get("updates", [])
        meta = body.get("meta", {})

    file_id = meta.get("file_id", "")
    deductible_pct = float(meta.get("deductible_pct", 1.0))
    deductible_pct = max(0.0, min(1.0, deductible_pct))
    user_id = current_user["id"] if current_user else None

    # Duplicate check (per user when authenticated)
    if file_id and user_id and file_already_applied(user_id, file_id):
        return {"applied": [], "skipped": [u.get("label", "") for u in updates], "duplicate": True}

    applied = []
    skipped = []

    for update in updates:
        section = update.get("yaml_file") or update.get("section", "")
        dot_path = update.get("dot_path", "")
        operation = update.get("operation", "set")
        raw_value = update.get("value")
        label = update.get("label", dot_path)

        if not section or not dot_path or raw_value is None:
            skipped.append(label)
            continue
        if ".." in section or "/" in section or "\\" in section:
            skipped.append(label)
            continue

        # Scale expense amounts by deductibility
        if operation == "add" and isinstance(raw_value, (int, float)) and raw_value > 0:
            value = round(raw_value * deductible_pct, 2)
        else:
            value = raw_value

        success = False
        if user_id:
            # Write to DB
            success = apply_dot_path_to_section(user_id, TAX_YEAR, section, dot_path, operation, value)
        else:
            # Legacy YAML fallback
            from pathlib import Path as _P
            yaml_path = ROOT / "user_data" / f"{section}.yaml"
            if yaml_path.exists():
                import yaml as _yaml
                with open(yaml_path, encoding="utf-8") as f:
                    data = _yaml.safe_load(f) or {}
                if _apply_dot_path(data, dot_path, operation, value):
                    with open(yaml_path, "w", encoding="utf-8") as f:
                        _yaml.dump(data, f, default_flow_style=False, allow_unicode=True)
                    success = True

        if success:
            applied.append(label)
            if file_id and user_id:
                total_amount = float(raw_value) if isinstance(raw_value, (int, float)) else 0.0
                add_transaction({
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "file_id": file_id,
                    "filename": meta.get("filename", ""),
                    "date": meta.get("date"),
                    "merchant": meta.get("merchant"),
                    "total_amount": total_amount,
                    "deductible_pct": deductible_pct,
                    "deductible_amount": round(total_amount * deductible_pct, 2),
                    "tax_category": meta.get("tax_category", ""),
                    "benefit_ids": meta.get("benefit_ids", []),
                    "form_line": meta.get("form_line", ""),
                    "section": section,
                    "dot_path": dot_path,
                    "status": "applied",
                    "label": label,
                })
        else:
            skipped.append(label)

    return {"applied": applied, "skipped": skipped, "duplicate": False}
