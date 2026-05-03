from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

router = APIRouter(prefix="/api/v1/users", tags=["users"])


# --- SCHEMAS ---
class UserCreate(BaseModel):
    # Dùng EmailStr chặn ngay email sai định dạng từ Gateway
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=50, description="Họ và tên user")
    role: str = Field(default="customer", pattern="^(customer|admin)$")


class UserUpdate(BaseModel):
    # Model riêng cho Cập nhật (Ngăn hacker sửa email hoặc tự thăng quyền admin)
    name: Optional[str] = Field(None, min_length=2, max_length=50)


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str

    class Config:
        from_attributes = True
        orm_mode = True


# --- ENDPOINTS ---
@router.get("", response_model=List[UserResponse])
def get_users(db: Session = Depends(get_db)):
    return db.query(User).all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    user_data = user.model_dump() if hasattr(user, "model_dump") else user.dict()
    db_user = User(**user_data)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, user: UserUpdate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = (
        user.model_dump(exclude_unset=True)
        if hasattr(user, "model_dump")
        else user.dict(exclude_unset=True)
    )
    for key, value in user_data.items():
        setattr(db_user, key, value)

    db.commit()
    db.refresh(db_user)
    return db_user
