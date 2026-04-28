from sqlalchemy import Column, Integer, String, LargeBinary, Float
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)

    # Đổi tạm thành String để test API CRUD.
    # Khi nào code logic mã hóa thì đổi lại thành LargeBinary
    email = Column(String, unique=True)

    # 🔐 encrypted fields
    phone = Column(LargeBinary, nullable=True)

    # BỔ SUNG CỘT CÒN THIẾU
    role = Column(String, default="customer")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)

    # BỔ SUNG CỘT CÒN THIẾU
    price = Column(Float)
    stock = Column(Integer)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    product_id = Column(Integer, nullable=True)

    # BỔ SUNG CỘT CÒN THIẾU
    status = Column(String, default="pending")
    total = Column(Float)
