import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.security.ssrf_guard import SSRFBlocked, validate_outbound_url


EVIDENCE_FILE = Path(
    os.getenv("EVIDENCE_FILE", "EVIDENCE/attack_results/ssrf/ssrf_result.txt")
)


def run_case(name: str, url: str, expected_allowed: bool) -> dict:
    try:
        detail = validate_outbound_url(url)
        actual_allowed = True
        reason = detail
    except SSRFBlocked as exc:
        actual_allowed = False
        reason = str(exc)

    return {
        "name": name,
        "url": url,
        "expected_allowed": expected_allowed,
        "actual_allowed": actual_allowed,
        "reason": reason,
        "passed": actual_allowed == expected_allowed,
    }


def main() -> None:
    cases = [
        run_case("block_aws_metadata_ip", "http://169.254.169.254/latest/meta-data/", False),
        run_case("block_loopback_ip", "http://127.0.0.1:8000/admin", False),
        run_case("block_localhost_hostname", "http://localhost:8000/admin", False),
        run_case("block_private_ip", "http://10.0.0.5/internal", False),
        run_case("block_file_scheme", "file:///etc/passwd", False),
        run_case("allow_public_https_ip", "https://93.184.216.34/", True),
    ]

    passed = sum(1 for case in cases if case["passed"])
    result = "PASS" if passed == len(cases) else "FAIL"
    report = {
        "title": "SSRF outbound URL guard evidence",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "expected_security_property": (
            "Block metadata, loopback, private, link-local, reserved IPs and non-http schemes."
        ),
        "result": result,
        "passed_cases": passed,
        "total_cases": len(cases),
        "cases": cases,
    }

    EVIDENCE_FILE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE_FILE.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"\nEvidence saved: {EVIDENCE_FILE}")

    if result != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
