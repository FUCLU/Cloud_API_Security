# DAST Evidence Summary

- generated_at_utc: 2026-06-01T08:58:49.618006+00:00
- checks_passed: 6/6
- html_report: `EVIDENCE/security_scans/zap_report.html`
- json_report: `EVIDENCE/security_scans/dast_summary.json`
- zap_status: skipped

## Checks

- PASS `frontend_https_available` - HTTP 200 over trusted local TLS
- PASS `kong_https_health` - HTTP 200 and backend status ok through Kong HTTPS
- PASS `security_headers_present` - HSTS, X-Content-Type-Options and X-Frame-Options are present
- PASS `rate_limit_headers_present` - Kong rate-limit headers are present
- PASS `protected_endpoint_requires_auth` - Missing Authorization is rejected by gateway/backend with 401 or 403
- PASS `jwt_alg_none_rejected` - Forged alg=none JWT is rejected

## Remaining Gap

- ZAP baseline was skipped: ghcr.io/zaproxy/zaproxy:stable is not available locally; pull it and rerun to execute ZAP baseline.
