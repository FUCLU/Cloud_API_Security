from jose import jwt, jwk, JWTError
from jose.utils import base64url_decode
import httpx
import os
from app.core.config import settings

# Cache key để không fetch mỗi request
_jwks_cache: dict | None = None
INTERNAL_CA_CERT_PATH = os.getenv("INTERNAL_CA_CERT_PATH")
KEYCLOAK_CA_CERT_PATH = os.getenv("KEYCLOAK_CA_CERT_PATH")

async def get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is None:
        verify = KEYCLOAK_CA_CERT_PATH if KEYCLOAK_CA_CERT_PATH else True
        async with httpx.AsyncClient(verify=verify) as client:
            res = await client.get(settings.jwks_url)
            res.raise_for_status()
            _jwks_cache = res.json()
    return _jwks_cache

async def verify_token(token: str) -> dict:
    try:
        jwks = await get_jwks()

        # Decode header để biết dùng key nào (Keycloak có thể có nhiều key)
        header = jwt.get_unverified_header(token)
        
        # Tìm đúng key theo kid (key ID)
        key = next(
            (k for k in jwks["keys"] if k["kid"] == header["kid"]),
            None
        )

        if not key:
            global _jwks_cache 
            _jwks_cache = None          # reset cache
            jwks = await get_jwks()     # fetch lại key mới từ Keycloak
            key = next(
                (k for k in jwks["keys"] if k["kid"] == header["kid"]),
                None
            )
        
        if not key:
            raise JWTError("Public key not found even after refresh")

        # Verify toàn bộ: chữ ký + expiry + issuer + audience
        payload = jwt.decode(
            token,
            key,
            algorithms=["ES256"],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
        )
        return payload

    except JWTError as e:
        raise ValueError(f"Token không hợp lệ: {e}")
