from fastapi import APIRouter, Depends, HTTPException

from api.auth import get_current_user, get_current_user_optional
from api.db import get_transactions, get_summary, reverse_transaction

router = APIRouter(tags=["transactions"])


@router.get("/transactions")
def list_transactions(
    benefit_id: str | None = None,
    tax_category: str | None = None,
    status: str | None = None,
    current_user: dict | None = Depends(get_current_user_optional),
):
    if not current_user:
        return {"transactions": []}
    return {"transactions": get_transactions(
        current_user["id"],
        benefit_id=benefit_id,
        tax_category=tax_category,
        status=status,
    )}


@router.get("/transactions/summary")
def transaction_summary(current_user: dict | None = Depends(get_current_user_optional)):
    if not current_user:
        return {"by_category": [], "total_applied": {"count": 0, "total_deductible": 0}}
    return get_summary(current_user["id"])


@router.delete("/transactions/{txn_id}")
def reverse_txn(txn_id: str, current_user: dict = Depends(get_current_user)):
    if not reverse_transaction(txn_id, current_user["id"]):
        raise HTTPException(404, f"Transaction '{txn_id}' not found")
    return {"reversed": True, "id": txn_id}
