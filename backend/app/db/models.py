from sqlalchemy import Column, Integer, String, LargeBinary, Float
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id       = Column(Integer, primary_key=True, index=True)
    name     = Column(String)
    email    = Column(String, unique=True)
    phone    = Column(LargeBinary, nullable=True)
    role     = Column(String, default="customer")
    totp_secret = Column(String, nullable=True)
    # nullable=True vì:
    # - Customer không cần TOTP
    # - Admin/Staff chỉ có sau khi setup lần đầu


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    price = Column(Float)
    stock = Column(Integer)


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    product_id = Column(Integer, nullable=True)
    status = Column(String, default="pending")
    total = Column(Float)
