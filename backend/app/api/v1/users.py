from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User
from pydantic import BaseModel
from typing import List
from app.security.authorization import require_roles

router = APIRouter(prefix="/api/v1/users", tags=["users"])


class UserCreate(BaseModel):
    email: str
    name: str
    role: str = "customer"


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str

    class Config:
        from_attributes = True  # Cho Pydantic V2
        orm_mode = True  # Cho Pydantic V1 (Chống lỗi 500)


@router.get("", response_model=List[UserResponse])
def get_users(request: Request, db: Session = Depends(get_db)):
    require_roles(request, {"admin"})
    return db.query(User).all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, request: Request, db: Session = Depends(get_db)):
    require_roles(request, {"admin"})
    # Tương thích mọi phiên bản Pydantic
    user_data = user.model_dump() if hasattr(user, "model_dump") else user.dict()
    db_user = User(**user_data)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, user: UserCreate, request: Request, db: Session = Depends(get_db)):
    require_roles(request, {"admin"})
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = user.model_dump() if hasattr(user, "model_dump") else user.dict()
    for key, value in user_data.items():
        setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return db_user
