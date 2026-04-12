from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from cryptography.exceptions import InvalidTag
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import User as UserModel
from app.security.aead_encryption import decrypt_field, load_dek_from_env

router = APIRouter()

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://admin:admin123@postgres:5432/cloudapi"
)
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

dek = load_dek_from_env()


class User(BaseModel):
    id: int
    name: str
    email: str
    phone: str


def _row_to_user(row: UserModel) -> User:
    """Decrypt email/phone và trả về User schema. Raises InvalidTag nếu bị tamper."""
    email_plain = decrypt_field(bytes(row.email), dek)  # type: ignore[arg-type]
    phone_plain = decrypt_field(bytes(row.phone), dek)  # type: ignore[arg-type]
    return User(
        id=row.id,  # type: ignore[arg-type]
        name=row.name,  # type: ignore[arg-type]
        email=email_plain,
        phone=phone_plain,
    )


@router.get("/users", response_model=List[User])
def get_users():
    session = Session()
    try:
        rows = session.query(UserModel).all()
        result = []
        for row in rows:
            try:
                result.append(_row_to_user(row))
            except InvalidTag:
                raise HTTPException(
                    status_code=422,
                    detail=f"Data integrity check failed for user id={row.id}",
                )
        return result
    finally:
        session.close()


@router.get("/users/{user_id}", response_model=User)
def get_user(user_id: int):
    session = Session()
    try:
        row = session.query(UserModel).filter(UserModel.id == user_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        try:
            return _row_to_user(row)
        except InvalidTag:
            raise HTTPException(
                status_code=422,
                detail=f"Data integrity check failed for user id={user_id}",
            )
    finally:
        session.close()
