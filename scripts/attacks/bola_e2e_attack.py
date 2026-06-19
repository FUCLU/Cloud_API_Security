#!/usr/bin/env python3
"""End-to-end BOLA/IDOR test through Kong mTLS + Keycloak + backend API."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import sys
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

import requests

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
REDIRECT_URI = os.getenv("REDIRECT_URI", "http://localhost:5173/callback")
API_BASE = os.getenv("API_BASE", "https://localhost:8443")
TLS_CA_CERT = os.getenv("TLS_CA_CERT", "certs/ca.crt")
CLIENT_CERT = os.getenv("CLIENT_CERT", "internal-certs/mtls/client.crt")
CLIENT_KEY = os.getenv("CLIENT_KEY", "internal-certs/mtls/client.key")
EVIDENCE_FILE = Path(os.getenv("EVIDENCE_FILE", "EVIDENCE/attack_results/bola/bola_e2e_result.json"))


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def sha256_b64url(text: str) -> str:
    return b64url(hashlib.sha256(text.encode("utf-8")).digest())


def parse_code_from_input(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        return ""
    if "code=" in raw:
        parsed = urllib.parse.urlparse(raw)
        qs = urllib.parse.parse_qs(parsed.query)
        return qs.get("code", [""])[0]
    return raw


def generate_pkce_pair() -> tuple[str, str]:
    verifier = b64url(secrets.token_bytes(64))
    challenge = sha256_b64url(verifier)
    return verifier, challenge


def decode_payload(token: str) -> dict:
    payload_b64 = token.split(".")[1]
    padded = payload_b64 + "=" * (-len(payload_b64) % 4)
    return json.loads(base64.urlsafe_b64decode(padded.encode("utf-8")))


def get_token(label: str) -> dict:
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

    print(f"\n[Login {label}] Mở URL sau và đăng nhập bằng customer {label}")
    print(f"  {auth_url}")
    print("  Sau khi redirect về /callback, copy toàn bộ URL hoặc riêng code=... dán vào đây.")
    auth_code = parse_code_from_input(input("  Callback URL/code: "))
    if not auth_code:
        raise RuntimeError(f"Thiếu authorization code cho {label}")

    res = requests.post(
        KEYCLOAK_TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "client_id": CLIENT_ID,
            "code": auth_code,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": verifier,
        },
        timeout=20,
    )
    print(f"  Token endpoint status: {res.status_code}")
    res.raise_for_status()
    access_token = res.json()["access_token"]
    payload = decode_payload(access_token)
    print(f"  sub  : {payload.get('sub')}")
    print(f"  email: {payload.get('email') or payload.get('preferred_username')}")
    print(f"  role : {payload.get('realm_access', {}).get('roles')}")
    return {"access_token": access_token, "payload": payload}


def api_request(identity: dict, method: str, path: str, body: dict | None = None) -> requests.Response:
    url = f"{API_BASE}{path}"
    headers = {
        "Authorization": f"Bearer {identity['access_token']}",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    return requests.request(
        method,
        url,
        headers=headers,
        data=json.dumps(body) if body is not None else None,
        verify=TLS_CA_CERT,
        cert=(CLIENT_CERT, CLIENT_KEY),
        timeout=20,
    )


def main() -> int:
    print("\n=== BOLA / IDOR END-TO-END ATTACK TEST ===")
    print("Mục tiêu: test thật qua Kong + Keycloak + backend API.")
    print("Kịch bản:")
    print("  1. Customer A tạo order A.")
    print("  2. Customer B tạo order B.")
    print("  3. Customer A đọc order A -> phải 200.")
    print("  4. Customer A đọc order B -> phải 403 nếu BOLA đã xử lý.")
    print()
    print("Gợi ý user demo:")
    print("  - Customer A: an@gmail.com / demo1234")
    print("  - Customer B: bich@gmail.com / demo1234")

    try:
        customer_a = get_token("A")
        customer_b = get_token("B")
    except Exception as exc:
        print(f"Login/token error: {exc}")
        return 1

    print("\n[Step 1] Customer A tạo order A qua API thật")
    create_a = api_request(customer_a, "POST", "/api/v1/orders", {"status": "pending", "total": 111.0})
    print(f"  Status: {create_a.status_code}")
    print(f"  Body  : {create_a.text.strip()}")
    if create_a.status_code != 201:
        print("  FAIL: Customer A chưa tạo được order. Kiểm tra OPA policy/customer POST orders.")
        return 1
    order_a = create_a.json()

    print("\n[Step 2] Customer B tạo order B qua API thật")
    create_b = api_request(customer_b, "POST", "/api/v1/orders", {"status": "pending", "total": 222.0})
    print(f"  Status: {create_b.status_code}")
    print(f"  Body  : {create_b.text.strip()}")
    if create_b.status_code != 201:
        print("  FAIL: Customer B chưa tạo được order. Kiểm tra OPA policy/customer POST orders.")
        return 1
    order_b = create_b.json()

    print("\n[Step 3] Customer A đọc order A của chính mình")
    read_own = api_request(customer_a, "GET", f"/api/v1/orders/{order_a['id']}")
    print(f"  Status: {read_own.status_code}")
    print(f"  Body  : {read_own.text.strip()}")

    print("\n[Step 4] Customer A thử đọc order B của customer khác")
    read_other = api_request(customer_a, "GET", f"/api/v1/orders/{order_b['id']}")
    print(f"  Status: {read_other.status_code}")
    print(f"  Body  : {read_other.text.strip()}")

    print("\n[Step 5] Customer A gọi list orders để kiểm tra không bị lộ toàn bộ danh sách")
    list_a = api_request(customer_a, "GET", "/api/v1/orders")
    print(f"  Status: {list_a.status_code}")
    print(f"  Body  : {list_a.text.strip()}")

    list_only_own = False
    if list_a.ok:
        ids = {item["id"] for item in list_a.json()}
        list_only_own = order_a["id"] in ids and order_b["id"] not in ids

    passed = (
        read_own.status_code == 200
        and read_other.status_code == 403
        and list_a.status_code == 200
        and list_only_own
    )
    result = "PASS" if passed else "FAIL"

    report = {
        "title": "BOLA/IDOR end-to-end API evidence",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "expected_security_property": "A customer can read own order but cannot read another customer's order.",
        "result": result,
        "customer_a": {
            "sub": customer_a["payload"].get("sub"),
            "email": customer_a["payload"].get("email") or customer_a["payload"].get("preferred_username"),
            "order_id": order_a["id"],
        },
        "customer_b": {
            "sub": customer_b["payload"].get("sub"),
            "email": customer_b["payload"].get("email") or customer_b["payload"].get("preferred_username"),
            "order_id": order_b["id"],
        },
        "checks": {
            "customer_a_reads_own_order": read_own.status_code,
            "customer_a_reads_customer_b_order": read_other.status_code,
            "customer_a_list_orders_filtered": list_only_own,
        },
    }
    EVIDENCE_FILE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE_FILE.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print("\n[Step 6] Kết luận")
    print(f"  Expected own order   : 200, actual={read_own.status_code}")
    print(f"  Expected other order : 403, actual={read_other.status_code}")
    print(f"  List only own orders : {list_only_own}")
    print(f"  Result               : {result}")
    print(f"  Evidence saved       : {EVIDENCE_FILE}")

    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
