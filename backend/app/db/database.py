from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base

DATABASE_URL = "postgresql://admin:admin123@postgres:5432/cloudapi"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Tạo bảng nếu chưa tồn tại
def init_db():
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
