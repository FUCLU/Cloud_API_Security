"""
models.py — SQLAlchemy ORM models
Tables: users, products, orders

Bảo mật:
- Các field nhạy cảm (email, phone, shipping_address) lưu dưới dạng ciphertext
- Plaintext KHÔNG BAO GIỜ được lưu trực tiếp vào DB (Invariant I1)
- Encryption/decryption thực hiện qua Vault Transit Engine
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def generate_uuid() -> str:
    return str(uuid.uuid4())


# ─────────────────────────────────────────────
# ENUMS
# ─────────────────────────────────────────────


class UserRole(str, enum.Enum):
    admin = "admin"
    staff = "staff"
    customer = "customer"


class OrderStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    shipping = "shipping"
    completed = "completed"
    cancelled = "cancelled"


class ProductCategory(str, enum.Enum):
    electronics = "electronics"
    clothing = "clothing"
    food = "food"
    furniture = "furniture"
    other = "other"


# ─────────────────────────────────────────────
# TABLE: users
# ─────────────────────────────────────────────


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    username: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )

    # AEAD encrypted — lưu ciphertext (vault:v1:...)
    email_enc: Mapped[str] = mapped_column(Text, nullable=False)
    phone_enc: Mapped[str | None] = mapped_column(Text, nullable=True)

    full_name: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole), nullable=False, default=UserRole.customer
    )
    is_active: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1
    )  # 1=active, 0=locked
    department: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Keycloak subject ID — dùng để BOLA check (token.sub == user.keycloak_id)
    keycloak_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True, unique=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    orders: Mapped[list[Order]] = relationship(
        "Order", back_populates="owner", foreign_keys="Order.user_id"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username} role={self.role}>"


# ─────────────────────────────────────────────
# TABLE: products
# ─────────────────────────────────────────────


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[ProductCategory] = mapped_column(
        SAEnum(ProductCategory), nullable=False, default=ProductCategory.other
    )
    price: Mapped[float] = mapped_column(Float, nullable=False)
    stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sku: Mapped[str] = mapped_column(
        String(32), nullable=False, unique=True, index=True
    )
    image_url: Mapped[str | None] = mapped_column(String(256), nullable=True)
    is_active: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    orders: Mapped[list[Order]] = relationship(
        "Order", back_populates="product", foreign_keys="Order.product_id"
    )

    def __repr__(self) -> str:
        return f"<Product id={self.id} name={self.name} price={self.price}>"


# ─────────────────────────────────────────────
# TABLE: orders
# ─────────────────────────────────────────────


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)

    # Foreign keys
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("products.id"), nullable=False, index=True
    )

    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(
        Float, nullable=False
    )  # snapshot giá lúc đặt
    total_price: Mapped[float] = mapped_column(
        Float, nullable=False
    )  # quantity * unit_price

    status: Mapped[OrderStatus] = mapped_column(
        SAEnum(OrderStatus), nullable=False, default=OrderStatus.pending
    )

    # AEAD encrypted — địa chỉ giao hàng là dữ liệu nhạy cảm
    shipping_address_enc: Mapped[str | None] = mapped_column(Text, nullable=True)

    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    owner: Mapped[User] = relationship(
        "User", back_populates="orders", foreign_keys=[user_id]
    )
    product: Mapped[Product] = relationship(
        "Product", back_populates="orders", foreign_keys=[product_id]
    )

    def __repr__(self) -> str:
        return f"<Order id={self.id} user={self.user_id} product={self.product_id} status={self.status}>"
