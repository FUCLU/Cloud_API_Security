# RUNBOOK — Cloud API Security (D1 Local)

Runbook vận hành theo cấu hình thực tế hiện tại.

## 1. Mục tiêu

1. Khởi động hệ thống đúng cấu hình.
2. Kiểm tra nhanh trạng thái dịch vụ.
3. Chạy test replay DPoP theo flow chuẩn.
4. Có checklist xử lý lỗi thường gặp.

---

## 2. Service và cổng

| Service | URL/Port | Ghi chú |
|---|---|---|
| Frontend HTTP | `http://localhost:5173` | UI chính |
| Frontend HTTPS | `https://localhost:5174` | Callback/UI TLS |
| Kong HTTP | `http://localhost:8000` | API entrypoint dev |
| Kong HTTPS | `https://localhost:8443` | API entrypoint TLS |
| Kong Admin | `http://localhost:8001` | Dev only |
| Keycloak | `http://localhost:8082` | Realm `cloudapi` |
| Backend | `http://localhost:9000` | Debug trực tiếp |
| OPA | `http://localhost:8181` | PDP |
| Vault | `http://localhost:8200` | Dev mode |
| Postgres | `localhost:5434` | host -> container |
| Redis | `localhost:6380` | host -> container |

---

## 3. Pre-flight checklist

1. Có `.env` (copy từ `.env.example`).
2. Docker chạy bình thường.
3. Không xung đột cổng quan trọng.

Kiểm tra:

```bash
docker version
docker compose version
```

---

## 4. Khởi động stack

```bash
docker compose up -d
docker compose ps
```

Bật thêm profile quan sát và tools:

```bash
docker compose --profile obs --profile tools up -d
```

---

## 5. Health check bắt buộc

```bash
curl http://localhost:9000/health
curl http://localhost:8181/health
curl http://localhost:8200/v1/sys/health
curl -k https://localhost:8443/health
```

Ghi chú:

- `https://localhost:8443` phải gọi bằng HTTPS.
- Health qua Kong có thể bị ảnh hưởng policy/plugin; ưu tiên kiểm tra thêm backend health.

---

## 6. Lệnh vận hành nhanh

Restart cụm chính:

```bash
docker compose restart backend kong keycloak opa
```

Xem log:

```bash
docker compose logs backend --tail 120
docker compose logs kong --tail 120
docker compose logs keycloak --tail 120
docker compose logs opa --tail 120
```

---

## 7. Chạy replay DPoP (ưu tiên)

Script:

- `scripts/attacks/replay_dpop_attack.py`

Thiết lập biến môi trường (PowerShell):

```powershell
$env:AUTH_FLOW="authorization_code"
$env:REDIRECT_URI="https://localhost:5174/callback"
$env:API_URL="https://localhost:8443/api/v1/products"
```

Chạy:

```powershell
python scripts/attacks/replay_dpop_attack.py
```

Kỳ vọng PASS:

- Request 1: `200`
- Request 2 (reuse proof): `401` với `DPoP proof replayed`

Evidence:

- `EVIDENCE/attack_results/token-hardening/dpop_replay_result.txt`

---

## 8. Điểm cấu hình quan trọng

1. Keycloak có DPoP feature:
   - `start-dev --features=dpop --import-realm`
2. Kong route API có:
   - `strip_path: false`
3. Backend DPoP verifier:
   - xử lý `X-Forwarded-Proto/Host/Port`
   - verify `cnf.jkt` trước replay cache
4. Backend startup có:
   - `init_db()` để tự tạo schema cơ bản

---

## 9. Troubleshooting

### 9.1 `Token is not DPoP bound`

Nguyên nhân:
- Token không có `cnf.jkt`.

Xử lý:
1. Kiểm tra Keycloak chạy với `--features=dpop`.
2. Kiểm tra cấu hình client `spa-client`.
3. Dùng flow `authorization_code` khi test replay.

### 9.2 `DPoP htu mismatch`

Xử lý:
1. Đảm bảo `API_URL` trùng URL public gọi thật qua Kong.
2. Restart backend/kong sau khi đổi config.

### 9.3 `forbidden_role`

Xử lý:
1. Kiểm tra role trong token.
2. Kiểm tra `opa/policies/authz.rego`.
3. Kiểm tra plugin role extraction `gateway/plugins/opa-authz/handler.lua`.

### 9.4 `relation "products" does not exist`

Xử lý:
1. `docker compose restart backend`
2. Nếu cần seed:

```bash
docker compose exec backend python -m app.db.seed_data
```

### 9.5 Callback UI báo `State mismatch`

Giải thích:
- Thường là mismatch state của frontend session.
- Với script CLI, nếu token exchange thành công thì vẫn test replay được.

---

## 10. Script bảo mật khác

```bash
python scripts/attacks/alg_none_attack.py
python scripts/attacks/bola_attack.py
python scripts/attacks/nonce_reuse_test.py
```

Evaluation:

```bash
python scripts/evaluation/e_n1_totp_test.py
python scripts/evaluation/e_c2_nonce_test.py
python scripts/evaluation/e_c3_aead_integrity.py
bash scripts/evaluation/e_z1_policy_test.sh
bash scripts/evaluation/e_z2_token_hardening.sh
```

---

## 11. Shutdown/Cleanup

Dừng stack:

```bash
docker compose down
```

Reset dữ liệu:

```bash
docker compose down -v --remove-orphans
```

---

## 12. Quy tắc vận hành

1. Không commit secrets/private keys/certs nhạy cảm.
2. Test chính thức phải đi qua Kong.
3. Mỗi thay đổi auth/policy/gateway cần re-test replay DPoP.
4. Lưu evidence sau mỗi vòng kiểm thử.
