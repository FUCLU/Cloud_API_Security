# DAST Evidence Summary

- generated_at_utc: 2026-06-02T03:50:15.913889+00:00
- checks_passed: 7/7
- html_report: `EVIDENCE/security_scans/zap_report.html`
- json_report: `EVIDENCE/security_scans/dast_summary.json`
- zap_status: skipped

## Ý nghĩa

Báo cáo này là kiểm thử black-box qua HTTPS, mô phỏng cách một client/attacker bên ngoài nhìn thấy hệ thống.
Các request hợp lệ qua Kong dùng CA nội bộ và client certificate `certs/client.crt` + `certs/client.key`.

## Checks

### PASS `frontend_https_available`

- Target: `https://localhost:5174`
- Kỳ vọng: HTTP 200 over trusted local TLS
- Bằng chứng: Frontend trả HTTP 200 qua HTTPS với CA nội bộ.

### PASS `kong_requires_client_certificate`

- Target: `https://localhost:8443/health`
- Kỳ vọng: Kong mTLS rejects requests that do not present a trusted client certificate
- Bằng chứng: Không gửi client cert thì Kong chặn trước khi vào backend.

### PASS `kong_https_health`

- Target: `https://localhost:8443/health`
- Kỳ vọng: HTTP 200 and backend status ok through Kong HTTPS
- Bằng chứng: Kong forward tới backend thành công, HTTP 200, body='{"status":"ok"}'.

### PASS `security_headers_present`

- Target: `https://localhost:8443/health`
- Kỳ vọng: HSTS, X-Content-Type-Options and X-Frame-Options are present
- Bằng chứng: Headers tìm thấy: strict-transport-security, x-content-type-options, x-frame-options

### PASS `rate_limit_headers_present`

- Target: `https://localhost:8443/health`
- Kỳ vọng: Kong rate-limit headers are present
- Bằng chứng: Rate-limit headers: x-ratelimit-limit-minute, x-ratelimit-remaining-minute, ratelimit-limit

### PASS `protected_endpoint_requires_auth`

- Target: `https://localhost:8443/api/v1/users`
- Kỳ vọng: Missing Authorization is rejected by gateway/backend with 401 or 403
- Bằng chứng: Không gửi Authorization bị chặn với HTTP 403.

### PASS `jwt_alg_none_rejected`

- Target: `https://localhost:8443/api/v1/users`
- Kỳ vọng: Forged alg=none JWT is rejected
- Bằng chứng: JWT giả mạo alg=none bị chặn với HTTP 401.


## Remaining Gap

- ZAP baseline was skipped: --skip-zap was set
