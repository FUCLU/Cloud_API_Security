import json
import os
import time

import pyotp
import requests


KEYCLOAK_TOKEN_URL = os.getenv(
    "KEYCLOAK_TOKEN_URL",
    "http://localhost:8082/realms/cloudapi/protocol/openid-connect/token",
)
CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "backend-client")
CLIENT_SECRET = os.getenv("KEYCLOAK_CLIENT_SECRET", "backend-secret")
USERNAME = os.getenv("KEYCLOAK_USERNAME", "admin")
PASSWORD = os.getenv("KEYCLOAK_PASSWORD", "admin")
TOTP_SECRET = os.getenv("TOTP_SECRET", "IVZUUSCVK5WFK5ZUKVJU26SHHFCVGSKG")
TOTAL_TESTS = int(os.getenv("TOTAL_TESTS", "100"))
EVIDENCE_DIR = os.getenv("EVIDENCE_DIR", "EVIDENCE/authn-logs")


def build_payload(totp_code: str) -> dict[str, str]:
    payload = {
        "client_id": CLIENT_ID,
        "grant_type": "password",
        "username": USERNAME,
        "password": PASSWORD,
        "totp": totp_code,
    }
    if CLIENT_SECRET:
        payload["client_secret"] = CLIENT_SECRET
    return payload


def run_evaluation() -> None:
    os.makedirs(EVIDENCE_DIR, exist_ok=True)

    totp = pyotp.TOTP(TOTP_SECRET)
    valid_attempts = 0
    invalid_attempts = 0
    success_count = 0
    fail_count = 0
    false_accept = 0
    rate_limited = False
    results = []

    print("===================================================")
    print("START E-N1: TOTP BRUTE-FORCE EVALUATION")
    print(f"Token URL: {KEYCLOAK_TOKEN_URL}")
    print(f"Total requests: {TOTAL_TESTS}")
    print("===================================================\n")

    for attempt in range(1, TOTAL_TESTS + 1):
        is_valid_attempt = attempt % 10 != 0
        current_code = totp.now() if is_valid_attempt else "000000"

        if is_valid_attempt:
            valid_attempts += 1
        else:
            invalid_attempts += 1

        try:
            response = requests.post(
                KEYCLOAK_TOKEN_URL,
                data=build_payload(current_code),
                timeout=10,
            )
            status = response.status_code
            body_lower = response.text.lower()
            blocked_by_rate_limit = (
                status == 429 or "account is temporarily disabled" in body_lower
            )
            rate_limited = rate_limited or blocked_by_rate_limit

            results.append(
                {
                    "attempt": attempt,
                    "valid_attempt": is_valid_attempt,
                    "code": current_code,
                    "status": status,
                    "rate_limited": blocked_by_rate_limit,
                }
            )

            if status == 200:
                if is_valid_attempt:
                    success_count += 1
                    outcome = "valid login accepted"
                else:
                    false_accept += 1
                    outcome = "invalid TOTP accepted"
            else:
                fail_count += 1
                outcome = "blocked" if not is_valid_attempt else "unexpected failure"

            print(f"[{attempt:03d}] code={current_code} status={status} {outcome}")
        except requests.RequestException as exc:
            fail_count += 1
            results.append(
                {
                    "attempt": attempt,
                    "valid_attempt": is_valid_attempt,
                    "code": current_code,
                    "error": str(exc),
                }
            )
            print(f"[{attempt:03d}] connection error: {exc}")

        time.sleep(0.05)

    success_rate = (
        f"{(success_count / valid_attempts) * 100:.1f}%" if valid_attempts else "0%"
    )
    summary = {
        "total_requests": TOTAL_TESTS,
        "valid_attempts_simulated": valid_attempts,
        "invalid_attempts_simulated": invalid_attempts,
        "successful_logins": success_count,
        "failed_logins": fail_count,
        "false_accept_vulnerabilities": false_accept,
        "rate_limited_or_temporarily_disabled": rate_limited,
        "valid_login_success_rate": success_rate,
    }

    summary_path = os.path.join(EVIDENCE_DIR, "e_n1_summary.json")
    details_path = os.path.join(EVIDENCE_DIR, "e_n1_details.json")

    with open(summary_path, "w", encoding="utf-8") as summary_file:
        json.dump(summary, summary_file, indent=4, ensure_ascii=False)

    with open(details_path, "w", encoding="utf-8") as details_file:
        json.dump(results, details_file, indent=4, ensure_ascii=False)

    print("\n===================================================")
    print("TOTP EVALUATION SUMMARY")
    print("===================================================")
    print(f"- Total requests: {TOTAL_TESTS}")
    print(f"- Valid successful logins: {success_count}/{valid_attempts}")
    print(f"- Invalid attempts blocked: {invalid_attempts - false_accept}/{invalid_attempts}")
    print(f"- False accepts: {false_accept}")
    print(f"- Rate limit observed: {rate_limited}")
    print(f"- Summary: {summary_path}")


if __name__ == "__main__":
    run_evaluation()
