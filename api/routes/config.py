import os
import sys
from pathlib import Path

from fastapi import APIRouter

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from scan_opportunities import BenefitLibrary  # noqa: E402

router = APIRouter(tags=["config"])


@router.get("/config")
def get_config():
    return {
        "ai_available": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "tax_year": 2025,
        "benefit_count": len(BenefitLibrary().benefits),
    }
