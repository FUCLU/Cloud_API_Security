"""
seed_data.py — Insert 50 records vào mỗi bảng: users, products, orders
Chạy: docker compose exec backend python -m app.db.seed_data
"""

from __future__ import annotations

import os
import random
import uuid
from datetime import datetime, timedelta

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import (
    Base, Order, OrderStatus, Product, ProductCategory, User, UserRole,
)

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://admin:admin123@api-postgres:5432/cloudapi",
)

engine       = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def mock_encrypt(plaintext: str) -> str:
    import base64
    return f"vault:v1:{base64.b64encode(plaintext.encode()).decode()}"


FIRST_NAMES = ["Minh","Hùng","Phúc","Kiệt","An","Bảo","Châu","Dũng","Giang","Hà",
                "Hải","Hoa","Khánh","Lan","Long","Mai","Nam","Nga","Ngọc","Nhung",
                "Quân","Tài","Thảo","Thu","Thùy","Tiến","Trang","Trung","Tuấn","Việt"]

LAST_NAMES  = ["Nguyễn","Trần","Lê","Phạm","Hoàng","Huỳnh","Phan",
                "Vũ","Võ","Đặng","Bùi","Đỗ","Hồ","Ngô","Dương"]

PRODUCT_NAMES = {
    ProductCategory.electronics: ["Laptop Dell XPS 15","iPhone 15 Pro","Samsung Galaxy S24",
        "MacBook Air M3","iPad Pro 12.9","AirPods Pro","Sony WH-1000XM5","LG OLED TV 55",
        "Logitech MX Master 3","Samsung SSD 1TB","Keyboard Keychron","Webcam Logitech C920"],
    ProductCategory.clothing:    ["Áo thun basic nam","Quần jean slim fit","Áo khoác denim",
        "Váy maxi hoa","Áo sơ mi trắng nữ","Quần jogger cotton","Áo hoodie oversize",
        "Đầm công sở","Quần short thể thao","Áo polo nam"],
    ProductCategory.food:        ["Cà phê Arabica 500g","Trà xanh Thái Nguyên","Mật ong nguyên chất",
        "Hạt macadamia rang","Chocolate đen 70%","Bánh granola yến mạch",
        "Nước mắm Phú Quốc","Dầu oliu nguyên chất","Sữa hạnh nhân","Nước ép việt quất"],
    ProductCategory.furniture:   ["Bàn làm việc đứng","Ghế công thái học","Kệ sách gỗ sồi",
        "Đèn bàn LED","Tủ đầu giường","Giường ngủ 1m8","Sofa góc L",
        "Bàn cà phê kính cường lực","Tủ quần áo 3 cánh","Kệ TV treo tường"],
    ProductCategory.other:       ["Bút máy cao cấp","Sổ tay da thật","Balo laptop 15",
        "Ví da nam","Túi xách nữ","Đồng hồ thể thao","Kính mát UV400",
        "Mũ bucket","Thảm yoga TPE","Bình giữ nhiệt 500ml"],
}

PRICE_RANGE = {
    ProductCategory.electronics: (500_000,  50_000_000),
    ProductCategory.clothing:    (150_000,   2_000_000),
    ProductCategory.food:         (50_000,     500_000),
    ProductCategory.furniture:   (500_000,  20_000_000),
    ProductCategory.other:       (100_000,   5_000_000),
}

ADDRESSES = [
    "123 Nguyễn Huệ, Q1, TP.HCM","456 Lê Lợi, Q3, TP.HCM",
    "789 Trần Hưng Đạo, Q5, TP.HCM","321 Đinh Tiên Hoàng, Bình Thạnh, TP.HCM",
    "654 Võ Văn Tần, Q3, TP.HCM","987 Cách Mạng Tháng 8, Q10, TP.HCM",
]


def seed_users(session: Session, count: int = 50) -> list[User]:
    existing = session.query(User).count()
    if existing >= count:
        print(f"  ✓ users đã có {existing} records — bỏ qua")
        return list(session.query(User).all())
    print(f"  → Inserting {count} users...")
    fixed = [
        User(id=str(uuid.uuid4()), username="phuc",
             email_enc=mock_encrypt("phuc@company.com"), phone_enc=mock_encrypt("0901234567"),
             full_name="Lưu Hồng Phúc", role=UserRole.admin, is_active=1,
             keycloak_id="user-admin-001", department="engineering",
             created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
        User(id=str(uuid.uuid4()), username="kiet",
             email_enc=mock_encrypt("kiet@company.com"), phone_enc=mock_encrypt("0902345678"),
             full_name="Võ Tưởng Tuấn Kiệt", role=UserRole.staff, is_active=1,
             keycloak_id="user-staff-001", department="operations",
             created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
        User(id=str(uuid.uuid4()), username="an",
             email_enc=mock_encrypt("an@gmail.com"), phone_enc=mock_encrypt("0903456789"),
             full_name="Nguyễn An", role=UserRole.customer, is_active=1,
             keycloak_id="user-customer-001", department="external",
             created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
    ]
    session.add_all(fixed)
    role_pool = [UserRole.admin]*1 + [UserRole.staff]*6 + [UserRole.customer]*40
    random.shuffle(role_pool)
    randoms = []
    for i, role in enumerate(role_pool):
        dept = {UserRole.admin:"engineering",UserRole.staff:"operations",UserRole.customer:"external"}[role]
        randoms.append(User(
            id=str(uuid.uuid4()), username=f"user_{i+1:03d}",
            email_enc=mock_encrypt(f"user_{i+1:03d}@example.com"),
            phone_enc=mock_encrypt(f"09{random.randint(10_000_000,99_999_999)}"),
            full_name=f"{random.choice(LAST_NAMES)} {random.choice(FIRST_NAMES)}",
            role=role, is_active=random.choices([1,0],weights=[95,5])[0],
            keycloak_id=None, department=dept,
            created_at=datetime.utcnow()-timedelta(days=random.randint(0,365)),
            updated_at=datetime.utcnow(),
        ))
    session.add_all(randoms)
    session.flush()
    print(f"  ✓ Inserted {len(fixed)+len(randoms)} users")
    return fixed + randoms


def seed_products(session: Session, count: int = 50) -> list[Product]:
    existing = session.query(Product).count()
    if existing >= count:
        print(f"  ✓ products đã có {existing} records — bỏ qua")
        return list(session.query(Product).all())
    print(f"  → Inserting {count} products...")
    products, sku_idx = [], 1
    for category in ProductCategory:
        names = PRODUCT_NAMES[category]
        lo, hi = PRICE_RANGE[category]
        for j in range(10):
            name = names[j % len(names)]
            products.append(Product(
                id=str(uuid.uuid4()), name=name,
                description=f"{name} — chất lượng cao, danh mục {category.value}",
                category=category, price=round(random.uniform(lo,hi),0),
                stock=random.randint(0,200),
                sku=f"SKU-{category.value[:3].upper()}-{sku_idx:04d}",
                image_url=f"https://picsum.photos/seed/{sku_idx}/400/300",
                is_active=random.choices([1,0],weights=[90,10])[0],
                created_at=datetime.utcnow()-timedelta(days=random.randint(0,180)),
                updated_at=datetime.utcnow(),
            ))
            sku_idx += 1
    session.add_all(products)
    session.flush()
    print(f"  ✓ Inserted {len(products)} products")
    return products


def seed_orders(session: Session, users: list, products: list, count: int = 50) -> list[Order]:
    existing = session.query(Order).count()
    if existing >= count:
        print(f"  ✓ orders đã có {existing} records — bỏ qua")
        return list(session.query(Order).all())
    print(f"  → Inserting {count} orders...")
    customers = [u for u in users if u.role == UserRole.customer] or users
    active    = [p for p in products if p.is_active == 1] or products
    statuses  = list(OrderStatus)
    weights   = [30,20,20,25,5]
    orders    = []
    notes     = [None,None,None,"Giao giờ hành chính","Để trước cửa","Gọi trước khi giao"]
    for _ in range(count):
        user    = random.choice(customers)
        product = random.choice(active)
        qty     = random.randint(1,5)
        created = datetime.utcnow()-timedelta(days=random.randint(0,90))
        orders.append(Order(
            id=str(uuid.uuid4()), user_id=str(user.id), product_id=str(product.id),
            quantity=qty, unit_price=float(product.price),
            total_price=round(qty*float(product.price),0),
            status=random.choices(statuses,weights=weights)[0],
            shipping_address_enc=mock_encrypt(random.choice(ADDRESSES)),
            note=random.choice(notes), created_at=created,
            updated_at=created+timedelta(hours=random.randint(0,48)),
        ))
    session.add_all(orders)
    session.flush()
    print(f"  ✓ Inserted {len(orders)} orders")
    return orders


def run_seed() -> None:
    print("\n🌱 Starting seed_data.py")
    print(f"   DATABASE_URL = {DATABASE_URL}\n")
    print("📦 Creating tables (if not exist)...")
    Base.metadata.create_all(bind=engine)
    print("   ✓ Tables ready\n")
    session: Session = SessionLocal()
    try:
        print("👤 Seeding users...")
        users = seed_users(session)
        print("\n🛍️  Seeding products...")
        products = seed_products(session)
        print("\n📦 Seeding orders...")
        seed_orders(session, users, products)
        session.commit()
        print("\n✅ Verification:")
        u = session.execute(text("SELECT COUNT(*) FROM users")).scalar_one()
        p = session.execute(text("SELECT COUNT(*) FROM products")).scalar_one()
        o = session.execute(text("SELECT COUNT(*) FROM orders")).scalar_one()
        print(f"   users    → {u}")
        print(f"   products → {p}")
        print(f"   orders   → {o}")
        assert u == 50 and p == 50 and o == 50, "❌ Count mismatch!"
        print("\n🎉 Seed completed successfully!\n")
    except Exception as exc:
        session.rollback()
        print(f"\n❌ Seed failed: {exc}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    run_seed()
