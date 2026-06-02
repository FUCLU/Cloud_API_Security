import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "backend" / "app"))

from app.security.bola_guard import can_read_order


EVIDENCE_FILE = Path(
    os.getenv("EVIDENCE_FILE", "EVIDENCE/attack_results/bola/bola_result.txt")
)


def payload(sub: str, roles: list[str]) -> dict:
    return {
        "sub": sub,
        "realm_access": {"roles": roles},
    }


def run_case(name: str, order_owner_id, token_payload: dict, expected: bool) -> dict:
    actual = can_read_order(order_owner_id, token_payload)
    return {
        "name": name,
        "order_owner_id": order_owner_id,
        "token_sub": token_payload.get("sub"),
        "roles": token_payload.get("realm_access", {}).get("roles", []),
        "expected_allowed": expected,
        "actual_allowed": actual,
        "passed": actual == expected,
    }


def main() -> None:
    print("\n=== BOLA / IDOR ATTACK TEST ===")
    print("Mục tiêu: chứng minh customer không đọc được order của customer khác.")
    print("Cơ chế bảo vệ: backend/app/security/bola_guard.py kiểm tra owner của object.")
    print()

    print("[Step 1] Chuẩn bị các payload token giả lập")
    print("  - customer-a: chủ sở hữu order")
    print("  - attacker-customer: customer khác cố đọc order của victim")
    print("  - staff/admin: role vận hành được phép xem order")
    print()

    print("[Step 2] Chạy 5 test case owner/role")
    cases = [
        run_case(
            "customer_reads_own_order",
            "customer-a",
            payload("customer-a", ["customer"]),
            True,
        ),
        run_case(
            "customer_reads_other_customer_order_bola_attack",
            "victim-customer",
            payload("attacker-customer", ["customer"]),
            False,
        ),
        run_case(
            "customer_missing_subject_denied",
            "victim-customer",
            {"realm_access": {"roles": ["customer"]}},
            False,
        ),
        run_case(
            "staff_operational_access_allowed",
            "victim-customer",
            payload("staff-1", ["staff"]),
            True,
        ),
        run_case(
            "admin_operational_access_allowed",
            "victim-customer",
            payload("admin-1", ["admin"]),
            True,
        ),
    ]

    passed = sum(1 for case in cases if case["passed"])
    result = "PASS" if passed == len(cases) else "FAIL"

    for index, case in enumerate(cases, start=1):
        status = "PASS" if case["passed"] else "FAIL"
        print(f"  [{index}] {status} - {case['name']}")
        print(f"      order_owner_id : {case['order_owner_id']}")
        print(f"      token_sub      : {case['token_sub']}")
        print(f"      roles          : {case['roles']}")
        print(f"      expected       : {case['expected_allowed']}")
        print(f"      actual         : {case['actual_allowed']}")

    print()
    print("[Step 3] Kết luận")
    print(f"  Passed cases: {passed}/{len(cases)}")
    print(f"  Result      : {result}")

    report = {
        "title": "BOLA/IDOR object-level authorization evidence",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "expected_security_property": (
            "A customer cannot read another customer's order; staff/admin can operate orders."
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
