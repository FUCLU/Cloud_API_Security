# PROJECT_CONTEXT.md
> **Dành cho LLM:** Đây là file ngữ cảnh dự án. Đọc toàn bộ trước khi trả lời bất kỳ câu hỏi nào liên quan đến codebase.

---

## 1. THÔNG TIN CƠ BẢN

| Trường | Giá trị |
|--------|---------|
| Tên đề tài | Cloud API-Based Network Application Security for Small Company Services |
| Môn học | NT219.Q21.ANTT — Mật mã học |
| Repo | `github.com/FUCLU/Cloud_API_Security` |
| Stack | Docker Compose · FastAPI · React · Kong · Keycloak · OPA · Vault |

### Nhóm thực hiện

| Thành viên | MSSV | Phụ trách |
|------------|------|-----------|
| Lưu Hồng Phúc | 24521382 | Docker Compose, Kong, DPoP backend, Frontend PKCE+DPoP, mTLS D2 |
| Phan Thái Hưng | 24520624 | FastAPI CRUD, Keycloak realm, PostgreSQL AEAD, BOLA, CORS |
| Võ Tưởng Tuấn Kiệt | 24520919 | OPA RBAC/ABAC, Grafana/Loki, Vault rotation, Evaluation scripts |

---

## 2. MỤC TIÊU HỆ THỐNG (3 BẢO ĐẢM CHÍNH)

```
AuthN  → Chỉ đúng người mới vào được      (Keycloak + TOTP + DPoP)
AuthZ  → Đúng người, chỉ làm đúng việc    (OPA/Rego + RBAC/ABAC + BOLA)
Crypto → Dữ liệu không đọc/sửa được       (TLS 1.3 + AES-256-GCM + Vault)
```

---

## 3. KIẾN TRÚC — LUỒNG REQUEST

```
Browser/SPA
    │  PKCE + DPoP token
    ▼
Kong Gateway :8000          ← PEP: verify JWT format (RS256/kid), rate-limit, Lua plugins
    │  forward + JWT
    ▼
FastAPI Backend :9000        ← verify DPoP proof, check jti (Redis SET NX), business logic
    │  authz query {subject, action, resource}
    ▼
OPA :8181                   ← PDP: evaluate Rego → {allow: bool, reason: string}
    │  nếu cần đọc/ghi data nhạy cảm
    ▼
Vault Transit :8200          ← AES-256-GCM envelope encrypt/decrypt (DEK/KEK)
    │
    ▼
PostgreSQL :5432             ← lưu ciphertext (KHÔNG BAO GIỜ plaintext)

Keycloak :8081               ← IdP: chỉ tham gia lúc login/refresh, không nằm trong luồng request thường
Redis :6379                  ← anti-replay: lưu DPoP jti với TTL
```

> ⚠️ **Quan trọng:** FastAPI `:9000` chỉ để debug. Mọi request từ client **phải** đi qua Kong `:8000`.

---

## 4. SERVICES — PORT VÀ VAI TRÒ

| Service | Container | Port | Vai trò |
|---------|-----------|------|---------|
| Frontend | `api-frontend` | `:5173` | React SPA — PKCE + DPoP |
| Kong | `api-gateway` | `:8000`, `:8443`, `:8001` | PEP — cửa ngõ duy nhất |
| Keycloak | `keycloak` | `:8081` | IdP — OIDC/PKCE/TOTP |
| FastAPI | `api-backend` | `:9000` | Business logic + security middleware |
| OPA | `opa` | `:8181` | PDP — Rego policy evaluation |
| Vault | `vault` | `:8200` | KMS — Transit Engine |
| PostgreSQL | `api-postgres` | `:5434→5432` | DB (dữ liệu nhạy cảm AEAD encrypted) |
| Redis | `api-redis` | `:6379` | DPoP jti anti-replay store |
| Grafana | `grafana` | `:3000` | Dashboard observability |
| Loki | `loki` | `:3100` | Log aggregation |
| Promtail | `promtail` | — | Log shipper |

### Networks (3 vùng cô lập)
```
edge-net     : Frontend ↔ Kong ↔ Keycloak
internal-net : Kong ↔ Backend ↔ PostgreSQL ↔ Vault ↔ OPA ↔ Redis
obs-net      : Promtail ↔ Loki ↔ Grafana
```

---

## 5. GIẢI PHÁP MẬT MÃ 3 LỚP

### Lớp 1 — Crypto (dữ liệu)
- **Truyền tải:** TLS 1.3, HSTS bắt buộc, 0-RTT tắt
- **Lưu trữ:** AES-256-GCM (AEAD), nonce = `os.urandom(12)` per-record
- **Envelope encryption:** DEK/KEK qua Vault Transit Engine
- **Key rotation:** tự động, SLA ≤ 10 phút

### Lớp 2 — AuthN (xác thực)
- **Flow:** Authorization Code + PKCE (SPA), Client Credentials (S2S)
- **MFA:** TOTP bắt buộc với Admin (không có bypass trong production)
- **Token binding:** DPoP (RFC 9449) — ephemeral ES256 keypair per-request
- **Anti-replay:** DPoP `jti` lưu Redis `SET NX` với TTL
- **Session:** refresh token rotation + reuse-detection (Keycloak)
- **Chữ ký:** RS256 only — `alg=none` và `alg=HS256` bị block tại Kong

### Lớp 3 — AuthZ (phân quyền)
- **Mô hình:** deny-by-default → least-privilege → RBAC → ABAC
- **PEP:** Kong plugin `opa-authz.lua` — forward mọi request lên OPA
- **PDP:** OPA trả về `{allow, reason}` — 100% quyết định có lý do
- **BOLA protection:** backend kiểm tra `token.sub == resource.owner_id`
- **3 roles:** Admin (full), Staff (no delete), Customer (own data only)

---

## 6. CẤU TRÚC THƯ MỤC QUAN TRỌNG

```
Cloud_Api_Security/
├── docker-compose.yml
├── .env.example                    ← copy → .env trước khi chạy
│
├── backend/app/
│   ├── main.py                     ← FastAPI init, CORS, middleware
│   ├── api/v1/                     ← orders.py, products.py, users.py
│   ├── core/
│   │   ├── config.py               ← env vars / settings
│   │   └── security.py             ← JWT decode helpers
│   ├── db/
│   │   ├── models.py               ← User, Product, Order (email/phone AEAD encrypted)
│   │   └── seed_data.py            ← 50 synthetic records mỗi bảng
│   ├── middleware/
│   │   ├── auth_middleware.py      ← JWT verify + DPoP verify per-request
│   │   └── logging_middleware.py   ← structured JSON log + correlation_id
│   ├── security/
│   │   ├── aead_encryption.py      ← AES-256-GCM encrypt/decrypt via Vault DEK
│   │   ├── dpop_verifier.py        ← DPoP proof verify + Redis jti SET NX
│   │   ├── jwt_verify.py           ← RS256 verify, alg pin, kid check
│   │   └── totp_verify.py          ← TOTP verify (pyotp)
│   └── services/
│       ├── order_service.py        ← BOLA check: token.sub vs resource.owner_id
│       ├── product_service.py
│       └── user_service.py         ← SSRF block
│
├── frontend/src/
│   ├── auth/
│   │   ├── AuthProvider.jsx        ← token context, auto-refresh
│   │   ├── PrivateRoute.jsx        ← route guard by role
│   │   └── keycloak.js             ← PKCE: code_verifier, redirect, callback
│   ├── utils/
│   │   ├── dpop.js                 ← DPoP proof generator (Web Crypto ES256)
│   │   └── apiFetch.js             ← fetch wrapper: Authorization + DPoP header
│   └── pages/
│       ├── admin/                  ← Dashboard, Orders, Products, Users, Settings
│       ├── staff/                  ← Dashboard, Orders, Products
│       └── customer/               ← ProductCatalog, MyOrders, Profile
│
├── gateway/
│   ├── kong.yml                    ← declarative config: routes, services, plugins
│   └── plugins/
│       ├── hsts-header.lua         ← inject HSTS header
│       ├── jwt-hardening.lua       ← block alg=none, kid whitelist
│       └── opa-authz.lua           ← Kong → OPA HTTP (PEP→PDP)
│
├── opa/policies/
│   ├── authz.rego                  ← RBAC + ABAC, deny-by-default, reason field
│   ├── admin.rego                  ← /admin/* → role=admin only
│   └── rate_limit.rego             ← deny if request_count > 100/phút
│
├── vault/
│   ├── init/vault-init.sh          ← bootstrap: enable transit, tạo DEK key
│   └── policies/dek-policy.hcl     ← least-privilege: chỉ encrypt/decrypt DEK
│
├── idp/keycloak/
│   ├── realm-export.json           ← realm "cloudapi": PKCE, TOTP, rotating refresh
│   └── users.json                  ← 3 test users: admin, staff, customer
│
├── scripts/
│   ├── attacks/                    ← alg_none, bola, nonce_reuse, replay_dpop
│   └── evaluation/                 ← e_c1 → e_z2 (invariant verification)
│
└── EVAL/
    ├── E-C1.md  → I1: TLS plaintext capture
    ├── E-C2.md  → I2: DPoP nonce reuse (50 threads)
    ├── E-C3.md  → I2/I3: AEAD tamper test
    ├── E-N1.md  → I3/I7: TOTP 100 tests
    ├── E-N2.md  → I4: mTLS cert revoke
    ├── E-X1.md  → I6: Vault key rotation SLA
    ├── E-X2.md  → I6: OPA explainability
    ├── E-Z1.md  → I5: OPA policy test suite ≥50 cases
    └── E-Z2.md  → I4: Token hardening 3 vectors
```

---

## 7. INVARIANTS — HỢP ĐỒNG BẢO MẬT

| ID | Mô tả | Ngưỡng | Script kiểm chứng |
|----|-------|--------|------------------|
| **I1** | DB không chứa plaintext | 0 byte leaked | `e_c1_tls_capture.sh` |
| **I2** | Tampered ciphertext/token bị reject + log | 100% blocked | `e_c2_nonce_test.py`, `e_c3_aead_integrity.py` |
| **I3** | Data integrity đảm bảo | Integrity verify pass | `e_n1_totp_test.py` |
| **I4** | Replay attack = 0 success | Replay = 0 | `e_z2_token_hardening.sh` |
| **I5** | OPA luôn trả reason cho mọi quyết định | 100% explainable | `e_z1_policy_test.sh` |
| **I6** | Key rotation ≤ 10 phút | SLA đạt | `e_x1_rotation_test.sh` |
| **I7** | MFA false-accept = 0 | 0% false-accept | `e_n1_totp_test.py` |

---

## 8. BIẾN MÔI TRƯỜNG QUAN TRỌNG

```bash
# Backend
DATABASE_URL=postgresql://admin:<POSTGRES_PASSWORD>@postgres:5432/cloudapi
OPA_URL=http://opa:8181
VAULT_ADDR=http://vault:8200
VAULT_TOKEN=<VAULT_ROOT_TOKEN>
REDIS_URL=redis://:<REDIS_PASSWORD>@redis:6379/0
KEYCLOAK_URL=http://keycloak:8080
KEYCLOAK_REALM=cloudapi          # ← QUAN TRỌNG: là "cloudapi", KHÔNG phải "lab"

# Frontend (build args — VITE_* không hoạt động ở runtime)
VITE_KEYCLOAK_URL=http://localhost:8081
VITE_KONG_URL=http://localhost:8000
VITE_REALM=cloudapi
VITE_CLIENT_ID=spa-client
```

---

## 9. TÀI KHOẢN DEMO

| Email | Password | Role | MFA |
|-------|----------|------|-----|
| `phuc@company.com` | `demo1234` | Admin | TOTP (nhập 6 số bất kỳ trong demo) |
| `kiet@company.com` | `demo1234` | Staff | TOTP (nhập 6 số bất kỳ trong demo) |
| `an@gmail.com` | `demo1234` | Customer | Không bắt buộc |

---

## 10. QUYỀN THEO ROLE

| Action | Admin | Staff | Customer |
|--------|-------|-------|----------|
| Xem tất cả đơn hàng | ✅ | ✅ | ❌ (chỉ own) |
| Cập nhật trạng thái đơn | ✅ | ✅ | ❌ |
| Thêm sản phẩm | ✅ | ❌ | ❌ |
| Sửa sản phẩm | ✅ | ✅ (tồn kho) | ❌ |
| Xóa sản phẩm | ✅ | ❌ | ❌ |
| Quản lý user | ✅ | ❌ | ❌ |
| Xem System Settings | ✅ | ❌ | ❌ |
| Đặt hàng | ✅ | ✅ | ✅ |

---

## 11. CÁC TẤN CÔNG CẦN CHẶN (≥8 VECTOR)

| Vector | Script | Kết quả mong đợi |
|--------|--------|-----------------|
| JWT `alg=none` bypass | `alg_none_attack.py` | 401 Unauthorized |
| JWT `alg=HS256` downgrade | `e_z2_token_hardening.sh` | 401 Unauthorized |
| BOLA/IDOR (user A xem resource user B) | `bola_attack.py` | 403 Forbidden |
| DPoP replay (dùng lại jti đã dùng) | `replay_dpop_attack.py` | 401 — jti reused |
| DPoP nonce reuse (50 threads đồng thời) | `nonce_reuse_test.py` | chỉ 1 success, 49 reject |
| AEAD tampering (flip 1 bit ciphertext) | `e_c3_aead_integrity.py` | 422 — InvalidTag |
| TOTP brute-force | `e_n1_totp_test.py` | 401 — false-accept = 0 |
| Plaintext capture trên wire | `e_c1_tls_capture.sh` | 0 byte plaintext |

---

## 12. QUICK START

```bash
git clone https://github.com/FUCLU/Cloud_API_Security.git
cd Cloud_API_Security
cp .env.example .env          # điền secret thực vào .env
docker compose up -d
docker compose ps             # chờ 11 services healthy

# Verify
curl http://localhost:8000/health   # qua Kong → {"status":"ok"}
curl http://localhost:9000/health   # backend trực tiếp (debug only)
```

```bash
# Lấy token (client_credentials)
TOKEN=$(curl -s -X POST \
  http://localhost:8081/realms/cloudapi/protocol/openid-connect/token \
  -d "client_id=backend-client&client_secret=<secret>&grant_type=client_credentials" \
  | jq -r '.access_token')

# Gọi API qua Kong (production path)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/users
```

---

## 13. LƯU Ý QUAN TRỌNG CHO LLM

1. **Realm Keycloak = `cloudapi`** — không phải `lab` (đã fix)
2. **VITE_* env** chỉ hoạt động lúc build — dùng `build.args` trong docker-compose, không dùng `environment`
3. **Vault dev mode** đang dùng cho local — token là biến môi trường, không hardcode `"root"`
4. **Kong custom plugins** (`jwt-hardening`, `opa-authz`) là Lua code tự viết trong `gateway/plugins/`
5. **BOLA check** nằm ở `backend/app/services/order_service.py` — compare `token.sub` vs `order.owner_id`
6. **Redis** cần password (`--requirepass`) — `REDIS_URL` format: `redis://:<password>@redis:6379/0`
7. **PostgreSQL** có 2 DB: `cloudapi` (app) và `keycloak` (IdP) — tách nhau qua `postgres/init.sql`
8. **Deployment D2** thay Kong bằng NGINX + mTLS, chia 3 network zone: DMZ / Private / Mgmt