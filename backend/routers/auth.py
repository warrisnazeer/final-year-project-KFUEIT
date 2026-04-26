"""
Auth Router — JWT-based authentication for single-user account.

POST /api/auth/login   — username + password → JWT token
GET  /api/auth/me      — validate token, return user info
"""

import os
import jwt
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
import bcrypt
from pydantic import BaseModel

from database import get_db
from models import User

router = APIRouter()
logger = logging.getLogger(__name__)

JWT_SECRET = os.getenv("JWT_SECRET", "news-narrative-secret-key-2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 72  # Token valid for 3 days


class LoginRequest(BaseModel):
    username: str
    password: str


def create_token(user_id: int, username: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    """Dependency to extract and validate JWT token. Returns User or None."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = db.query(User).filter(User.user_id == payload["user_id"]).first()
        return user
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def require_user(authorization: str = Header(...), db: Session = Depends(get_db)):
    """Dependency that REQUIRES a valid logged-in user. Raises 401 if not."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = db.query(User).filter(User.user_id == payload["user_id"]).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    try:
        if not bcrypt.checkpw(body.password.encode('utf-8'), user.password_hash.encode('utf-8')):
            raise HTTPException(status_code=401, detail="Invalid username or password")
    except ValueError:
        # Catch errors if stored hash is somehow invalid format
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_token(user.user_id, user.username)
    return {
        "token": token,
        "user": {
            "user_id": user.user_id,
            "username": user.username,
            "email": user.email,
        },
    }


@router.get("/me")
def get_me(user: User = Depends(require_user)):
    return {
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }
