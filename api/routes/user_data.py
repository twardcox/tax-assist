from pathlib import Path
from typing import Any

import yaml
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.auth import get_current_user, get_current_user_optional
from api.db import get_section_data, save_section_data

ROOT = Path(__file__).parent.parent.parent
USER_DATA = ROOT / "user_data"

router = APIRouter(tags=["user-data"])

VALID_SECTIONS = {
    "household", "income", "businesses", "real_estate",
    "investments", "retirement", "healthcare", "dependents",
    "goals", "documents_index",
}

TAX_YEAR = 2025


class DataBody(BaseModel):
    data: dict | None = None    # new JSON format
    content: str | None = None  # legacy YAML string format (still accepted)


def _resolve_user_id(current_user: dict | None) -> str | None:
    """Return user_id if authenticated, else None (CLI / unauthenticated fallback)."""
    return current_user["id"] if current_user else None


@router.get("/user-data")
def list_sections(current_user: dict | None = Depends(get_current_user_optional)):
    return {"sections": sorted(VALID_SECTIONS - {"documents_index"})}


@router.get("/user-data/{section}")
def get_section_raw(section: str,
                    current_user: dict | None = Depends(get_current_user_optional)):
    if section not in VALID_SECTIONS:
        raise HTTPException(404, f"Section '{section}' not found")
    user_id = _resolve_user_id(current_user)
    if user_id:
        data = get_section_data(user_id, TAX_YEAR, section)
        # Return as YAML string for backwards compat with frontend that still uses raw YAML display
        content = yaml.dump(data, default_flow_style=False, allow_unicode=True) if data else ""
        return {"section": section, "content": content}
    # Unauthenticated fallback: read YAML file
    path = USER_DATA / f"{section}.yaml"
    if not path.exists():
        raise HTTPException(404, f"Section '{section}' not found")
    return {"section": section, "content": path.read_text(encoding="utf-8")}


@router.put("/user-data/{section}")
def update_section(section: str, body: DataBody,
                   current_user: dict | None = Depends(get_current_user_optional)):
    if section not in VALID_SECTIONS:
        raise HTTPException(400, f"'{section}' is not an editable section")

    # Resolve the data dict from either JSON body or legacy YAML string
    if body.data is not None:
        data = body.data
    elif body.content is not None:
        try:
            data = yaml.safe_load(body.content) or {}
        except yaml.YAMLError as exc:
            raise HTTPException(422, f"Invalid YAML: {exc}") from exc
    else:
        raise HTTPException(422, "Provide either 'data' (JSON) or 'content' (YAML string)")

    user_id = _resolve_user_id(current_user)
    if user_id:
        save_section_data(user_id, TAX_YEAR, section, data)
    else:
        # Unauthenticated fallback: write YAML file
        path = USER_DATA / f"{section}.yaml"
        if not path.exists():
            raise HTTPException(404, f"Section '{section}' not found")
        path.write_text(
            yaml.dump(data, default_flow_style=False, allow_unicode=True),
            encoding="utf-8",
        )
    return {"section": section, "saved": True}


@router.get("/user-data/{section}/parsed")
def get_section_parsed(section: str,
                       current_user: dict | None = Depends(get_current_user_optional)) -> dict[str, Any]:
    if section not in VALID_SECTIONS:
        raise HTTPException(404, f"Section '{section}' not found")
    user_id = _resolve_user_id(current_user)
    if user_id:
        data = get_section_data(user_id, TAX_YEAR, section)
        return {"section": section, "data": data}
    # Unauthenticated fallback
    path = USER_DATA / f"{section}.yaml"
    if not path.exists():
        raise HTTPException(404, f"Section '{section}' not found")
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return {"section": section, "data": data}
