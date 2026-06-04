"""
JWT authentication utilities for UTBIS.

Requires env var JWT_SECRET_KEY (min 32 chars). Falls back to a dev-only
default so the server starts without config; override in production.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import bcrypt as _bcrypt
from jose import JWTError, jwt

from api.db import (
    get_user_by_id,
    is_token_revoked,
    revoke_token,
)

_SECRET = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-me-in-production-32ch")
_ALGORITHM = "HS256"
_ACCESS_TOKEN_EXPIRE_MINUTES = 60

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


# ── Password ───────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


# ── JWT ────────────────────────────────────────────────────────────────────────

def create_access_token(user_id: str, email: str) -> str:
    jti = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) + timedelta(minutes=_ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "email": email,
        "jti": jti,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, _SECRET, algorithm=_ALGORITHM)


def _decode_raw(token: str) -> dict:
    try:
        return jwt.decode(token, _SECRET, algorithms=[_ALGORITHM])
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


# ── FastAPI dependencies ───────────────────────────────────────────────────────

def get_current_user(token: str | None = Depends(oauth2_scheme)) -> dict:
    """Require a valid JWT. Raises 401 if missing or invalid."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = _decode_raw(token)
    jti = payload.get("jti", "")
    if is_token_revoked(jti):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")
    user_id = payload.get("sub")
    user = get_user_by_id(user_id) if user_id else None
    if not user or not user.get("is_active"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_user_optional(token: str | None = Depends(oauth2_scheme)) -> dict | None:
    """Return current user if token present and valid, else None (no error)."""
    if not token:
        return None
    try:
        return get_current_user(token)
    except HTTPException:
        return None


def logout_token(token: str) -> None:
    """Add token JTI to revocation list."""
    try:
        payload = _decode_raw(token)
        jti = payload.get("jti", "")
        exp = payload.get("exp")
        if jti and exp:
            expires_at = datetime.fromtimestamp(exp, tz=timezone.utc).isoformat()
            revoke_token(jti, expires_at)
    except HTTPException:
        pass  # already invalid — nothing to revoke
