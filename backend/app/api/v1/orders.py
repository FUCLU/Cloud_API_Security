from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import Order
from pydantic import BaseModel
from typing import List
import hmac
from hashlib import sha256
import os

from app.security.bola_guard import can_read_order, roles_from_payload

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])


class OrderResponse(BaseModel):
    id: int
    status: str
    total: float

    class Config:
        from_attributes = True
        orm_mode = True


class OrderCreate(BaseModel):
    status: str = "pending"
    total: float


@router.get("", response_model=List[OrderResponse])
def get_orders(request: Request, db: Session = Depends(get_db)):
    token_payload = getattr(request.state, "user", None)
    if not token_payload:
        raise HTTPException(status_code=401, detail="Authentication required")

    roles = roles_from_payload(token_payload)
    if "admin" in roles or "staff" in roles:
        return db.query(Order).all()

    token_sub = token_payload.get("sub")
    if not token_sub:
        raise HTTPException(status_code=403, detail="Missing subject")
    return db.query(Order).filter(Order.user_id == str(token_sub)).all()


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, request: Request, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    token_payload = getattr(request.state, "user", None)
    if not token_payload:
        raise HTTPException(status_code=401, detail="Authentication required")

    # BOLA LOGIC: customer chỉ được xem order thuộc subject của chính mình.
    # Admin/staff được phép xem để vận hành đơn hàng.
    order_owner_id = getattr(order, "user_id", None)
    if not can_read_order(order_owner_id, token_payload):
        raise HTTPException(status_code=403, detail="Forbidden")

    return order


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(order: OrderCreate, request: Request, db: Session = Depends(get_db)):
    token_payload = getattr(request.state, "user", None)
    if not token_payload:
        raise HTTPException(status_code=401, detail="Authentication required")

    token_sub = token_payload.get("sub")
    if not token_sub:
        raise HTTPException(status_code=403, detail="Missing subject")

    order_data = order.model_dump() if hasattr(order, "model_dump") else order.dict()
    order_data["user_id"] = str(token_sub)
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
async def order_webhook(request: Request):
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

    # So sánh an toàn chống Timing Attack
    if not hmac.compare_digest(expected_sig, sig_header):
        raise HTTPException(status_code=401, detail="Invalid signature")

    return {"message": "Webhook OK"}
