from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.user import UserLogin, Token, UserOut, UserCreate
from app.auth import verify_password, get_password_hash, create_access_token, get_current_user, require_role

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": user.id, "role": user.role, "email": user.email, "phc_id": user.phc_id}
    )

    # Log audit event
    audit = AuditLog(
        id=f"aud_{int(datetime.utcnow().timestamp()*1000)}",
        user_id=user.id,
        action="USER_LOGIN",
        entity="users",
        entity_id=user.id,
        details=f"User {user.email} logged in with role {user.role}"
    )
    db.add(audit)
    db.commit()

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["district_admin", "block_officer"]))
):
    users = db.query(User).all()
    return [UserOut.model_validate(u) for u in users]
