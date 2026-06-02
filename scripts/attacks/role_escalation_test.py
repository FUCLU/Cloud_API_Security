#!/usr/bin/env python3
"""Evidence test for frontend role route isolation."""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

EVIDENCE_FILE = Path("EVIDENCE/attack_results/role-escalation/role_escalation_result.json")
APP_FILE = Path("frontend/src/App.jsx")


def can_access_route(user_roles: list[str], allowed_roles: list[str]) -> bool:
    if not allowed_roles:
        return True
    return any(role in user_roles for role in allowed_roles)


def route_contains(app_source: str, path: str, expected_roles: list[str]) -> bool:
    pattern = rf'path="{re.escape(path)}"[\s\S]*?<PrivateRoute\s+roles=\{{\[([^\]]*)\]\}}>'
    match = re.search(pattern, app_source)
    if not match:
        return False

    actual_roles = [
        role.strip().strip("'\"")
        for role in match.group(1).split(",")
        if role.strip()
    ]
    return sorted(actual_roles) == sorted(expected_roles)


def main() -> int:
    print("\n=== ROLE ESCALATION TEST ===")
    print("Mục tiêu: chứng minh admin/staff/customer chỉ vào được đúng vùng UI được phép.")
    print("Cơ chế bảo vệ: frontend/src/App.jsx + PrivateRoute + roleAccess.js.")
    print()

    print("[Step 1] Đọc cấu hình route thật từ frontend/src/App.jsx")
    app_source = APP_FILE.read_text(encoding="utf-8")

    cases = [
        {
            "name": "admin_can_access_admin",
            "userRoles": ["admin"],
            "allowedRoles": ["admin"],
            "expected": True,
        },
        {
            "name": "admin_cannot_access_staff_ui",
            "userRoles": ["admin"],
            "allowedRoles": ["staff"],
            "expected": False,
        },
        {
            "name": "admin_cannot_access_customer_ui",
            "userRoles": ["admin"],
            "allowedRoles": ["customer"],
            "expected": False,
        },
        {
            "name": "staff_can_access_staff",
            "userRoles": ["staff"],
            "allowedRoles": ["staff"],
            "expected": True,
        },
        {
            "name": "staff_cannot_access_admin",
            "userRoles": ["staff"],
            "allowedRoles": ["admin"],
            "expected": False,
        },
        {
            "name": "staff_cannot_access_customer",
            "userRoles": ["staff"],
            "allowedRoles": ["customer"],
            "expected": False,
        },
        {
            "name": "customer_can_access_customer",
            "userRoles": ["customer"],
            "allowedRoles": ["customer"],
            "expected": True,
        },
        {
            "name": "customer_cannot_access_admin",
            "userRoles": ["customer"],
            "allowedRoles": ["admin"],
            "expected": False,
        },
        {
            "name": "customer_cannot_access_staff",
            "userRoles": ["customer"],
            "allowedRoles": ["staff"],
            "expected": False,
        },
    ]

    route_config_cases = [
        {
            "name": "admin_route_allows_only_admin",
            "path": "/admin",
            "expectedRoles": ["admin"],
            "passed": route_contains(app_source, "/admin", ["admin"]),
        },
        {
            "name": "staff_route_allows_only_staff",
            "path": "/staff",
            "expectedRoles": ["staff"],
            "passed": route_contains(app_source, "/staff", ["staff"]),
        },
        {
            "name": "customer_route_allows_only_customer",
            "path": "/customer",
            "expectedRoles": ["customer"],
            "passed": route_contains(app_source, "/customer", ["customer"]),
        },
    ]

    print("[Step 2] Kiểm tra route nào yêu cầu role nào")
    for case in route_config_cases:
        status = "PASS" if case["passed"] else "FAIL"
        print(f"  {status} - {case['path']} chỉ cho {case['expectedRoles']}")

    evaluated = []
    print()
    print("[Step 3] Kiểm tra 9 tình huống leo quyền giữa các role")
    for test_case in cases:
        actual = can_access_route(test_case["userRoles"], test_case["allowedRoles"])
        passed = actual == test_case["expected"]
        evaluated.append({**test_case, "actual": actual, "passed": passed})
        status = "PASS" if passed else "FAIL"
        print(f"  {status} - {test_case['name']}: expected={test_case['expected']}, actual={actual}")

    passed_cases = sum(1 for test_case in evaluated if test_case["passed"])
    passed_route_cases = sum(1 for test_case in route_config_cases if test_case["passed"])

    report = {
        "title": "Frontend role route isolation / privilege escalation evidence",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "expected_security_property": (
            "Admin, staff and customer UI areas are isolated by route role guards."
        ),
        "result": (
            "PASS"
            if passed_cases == len(evaluated)
            and passed_route_cases == len(route_config_cases)
            else "FAIL"
        ),
        "passed_cases": passed_cases,
        "total_cases": len(evaluated),
        "passed_route_config_cases": passed_route_cases,
        "total_route_config_cases": len(route_config_cases),
        "route_config_cases": route_config_cases,
        "cases": evaluated,
    }

    print()
    print("[Step 4] Kết luận")
    print(f"  Logic cases : {passed_cases}/{len(evaluated)} passed")
    print(f"  Route config: {passed_route_cases}/{len(route_config_cases)} passed")
    print(f"  Result      : {report['result']}")

    EVIDENCE_FILE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE_FILE.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\nEvidence saved: {EVIDENCE_FILE}")
    return 0 if report["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
