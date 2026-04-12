from fastapi import APIRouter

router = APIRouter()


@router.get("/orders")
def get_orders():
    return [
        {"id": 1, "user_id": 1, "product_id": 1},
        {"id": 2, "user_id": 2, "product_id": 2},
    ]
