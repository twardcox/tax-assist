"""GET /reconciliation — ledger vs. DB data + unprocessed document checklist."""

from fastapi import APIRouter, Depends

from api.auth import get_current_user_optional
from api.db import get_section_data, get_summary

router = APIRouter(tags=["reconciliation"])

TAX_YEAR = 2025

_FORM_LABELS = {
    "w2_forms":      "W-2",
    "form_1099_nec": "1099-NEC",
    "form_1099_misc": "1099-MISC",
    "form_1099_int": "1099-INT",
    "form_1099_div": "1099-DIV",
    "form_1099_b":   "1099-B",
    "form_1099_r":   "1099-R",
    "form_k1":       "K-1",
    "form_ssa1099":  "SSA-1099",
    "form_1098":     "1098 (Mortgage)",
    "form_1098t":    "1098-T (Tuition)",
    "form_1098e":    "1098-E (Student Loan)",
}


@router.get("/reconciliation")
def get_reconciliation(current_user: dict | None = Depends(get_current_user_optional)):
    if not current_user:
        return {
            "ledger": {"by_category": [], "total_applied": {"count": 0, "total_deductible": 0}},
            "total_deductible_in_ledger": 0,
            "total_transactions": 0,
            "unprocessed_income_documents": [],
            "ledger_by_category": {},
        }

    user_id = current_user["id"]
    summary = get_summary(user_id)

    # Income doc checklist from DB
    doc_idx = get_section_data(user_id, TAX_YEAR, "documents_index")
    unprocessed: list[dict] = []
    for key, entries in doc_idx.get("income_documents", {}).items():
        label = _FORM_LABELS.get(key, key)
        if isinstance(entries, list):
            for entry in entries:
                if isinstance(entry, dict) and not entry.get("processed"):
                    detail = (
                        entry.get("employer") or entry.get("institution")
                        or entry.get("payer") or entry.get("school")
                        or entry.get("lender") or "not uploaded"
                    )
                    unprocessed.append({"form": label, "detail": detail})
        elif isinstance(entries, dict) and not entries.get("processed"):
            unprocessed.append({"form": label, "detail": "not uploaded"})

    ledger_by_category = {
        r["tax_category"]: r["total_deductible"]
        for r in summary.get("by_category", [])
        if r.get("total_deductible")
    }

    return {
        "ledger": summary,
        "ledger_by_category": ledger_by_category,
        "total_deductible_in_ledger": summary.get("total_applied", {}).get("total_deductible") or 0,
        "total_transactions": summary.get("total_applied", {}).get("count") or 0,
        "unprocessed_income_documents": unprocessed,
    }
