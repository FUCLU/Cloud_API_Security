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
├── .env.example                         # Template biến môi trường (copy → .env)
├── .gitignore                           # Loại trừ *.env, *.key, *.pem, certs/
├── docker-compose.yml                   # D1: toàn bộ stack 11 services, 1 lệnh
├── README.md
├── RUNBOOK.md                           # Hướng dẫn chạy từ máy sạch (≤5 phút)
├── AIM.md                               # Assets · Identity · SMART goals
├── CRYPTO_SOLUTION.md                   # Giải pháp mật mã 3 lớp + WAF
├── REFERENCES.md                        # 13 nguồn chính thức + 5 công cụ
├── RESULTS.md                           # Bảng 9 metrics + kết luận I1–I7
│
├── ARCH/
│   ├── ARCH.drawio                      # Sơ đồ kiến trúc (draw.io) — cần tạo
│   └── ARCH.pdf                         # Export kiến trúc + invariants I1–I7
│
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── package-lock.json
│   ├── index.html                       # Entry point Vite
│   └── src/
│       ├── main.jsx                     # Entry point React
│       ├── App.jsx                      # Router + route definitions (+ /callback)
│       ├── logo.png
│       │
│       ├── auth/                        # Keycloak PKCE integration
│       │   ├── AuthProvider.jsx         # Context: token, login, logout, refresh tự động
│       │   ├── PrivateRoute.jsx         # Route guard theo role
│       │   └── keycloak.js              # PKCE: code_verifier, redirect, callback handler
│       │
│       ├── api/                         # API call functions (dùng apiFetch bên dưới)
│       │   ├── index.js                 # Re-export tất cả API modules
│       │   ├── orders.js                # CRUD orders endpoints
│       │   ├── products.js              # CRUD products endpoints
│       │   └── users.js                 # CRUD users endpoints
│       │
│       ├── utils/                       # Security utilities
│       │   ├── dpop.js                  # DPoP proof generator (Web Crypto ES256, RFC 9449)
│       │   └── apiFetch.js              # Fetch wrapper: auto Authorization + DPoP header
│       │3
│       ├── hooks/                       # Custom React hooks
│       │   ├── useAuth.js               # Hook dùng AuthProvider context
│       │   ├── useOrders.js             # Hook fetch + state orders
│       │   └── useProducts.js           # Hook fetch + state products
│       │
│       ├── components/
│       │   ├── shared/                  # Reusable components
│       │   │   ├── LoadingScreen.jsx    # Loading indicator toàn trang
│       │   │   ├── OrderRow.jsx         # Row component cho bảng đơn hàng
│       │   │   └── ProductCard.jsx      # Card component sản phẩm
│       │   └── ui/                      # Base UI components
│       │       ├── Badge.jsx            # Badge trạng thái (pending, done...)
│       │       ├── Drawer.jsx           # Slide-in drawer chi tiết
│       │       └── Modal.jsx            # Modal dialog (thêm/sửa/xoá)
│       │
│       ├── context/
│       │   └── CartContext.jsx          # Shared cart state (React Context)
│       │
│       ├── layouts/
│       │   ├── AdminLayout.jsx          # Sidebar + Outlet cho Admin
│       │   ├── StaffLayout.jsx          # Sidebar + Outlet cho Staff
│       │   └── CustomerLayout.jsx       # Navbar + Outlet cho Customer
│       │
│       ├── pages/
│       │   ├── auth/
│       │   │   └── Login.jsx            # Redirect Keycloak PKCE + OTP step
│       │   ├── admin/
│       │   │   ├── Dashboard.jsx        # KPI, biểu đồ doanh thu, Security Audit Log
│       │   │   ├── Orders.jsx           # Quản lý đơn hàng (filter + drawer)
│       │   │   ├── Products.jsx         # CRUD sản phẩm (modal)
│       │   │   ├── UserManagement.jsx   # Quản lý user + khoá/mở khoá tài khoản
│       │   │   └── SystemSettings.jsx   # Toggle TLS/DPoP/MFA/WAF, Vault log, OPA viewer
│       │   ├── staff/
│       │   │   ├── Dashboard.jsx        # Đơn cần xử lý, tồn kho sắp hết
│       │   │   ├── Orders.jsx           # Cập nhật trạng thái đơn hàng
│       │   │   └── Products.jsx         # Cập nhật tồn kho (không xoá)
│       │   └── customer/
│       │       ├── ProductCatalog.jsx   # Danh sách sản phẩm + giỏ hàng
│       │       ├── MyOrders.jsx         # Đơn hàng + đặt mới + thanh toán
│       │       └── Profile.jsx          # Thông tin cá nhân + đổi mật khẩu
│       │
│       └── styles/
│           ├── global.css               # Design system dùng chung toàn app
│           └── login.css                # CSS riêng trang Login
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py                      # FastAPI app init, CORS, middleware mount
│       ├── api/v1/                      # REST endpoints
│       │   ├── orders.py                # GET/POST/PUT/DELETE /api/v1/orders
│       │   ├── products.py              # GET/POST/PUT/DELETE /api/v1/products
│       │   └── users.py                 # GET/POST/PUT/DELETE /api/v1/users
│       ├── core/
│       │   ├── config.py                # Env vars, settings
│       │   └── security.py              # JWT decode helpers
│       ├── db/
│       │   ├── database.py              # SQLAlchemy engine + session
│       │   ├── models.py                # ORM: User, Product, Order (email/phone encrypted)
│       │   └── seed_data.py             # Insert 50 synthetic records mỗi bảng
│       ├── middleware/
│       │   ├── auth_middleware.py       # JWT verify + DPoP verify per-request
│       │   └── logging_middleware.py    # Structured JSON log + correlation_id
│       ├── security/
│       │   ├── aead_encryption.py       # AES-256-GCM encrypt/decrypt (Vault DEK)
│       │   ├── dpop_verifier.py         # DPoP proof verify + Redis jti SET NX
│       │   ├── jwt_verify.py            # RS256 verify, alg pin, kid check
│       │   └── totp_verify.py           # TOTP verify (pyotp), false-accept=0
│       ├── services/
│       │   ├── order_service.py         # Business logic + BOLA check (token.sub vs owner)
│       │   ├── product_service.py       # Business logic sản phẩm
│       │   └── user_service.py          # Business logic user + SSRF block
│       └── tests/
│           ├── test_orders.py
│           ├── test_security.py
│           └── test_users.py
│
├── gateway/
│   ├── kong.conf                        # TLS 1.3, ssl_session_tickets off
│   ├── kong.yml                         # Declarative config: routes, plugins, services
│   ├── deck/
│   │   └── kong-declarative.yml
│   └── plugins/
│       ├── hsts-header.lua              # Inject HSTS header
│       ├── jwt-hardening.lua            # Block alg=none, kid whitelist
│       └── opa-authz.lua                # Kong → OPA HTTP API (PEP→PDP)
│
├── idp/keycloak/
│   ├── realm-export.json                # Realm "cloudapi": PKCE, TOTP, rotating refresh
│   ├── clients.json                     # spa-client (public) + backend-client (confidential)
│   └── users.json                       # 3 test users: admin, staff, customer
│
├── opa/
│   ├── config/
│   │   └── opa-config.yaml              # OPA server config + decision log
│   ├── policies/
│   │   ├── authz.rego                   # RBAC + ABAC deny-by-default + reason field
│   │   ├── admin.rego                   # /admin/* → role=admin only
│   │   └── rate_limit.rego              # Deny nếu request_count > 100/phút
│   └── tests/
│       ├── authz_test.rego              # ≥25 test cases RBAC + BOLA
│       ├── admin_test.rego              # Admin path protection cases
│       └── rate_test.rego               # Rate limit policy cases
│
├── vault/
│   ├── init/
│   │   ├── vault-init.sh                # Bootstrap: enable transit, tạo DEK key
│   │   └── enable-transit.sh            # Enable transit engine + apply dek-policy
│   └── policies/
│       └── dek-policy.hcl               # Least-privilege: chỉ encrypt/decrypt DEK
│
├── observability/
│   ├── grafana/
│   │   ├── dashboards/
│   │   │   └── api-security-dashboard.json  # Request count, auth failures, OPA denies
│   │   └── provisioning/                # Grafana datasource + dashboard auto-provision
│   ├── loki/
│   │   └── loki-config.yml
│   └── promtail/
│       └── promtail-config.yml          # Scrape Kong + FastAPI + OPA decision logs
│
├── DEPLOY/
│   ├── D1/
│   │   └── Runbook.md                   # Docker Compose local (8 sections)
│   └── D2/
│       ├── nginx.conf                   # NGINX mTLS gateway (thay Kong)
│       ├── iptables.sh                  # 3-zone firewall: DMZ / Private / Mgmt
│       ├── Runbook.md                   # VM setup, CA bootstrap, cert rotation
│       └── certs/
│           ├── ca.crt                   # Self-signed CA (RSA 4096, 365 ngày)
│           ├── svc.crt                  # Service cert (RSA 2048, 90 ngày)
│           └── svc.key
│
├── EVAL/
│   ├── E-C1.md                          # I1 — TLS plaintext capture
│   ├── E-C2.md                          # I2 — DPoP nonce reuse (50 threads)
│   ├── E-C3.md                          # I2/I3 — AEAD tamper test
│   ├── E-N1.md                          # I3/I7 — TOTP AuthN (100 tests, false-accept=0)
│   ├── E-N2.md                          # I4 — mTLS cert revoke + rotate
│   ├── E-X1.md                          # I6 — Vault key rotation SLA ≤10 phút
│   ├── E-X2.md                          # I6 — OPA explainability (100% reason)
│   ├── E-Z1.md                          # I5 — OPA policy test suite ≥50 cases
│   └── E-Z2.md                          # I4 — Token hardening 3 vectors
│
├── EVIDENCE/
│   ├── attack_results/                  # logs từ bola_attack, alg_none, replay_dpop
│   ├── captures/                        # http_capture.pcap, tls_capture.pcap
│   ├── logs/                            # auth.log, kong.log, opa.log, opa_decisions.json
│   ├── screenshots/                     # Wireshark TLS vs HTTP, Grafana alerts
│   └── security_scans/
│       ├── bandit_report.json           # SAST output
│       ├── zap_report.html              # DAST output (chạy thực, không chỉ skeleton)
│       ├── opa_results.json             # OPA test JSON (≥50 cases, ≥95% pass) — cần tạo
│       ├── sca_report.txt               # pip-audit SCA output — cần tạo
│       └── restler_results/             # RESTler API fuzzing output
│
├── scripts/
│   ├── attacks/
│   │   ├── alg_none_attack.py           # Vector 1: JWT alg=none bypass
│   │   ├── bola_attack.py               # BOLA: user A truy cập resource user B
│   │   ├── nonce_reuse_test.py          # 50 threads cùng DPoP proof
│   │   └── replay_dpop_attack.py        # DPoP replay attack
│   ├── evaluation/
│   │   ├── e_c1_tls_capture.sh          # tcpdump + Wireshark verify
│   │   ├── e_c2_nonce_test.py           # 50 threads nonce reuse
│   │   ├── e_c3_aead_integrity.py       # Flip tag byte → InvalidTag
│   │   ├── e_n1_totp_test.py            # 100 TOTP tests
│   │   ├── e_x1_rotation_test.sh        # Vault rotate + timestamp
│   │   ├── e_z1_policy_test.sh          # OPA test suite JSON export
│   │   └── e_z2_token_hardening.sh      # 3 token attack vectors
│   └── security_testing/
│       ├── run_dast.sh                  # OWASP ZAP scan
│       ├── run_fuzz.sh                  # RESTler fuzzing
│       └── run_sast.sh                  # Bandit SAST
│
├── tests/
│   ├── integration/
│   │   ├── test_api_flow.py
│   │   ├── test_auth_flow.py
│   │   └── test_policy_flow.py
│   ├── security/
│   │   ├── test_replay.py
│   │   └── test_token.py
│   └── security_scans/
│       ├── dast/
│       │   └── zap_scan.sh
│       ├── fuzz/
│       │   └── restler_config.json
│       └── sast/
│           └── bandit.sh
│
└── vault/
    ├── init/
    │   ├── vault-init.sh
    │   └── enable-transit.sh
    └── policies/
        └── dek-policy.hcl
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

## Những việc đã hoàn thành

### 1. FastAPI Project
- Tạo cấu trúc thư mục backend:
  - `backend/app/main.py`
  - `backend/app/routers/users.py`
  - `backend/app/routers/products.py`
  - `backend/app/routers/orders.py`
- Viết các endpoint GET cơ bản (hardcoded data):
  - `GET /api/v1/users`
  - `GET /api/v1/products`
  - `GET /api/v1/orders`
- Kiểm tra API chạy thành công qua Kong (`curl http://localhost:8000/api/v1/products`)

### 2. Keycloak Realm
- Tạo file `idp/keycloak/realm-export.json` với realm tên **`lab`**
- Khai báo 2 clients:
  - `spa-client` (public client, PKCE enabled)
  - `backend-client` (confidential client)
- Khai báo 2 roles: `user` và `admin`
- Tạo file `idp/keycloak/users.json` với 3 test users (1 admin, 2 user thường)
- Import realm thành công vào Keycloak container

### 3. PostgreSQL & Seed Data
- Tạo file `backend/app/db/models.py` với 3 bảng: `users`, `products`, `orders`
- Viết script `backend/app/db/seed_data.py` để insert 50 records cho mỗi bảng
- Chạy seed data thành công và verify:
  - `SELECT COUNT(*) FROM users;` → 50
  - `SELECT COUNT(*) FROM products;` → 50
  - `SELECT COUNT(*) FROM orders;` → 50

### 4. Documentation
- Viết skeleton cho `DEPLOY/D1/Runbook.md`
- Hoàn thành mục **BOM (Bill of Materials)** liệt kê tất cả services và version
- Hoàn thành mục **Trust Boundaries** mô tả ngắn gọn các network và luồng giao tiếp

### 5. Keycloak TOTP (Phần cơ bản)
- Thêm Required Action `CONFIGURE_TOTP` trong `realm-export.json`
- Gán required action bắt buộc cho user admin (`admin@lab.local`)

### 6. AEAD Encryption at-rest (Phần cơ bản)
- Viết hàm `encrypt_field()` sử dụng AES-256-GCM + nonce trong `backend/app/security/aead_encryption.py`
- Tích hợp lấy DEK từ Vault Transit Engine
- Gọi hàm encrypt cho cột email trong `seed_data.py`

---
