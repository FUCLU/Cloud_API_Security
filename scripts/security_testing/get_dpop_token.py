#!/usr/bin/env python3
"""Get a Keycloak token and matching DPoP proof for local security testing."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import sys
import time
import urllib.parse
import uuid
from pathlib import Path

import requests
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

KEYCLOAK_AUTH_URL = os.getenv(
    "KEYCLOAK_AUTH_URL",
    "http://localhost:8082/realms/cloudapi/protocol/openid-connect/auth",
)
KEYCLOAK_TOKEN_URL = os.getenv(
    "KEYCLOAK_TOKEN_URL",
    "http://localhost:8082/realms/cloudapi/protocol/openid-connect/token",
)
CLIENT_ID = os.getenv("CLIENT_ID", "spa-client")
AUTH_FLOW = os.getenv("AUTH_FLOW", "authorization_code").strip().lower()
REDIRECT_URI = os.getenv("REDIRECT_URI", "https://localhost:5174/callback?manual=1&debug=1")
AUTH_CODE = os.getenv("AUTH_CODE", "").strip()
KC_USERNAME = os.getenv("KC_USERNAME", os.getenv("ATTACK_USERNAME", "an@gmail.com"))
KC_PASSWORD = os.getenv("KC_PASSWORD", os.getenv("ATTACK_PASSWORD", "demo1234"))
API_URL = os.getenv("API_URL", "https://localhost:8443/api/v1/products")
OUTPUT_FILE = Path(os.getenv("OUTPUT_FILE", "EVIDENCE/authn-logs/latest_dpop_token.json"))


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def sha256_b64url(text: str) -> str:
    return b64url(hashlib.sha256(text.encode("utf-8")).digest())


def generate_pkce_pair() -> tuple[str, str]:
    verifier = b64url(secrets.token_bytes(64))
    challenge = sha256_b64url(verifier)
    return verifier, challenge


def parse_code_from_input(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        return ""
    if "code=" in raw:
        parsed = urllib.parse.urlparse(raw)
        qs = urllib.parse.parse_qs(parsed.query)
        return qs.get("code", [""])[0]
    return raw


def mask(token: str, head: int = 28, tail: int = 18) -> str:
    if len(token) <= head + tail:
        return token
    return f"{token[:head]}...{token[-tail:]}"


def public_jwk(private_key: ec.EllipticCurvePrivateKey) -> dict:
    pub = private_key.public_key().public_numbers()
    return {
        "kty": "EC",
        "crv": "P-256",
        "x": b64url(pub.x.to_bytes(32, "big")),
        "y": b64url(pub.y.to_bytes(32, "big")),
    }


def create_dpop_proof(
    private_key: ec.EllipticCurvePrivateKey,
    htm: str,
    htu: str,
    access_token: str | None = None,
) -> str:
    payload = {
        "jti": str(uuid.uuid4()),
        "htm": htm.upper(),
        "htu": htu,
        "iat": int(time.time()),
    }
    if access_token:
        payload["ath"] = sha256_b64url(access_token)

    headers = {
        "typ": "dpop+jwt",
        "alg": "ES256",
        "jwk": public_jwk(private_key),
    }
    encoded_header = b64url(json.dumps(headers, separators=(",", ":")).encode("utf-8"))
    encoded_payload = b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
    der_signature = private_key.sign(signing_input, ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der_signature)
    raw_signature = r.to_bytes(32, "big") + s.to_bytes(32, "big")
    return f"{encoded_header}.{encoded_payload}.{b64url(raw_signature)}"


def decode_payload(token: str) -> dict:
    payload_b64 = token.split(".")[1]
    padded = payload_b64 + "=" * (-len(payload_b64) % 4)
    return json.loads(base64.urlsafe_b64decode(padded.encode("utf-8")))


def get_token_authorization_code(private_key: ec.EllipticCurvePrivateKey) -> dict:
    verifier, challenge = generate_pkce_pair()
    state = b64url(secrets.token_bytes(16))
    auth_url = (
        f"{KEYCLOAK_AUTH_URL}"
        f"?response_type=code"
        f"&client_id={urllib.parse.quote(CLIENT_ID)}"
        f"&redirect_uri={urllib.parse.quote(REDIRECT_URI)}"
        f"&scope=openid%20profile%20email%20roles"
        f"&state={urllib.parse.quote(state)}"
        f"&code_challenge={urllib.parse.quote(challenge)}"
        f"&code_challenge_method=S256"
    )

    print("[Step 2] Mở URL đăng nhập Keycloak để lấy authorization code")
    print(f"  Auth URL: {auth_url}")
    print(f"  Redirect URI kỳ vọng: {REDIRECT_URI}")
    print("  Sau khi đăng nhập, trang callback sẽ dừng lại và hiện code để copy.")
    print("  Lưu ý: code chỉ dùng được một lần và hết hạn nhanh.")
    auth_code = parse_code_from_input(AUTH_CODE)
    if not auth_code:
        user_input = input("  Dán toàn bộ callback URL hoặc chỉ giá trị code: ").strip()
        auth_code = parse_code_from_input(user_input)
    if not auth_code:
        raise RuntimeError("Thiếu authorization code")

    print()
    print("[Step 3] Đổi authorization code + PKCE verifier lấy token")
    token_dpop = create_dpop_proof(private_key, "POST", KEYCLOAK_TOKEN_URL)
    response = requests.post(
        KEYCLOAK_TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "client_id": CLIENT_ID,
            "code": auth_code,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": verifier,
        },
        headers={"DPoP": token_dpop},
        timeout=20,
    )
    print(f"  HTTP status: {response.status_code}")
    if not response.ok:
        print(f"  Body: {response.text}")
        raise RuntimeError("Token exchange failed")
    return response.json()


def get_token_password(private_key: ec.EllipticCurvePrivateKey) -> dict:
    print("[Step 2] Gửi username/password tới Keycloak token endpoint")
    print(f"  Token URL : {KEYCLOAK_TOKEN_URL}")
    print(f"  Client ID : {CLIENT_ID}")
    print(f"  Username  : {KC_USERNAME}")
    token_dpop = create_dpop_proof(private_key, "POST", KEYCLOAK_TOKEN_URL)
    response = requests.post(
        KEYCLOAK_TOKEN_URL,
        data={
            "grant_type": "password",
            "client_id": CLIENT_ID,
            "username": KC_USERNAME,
            "password": KC_PASSWORD,
            "scope": "openid profile email roles",
        },
        headers={"DPoP": token_dpop},
        timeout=20,
    )
    print(f"  HTTP status: {response.status_code}")
    if not response.ok:
        print(f"  Body: {response.text}")
        raise RuntimeError("Password grant failed")
    return response.json()


def main() -> int:
    print("\n=== GET TOKEN FOR SECURITY TESTING ===")
    print("Mục tiêu: lấy access token từ Keycloak và tạo DPoP proof tương ứng để test API thủ công.")
    print("Flow mặc định: Authorization Code + PKCE S256 + DPoP, giống cơ chế frontend.")
    print("Có thể đặt AUTH_FLOW=password để debug password grant local, nhưng token có thể không DPoP-bound.")
    print()

    print("[Step 1] Tạo DPoP key pair ECDSA P-256")
    private_key = ec.generate_private_key(ec.SECP256R1())
    print(f"  Public JWK: {public_jwk(private_key)}")
    print()

    try:
        if AUTH_FLOW == "password":
            body = get_token_password(private_key)
        else:
            body = get_token_authorization_code(private_key)
    except Exception as exc:
        print(f"  Error : {exc}")
        print("  Result: FAIL")
        return 1

    access_token = body["access_token"]
    refresh_token = body.get("refresh_token", "")
    id_token = body.get("id_token", "")
    access_payload = decode_payload(access_token)
    cnf_jkt = access_payload.get("cnf", {}).get("jkt")

    print()
    print("[Step 4] Decode access token để xem cơ chế")
    print(f"  iss       : {access_payload.get('iss')}")
    print(f"  aud       : {access_payload.get('aud')}")
    print(f"  sub       : {access_payload.get('sub')}")
    print(f"  exp       : {access_payload.get('exp')}")
    print(f"  roles     : {access_payload.get('realm_access', {}).get('roles')}")
    print(f"  cnf.jkt   : {cnf_jkt}")
    print("  alg       : ES256 (theo Keycloak realm và backend verifier)")
    if not cnf_jkt:
        print("  CẢNH BÁO : token này không có cnf.jkt, backend DPoP sẽ từ chối.")
        print("             Hãy dùng AUTH_FLOW=authorization_code để lấy token giống frontend.")

    print()
    print("[Step 5] Tạo DPoP proof mẫu cho API test")
    api_dpop = create_dpop_proof(private_key, "GET", API_URL, access_token)
    print(f"  API URL   : {API_URL}")
    print(f"  DPoP proof: {mask(api_dpop)}")

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(
        json.dumps(
            {
                "auth_flow": AUTH_FLOW,
                "auth_url": KEYCLOAK_AUTH_URL,
                "token_url": KEYCLOAK_TOKEN_URL,
                "client_id": CLIENT_ID,
                "username": KC_USERNAME if AUTH_FLOW == "password" else None,
                "api_url": API_URL,
                "access_token": access_token,
                "refresh_token": refresh_token,
                "id_token": id_token,
                "dpop_proof_for_api": api_dpop,
                "access_payload": access_payload,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print()
    print("[Step 6] Token để copy test")
    print(f"  ACCESS_TOKEN={access_token}")
    print(f"  DPOP_PROOF={api_dpop}")
    print()
    print("[Step 7] Lệnh curl mẫu qua Kong mTLS")
    print(
        "curl.exe --cacert certs\\ca.crt --cert certs\\client.crt --key certs\\client.key "
        f"-H \"Authorization: Bearer {access_token}\" "
        f"-H \"DPoP: {api_dpop}\" "
        f"\"{API_URL}\""
    )
    print()
    print(f"Evidence saved: {OUTPUT_FILE}")
    print("Result: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
