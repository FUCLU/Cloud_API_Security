#!/usr/bin/env python3
"""Run D1 black-box DAST checks and write HTML/JSON evidence."""

from __future__ import annotations

import argparse
import base64
import json
import shutil
import ssl
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "EVIDENCE" / "security_scans"
REPORT_HTML = EVIDENCE / "zap_report.html"
SUMMARY_JSON = EVIDENCE / "dast_summary.json"
SUMMARY_MD = EVIDENCE / "dast_summary.md"
CA_CERT = ROOT / "certs" / "ca.crt"
CLIENT_CERT = ROOT / "internal-certs" / "mtls" / "client.crt"
CLIENT_KEY = ROOT / "internal-certs" / "mtls" / "client.key"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def forged_alg_none_token() -> str:
    header = b64url(json.dumps({"alg": "none", "typ": "JWT"}).encode())
    payload = b64url(
        json.dumps(
            {
                "sub": "attacker",
                "role": "admin",
                "email": "attacker@evil.local",
                "exp": 9999999999,
            }
        ).encode()
    )
    return f"{header}.{payload}."


def request(
    url: str,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    timeout: int = 15,
    client_cert: bool = True,
) -> dict:
    ctx = ssl.create_default_context(cafile=str(CA_CERT))
    if client_cert and CLIENT_CERT.exists() and CLIENT_KEY.exists():
        ctx.load_cert_chain(certfile=str(CLIENT_CERT), keyfile=str(CLIENT_KEY))
    req = urllib.request.Request(url, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            body = resp.read(4096).decode("utf-8", errors="replace")
            return {
                "ok": True,
                "status": resp.status,
                "headers": {k.lower(): v for k, v in resp.headers.items()},
                "body": body,
            }
    except urllib.error.HTTPError as exc:
        body = exc.read(4096).decode("utf-8", errors="replace")
        return {
            "ok": False,
            "status": exc.code,
            "headers": {k.lower(): v for k, v in exc.headers.items()},
            "body": body,
        }
    except Exception as exc:
        return {"ok": False, "status": None, "headers": {}, "body": "", "error": str(exc)}


def test(name: str, target: str, expected: str, passed: bool, detail: dict) -> dict:
    return {
        "name": name,
        "target": target,
        "expected": expected,
        "passed": passed,
        "detail": detail,
    }


def summarize_detail(item: dict) -> str:
    detail = item.get("detail", {})
    name = item.get("name", "")
    status = detail.get("status")
    headers = detail.get("headers", {})
    body = detail.get("body", "")
    error = detail.get("error", "")

    if name == "frontend_https_available":
        if item["passed"]:
            return f"Frontend trả HTTP {status} qua HTTPS với CA nội bộ."
        return f"Frontend chưa truy cập được qua HTTPS: {error or status}"

    if name == "kong_requires_client_certificate":
        if item["passed"]:
            return "Không gửi client cert thì Kong chặn trước khi vào backend."
        return f"Kong chưa chặn request thiếu client cert: status={status}, error={error}"

    if name == "kong_https_health":
        if item["passed"]:
            return f"Kong forward tới backend thành công, HTTP {status}, body={body.strip()!r}."
        return f"Kong health fail: status={status}, error={error}, body={body.strip()!r}"

    if name == "security_headers_present":
        present = [
            key
            for key in ["strict-transport-security", "x-content-type-options", "x-frame-options"]
            if key in headers
        ]
        return "Headers tìm thấy: " + (", ".join(present) if present else "không có")

    if name == "rate_limit_headers_present":
        present = [
            key
            for key in ["x-ratelimit-limit-minute", "x-ratelimit-remaining-minute", "ratelimit-limit"]
            if key in headers
        ]
        return "Rate-limit headers: " + (", ".join(present) if present else "không có")

    if name == "protected_endpoint_requires_auth":
        if item["passed"]:
            return f"Không gửi Authorization bị chặn với HTTP {status}."
        return f"Endpoint protected không chặn đúng: status={status}, body={body.strip()!r}"

    if name == "jwt_alg_none_rejected":
        if item["passed"]:
            return f"JWT giả mạo alg=none bị chặn với HTTP {status}."
        return f"JWT alg=none chưa bị chặn đúng: status={status}, body={body.strip()!r}"

    if error:
        return error
    if status is not None:
        return f"HTTP {status}"
    return json.dumps(detail, ensure_ascii=False)[:180]


def print_console_report(checks: list[dict], zap: dict) -> None:
    passed = sum(1 for item in checks if item["passed"])

    print("\n=== DAST SECURITY REPORT ===")
    print("Mục tiêu: kiểm thử black-box qua HTTPS giống góc nhìn attacker bên ngoài.")
    print("Phạm vi:")
    print("  - Frontend HTTPS")
    print("  - Kong API Gateway HTTPS/mTLS")
    print("  - Security headers")
    print("  - Rate limiting")
    print("  - Auth bắt buộc")
    print("  - JWT alg=none hardening")
    print()

    for index, item in enumerate(checks, start=1):
        status = "PASS" if item["passed"] else "FAIL"
        print(f"[{index}] {status} - {item['name']}")
        print(f"    Target : {item['target']}")
        print(f"    Kỳ vọng: {item['expected']}")
        print(f"    Bằng chứng: {summarize_detail(item)}")
        print()

    print("=== TỔNG KẾT ===")
    print(f"Checks passed: {passed}/{len(checks)}")
    print(f"ZAP status   : {zap.get('status')}")
    if zap.get("reason"):
        print(f"ZAP reason   : {zap.get('reason')}")
    print(f"HTML report  : {rel(REPORT_HTML)}")
    print(f"JSON report  : {rel(SUMMARY_JSON)}")
    print(f"MD summary   : {rel(SUMMARY_MD)}")
    print("============================\n")


def run_builtin_checks(frontend_url: str, api_url: str) -> list[dict]:
    checks: list[dict] = []

    frontend = request(frontend_url, method="GET")
    checks.append(
        test(
            "frontend_https_available",
            frontend_url,
            "HTTP 200 over trusted local TLS",
            frontend.get("status") == 200,
            frontend,
        )
    )

    health_url = f"{api_url.rstrip('/')}/health"
    no_client_cert = request(health_url, method="GET", client_cert=False)
    checks.append(
        test(
            "kong_requires_client_certificate",
            health_url,
            "Kong mTLS rejects requests that do not present a trusted client certificate",
            (
                no_client_cert.get("status") == 400
                and "ssl certificate" in no_client_cert.get("body", "").lower()
            )
            or (
                no_client_cert.get("status") is None
                and any(
                    text in no_client_cert.get("error", "").lower()
                    for text in ["certificate required", "tlsv13 alert", "handshake", "certificate"]
                )
            ),
            no_client_cert,
        )
    )

    health = request(health_url, method="GET")
    headers = health.get("headers", {})
    checks.append(
        test(
            "kong_https_health",
            health_url,
            "HTTP 200 and backend status ok through Kong HTTPS",
            health.get("status") == 200 and '"ok"' in health.get("body", ""),
            health,
        )
    )
    checks.append(
        test(
            "security_headers_present",
            health_url,
            "HSTS, X-Content-Type-Options and X-Frame-Options are present",
            all(
                key in headers
                for key in ["strict-transport-security", "x-content-type-options", "x-frame-options"]
            ),
            {"headers": headers},
        )
    )
    checks.append(
        test(
            "rate_limit_headers_present",
            health_url,
            "Kong rate-limit headers are present",
            "x-ratelimit-limit-minute" in headers or "ratelimit-limit" in headers,
            {"headers": headers},
        )
    )

    protected_url = f"{api_url.rstrip('/')}/api/v1/users"
    no_auth = request(protected_url, method="GET")
    checks.append(
        test(
            "protected_endpoint_requires_auth",
            protected_url,
            "Missing Authorization is rejected by gateway/backend with 401 or 403",
            no_auth.get("status") in {401, 403},
            no_auth,
        )
    )

    alg_none = request(
        protected_url,
        method="GET",
        headers={"Authorization": f"Bearer {forged_alg_none_token()}"},
    )
    checks.append(
        test(
            "jwt_alg_none_rejected",
            protected_url,
            "Forged alg=none JWT is rejected",
            alg_none.get("status") == 401,
            alg_none,
        )
    )

    return checks


def try_zap(frontend_url: str) -> dict:
    image = "ghcr.io/zaproxy/zaproxy:stable"
    docker = shutil.which("docker")
    if docker is None:
        return {"status": "skipped", "reason": "docker CLI not found"}

    images = subprocess.run(
        [docker, "images", "-q", image],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if not images.stdout.strip():
        return {
            "status": "skipped",
            "reason": f"{image} is not available locally; pull it and rerun to execute ZAP baseline.",
        }

    cmd = [
        docker,
        "run",
        "--rm",
        "--network",
        "host",
        "-v",
        f"{EVIDENCE.as_posix()}:/zap/wrk",
        image,
        "zap-baseline.py",
        "-t",
        frontend_url,
        "-r",
        "zap_report.html",
    ]
    result = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, check=False, timeout=600)
    return {
        "status": "completed" if result.returncode in {0, 1, 2} else "failed",
        "exit_code": result.returncode,
        "stdout": result.stdout[-4000:],
        "stderr": result.stderr[-4000:],
    }


def html_report(checks: list[dict], zap: dict) -> str:
    rows = []
    for item in checks:
        status = "PASS" if item["passed"] else "FAIL"
        color = "#137333" if item["passed"] else "#b3261e"
        detail = json.dumps(item["detail"], indent=2, ensure_ascii=False)
        rows.append(
            f"<tr><td>{item['name']}</td><td style='color:{color};font-weight:700'>{status}</td>"
            f"<td>{item['expected']}</td><td><code>{item['target']}</code></td></tr>"
            f"<tr><td colspan='4'><pre>{detail}</pre></td></tr>"
        )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>D1 DAST Evidence</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 32px; color: #1f1f1f; }}
    table {{ border-collapse: collapse; width: 100%; }}
    th, td {{ border: 1px solid #ddd; padding: 8px; vertical-align: top; }}
    th {{ background: #f5f5f5; text-align: left; }}
    pre {{ white-space: pre-wrap; background: #f7f7f7; padding: 12px; margin: 0; }}
    code {{ font-family: Consolas, monospace; }}
  </style>
</head>
<body>
  <h1>D1 DAST Evidence</h1>
  <p>Generated at {now()}</p>
  <p>This report contains built-in black-box checks. ZAP status: <strong>{zap.get('status')}</strong> - {zap.get('reason', '')}</p>
  <table>
    <thead><tr><th>Check</th><th>Status</th><th>Expected</th><th>Target</th></tr></thead>
    <tbody>{''.join(rows)}</tbody>
  </table>
  <h2>ZAP Details</h2>
  <pre>{json.dumps(zap, indent=2, ensure_ascii=False)}</pre>
</body>
</html>
"""


def write_markdown(checks: list[dict], zap: dict) -> None:
    passed = sum(1 for item in checks if item["passed"])
    lines = [
        "# DAST Evidence Summary",
        "",
        f"- generated_at_utc: {now()}",
        f"- checks_passed: {passed}/{len(checks)}",
        f"- html_report: `{rel(REPORT_HTML)}`",
        f"- json_report: `{rel(SUMMARY_JSON)}`",
        f"- zap_status: {zap.get('status')}",
        "",
        "## Ý nghĩa",
        "",
        "Báo cáo này là kiểm thử black-box qua HTTPS, mô phỏng cách một client/attacker bên ngoài nhìn thấy hệ thống.",
        "Các request hợp lệ qua Kong dùng CA nội bộ và client certificate `internal-certs/mtls/client.crt` + `internal-certs/mtls/client.key`.",
        "",
        "## Checks",
        "",
    ]
    for item in checks:
        lines += [
            f"### {'PASS' if item['passed'] else 'FAIL'} `{item['name']}`",
            "",
            f"- Target: `{item['target']}`",
            f"- Kỳ vọng: {item['expected']}",
            f"- Bằng chứng: {summarize_detail(item)}",
            "",
        ]
    if zap.get("status") == "skipped":
        lines += [
            "",
            "## Remaining Gap",
            "",
            f"- ZAP baseline was skipped: {zap.get('reason')}",
        ]
    SUMMARY_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--frontend-url", default="https://localhost:5174")
    parser.add_argument("--api-url", default="https://localhost:8443")
    parser.add_argument("--skip-zap", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Return non-zero if any built-in check fails.")
    args = parser.parse_args()

    EVIDENCE.mkdir(parents=True, exist_ok=True)
    checks = run_builtin_checks(args.frontend_url, args.api_url)
    zap = {"status": "skipped", "reason": "--skip-zap was set"} if args.skip_zap else try_zap(args.frontend_url)

    payload = {
        "generated_at_utc": now(),
        "frontend_url": args.frontend_url,
        "api_url": args.api_url,
        "checks": checks,
        "zap": zap,
    }
    SUMMARY_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    REPORT_HTML.write_text(html_report(checks, zap), encoding="utf-8")
    write_markdown(checks, zap)

    passed = sum(1 for item in checks if item["passed"])
    print_console_report(checks, zap)
    return 1 if args.strict and passed != len(checks) else 0


if __name__ == "__main__":
    raise SystemExit(main())
