"""
One-time YAML → DB migration.

Runs idempotently on every startup (skips if users table already has rows).
Creates a default admin user from existing YAML data so the app works immediately.
"""

from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent

DEFAULT_USER_ID    = "00000000-0000-0000-0000-000000000001"
DEFAULT_USER_EMAIL = "admin@localhost"
DEFAULT_PASSWORD   = "changeme123"

_SECTION_YAML_MAP = {
    "household":      "household.yaml",
    "income":         "income.yaml",
    "businesses":     "businesses.yaml",
    "real_estate":    "real_estate.yaml",
    "investments":    "investments.yaml",
    "retirement":     "retirement.yaml",
    "healthcare":     "healthcare.yaml",
    "dependents":     "dependents.yaml",
    "goals":          "goals.yaml",
    "documents_index": "documents_index.yaml",
}


def migrate_yaml_if_needed() -> None:
    from api.db import (
        _conn, create_user, save_section_data, user_count,
    )
    from api.auth import hash_password

    if user_count() > 0:
        return  # already migrated

    print("[migrate] No users found — importing YAML data into DB for default user…")

    # Create default user
    try:
        create_user(DEFAULT_USER_EMAIL, hash_password(DEFAULT_PASSWORD), "Admin")
    except Exception:
        pass  # user may already exist from a partial run

    # Look up the actual user_id (may differ if create_user generated a UUID)
    from api.db import get_user_by_email
    user = get_user_by_email(DEFAULT_USER_EMAIL)
    if not user:
        print("[migrate] ERROR: could not create default user")
        return
    uid = user["id"]

    # Import each YAML section
    data_dir = ROOT / "user_data"
    imported = 0
    for section, filename in _SECTION_YAML_MAP.items():
        path = data_dir / filename
        if not path.exists():
            continue
        try:
            with open(path, encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            if data:
                save_section_data(uid, 2025, section, data)
                imported += 1
        except Exception as exc:
            print(f"[migrate] WARNING: could not import {filename}: {exc}")

    # Assign orphaned transactions to default user
    try:
        with _conn() as c:
            c.execute("UPDATE transactions SET user_id=? WHERE user_id IS NULL", (uid,))
    except Exception as exc:
        print(f"[migrate] WARNING: could not assign transactions: {exc}")

    print(
        f"[migrate] Done. Imported {imported} sections for {DEFAULT_USER_EMAIL}.\n"
        f"[migrate] Default credentials: {DEFAULT_USER_EMAIL} / {DEFAULT_PASSWORD}\n"
        f"[migrate] IMPORTANT: Change the password after first login!"
    )
