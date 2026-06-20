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
    "secure": settings.auth_cookie_secure,
    "samesite": "lax",
    "path": "/",
}
INTERNAL_CA_CERT_PATH = os.getenv("INTERNAL_CA_CERT_PATH")
KEYCLOAK_CA_CERT_PATH = os.getenv("KEYCLOAK_CA_CERT_PATH")
DEMO_TOTP_RESET_EMAILS = {
    "phuc@company.com",
    "hung@company.com",
    "kiet@company.com",
}
KEYCLOAK_ADMIN_USERNAME = os.getenv("KEYCLOAK_ADMIN", "admin")
KEYCLOAK_ADMIN_PASSWORD = os.getenv("KEYCLOAK_ADMIN_PASSWORD", "")


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
        response.delete_cookie(cookie_name, path="/", secure=settings.auth_cookie_secure, samesite="lax")


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


def keycloak_verify():
    return KEYCLOAK_CA_CERT_PATH if KEYCLOAK_CA_CERT_PATH else True


async def get_keycloak_admin_token() -> str:
    if not KEYCLOAK_ADMIN_USERNAME or not KEYCLOAK_ADMIN_PASSWORD:
        raise HTTPException(status_code=500, detail="Missing Keycloak admin credentials")

    token_url = f"{settings.keycloak_url}/realms/master/protocol/openid-connect/token"
    async with httpx.AsyncClient(verify=keycloak_verify(), timeout=15) as client:
        res = await client.post(token_url, data={
            "grant_type": "password",
            "client_id": "admin-cli",
            "username": KEYCLOAK_ADMIN_USERNAME,
            "password": KEYCLOAK_ADMIN_PASSWORD,
        })

    if res.status_code >= 400:
        raise HTTPException(status_code=502, detail="Cannot authenticate to Keycloak admin API")

    return res.json()["access_token"]


async def reset_keycloak_totp_required_action(email: str) -> None:
    admin_token = await get_keycloak_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}
    admin_base = f"{settings.keycloak_url}/admin/realms/{settings.keycloak_realm}"

    async with httpx.AsyncClient(verify=keycloak_verify(), timeout=20) as client:
        users_res = await client.get(
            f"{admin_base}/users",
            headers=headers,
            params={"email": email, "exact": "true"},
        )
        if users_res.status_code >= 400:
            raise HTTPException(status_code=502, detail="Cannot query Keycloak user")

        users = users_res.json()
        if not users:
            raise HTTPException(status_code=404, detail="Keycloak user not found")

        user = users[0]
        user_id = user["id"]

        credentials_res = await client.get(f"{admin_base}/users/{user_id}/credentials", headers=headers)
        if credentials_res.status_code >= 400:
            raise HTTPException(status_code=502, detail="Cannot query Keycloak credentials")

        for credential in credentials_res.json():
            if credential.get("type") == "otp":
                delete_res = await client.delete(
                    f"{admin_base}/users/{user_id}/credentials/{credential['id']}",
                    headers=headers,
                )
                if delete_res.status_code >= 400:
                    raise HTTPException(status_code=502, detail="Cannot remove Keycloak OTP credential")

        required_actions = set(user.get("requiredActions") or [])
        required_actions.add("CONFIGURE_TOTP")
        user["requiredActions"] = sorted(required_actions)

        update_res = await client.put(f"{admin_base}/users/{user_id}", headers=headers, json=user)
        if update_res.status_code >= 400:
            raise HTTPException(status_code=502, detail="Cannot update Keycloak required actions")


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


@router.post('/totp/reset-demo')
async def reset_demo_totp(payload: dict, response: Response, db: Session = Depends(get_db)):
    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if email not in DEMO_TOTP_RESET_EMAILS:
        raise HTTPException(status_code=403, detail="Only demo admin/staff accounts can be reset")

    await reset_keycloak_totp_required_action(email)

    user = db.query(User).filter(User.email == email).first()
    if user:
        user.totp_secret = None
        db.commit()

    clear_auth_cookies(response)
    return {
        "ok": True,
        "email": email,
        "message": "Keycloak TOTP reset. The next login will require QR setup again.",
    }


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
