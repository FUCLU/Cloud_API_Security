# E-C1 — Đánh giá TLS/mTLS và không lộ plaintext

## 1. Mục tiêu

Chứng minh luồng API production/local đi qua TLS, WAF/Kong sử dụng mTLS ở đoạn WAF -> Kong, và request API không truyền plaintext HTTP trực tiếp vào backend.

## 2. Thành phần liên quan

| Thành phần | Vai trò |
|---|---|
| `frontend/nginx.conf`, `frontend/nginx.local.conf` | HTTPS frontend, proxy `/api/` sang WAF |
| `waf/nginx.conf`, `waf/nginx.local.conf` | TLS edge cho API, gửi client cert khi proxy sang Kong |
| `gateway/kong.yml`, `gateway/kong.local.yml` | Kong upstream TLS verify backend |
| `internal-certs/` | Internal CA và cert cho backend/OPA/Postgres/Redis/Vault |
| `internal-certs/mtls/client.crt` | Client cert để WAF kết nối Kong |

## 3. Lệnh kiểm thử

Local:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env.local ps
curl -k -I https://localhost:9444
curl -k https://localhost:9443/health
```

Production:

```bash
docker compose ps
curl -I https://app.fmsec.shop
curl --cacert certs/kong.crt \
  --cert internal-certs/mtls/client.crt \
  --key internal-certs/mtls/client.key \
  https://api.fmsec.shop:8443/health
```

Kiểm tra cấu hình TLS:

```bash
grep -R "ssl_protocols TLSv1.3" frontend waf gateway
grep -R "ssl_verify_client on" waf docker-compose.yml
grep -R "tls_verify: true" gateway
```

## 4. Evidence cần lưu

| Evidence | Nội dung |
|---|---|
| `EVIDENCE/deploy_server/screenshots/server-da-trien-khai.png` | Ảnh terminal cho thấy `docker compose ps`, frontend health và API health qua mTLS |
| `EVIDENCE/security_scans/dast_summary.md` | Kết quả DAST hoặc health check HTTPS |
| `EVIDENCE/captures/` | Nếu có tcpdump/Wireshark, lưu file capture tại đây |

## 5. Tiêu chí đạt

- Frontend trả HTTP headers qua HTTPS.
- API `/health` trả `{"status":"ok"}` qua WAF/Kong.
- Kong không expose HTTP plaintext ra ngoài.
- WAF/Kong có cấu hình TLS/mTLS và upstream verify backend.

## 6. Kết luận

ĐẠT nếu các health check HTTPS/mTLS thành công và cấu hình TLS/mTLS khớp với `docker-compose.yml`, `waf/nginx.conf`, `gateway/kong.yml`.

