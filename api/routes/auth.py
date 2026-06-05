from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr

from api.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    logout_token,
    oauth2_scheme,
    verify_password,
)
from api.db import create_user, get_user_by_email

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterBody(BaseModel):
    email: EmailStr
    password: str
    display_name: str = ""


class LoginBody(BaseModel):
    email: EmailStr
    password: str


@router.post("/register", status_code=201)
def register(body: RegisterBody):
    if len(body.password) < 8:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "Password must be at least 8 characters")
    if get_user_by_email(body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user_id = create_user(body.email, hash_password(body.password), body.display_name)
    token = create_access_token(user_id, body.email.lower().strip())
    return {"token": token, "token_type": "bearer", "user_id": user_id}


@router.post("/login")
def login(body: LoginBody):
    user = get_user_by_email(body.email)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user.get("is_active"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")
    token = create_access_token(user["id"], user["email"])
    return {"token": token, "token_type": "bearer", "user_id": user["id"],
            "display_name": user.get("display_name", "")}


@router.post("/logout")
def logout(token: str | None = Depends(oauth2_scheme),
           current_user: dict = Depends(get_current_user)):
    if token:
        logout_token(token)
    return {"logged_out": True}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "display_name": current_user.get("display_name", ""),
    }
