"""
database.py — SQLAlchemy engine + session factory

Import trong các service:
    from app.db.database import get_db, engine

Dùng trong FastAPI dependency injection:
    def some_endpoint(db: Session = Depends(get_db)):
        ...
"""

import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# DATABASE_URL lấy từ .env (docker-compose inject vào container)
# Format: postgresql://admin:<POSTGRES_PASSWORD>@postgres:5432/cloudapi
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://admin:admin123@api-postgres:5432/cloudapi",  # fallback dev
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # kiểm tra connection trước khi dùng
    pool_size=10,
    max_overflow=20,
    echo=False,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency — tự động đóng session sau mỗi request."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
