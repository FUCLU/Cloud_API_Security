from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()  


class Order(BaseModel):
    id: int
    user_id: int
    total: float
    status: str


orders_db = [
    {"id": 101, "user_id": 1, "total": 35990000, "status": "completed"},
    {"id": 102, "user_id": 2, "total": 28990000, "status": "processing"},
    {"id": 103, "user_id": 3, "total": 5990000, "status": "pending"},
]


@router.get("/orders", response_model=List[Order])
async def get_orders():
    return orders_db
