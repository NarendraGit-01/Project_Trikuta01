from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.auth.deps import require_roles
from backend.app.core.database import get_db
from backend.app.core.security import get_password_hash
from backend.app.models.user import User
from backend.app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["User Administration"])


@router.get("", response_model=List[UserOut])
def list_users(
    current_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    return db.query(User).order_by(User.id).all()


@router.post("", response_model=UserOut)
def create_user(
    user_in: UserCreate,
    current_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(User.username == user_in.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    new_user = User(
        username=user_in.username,
        password_hash=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role.upper(),
        active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_dict = user_update.model_dump(exclude_unset=True)
    if "password" in update_dict:
        user.password_hash = get_password_hash(update_dict.pop("password"))
    if "role" in update_dict:
        user.role = update_dict["role"].upper()

    for k, v in update_dict.items():
        setattr(user, k, v)

    db.commit()
    db.refresh(user)
    return user
