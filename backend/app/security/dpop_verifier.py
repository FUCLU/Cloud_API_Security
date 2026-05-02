import base64
import hashlib
import json
import time
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from fastapi import HTTPException, Request
from jose import jwt
import redis

REDIS_URL = "redis://api-redis:6379/0"
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def _b64url_sha256(data: str) -> str:
    digest = hashlib.sha256(data.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("utf-8")


def _normalize_dpop_url(url: str) -> str:
    parts = urlsplit(url)
    scheme = (parts.scheme or "").lower()
    netloc = (parts.netloc or "").lower()
    path = parts.path or "/"
    query = parts.query or ""
    return urlunsplit((scheme, netloc, path, query, ""))


def verify_dpop(request: Request, access_token: str) -> dict[str, Any]:
    proof = request.headers.get("DPoP")
    if not proof:
        raise HTTPException(status_code=401, detail="Missing DPoP proof")

    try:
        token_payload = jwt.get_unverified_claims(access_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Access Token")

    try:
        header = jwt.get_unverified_header(proof)
        jwk_dict = header.get("jwk")
        alg = header.get("alg")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid DPoP header")

    if not jwk_dict:
        raise HTTPException(status_code=401, detail="Missing jwk in DPoP header")
    if alg != "ES256":
        raise HTTPException(status_code=401, detail="DPoP alg must be ES256")

    try:
        payload = jwt.decode(
            proof,
            jwk_dict,
            algorithms=["ES256"],
            options={"verify_aud": False, "verify_iss": False},
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid DPoP signature")

    jti = payload.get("jti")
    htm = payload.get("htm")
    htu = payload.get("htu")
    iat = payload.get("iat")
    ath = payload.get("ath")

    if not all([jti, htm, htu, iat, ath]):
        raise HTTPException(status_code=401, detail="Missing required DPoP claims")

    now = int(time.time())
    if not isinstance(iat, int):
        raise HTTPException(status_code=401, detail="Invalid iat")
    if abs(now - iat) > 60:
        raise HTTPException(status_code=401, detail="DPoP proof expired")

    req_method = request.method.upper()
    forwarded_proto = request.headers.get("x-forwarded-proto")
    forwarded_host = request.headers.get("x-forwarded-host")
    forwarded_port = request.headers.get("x-forwarded-port")
    if forwarded_proto and forwarded_host:
        host = forwarded_host
        if ":" not in host and forwarded_port:
            host = f"{host}:{forwarded_port}"
        req_url = f"{forwarded_proto}://{host}{request.url.path}"
        if request.url.query:
            req_url = f"{req_url}?{request.url.query}"
    else:
        req_url = str(request.url)

    if htm.upper() != req_method:
        raise HTTPException(status_code=401, detail="DPoP htm mismatch")
    if _normalize_dpop_url(htu) != _normalize_dpop_url(req_url):
        raise HTTPException(status_code=401, detail="DPoP htu mismatch")

    expected_ath = _b64url_sha256(access_token)
    if ath != expected_ath:
        raise HTTPException(status_code=401, detail="DPoP ath mismatch")

    expected_jkt = token_payload.get("cnf", {}).get("jkt")
    if not expected_jkt:
        raise HTTPException(status_code=401, detail="Token is not DPoP bound")

    required_fields = {
        "crv": jwk_dict["crv"],
        "kty": jwk_dict["kty"],
        "x": jwk_dict["x"],
        "y": jwk_dict["y"],
    }
    jwk_json = json.dumps(required_fields, sort_keys=True, separators=(",", ":"))
    sha256_hash = hashlib.sha256(jwk_json.encode()).digest()
    actual_jkt = base64.urlsafe_b64encode(sha256_hash).rstrip(b"=").decode()

    if actual_jkt != expected_jkt:
        raise HTTPException(status_code=401, detail="DPoP key binding mismatch")

    key = f"dpop:jti:{jti}"
    ok = redis_client.set(key, "1", ex=3600, nx=True)
    if not ok:
        raise HTTPException(status_code=401, detail="DPoP proof replayed")

    return payload
