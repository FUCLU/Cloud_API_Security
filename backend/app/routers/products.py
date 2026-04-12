from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()  # ← Quan trọng


class Product(BaseModel):
    id: int
    name: str
    price: float
    stock: int


products_db = [
    {"id": 1, "name": "Laptop Dell XPS", "price": 29990000, "stock": 15},
    {"id": 2, "name": "iPhone 15 Pro", "price": 28990000, "stock": 23},
    {"id": 3, "name": "Tai nghe AirPods Pro", "price": 5990000, "stock": 45},
]


@router.get("/products", response_model=List[Product])
async def get_products():
    return products_db
