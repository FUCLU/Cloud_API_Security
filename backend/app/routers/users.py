from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()  # ← Phải có dòng này


class User(BaseModel):
    id: int
    email: str
    full_name: str
    role: str


users_db = [
    {"id": 1, "email": "admin@company.com", "full_name": "Admin User", "role": "admin"},
    {"id": 2, "email": "staff@company.com", "full_name": "Staff User", "role": "user"},
    {
        "id": 3,
        "email": "customer@gmail.com",
        "full_name": "Customer User",
        "role": "user",
    },
]


@router.get("/users", response_model=List[User])
async def get_users():
    return users_db
