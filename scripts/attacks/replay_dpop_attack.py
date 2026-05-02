import base64
import hashlib
import os
import secrets
import time
import urllib.parse
import uuid
from datetime import datetime, timezone
from pathlib import Path

import jwt
import requests
from cryptography.hazmat.primitives.asymmetric import ec

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
ATTACK_USERNAME = os.getenv("ATTACK_USERNAME", "an@gmail.com")
ATTACK_PASSWORD = os.getenv("ATTACK_PASSWORD", "demo1234")
AUTH_FLOW = os.getenv("AUTH_FLOW", "authorization_code").strip().lower()
REDIRECT_URI = os.getenv("REDIRECT_URI", "http://localhost:5173/callback")
AUTH_CODE = os.getenv("AUTH_CODE", "").strip()
VERIFY_TLS = os.getenv("VERIFY_TLS", "false").lower() == "true"
EVIDENCE_FILE = Path(
    os.getenv(
        "EVIDENCE_FILE",
        "EVIDENCE/attack_results/token-hardening/dpop_replay_result.txt",
    )
)


def mask_token(token: str, head: int = 24, tail: int = 16) -> str:
    if len(token) <= head + tail:
        return token
    return f"{token[:head]}...{token[-tail:]}"


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


def save_evidence(report: str) -> None:
    EVIDENCE_FILE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE_FILE.write_text(report, encoding="utf-8")
    print(f"[+] Evidence saved: {EVIDENCE_FILE}")


def ec_public_jwk(private_key: ec.EllipticCurvePrivateKey) -> dict:
    pub = private_key.public_key().public_numbers()
    x = pub.x.to_bytes(32, "big")
    y = pub.y.to_bytes(32, "big")
    return {
        "kty": "EC",
        "crv": "P-256",
        "x": b64url(x),
        "y": b64url(y),
    }


def create_dpop_proof(
    private_key: ec.EllipticCurvePrivateKey,
    htm: str,
    htu: str,
    ath: str | None = None,
) -> str:
    jwk = ec_public_jwk(private_key)
    payload = {
        "jti": str(uuid.uuid4()),
        "htm": htm.upper(),
        "htu": htu,
        "iat": int(time.time()),
    }
    if ath:
        payload["ath"] = ath

    headers = {
        "typ": "dpop+jwt",
        "alg": "ES256",
        "jwk": jwk,
    }
    return jwt.encode(payload, private_key, algorithm="ES256", headers=headers)


def get_dpop_bound_access_token(private_key: ec.EllipticCurvePrivateKey) -> str:
    if AUTH_FLOW == "password":
        return get_token_password_grant(private_key)
    return get_token_authorization_code_grant(private_key)


def get_token_password_grant(private_key: ec.EllipticCurvePrivateKey) -> str:
    token_dpop_proof = create_dpop_proof(
        private_key=private_key,
        htm="POST",
        htu=KEYCLOAK_TOKEN_URL,
    )

    response = requests.post(
        KEYCLOAK_TOKEN_URL,
        data={
            "client_id": CLIENT_ID,
            "grant_type": "password",
            "username": ATTACK_USERNAME,
            "password": ATTACK_PASSWORD,
        },
        headers={"DPoP": token_dpop_proof},
        timeout=15,
    )
    response.raise_for_status()
    body = response.json()
    access_token = body.get("access_token")
    if not access_token:
        raise RuntimeError("No access_token returned from Keycloak")
    return access_token


def get_token_authorization_code_grant(private_key: ec.EllipticCurvePrivateKey) -> str:
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

    print("Mở URL sau trên trình duyệt và đăng nhập:")
    print(auth_url)
    print(f"Redirect URI dự kiến bắt đầu bằng: {REDIRECT_URI}")

    auth_code = parse_code_from_input(AUTH_CODE)
    if not auth_code:
        user_input = input("Dán toàn bộ callback URL hoặc chỉ authorization code: ").strip()
        auth_code = parse_code_from_input(user_input)
    if not auth_code:
        raise RuntimeError("Thiếu authorization code cho authorization_code flow")

    token_dpop_proof = create_dpop_proof(
        private_key=private_key,
        htm="POST",
        htu=KEYCLOAK_TOKEN_URL,
    )

    response = requests.post(
        KEYCLOAK_TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "client_id": CLIENT_ID,
            "code": auth_code,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": verifier,
        },
        headers={"DPoP": token_dpop_proof},
        timeout=20,
    )
    response.raise_for_status()
    body = response.json()
    access_token = body.get("access_token")
    if not access_token:
        raise RuntimeError("Keycloak không trả về access_token")
    return access_token


def main() -> None:
    requests.packages.urllib3.disable_warnings()  # type: ignore[attr-defined]

    private_key = ec.generate_private_key(ec.SECP256R1())
    print("Bước 1: Lấy access token DPoP-bound từ Keycloak")
    print(f"Flow đang dùng: {AUTH_FLOW}")
    print(f"POST {KEYCLOAK_TOKEN_URL}")
    if AUTH_FLOW == "password":
        print(f"Form: client_id={CLIENT_ID}, grant_type=password, username={ATTACK_USERNAME}, password=***")
    else:
        print(
            f"Form: client_id={CLIENT_ID}, grant_type=authorization_code, "
            f"redirect_uri={REDIRECT_URI}, code=<lấy từ browser>, code_verifier=<pkce>"
        )

    try:
        access_token = get_dpop_bound_access_token(private_key)
        print("Lấy token thành công.")
        print(f"access_token: {mask_token(access_token)}")
    except Exception as e:
        print(f"[!] Keycloak auth error: {e}")
        return

    print("\nBước 2: Tạo DPoP proof cho request API")
    print(f"API đích (htu): {API_URL}")
    print("HTTP method (htm): GET")
    api_dpop_proof = create_dpop_proof(
        private_key=private_key,
        htm="GET",
        htu=API_URL,
        ath=sha256_b64url(access_token),
    )
    print(f"dpop_proof: {mask_token(api_dpop_proof)}")

    headers = {
        "Authorization": f"Bearer {access_token}",
        "DPoP": api_dpop_proof,
    }

    print("\nBước 3: Gửi request API lần 1 (kỳ vọng: 200 nếu role được phép)")
    print(f"GET {API_URL}")
    print(f"Headers.Authorization: Bearer {mask_token(access_token)}")
    print(f"Headers.DPoP: {mask_token(api_dpop_proof)}")

    first = requests.get(API_URL, headers=headers, timeout=15, verify=VERIFY_TLS)
    print(f"Response status: {first.status_code}")
    print(f"Response body: {first.text}")

    print("\nBước 4: Replay lại cùng DPoP proof (kỳ vọng: 401)")
    print(f"GET {API_URL}")
    print("Tái sử dụng y nguyên Authorization + DPoP headers của Bước 3")
    second = requests.get(API_URL, headers=headers, timeout=15, verify=VERIFY_TLS)
    print(f"Response status: {second.status_code}")
    print(f"Response body: {second.text}")

    print("\n~ TỔNG KẾT KẾT QUẢ ~")
    print(f"Status lần 1: {first.status_code}")
    print(f"Status lần 2: {second.status_code}")

    if first.status_code == 403 and second.status_code == 403:
        verdict = "INVALID_TEST_POLICY_BLOCK"
        verdict_detail = (
            "Request bi chan boi policy/role truoc khi den replay check. "
            "Can doi user hoac endpoint duoc allow de test replay dung."
        )
    elif (
        first.status_code == 401
        and "Token is not DPoP bound" in first.text
        and second.status_code == 401
    ):
        verdict = "INVALID_TEST_TOKEN_NOT_BOUND"
        verdict_detail = (
            "Access token chua duoc bind DPoP (thieu cnf.jkt), "
            "nen khong the ket luan replay tren token-bound flow."
        )
    elif first.status_code == 200 and second.status_code in [401, 400]:
        verdict = "PASS"
        verdict_detail = "Replay bi chan dung (jti da duoc su dung)."
    elif first.status_code == 200 and second.status_code == 200:
        verdict = "FAIL_REPLAY_ACCEPTED"
        verdict_detail = "Replay khong bi chan."
    else:
        verdict = "FAIL_UNEXPECTED"
        verdict_detail = "Ket qua khong dung mau mong doi, can kiem tra middleware/log."

    print(f"=> Kết luận: {verdict}")
    print(f"=> Chi tiết: {verdict_detail}")

    timestamp = datetime.now(timezone.utc).isoformat()
    result_lines = [
        "~ BẰNG CHỨNG DPOP REPLAY ATTACK ~",
        f"timestamp_utc: {timestamp}",
        f"target_url: {API_URL}",
        f"first_status: {first.status_code}",
        f"second_status: {second.status_code}",
        f"verify_tls: {VERIFY_TLS}",
        f"first_body: {first.text.strip()}",
        f"second_body: {second.text.strip()}",
        "kỳ_vọng: lần1 = 200, lần2 = 401 (hoặc 400)",
        f"result: {verdict}",
        f"detail: {verdict_detail}",
    ]
    save_evidence("\n".join(result_lines) + "\n")


if __name__ == "__main__":
    main()
