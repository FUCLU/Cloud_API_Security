from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import Order
from pydantic import BaseModel, Field
from typing import List, Optional
import hmac
from hashlib import sha256
import os

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])


# --- SCHEMAS ---
class OrderCreate(BaseModel):
    status: str = Field(
        default="pending", pattern="^(pending|shipped|completed|cancelled)$"
    )
    total: float = Field(..., gt=0, description="Tổng tiền phải lớn hơn 0")


class OrderResponse(BaseModel):
    id: int
    user_id: Optional[int] = None  # Thêm trường này để Swagger UI hiển thị đầy đủ
    status: str
    total: float

    class Config:
        from_attributes = True
        orm_mode = True


class WebhookPayload(BaseModel):
    # Schema này chỉ để OpenAPI vẽ tài liệu (Swagger), validation thực tế vẫn xử lý ở hàm
    order_id: int
    status: str


# --- ENDPOINTS ---
@router.get("", response_model=List[OrderResponse])
def get_orders(db: Session = Depends(get_db)):
    return db.query(Order).all()


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, request: Request, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if not hasattr(request.state, "token") or not request.state.token:
        raise HTTPException(status_code=401, detail="Authentication required")

    token_sub = request.state.token.get("sub")

    # BOLA LOGIC: Chặn User A xem Order của User B
    order_owner_id = getattr(order, "user_id", None)
    if order_owner_id is not None and str(order_owner_id) != str(token_sub):
        raise HTTPException(status_code=403, detail="Forbidden")

    return order


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    order_data = order.model_dump() if hasattr(order, "model_dump") else order.dict()
    db_order = Order(**order_data)
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    db_order = db.query(Order).filter(Order.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(db_order)
    db.commit()
    return None


@router.post("/webhooks/orders")
async def order_webhook(request: Request, payload: WebhookPayload):
    # Gắn 'payload: WebhookPayload' để sinh OpenAPI docs, nhưng vẫn đọc 'request.body()' để verify HMAC byte-by-byte
    body = await request.body()
    timestamp = request.headers.get("X-Timestamp")
    sig_header = request.headers.get("X-Signature")

    if not timestamp or not sig_header:
        raise HTTPException(
            status_code=401, detail="Missing X-Timestamp or X-Signature"
        )

    secret = os.getenv("WEBHOOK_SECRET", "your-super-secret-webhook-key-2026")

    expected_sig = hmac.new(
        secret.encode(), f"{timestamp}.".encode() + body, sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, sig_header):
        raise HTTPException(status_code=401, detail="Invalid signature")

    return {"message": "Webhook OK"}
