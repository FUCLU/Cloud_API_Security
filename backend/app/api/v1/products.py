from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import Product
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/api/v1/products", tags=["products"])


class ProductCreate(BaseModel):
    name: str
    price: float
    stock: int


class ProductResponse(BaseModel):
    id: int
    name: str
    price: float
    stock: int

    class Config:
        from_attributes = True
        orm_mode = True


@router.get("", response_model=List[ProductResponse])
def get_products(db: Session = Depends(get_db)):
    return db.query(Product).all()


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    product_data = (
        product.model_dump() if hasattr(product, "model_dump") else product.dict()
    )
    db_product = Product(**product_data)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int, product: ProductCreate, db: Session = Depends(get_db)
):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    product_data = (
        product.model_dump() if hasattr(product, "model_dump") else product.dict()
    )
    for key, value in product_data.items():
        setattr(db_product, key, value)
    db.commit()
    db.refresh(db_product)
    return db_product
