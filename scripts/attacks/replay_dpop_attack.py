#!/usr/bin/env python3
"""DPoP replay attack evidence script without external JWT dependency."""

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
from datetime import datetime, timezone
from pathlib import Path

import requests
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

KEYCLOAK_TOKEN_URL = os.getenv(
    "KEYCLOAK_TOKEN_URL",
    "http://localhost:8082/realms/cloudapi/protocol/openid-connect/token",
)
KEYCLOAK_AUTH_URL = os.getenv(
    "KEYCLOAK_AUTH_URL",
    "http://localhost:8082/realms/cloudapi/protocol/openid-connect/auth",
)
API_URL = os.getenv("API_URL", "https://localhost:8443/api/v1/products")
CLIENT_ID = os.getenv("CLIENT_ID", "spa-client")
AUTH_FLOW = os.getenv("AUTH_FLOW", "authorization_code").strip().lower()
REDIRECT_URI = os.getenv("REDIRECT_URI", "http://localhost:5173/callback")
AUTH_CODE = os.getenv("AUTH_CODE", "").strip()
ATTACK_USERNAME = os.getenv("ATTACK_USERNAME", "an@gmail.com")
ATTACK_PASSWORD = os.getenv("ATTACK_PASSWORD", "demo1234")
TLS_CA_CERT = os.getenv("TLS_CA_CERT", "certs/ca.crt")
CLIENT_CERT = os.getenv("CLIENT_CERT", "certs/client.crt")
CLIENT_KEY = os.getenv("CLIENT_KEY", "certs/client.key")
EVIDENCE_FILE = Path(
    os.getenv(
        "EVIDENCE_FILE",
        "EVIDENCE/attack_results/token-hardening/dpop_replay_result.txt",
    )
)


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def sha256_b64url(text: str) -> str:
    return b64url(hashlib.sha256(text.encode("utf-8")).digest())


def mask_token(token: str, head: int = 28, tail: int = 18) -> str:
    if len(token) <= head + tail:
        return token
    return f"{token[:head]}...{token[-tail:]}"


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

    header = {
        "typ": "dpop+jwt",
        "alg": "ES256",
        "jwk": public_jwk(private_key),
    }
    encoded_header = b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    encoded_payload = b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
    der_signature = private_key.sign(signing_input, ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der_signature)
    raw_signature = r.to_bytes(32, "big") + s.to_bytes(32, "big")
    return f"{encoded_header}.{encoded_payload}.{b64url(raw_signature)}"


def save_evidence(report: str) -> None:
    EVIDENCE_FILE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE_FILE.write_text(report, encoding="utf-8")
    print(f"[+] Evidence saved: {EVIDENCE_FILE}")


def get_token_authorization_code(private_key: ec.EllipticCurvePrivateKey) -> str:
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

    print("[Step 2] Mở URL sau trên trình duyệt và đăng nhập")
    print(f"  Auth URL: {auth_url}")
    print(f"  Redirect URI kỳ vọng: {REDIRECT_URI}")
    auth_code = parse_code_from_input(AUTH_CODE)
    if not auth_code:
        user_input = input("  Dán toàn bộ callback URL hoặc chỉ authorization code: ").strip()
        auth_code = parse_code_from_input(user_input)
    if not auth_code:
        raise RuntimeError("Thiếu authorization code")

    print()
    print("[Step 3] Đổi authorization code + PKCE verifier lấy access token")
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
    response.raise_for_status()
    access_token = response.json().get("access_token")
    if not access_token:
        raise RuntimeError("Keycloak không trả access_token")
    return access_token


def get_token_password(private_key: ec.EllipticCurvePrivateKey) -> str:
    print("[Step 2] Lấy token bằng password grant demo")
    print("  Lưu ý: flow này chỉ để debug; token có thể không DPoP-bound tùy Keycloak.")
    token_dpop = create_dpop_proof(private_key, "POST", KEYCLOAK_TOKEN_URL)
    response = requests.post(
        KEYCLOAK_TOKEN_URL,
        data={
            "client_id": CLIENT_ID,
            "grant_type": "password",
            "username": ATTACK_USERNAME,
            "password": ATTACK_PASSWORD,
            "scope": "openid profile email roles",
        },
        headers={"DPoP": token_dpop},
        timeout=20,
    )
    print(f"  HTTP status: {response.status_code}")
    response.raise_for_status()
    access_token = response.json().get("access_token")
    if not access_token:
        raise RuntimeError("Keycloak không trả access_token")
    return access_token


def main() -> None:
    print("\n=== DPoP REPLAY ATTACK TEST ===")
    print("Mục tiêu: chứng minh backend chặn việc dùng lại cùng một DPoP proof.")
    print("Cơ chế bảo vệ: backend/app/security/dpop_verifier.py lưu jti vào Redis với nx=True.")
    print(f"API target : {API_URL}")
    print(f"TLS CA     : {TLS_CA_CERT}")
    print(f"mTLS cert  : {CLIENT_CERT}")
    print(f"Auth flow  : {AUTH_FLOW}")
    print()

    print("[Step 1] Tạo DPoP key pair ECDSA P-256")
    private_key = ec.generate_private_key(ec.SECP256R1())
    print(f"  Public JWK: {public_jwk(private_key)}")

    try:
        if AUTH_FLOW == "password":
            access_token = get_token_password(private_key)
        else:
            access_token = get_token_authorization_code(private_key)
    except Exception as exc:
        print(f"  Keycloak auth error: {exc}")
        print("  Result: FAIL")
        return

    print("  Lấy access token thành công.")
    print(f"  access_token: {mask_token(access_token)}")

    print()
    print("[Step 4] Tạo DPoP proof cho request API lần 1")
    api_dpop_proof = create_dpop_proof(private_key, "GET", API_URL, access_token)
    print(f"  htm: GET")
    print(f"  htu: {API_URL}")
    print(f"  DPoP proof: {mask_token(api_dpop_proof)}")

    headers = {
        "Authorization": f"Bearer {access_token}",
        "DPoP": api_dpop_proof,
    }

    print()
    print("[Step 5] Gửi request API lần 1")
    print("  Kỳ vọng: HTTP 200 nếu token/role/DPoP hợp lệ")
    first = requests.get(
        API_URL,
        headers=headers,
        timeout=20,
        verify=TLS_CA_CERT,
        cert=(CLIENT_CERT, CLIENT_KEY),
    )
    print(f"  Response status: {first.status_code}")
    print(f"  Response body  : {first.text.strip()}")

    print()
    print("[Step 6] Replay lại y nguyên Authorization + DPoP proof")
    print("  Kỳ vọng: HTTP 401 hoặc 400 vì jti đã được dùng")
    second = requests.get(
        API_URL,
        headers=headers,
        timeout=20,
        verify=TLS_CA_CERT,
        cert=(CLIENT_CERT, CLIENT_KEY),
    )
    print(f"  Response status: {second.status_code}")
    print(f"  Response body  : {second.text.strip()}")

    if first.status_code == 200 and second.status_code in {400, 401}:
        verdict = "PASS"
        detail = "Replay bị chặn đúng vì DPoP jti đã được sử dụng."
    elif first.status_code == 200 and second.status_code == 200:
        verdict = "FAIL_REPLAY_ACCEPTED"
        detail = "Replay không bị chặn, cần kiểm tra Redis jti store."
    elif first.status_code == 401 and "Token is not DPoP bound" in first.text:
        verdict = "INVALID_TEST_TOKEN_NOT_BOUND"
        detail = "Token không có cnf.jkt; hãy dùng authorization_code flow thay vì password flow."
    elif first.status_code == 403:
        verdict = "INVALID_TEST_POLICY_BLOCK"
        detail = "Request bị policy/role chặn trước khi tới replay check; hãy đổi user hoặc endpoint."
    else:
        verdict = "FAIL_UNEXPECTED"
        detail = "Kết quả không đúng mẫu mong đợi, cần kiểm tra middleware/log."

    print()
    print("[Step 7] Kết luận")
    print(f"  Result : {verdict}")
    print(f"  Ý nghĩa: {detail}")

    timestamp = datetime.now(timezone.utc).isoformat()
    result_lines = [
        "~ DPOP REPLAY ATTACK EVIDENCE ~",
        f"timestamp_utc: {timestamp}",
        f"target_url: {API_URL}",
        f"auth_flow: {AUTH_FLOW}",
        f"tls_ca: {TLS_CA_CERT}",
        f"client_cert: {CLIENT_CERT}",
        f"first_status: {first.status_code}",
        f"second_status: {second.status_code}",
        f"first_body: {first.text.strip()}",
        f"second_body: {second.text.strip()}",
        "expected: first request = 200, replay request = 401 or 400",
        f"result: {verdict}",
        f"detail: {detail}",
    ]
    save_evidence("\n".join(result_lines) + "\n")


if __name__ == "__main__":
    main()
