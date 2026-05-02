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

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine)

router = APIRouter(prefix='/api/v1/auth', tags=['auth'])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get('/totp/status')
async def get_totp_status(request: Request, db: Session = Depends(get_db)):
    payload = request.state.user
    email = payload.get('email')
    roles = payload.get('realm_access', {}).get('roles', [])

    role = next((r for r in roles if r in ['admin', 'staff']), None)
    if role is None:
        return {'required': False, 'configured': False}

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, name=payload.get('name') or email, role=role)
        db.add(user)
        db.commit()
        db.refresh(user)
    configured = bool(user and user.totp_secret)
    return {'required': True, 'configured': configured}


@router.get('/totp/setup')
async def get_totp_setup(request: Request, db: Session = Depends(get_db)):
    payload = request.state.user
    email = payload.get('email')
    roles = payload.get('realm_access', {}).get('roles', [])

    if not any(r in roles for r in ['admin', 'staff']):
        raise HTTPException(status_code=403, detail='Only admin/staff can setup TOTP')

    user = db.query(User).filter(User.email == email).first()
    if not user:
        role = next((r for r in roles if r in ['admin', 'staff']), 'staff')
        user = User(email=email, name=payload.get('name') or email, role=role)
        db.add(user)
        db.commit()
        db.refresh(user)
    if user and user.totp_secret:
        raise HTTPException(status_code=400, detail='User already configured TOTP')

    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(name=email, issuer_name='E-Market Cloud API')

    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white')

    buffered = BytesIO()
    img.save(buffered, format='PNG')
    img_str = b64encode(buffered.getvalue()).decode()
    qr_code_url = f'data:image/png;base64,{img_str}'

    return {
        'secret': secret,
        'qr_code_url': qr_code_url,
        'provisioning_uri': provisioning_uri,
        'message': 'Scan QR code with authenticator app',
    }


@router.post('/totp/verify-setup')
async def verify_totp_setup(request: Request, payload_dict: dict, db: Session = Depends(get_db)):
    body = payload_dict

    totp_code = body.get('totp_code')
    if not totp_code or len(totp_code) != 6:
        raise HTTPException(status_code=400, detail='TOTP code must be 6 digits')

    user_payload = request.state.user
    email = user_payload.get('email')
    roles = user_payload.get('realm_access', {}).get('roles', [])

    if not any(r in roles for r in ['admin', 'staff']):
        raise HTTPException(status_code=403, detail='Only admin/staff can setup TOTP')

    user = db.query(User).filter(User.email == email).first()
    if not user:
        role = next((r for r in roles if r in ['admin', 'staff']), 'staff')
        user = User(email=email, name=user_payload.get('name') or email, role=role)
        db.add(user)
        db.commit()
        db.refresh(user)

    secret = body.get('secret')
    if not secret:
        raise HTTPException(status_code=400, detail='Missing secret')

    totp = pyotp.TOTP(secret)
    if not totp.verify(totp_code, valid_window=1):
        raise HTTPException(status_code=401, detail='Invalid TOTP code')

    user.totp_secret = secret
    db.commit()

    return {
        'message': 'TOTP setup completed',
        'email': email,
        'role': next((r for r in roles if r in ['admin', 'staff']), None),
    }
