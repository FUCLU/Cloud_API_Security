# E-C2 — Đánh giá WAF Filtering và Webhook HMAC

## 1. Mục tiêu

Chứng minh hệ thống có lớp bảo vệ ở edge trước khi request vào backend: WAF Nginx chặn payload độc hại cơ bản, webhook public được xác thực bằng HMAC thay vì chỉ dựa vào URL bí mật.

## 2. Thành phần liên quan

| Thành phần | Vai trò |
|---|---|
| `waf/nginx.conf` | WAF production, TLS 1.3, mTLS sang Kong, rule chặn traversal/SQLi/XSS |
| `waf/nginx.local.conf` | WAF local, rule tương tự nhưng local TLS verify được nới lỏng |
| `backend/app/api/v1/orders.py` | Endpoint webhook `POST /api/v1/orders/webhooks/orders` |
| `WEBHOOK_SECRET` | Secret dùng tính HMAC-SHA256 |

## 3. Lệnh kiểm thử WAF

Local:

```bash
curl -k "https://localhost:9443/api/v1/products?x=%3Cscript%3E"
curl -k "https://localhost:9443/api/v1/products?x=union%20select"
curl -k "https://localhost:9443/../etc/passwd"
```

Production:

```bash
curl -k "https://api.fmsec.shop:8443/api/v1/products?x=%3Cscript%3E"
curl -k "https://api.fmsec.shop:8443/api/v1/products?x=union%20select"
```

Kết quả mong đợi: WAF trả `403` hoặc request bị chặn trước backend.

## 4. Lệnh kiểm thử Webhook HMAC

Ví dụ local:

```bash
BODY='{"order_id":1,"status":"paid"}'
TS=$(date +%s)
SECRET="${WEBHOOK_SECRET:-your-super-secret-webhook-key-2026}"
SIG=$(printf "%s.%s" "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')

curl -k -i https://localhost:9443/api/v1/orders/webhooks/orders \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  --data "$BODY"
```

Kiểm thử chữ ký sai:

```bash
curl -k -i https://localhost:9443/api/v1/orders/webhooks/orders \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: invalid" \
  --data "$BODY"
```

## 5. Evidence cần lưu

| Evidence | Nội dung |
|---|---|
| `EVIDENCE/attack_results/waf-filtering.txt` | Output request bị WAF chặn |
| `EVIDENCE/attack_results/webhook-hmac.txt` | Output webhook đúng/sai chữ ký |

## 6. Tiêu chí đạt

- Payload traversal/SQLi/XSS cơ bản bị WAF chặn.
- Webhook thiếu hoặc sai `X-Signature` trả `401`.
- Webhook có HMAC hợp lệ trả thành công.
- Khi deploy thật, `WEBHOOK_SECRET` phải được đặt trong `.env`, không dùng default demo.

