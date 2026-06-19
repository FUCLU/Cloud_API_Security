from sqlalchemy import create_engine
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker, Session
from .models import Base
import os


DB_USER = os.getenv("POSTGRES_USER", "admin")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "Pg$8kL2!nX5rQ9vW")
DB_HOST = os.getenv("POSTGRES_HOST", "postgres")
DB_NAME = os.getenv("POSTGRES_DB", "cloudapi")

# Lắp ghép URL kết nối
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:5432/{DB_NAME}",
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Dependency injection cho database session"""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    # Keep the dev database compatible with the current BOLA model.
    # Existing demo rows with integer owners become text; new rows use Keycloak `sub`.
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE orders "
                "ALTER COLUMN user_id TYPE VARCHAR USING user_id::text"
            )
        )


if __name__ == "__main__":
    init_db()
