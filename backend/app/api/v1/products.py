from fastapi import APIRouter

router = APIRouter()


@router.get("/products")
def get_products():
    return [
        {"id": 1, "name": "Laptop", "price": 1000},
        {"id": 2, "name": "Phone", "price": 500},
    ]
