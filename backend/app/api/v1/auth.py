import pyotp
import qrcode
from io import BytesIO
from base64 import b64encode
import os
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Request, HTTPException, Depends, Response
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.models import User
from app.security.jwt_verify import verify_token

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine)

router = APIRouter(prefix='/api/v1/auth', tags=['auth'])

ACCESS_COOKIE = "cloudapi_access"
REFRESH_COOKIE = "cloudapi_refresh"
ID_COOKIE = "cloudapi_id"
COOKIE_KWARGS = {
    "httponly": True,
    "secure": True,
    "samesite": "lax",
    "path": "/",
}
INTERNAL_CA_CERT_PATH = os.getenv("INTERNAL_CA_CERT_PATH")
KEYCLOAK_CA_CERT_PATH = os.getenv("KEYCLOAK_CA_CERT_PATH")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def user_from_payload(payload: dict) -> dict:
    roles = payload.get("realm_access", {}).get("roles", [])
    return {
        "sub": payload.get("sub"),
        "email": payload.get("email"),
        "name": payload.get("name") or payload.get("preferred_username"),
        "username": payload.get("preferred_username"),
        "roles": roles or ["customer"],
    }


def set_auth_cookies(response: Response, tokens: dict) -> None:
    access_max_age = int(tokens.get("expires_in", 300))
    refresh_max_age = int(tokens.get("refresh_expires_in", 1800))
    response.set_cookie(ACCESS_COOKIE, tokens["access_token"], max_age=access_max_age, **COOKIE_KWARGS)
    response.set_cookie(REFRESH_COOKIE, tokens["refresh_token"], max_age=refresh_max_age, **COOKIE_KWARGS)
    if tokens.get("id_token"):
        response.set_cookie(ID_COOKIE, tokens["id_token"], max_age=refresh_max_age, **COOKIE_KWARGS)


def clear_auth_cookies(response: Response) -> None:
    for cookie_name in (ACCESS_COOKIE, REFRESH_COOKIE, ID_COOKIE):
        response.delete_cookie(cookie_name, path="/", secure=True, samesite="lax")


async def exchange_token(form: dict) -> dict:
    if settings.keycloak_client_secret:
        form["client_secret"] = settings.keycloak_client_secret
    verify = KEYCLOAK_CA_CERT_PATH if KEYCLOAK_CA_CERT_PATH else True
    async with httpx.AsyncClient(verify=verify, timeout=15) as client:
        res = await client.post(settings.oidc_token_url, data=form)
    if res.status_code >= 400:
        detail = "Keycloak token exchange failed"
        try:
            keycloak_error = res.json()
            error = keycloak_error.get("error")
            description = keycloak_error.get("error_description")
            if error or description:
                detail = f"{detail}: {error or description}"
        except ValueError:
            pass
        raise HTTPException(status_code=401, detail=detail)
    return res.json()


@router.post('/callback')
async def oidc_callback(payload: dict, response: Response):
    code = payload.get("code")
    code_verifier = payload.get("code_verifier")
    redirect_uri = payload.get("redirect_uri")

    if not code or not code_verifier or not redirect_uri:
        raise HTTPException(status_code=400, detail="Missing OIDC callback fields")

    tokens = await exchange_token({
        "grant_type": "authorization_code",
        "client_id": settings.keycloak_client_id,
        "redirect_uri": redirect_uri,
        "code": code,
        "code_verifier": code_verifier,
    })
    token_payload = await verify_token(tokens["access_token"])
    set_auth_cookies(response, tokens)
    return {"authenticated": True, "user": user_from_payload(token_payload)}


@router.get('/session')
async def get_session(request: Request, response: Response):
    access_token = request.cookies.get(ACCESS_COOKIE)
    refresh_token = request.cookies.get(REFRESH_COOKIE)

    if access_token:
        try:
            payload = await verify_token(access_token)
            return {"authenticated": True, "user": user_from_payload(payload)}
        except ValueError:
            pass

    if not refresh_token:
        clear_auth_cookies(response)
        return {"authenticated": False, "user": None}

    try:
        tokens = await exchange_token({
            "grant_type": "refresh_token",
            "client_id": settings.keycloak_client_id,
            "refresh_token": refresh_token,
        })
        payload = await verify_token(tokens["access_token"])
        set_auth_cookies(response, tokens)
        return {"authenticated": True, "user": user_from_payload(payload)}
    except HTTPException:
        clear_auth_cookies(response)
        return {"authenticated": False, "user": None}


@router.post('/logout')
async def session_logout(request: Request, response: Response):
    id_token = request.cookies.get(ID_COOKIE)
    clear_auth_cookies(response)

    logout_url = None
    if id_token:
        query = urlencode({
            "client_id": settings.keycloak_client_id,
            "id_token_hint": id_token,
            "post_logout_redirect_uri": f"{settings.frontend_url}/login",
        })
        logout_url = f"{settings.oidc_logout_url}?{query}"

    return {"ok": True, "logout_url": logout_url}


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
