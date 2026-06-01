#!/usr/bin/env python3
"""Run reproducible SAST/SCA checks and write evidence files.

The script prefers real tools when available:
  - Bandit for Python SAST
  - pip-audit for dependency SCA

If a tool is not installed, it writes a deterministic fallback report so the
D1 evidence directory still documents what was checked and what remains.
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
EVIDENCE = ROOT / "EVIDENCE" / "security_scans"
BANDIT_JSON = EVIDENCE / "bandit_report.json"
SCA_REPORT = EVIDENCE / "sca_report.txt"
SUMMARY_MD = EVIDENCE / "sast_summary.md"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def run(cmd: list[str], timeout: int = 120) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
    )


def python_files(include_scripts: bool = False) -> list[Path]:
    ignored = {".venv", "__pycache__", ".pytest_cache"}
    files: list[Path] = []
    for path in BACKEND.rglob("*.py"):
        if any(part in ignored for part in path.parts):
            continue
        files.append(path)
    if include_scripts:
        for path in (ROOT / "scripts").rglob("*.py"):
            if any(part in ignored for part in path.parts):
                continue
            if "security_testing" in path.parts:
                continue
            files.append(path)
    return sorted(files)


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def fallback_sast(include_scripts: bool = False) -> dict:
    """Small local static scanner for the most relevant risky patterns."""
    issues: list[dict] = []
    patterns = [
        ("CLOUD-SAST-001", "Use of eval/exec", re.compile(r"\b(eval|exec)\s*\("), "HIGH"),
        ("CLOUD-SAST-002", "subprocess shell=True", re.compile(r"shell\s*=\s*True"), "HIGH"),
        ("CLOUD-SAST-003", "TLS verification disabled", re.compile(r"verify\s*=\s*False|_create_unverified_context"), "MEDIUM"),
        ("CLOUD-SAST-004", "Wildcard CORS origin", re.compile(r"allow_origins\s*=\s*\[\s*[\"']\*[\"']\s*\]"), "MEDIUM"),
        ("CLOUD-SAST-005", "Hardcoded development secret", re.compile(r"(?i)(password|secret|token|api_key)\s*=\s*[\"'][^\"']{4,}[\"']"), "MEDIUM"),
    ]

    files = python_files(include_scripts=include_scripts)
    for path in files:
        text = path.read_text(encoding="utf-8", errors="replace")
        try:
            ast.parse(text)
        except SyntaxError as exc:
            issues.append(
                {
                    "test_id": "CLOUD-SAST-000",
                    "issue_severity": "HIGH",
                    "issue_confidence": "HIGH",
                    "issue_text": f"Python syntax error: {exc.msg}",
                    "filename": rel(path),
                    "line_number": exc.lineno or 1,
                }
            )
        for line_no, line in enumerate(text.splitlines(), start=1):
            stripped = line.strip()
            if stripped.startswith("#"):
                continue
            for test_id, description, regex, severity in patterns:
                if regex.search(line):
                    issues.append(
                        {
                            "test_id": test_id,
                            "issue_severity": severity,
                            "issue_confidence": "MEDIUM",
                            "issue_text": description,
                            "filename": rel(path),
                            "line_number": line_no,
                            "code": stripped[:220],
                        }
                    )

    totals = {"loc": 0, "nosec": 0, "skipped_tests": 0}
    for path in files:
        totals["loc"] += len(path.read_text(encoding="utf-8", errors="replace").splitlines())

    return {
        "generated_at_utc": now(),
        "tool": "fallback-static-checker",
        "note": "Bandit was not installed; this local checker covers high-signal D1 patterns only.",
        "metrics": {"_totals": totals},
        "results": issues,
        "summary": {
            "files_scanned": len(files),
            "issues_total": len(issues),
            "high": sum(1 for issue in issues if issue["issue_severity"] == "HIGH"),
            "medium": sum(1 for issue in issues if issue["issue_severity"] == "MEDIUM"),
            "low": sum(1 for issue in issues if issue["issue_severity"] == "LOW"),
        },
    }


def run_bandit(include_scripts: bool = False) -> tuple[dict, str]:
    scan_roots = ["backend"]
    if include_scripts:
        scan_roots.append("scripts")
    cmd_candidates = [
        [sys.executable, "-m", "bandit"],
        ["bandit"],
    ]
    for base_cmd in cmd_candidates:
        if base_cmd[0] != sys.executable and shutil.which(base_cmd[0]) is None:
            continue
        result = run(base_cmd + ["-r", *scan_roots, "-f", "json"], timeout=180)
        if result.returncode in {0, 1} and result.stdout.strip():
            report = json.loads(result.stdout)
            report["generated_at_utc"] = now()
            return report, "bandit"
    return fallback_sast(include_scripts=include_scripts), "fallback"


def run_sca() -> str:
    header = [
        "# Dependency Audit Evidence",
        "",
        f"- generated_at_utc: {now()}",
        f"- requirements: {rel(ROOT / 'backend' / 'requirements.txt')}",
        "",
    ]
    result = run([sys.executable, "-m", "pip_audit", "-r", "backend/requirements.txt"], timeout=180)
    if result.returncode in {0, 1} and (result.stdout.strip() or result.stderr.strip()):
        body = [
            "- tool: pip-audit",
            f"- exit_code: {result.returncode}",
            "",
            "```text",
            (result.stdout + result.stderr).strip(),
            "```",
            "",
        ]
        return "\n".join(header + body)

    req_text = (ROOT / "backend" / "requirements.txt").read_text(encoding="utf-8", errors="replace")
    body = [
        "- tool: pip-audit",
        "- status: NOT RUN",
        "- reason: pip-audit is not installed in the current Python environment.",
        "- remediation: install with `python -m pip install pip-audit` and rerun `python scripts/security_testing/run_sast.py`.",
        "",
        "## Locked Dependencies",
        "",
        "```text",
        req_text.strip(),
        "```",
        "",
    ]
    return "\n".join(header + body)


def write_summary(report: dict, engine: str, sca_text: str, include_scripts: bool) -> None:
    results = report.get("results", [])
    high = sum(1 for issue in results if issue.get("issue_severity") == "HIGH")
    medium = sum(1 for issue in results if issue.get("issue_severity") == "MEDIUM")
    low = sum(1 for issue in results if issue.get("issue_severity") == "LOW")
    lines = [
        "# SAST Evidence Summary",
        "",
        f"- generated_at_utc: {now()}",
        f"- engine: {engine}",
        f"- report: `{rel(BANDIT_JSON)}`",
        f"- sca_report: `{rel(SCA_REPORT)}`",
        f"- scanned_roots: `backend`{', `scripts`' if include_scripts else ''}",
        f"- total_issues: {len(results)}",
        f"- high: {high}",
        f"- medium: {medium}",
        f"- low: {low}",
        "",
        "## Top Findings",
        "",
    ]
    if results:
        for issue in results[:15]:
            lines.append(
                f"- {issue.get('issue_severity', 'UNKNOWN')} {issue.get('test_id', '')}: "
                f"{issue.get('issue_text', '')} "
                f"({issue.get('filename', '')}:{issue.get('line_number', '')})"
            )
    else:
        lines.append("- No findings reported.")
    if "status: NOT RUN" in sca_text:
        lines += [
            "",
            "## Remaining Gap",
            "",
            "- `pip-audit` is not installed, so dependency vulnerability lookup was not executed.",
        ]
    SUMMARY_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--include-scripts", action="store_true", help="Also scan helper/evaluation scripts.")
    parser.add_argument("--strict", action="store_true", help="Return non-zero when high severity findings exist.")
    args = parser.parse_args()

    EVIDENCE.mkdir(parents=True, exist_ok=True)
    report, engine = run_bandit(include_scripts=args.include_scripts)
    BANDIT_JSON.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    sca_text = run_sca()
    SCA_REPORT.write_text(sca_text, encoding="utf-8")
    write_summary(report, engine, sca_text, args.include_scripts)

    high = sum(1 for issue in report.get("results", []) if issue.get("issue_severity") == "HIGH")
    print(f"SAST evidence written: {rel(BANDIT_JSON)}")
    print(f"SCA evidence written:  {rel(SCA_REPORT)}")
    print(f"Summary written:       {rel(SUMMARY_MD)}")
    print(f"Engine: {engine}; high findings: {high}; total findings: {len(report.get('results', []))}")
    return 1 if args.strict and high else 0


if __name__ == "__main__":
    raise SystemExit(main())
