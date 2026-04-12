from sqlalchemy import Column, Integer, String, LargeBinary
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String)

    # 🔐 encrypted fields
    email = Column(LargeBinary)  # BYTEA
    phone = Column(LargeBinary)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True)
    name = Column(String)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    product_id = Column(Integer)
