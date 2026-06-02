import base64
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

API_URL = os.getenv("API_URL", "https://localhost:8443/api/v1/users")
TLS_CA_CERT = os.getenv("TLS_CA_CERT", "certs/ca.crt")
CLIENT_CERT = os.getenv("CLIENT_CERT", "certs/client.crt")
CLIENT_KEY = os.getenv("CLIENT_KEY", "certs/client.key")
EVIDENCE_FILE = Path(
    os.getenv(
        "EVIDENCE_FILE",
        "EVIDENCE/attack_results/token-hardening/alg_none_result.txt",
    )
)


def b64url_encode(data: str) -> str:
    return base64.urlsafe_b64encode(data.encode("utf-8")).rstrip(b"=").decode("utf-8")


def save_evidence(report: str) -> None:
    EVIDENCE_FILE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE_FILE.write_text(report, encoding="utf-8")
    print(f"[+] Evidence saved: {EVIDENCE_FILE}")


def main() -> None:
    requests.packages.urllib3.disable_warnings()  # type: ignore[attr-defined]

    print("\n=== JWT ALG=NONE ATTACK TEST ===")
    print("Mục tiêu: giả mạo JWT không có chữ ký để xem gateway có chặn hay không.")
    print("Cơ chế bảo vệ: gateway/plugins/jwt-hardening/handler.lua chặn alg=none.")
    print(f"Target URL : {API_URL}")
    print(f"TLS CA     : {TLS_CA_CERT}")
    print(f"mTLS cert  : {CLIENT_CERT}")

    print("\n[Step 1] Tạo JWT header giả mạo")
    header = {"alg": "none", "typ": "JWT"}
    print(f"  header_json: {json.dumps(header, separators=(',', ':'))}")

    print("\n[Step 2] Tạo payload giả mạo role admin")
    payload = {
        "sub": "attacker",
        "role": "admin",
        "email": "attacker@evil.local",
        "exp": 9999999999,
    }
    print(f"  payload_json: {json.dumps(payload, separators=(',', ':'))}")

    print("\n[Step 3] Base64URL encode và lắp JWT không chữ ký")
    header_b64 = b64url_encode(json.dumps(header, separators=(",", ":")))
    payload_b64 = b64url_encode(json.dumps(payload, separators=(",", ":")))
    token = f"{header_b64}.{payload_b64}."
    print(f"  header_b64 : {header_b64}")
    print(f"  payload_b64: {payload_b64}")
    print("  signature  : <rỗng>")
    print(f"  token      : {token[:96]}...")

    print("\n[Step 4] Gửi request tấn công qua Kong")
    print("  Method : GET")
    print(f"  URL    : {API_URL}")
    print("  Header : Authorization: Bearer <forged_alg_none_token>")
    response = requests.get(
        API_URL,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
        verify=TLS_CA_CERT,
        cert=(CLIENT_CERT, CLIENT_KEY),
    )

    body_text = response.text.strip()
    timestamp = datetime.now(timezone.utc).isoformat()
    pass_fail = "PASS" if response.status_code == 401 else "FAIL"

    print("\n[Step 5] Đánh giá kết quả")
    print("  Kỳ vọng : HTTP 401 Unauthorized")
    print(f"  Thực tế : HTTP {response.status_code}")
    print(f"  Body    : {body_text}")
    print(f"  Result  : {pass_fail}")
    if pass_fail == "PASS":
        print("  Ý nghĩa : Gateway đã chặn token alg=none trước khi vào backend.")
    else:
        print("  Ý nghĩa : Cần kiểm tra lại plugin jwt-hardening hoặc route Kong.")

    result_lines = [
        "~ ALG NONE ATTACK EVIDENCE ~",
        f"timestamp_utc: {timestamp}",
        f"target_url: {API_URL}",
        f"attack_goal: Forge unsigned JWT with alg=none and admin role",
        f"defense: Kong jwt-hardening plugin must reject alg=none",
        f"header_json: {json.dumps(header, separators=(',', ':'))}",
        f"payload_json: {json.dumps(payload, separators=(',', ':'))}",
        f"header_b64: {header_b64}",
        f"payload_b64: {payload_b64}",
        f"status_code: {response.status_code}",
        f"tls_ca: {TLS_CA_CERT}",
        f"client_cert: {CLIENT_CERT}",
        f"response_body: {body_text}",
        "expected: 401 Unauthorized",
        f"result: {pass_fail}",
    ]
    save_evidence("\n".join(result_lines) + "\n")


if __name__ == "__main__":
    main()
