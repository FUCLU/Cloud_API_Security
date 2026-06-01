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


ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "EVIDENCE" / "security_scans"
REPORT_HTML = EVIDENCE / "zap_report.html"
SUMMARY_JSON = EVIDENCE / "dast_summary.json"
SUMMARY_MD = EVIDENCE / "dast_summary.md"


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


def request(url: str, method: str = "GET", headers: dict[str, str] | None = None, timeout: int = 15) -> dict:
    ctx = ssl.create_default_context(cafile=str(ROOT / "certs" / "ca.crt"))
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
        headers={"Authorization": f"Bearer {forged_alg_none_token()}", "DPoP": "invalid"},
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
        "## Checks",
        "",
    ]
    for item in checks:
        lines.append(f"- {'PASS' if item['passed'] else 'FAIL'} `{item['name']}` - {item['expected']}")
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
    print(f"DAST HTML written: {rel(REPORT_HTML)}")
    print(f"DAST JSON written: {rel(SUMMARY_JSON)}")
    print(f"Summary written:   {rel(SUMMARY_MD)}")
    print(f"Built-in checks: {passed}/{len(checks)} passed; ZAP status: {zap.get('status')}")
    return 1 if args.strict and passed != len(checks) else 0


if __name__ == "__main__":
    raise SystemExit(main())
