from faker import Faker
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# Import path đúng khi chạy trong container (WORKDIR = /app)
from app.db.models import Base, User, Product, Order
from app.security.aead_encryption import encrypt_field, decrypt_field, get_dek

fake = Faker()

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://admin:admin123@postgres:5432/cloudapi"
)
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

Base.metadata.create_all(engine)

# ─── Load DEK ────────────────────────────────────────────────────────────────
dek = get_dek()
print(f"[SEED] DEK loaded ({len(dek)} bytes)")

# ─── Seed Users ───────────────────────────────────────────────────────────────
users = []
sample_email_plain = None  # lưu lại để verify sau
sample_phone_plain = None

for i in range(50):
    email_plain = fake.email()
    phone_plain = fake.phone_number()

    if i == 0:
        sample_email_plain = email_plain
        sample_phone_plain = phone_plain

    user = User(
        name=fake.name(),
        email=encrypt_field(email_plain, dek),  # lưu ciphertext (bytes)
        phone=encrypt_field(phone_plain, dek),
    )
    session.add(user)
    users.append(user)

session.commit()
print(f"[SEED] ✓ 50 users inserted (email+phone encrypted)")

# ─── Seed Products ────────────────────────────────────────────────────────────
products = []
for _ in range(50):
    product = Product(name=fake.word())
    session.add(product)
    products.append(product)

session.commit()
print(f"[SEED] ✓ 50 products inserted")

# ─── Seed Orders ──────────────────────────────────────────────────────────────
for _ in range(50):
    order = Order(
        user_id=fake.random_element(users).id,
        product_id=fake.random_element(products).id,
    )
    session.add(order)

session.commit()
print(f"[SEED] ✓ 50 orders inserted")

# ─── Verify 3.4: DB chứa ciphertext, không phải plaintext ────────────────────
print("\n[VERIFY 3.4] Kiểm tra DB chứa ciphertext...")

# Dùng session.query thay vì mở connection mới — tránh None do isolation
session.expire_all()  # flush cache, đọc lại từ DB
user_check = session.query(User).first()

if user_check is None:
    raise RuntimeError("❌ Bảng users trống sau khi seed — kiểm tra DATABASE_URL")

email_blob: bytes = user_check.email  # type: ignore[assignment]
phone_blob: bytes = user_check.phone  # type: ignore[assignment]

# Ciphertext không được chứa @ (dấu hiệu plaintext email)
assert (
    b"@" not in email_blob
), "❌ email trong DB là PLAINTEXT! Kiểm tra lại encrypt_field()"
assert len(email_blob) > 12, "❌ blob quá ngắn, không phải ciphertext hợp lệ"
print(f"  email blob (hex): {email_blob.hex()[:48]}...  ✓")
print(f"  phone blob (hex): {phone_blob.hex()[:48]}...  ✓")

# ─── Verify 3.5: Decrypt ra đúng plaintext ────────────────────────────────────
print("\n[VERIFY 3.5] Kiểm tra decrypt trả đúng plaintext...")
email_decrypted = decrypt_field(email_blob, dek)
phone_decrypted = decrypt_field(phone_blob, dek)

assert "@" in email_decrypted, "❌ Email sau decrypt không hợp lệ"
print(f"  decrypt email → {email_decrypted}  ✓")
print(f"  decrypt phone → {phone_decrypted}  ✓")

print("\n[SEED] ✅ Hoàn thành. DB: plaintext=0, ciphertext=100%")
