import pyotp
import qrcode
from io import BytesIO
from base64 import b64encode
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.models import User

# ── DB session ───────────────────────────────────────────────────
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/totp/setup")
async def get_totp_setup(request: Request, db: Session = Depends(get_db)):
    """
    Lấy secret + QR code để setup TOTP lần đầu
    Chỉ dành cho admin/staff
    """
    # Lấy email từ payload
    payload = request.state.user
    email = payload.get("email")
    roles = payload.get("realm_access", {}).get("roles", [])

    # Kiểm tra role
    if not any(r in roles for r in ["admin", "staff"]):
        raise HTTPException(status_code=403, detail="Chỉ admin/staff được setup TOTP")

    # Kiểm tra user đã setup chưa
    user = db.query(User).filter(User.email == email).first()
    if user and user.totp_secret:
        raise HTTPException(status_code=400, detail="User đã setup TOTP rồi")

    # Sinh secret
    secret = pyotp.random_base32()

    # Sinh QR code
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=email,
        issuer_name="E-Market Cloud API"
    )

    # QR code → base64 data URL
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    # Convert to base64
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = b64encode(buffered.getvalue()).decode()
    qr_code_url = f"data:image/png;base64,{img_str}"

    return {
        "secret": secret,
        "qr_code_url": qr_code_url,
        "provisioning_uri": provisioning_uri,
        "message": "Quét QR code bằng ứng dụng authenticator"
    }


@router.post("/totp/verify-setup")
async def verify_totp_setup(
    request: Request,
    payload_dict: dict,
    db: Session = Depends(get_db)
):
    """
    Verify mã TOTP + lưu secret vào DB
    """
    try:
        body = payload_dict  # FastAPI auto-parse JSON body
    except:
        raise HTTPException(status_code=400, detail="Invalid request body")

    totp_code = body.get("totp_code")
    if not totp_code or len(totp_code) != 6:
        raise HTTPException(status_code=400, detail="Mã TOTP phải 6 chữ số")

    # Lấy email từ JWT
    user_payload = request.state.user
    email = user_payload.get("email")
    roles = user_payload.get("realm_access", {}).get("roles", [])

    # Kiểm tra role
    if not any(r in roles for r in ["admin", "staff"]):
        raise HTTPException(status_code=403, detail="Chỉ admin/staff được setup TOTP")

    # Lấy secret từ sessionStorage (hoặc generate lại)
    # Thực tế, frontend sẽ gửi secret hoặc tôi lấy từ temp store
    # Tạm thời: generate lại + verify
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tìm thấy")

    # Lấy secret từ request body (frontend gửi lại)
    secret = body.get("secret")
    if not secret:
        raise HTTPException(status_code=400, detail="Thiếu secret")

    # Verify TOTP code
    totp = pyotp.TOTP(secret)
    if not totp.verify(totp_code, valid_window=1):
        raise HTTPException(status_code=401, detail="Mã TOTP không hợp lệ")

    user.totp_secret = secret
    db.commit()

    return {
        "message": "✓ Setup TOTP thành công",
        "email": email,
        "role": next((r for r in roles if r in ["admin", "staff"]), None)
    }
