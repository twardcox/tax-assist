import hashlib
import os
import re
import sys
import threading
import uuid
from pathlib import Path
from typing import Any

import io

import yaml
from PIL import Image
from fastapi import APIRouter, Body, Depends, HTTPException, UploadFile, File

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from classify_receipts import classify_filename, extract_with_ai_bytes  # noqa: E402
from api.auth import get_current_user, get_current_user_optional         # noqa: E402
from api.db import (                                                      # noqa: E402
    add_transaction, apply_dot_path_to_section,
    delete_document_record, file_already_applied,
    get_document_content, get_documents_for_user, init_db,
    upsert_document,
)

init_db()

router = APIRouter(tags=["documents"])

# job_id -> {status: "running"|"complete"|"error", extracted: dict|None, error: str|None}
_extract_jobs: dict[str, dict] = {}

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".heic", ".tiff", ".csv"}

TAX_YEAR = 2025
MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB


_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".heic", ".tiff"}
_MAX_DIMENSION = 1800
_JPEG_QUALITY = 85


def _compress_image(content: bytes) -> bytes | None:
    """Returns JPEG bytes on success, None if Pillow cannot decode the source."""
    try:
        img = Image.open(io.BytesIO(content))
        img = img.convert("RGB")
        if max(img.size) > _MAX_DIMENSION:
            img.thumbnail((_MAX_DIMENSION, _MAX_DIMENSION), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=_JPEG_QUALITY, optimize=True)
        return buf.getvalue()
    except Exception:
        return None


def _safe_name(name: str) -> str:
    name = re.sub(r"[^\w.\-]", "_", name)
    return name[:200]


def _file_id(user_id: str, name: str, content: bytes) -> str:
    digest = hashlib.sha256(content).hexdigest()[:16]
    return hashlib.sha256(f"{user_id}:{name}:{digest}".encode()).hexdigest()[:12]


def _normalize(doc: dict) -> dict:
    """Shape DB row into the API response shape the frontend expects."""
    return {
        "file_id":    doc["id"],
        "file":       doc["filename"],
        "category":   doc.get("category", ""),
        "confidence": doc.get("confidence", ""),
        "size":       doc.get("size", 0),
        "note":       doc.get("note", ""),
        "extracted":  bool(doc.get("extracted", 0)),
        "uploaded_at": doc.get("uploaded_at", ""),
    }


# ── Upload / list / delete ─────────────────────────────────────────────────────

@router.post("/documents/upload")
def upload_document(file: UploadFile = File(...),
                    current_user: dict | None = Depends(get_current_user_optional)):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type '{suffix}' not allowed.")

    safe = _safe_name(file.filename)
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File exceeds the 20 MB upload limit.")
    if suffix in _IMAGE_SUFFIXES:
        compressed = _compress_image(content)
        if compressed is not None:
            content = compressed
            safe = Path(safe).stem + ".jpg"
            suffix = ".jpg"
        elif suffix in {".heic", ".tiff"}:
            raise HTTPException(
                415,
                "HEIC/TIFF images must be converted to JPG/PNG/PDF before upload (image could not be decoded).",
            )
    fid = _file_id(uid, safe, content)

    info = classify_filename(safe, size=len(content))
    info["file_id"] = fid

    if current_user:
        upsert_document(
            current_user["id"], fid, safe,
            category=info.get("category", ""),
            confidence=info.get("confidence", ""),
            content=content,
            size=len(content),
            note=info.get("note", ""),
        )
    return info


@router.get("/documents")
def list_documents(current_user: dict | None = Depends(get_current_user_optional)):
    if not current_user:
        return {"files": []}
    docs = get_documents_for_user(current_user["id"])
    return {"files": [_normalize(d) for d in docs]}


@router.delete("/documents/{file_id}")
def delete_document(file_id: str,
                    current_user: dict | None = Depends(get_current_user_optional)):
    if not current_user:
        raise HTTPException(401, "Authentication required")
    deleted = delete_document_record(current_user["id"], file_id)
    if not deleted:
        raise HTTPException(404, f"Document '{file_id}' not found")
    return {"deleted": True, "file_id": file_id}


# ── AI Extraction ──────────────────────────────────────────────────────────────

def _run_extraction(job_id: str, content: bytes, filename: str) -> None:
    try:
        result = extract_with_ai_bytes(content, filename)
        _extract_jobs[job_id] = {"status": "complete", "extracted": result, "error": None}
    except Exception as exc:
        _extract_jobs[job_id] = {"status": "error", "extracted": None, "error": str(exc)}


@router.post("/documents/{file_id}/extract")
def extract_document(file_id: str,
                     current_user: dict | None = Depends(get_current_user_optional)):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(503, "ANTHROPIC_API_KEY is not set")
    if not current_user:
        raise HTTPException(401, "Authentication required")
    content, filename = get_document_content(current_user["id"], file_id)
    if content is None:
        raise HTTPException(404, f"Document '{file_id}' not found")
    job_id = str(uuid.uuid4())
    _extract_jobs[job_id] = {"status": "running", "extracted": None, "error": None}
    threading.Thread(target=_run_extraction, args=(job_id, content, filename), daemon=True).start()
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
      "updates": [{yaml_file|section, dot_path, operation, value, label}]
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

        if operation == "add" and isinstance(raw_value, (int, float)) and raw_value > 0:
            value = round(raw_value * deductible_pct, 2)
        else:
            value = raw_value

        success = False
        if user_id:
            success = apply_dot_path_to_section(user_id, TAX_YEAR, section, dot_path, operation, value)
        else:
            yaml_path = ROOT / "user_data" / f"{section}.yaml"
            if yaml_path.exists():
                with open(yaml_path, encoding="utf-8") as f:
                    data = yaml.safe_load(f) or {}
                if _apply_dot_path(data, dot_path, operation, value):
                    with open(yaml_path, "w", encoding="utf-8") as f:
                        yaml.dump(data, f, default_flow_style=False, allow_unicode=True)
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
