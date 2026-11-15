from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.auth.deps import get_current_user
from backend.app.core.database import get_db
from backend.app.core.security import create_access_token, verify_password, get_password_hash
from backend.app.models.user import User
from backend.app.schemas.user import ChangePasswordRequest, LoginRequest, ResetPasswordRequest, Token, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
def login(login_req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_req.username).first()
    if not user or not verify_password(login_req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    access_token = create_access_token(subject=user.username, role=user.role)
    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        username=user.username,
        user_id=user.id,
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Successfully logged out"}


@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.password_hash = get_password_hash(req.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.post("/reset-password")
def reset_password(
    req: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    email = req.email.strip().lower()
    user = db.query(User).filter(User.username.ilike(email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="No registered account found with that email address.")

    # Only authorized administrator email can self-reset
    if email != "narendra.r10109@gmail.com":
        raise HTTPException(status_code=403, detail="Self-reset is only permitted for the registered administrator email.")

    user.password_hash = get_password_hash(req.new_password)
    user.active = True
    db.commit()
    return {"message": f"Password for {user.username} has been successfully reset! You can now log in."}
