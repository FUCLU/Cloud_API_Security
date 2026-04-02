# NT219.Q21.ANTT - MẬT MÃ HỌC

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![Kong](https://img.shields.io/badge/Kong-3.6-003459?logo=kong&logoColor=white)
![Keycloak](https://img.shields.io/badge/Keycloak-24.0-4D4D4D?logo=keycloak&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Vault](https://img.shields.io/badge/Vault-1.15-FFEC6E?logo=vault&logoColor=black)
![Grafana](https://img.shields.io/badge/Grafana-10-F46800?logo=grafana&logoColor=white)
![OPA](https://img.shields.io/badge/OPA-0.65-7D9FC2?logoColor=white)

**Tên đề tài:** Cloud API-Based Network Application Security for Small Company Services

## Mục lục
- [Tổng quan](#tổng-quan)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Giải pháp mật mã 3 lớp](#giải-pháp-mật-mã-3-lớp)
- [Invariants hệ thống](#invariants-hệ-thống)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Quick Start](#-quick-start)
- [Hướng dẫn Frontend](#-hướng-dẫn-frontend)
- [Địa chỉ truy cập](#địa-chỉ-truy-cập-sau-khi-stack-chạy)
- [Xác thực và gọi API](#lấy-token-và-gọi-api-có-auth)
- [Chạy kiểm thử](#chạy-kiểm-thử)
- [Triển khai D2 — Linux VM + mTLS](#triển-khai-d2--linux-vm--mtls)
- [CI/CD & Bảo mật supply chain](#cicd--bảo-mật-supply-chain)
- [Phân công](#phân-công)
- [Lưu ý bảo mật](#lưu-ý-bảo-mật)

---

## Tổng quan

Hãy tưởng tượng bạn đang xây dựng một ứng dụng web cho công ty nhỏ — có trang
quản lý đơn hàng, thông tin khách hàng, dữ liệu nội bộ. Ứng dụng này giao tiếp
qua API, nghĩa là mọi thao tác (đăng nhập, xem đơn hàng, chỉnh sửa sản phẩm)
đều là các request gửi đi và nhận về.

Vấn đề là: **API rất dễ bị tấn công nếu không được bảo vệ đúng cách.**

Kẻ tấn công có thể:
- Giả mạo token đăng nhập để truy cập tài khoản người khác
- Xem đơn hàng của khách hàng khác chỉ bằng cách đổi một con số trong URL
- Đánh cắp token rồi dùng lại mãi vì token không hết hạn
- Đọc dữ liệu nhạy cảm trong database nếu không được mã hóa

**Repo này xây dựng một hệ thống phòng thủ hoàn chỉnh cho đúng bài toán đó.**

Cụ thể, hệ thống đảm bảo 3 điều:

**1. Chỉ đúng người mới được vào:**
Người dùng phải đăng nhập qua Keycloak với mật khẩu + mã OTP 6 số. Token
sau khi đăng nhập chỉ sống 15 phút và bị khóa chặt vào thiết bị đang dùng —
lấy được token cũng không dùng ở nơi khác được.

**2. Đúng người nhưng chỉ được làm đúng việc của mình:**
Khách hàng chỉ thấy đơn hàng của chính mình. Nhân viên không xóa được sản
phẩm. Admin mới có toàn quyền. Mọi quyết định phân quyền đều được ghi log
với lý do cụ thể.

**3. Dữ liệu không thể bị đọc trộm hoặc chỉnh sửa:**
Mọi kết nối đều mã hóa bằng TLS 1.3. Dữ liệu nhạy cảm trong database được
mã hóa AES-256-GCM — dù ai đó lấy được file database cũng không đọc được gì.
Khóa mã hóa được quản lý tự động và thay mới định kỳ.

---

| Thành phần | Công nghệ | Làm gì |
|---|---|---|
| **Frontend** | React + Vite | SPA — giao diện 3 role: Admin, Staff, Customer |
| **API Gateway** | Kong 3.6 | Cửa ngõ duy nhất — kiểm tra token, chặn request bất thường |
| **Identity Provider** | Keycloak 24.0 | Quản lý đăng nhập, OTP, cấp token |
| **Authorization** | OPA / Rego 0.65.0 | Quyết định ai được làm gì |
| **Key Management** | HashiCorp Vault 1.15 | Quản lý và tự động thay khóa mã hóa |
| **Replay Protection** | Redis | Ghi nhớ DPoP jti đã dùng — chặn replay |
| **Observability** | Grafana + Loki + Promtail | Ghi log mọi thứ, cảnh báo khi có bất thường |
| **CI/CD** | GitHub Actions | Tự động kiểm tra bảo mật mỗi lần cập nhật code |

---

## Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CI/CD Pipeline                                                         │
│  GitHub  ──►  GitHub Actions  ──►  Container Registry                   │
└─────────────────────────────────────────────────────────────────────────┘

                            ┌──────────────┐   ┌────────────────┐
                            │   Browser /  │   │  Mobile App /  │
                            │   React SPA  │   │  3rd-party     │
                            └──────┬───────┘   └───────┬────────┘
                                   │                   │
                                   └─────────┬─────────┘
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Security & Service Layer                                                │
│                                                                          │
│   ┌────────────┐                        ┌────────┐   ┌────────────────┐  │
│   │  Keycloak  │◄──────────────────────►│  Kong  │   │ Key Management │  │
│   │  OIDC/PKCE │  authentication        │   API  │   │ (Vault)        │  │
│   └────────────┘                        │Gateway │   └───────┬────────┘  │
│                                         │        │           │           │
│   ┌────────────┐                        │        │           │ (yellow)  │
│   │    OPA     │◄──────────────────────►│        │           │           │
│   │   Policy   │  authorization         └───┬────┘           │           │
│   │   Engine   │                            │                │           │
│   └────────────┘                            │                ▼           │
│                                             ▼         ┌───────────────┐  │
│                             ┌───────────────────┐     │  PostgreSQL   │  │
│   ┌──────────┐              │   FastAPI Backend │───► │  Encrypted DB │  │
│   │  Redis   │◄────────────►│   Business Logic  │     └───────────────┘  │
│   │  Replay  │  jti check   │   DPoP · mTLS     │                        │
│   │  Store   │              └───────────────────┘                        │
│   └──────────┘                                                           │
│                        ╔══════════════════════════╗                      │
│                        ║  alg=none JWT  →  401    ║  blocked threats     │
│                        ║  Replay attack →  401    ║                      │
│                        ║  BOLA / IDOR   →  403    ║                      │
│                        ╚══════════════════════════╝                      │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Monitoring & Observability                                             │
│  Promtail  ──►  Loki  ──►  Grafana                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

Sơ đồ đầy đủ: [`ARCH/ARCH.pdf`](ARCH/ARCH.pdf).

**Port mapping Docker (D1) — 11 services:**
 
| Service | Container | Port | Trạng thái |
|---|---|---|---|
| Frontend (React/Vite) | `api-frontend` | `:5173` | ✅ healthy |
| FastAPI (Backend) | `api-backend` | `:9000` | ✅ healthy |
| Kong API Gateway | `api-gateway` | `:8000`, `:8443`, `:8001` | ✅ healthy |
| Keycloak | `keycloak` | `:8081` | ✅ healthy |
| OPA | `opa` | `:8181` | ✅ healthy |
| HashiCorp Vault | `vault` | `:8200` | ✅ healthy |
| PostgreSQL | `api-postgres` | `:5434` | ✅ healthy |
| Redis | `api-redis` | `:6379` | ✅ healthy |
| Grafana | `grafana` | `:3000` | ✅ healthy |
| Loki | `loki` | `:3100` | ✅ healthy |
| Promtail | `promtail` | — | ✅ running |
 
> ⚠️ **Lưu ý:** FastAPI expose ở `:9000` chỉ để debug nội bộ. Mọi request từ client **phải** đi qua **Kong `:8000`** để được JWT verify, rate-limit và OPA authz kiểm tra.
 
> ⚠️ **Keycloak realm:** Realm hiện tại tên là **`cloudapi`** (không phải `lab`). Mọi API call liên quan đến Keycloak dùng `/realms/cloudapi/`.

---

## Giải pháp mật mã 3 lớp

### Lớp 1 — Crypto (Bảo vệ dữ liệu)

- **Truyền tải:** TLS 1.3, ciphersuites thu gọn, 0-RTT tắt, HSTS header bắt buộc
- **Lưu trữ:** AES-256-GCM (AEAD), nonce `os.urandom(12)` per-record, envelope encryption DEK/KEK qua HashiCorp Vault Transit Engine
- **Chữ ký:** RS256 (Keycloak), toàn bộ tham số được tài liệu hóa đầy đủ

### Lớp 2 — AuthN (Xác thực)

- **Người dùng:** TOTP MFA bắt buộc cho admin (không có bypass)
- **Flow:** Authorization Code + PKCE (public clients / SPA), Client Credentials (S2S)
- **Token binding:** DPoP (RFC 9449) — ephemeral ES256 keypair, jti lưu Redis SET NX chống replay
- **Session:** refresh token rotation + reuse-detection (Keycloak)
- **S2S:** mTLS east-west (D2), self-signed CA

### Lớp 3 — AuthZ (Cấp quyền)

- **Mô hình:** deny-by-default → least-privilege → RBAC → ABAC (OPA/Rego)
- **Thi hành:** PEP tại Kong gateway (`opa-authz.lua`), PDP tại OPA — log reason cho mọi quyết định (100%)
- **Token:** JWT pin `alg=RS256`, kiểm soát `kid`, TTL 15 phút, DPoP-bound

Chi tiết đầy đủ: [`CRYPTO_SOLUTION.md`](CRYPTO_SOLUTION.md)

---

## Invariants hệ thống

| ID | Mô tả | Ngưỡng | Evaluation |
|---|---|---|---|
| **I1** | Không rò rỉ plaintext trên kênh bảo vệ | 0 byte | [E-C1](EVAL/E-C1.md) |
| **I2** | Tampering (ciphertext/token) bị từ chối và có log | 100% bị chặn | [E-C2](EVAL/E-C2.md), [E-C3](EVAL/E-C3.md) |
| **I3** | Dữ liệu nguyên gốc, không bị chỉnh sửa ngoài phạm vi | Integrity verify pass | [E-N1](EVAL/E-N1.md) |
| **I4** | AuthN chống phishing; PoP token bound; replay = 0 | Replay = 0 | [E-N2](EVAL/E-N2.md) |
| **I5** | Quyết định AuthZ giải thích được từ log/policy | 100% explainable | [E-Z1](EVAL/E-Z1.md) |
| **I6** | Key rotation ≤ 10 phút; blast-radius ≤ 24h | SLA đạt | [E-X1](EVAL/E-X1.md), [E-X2](EVAL/E-X2.md) |
| **I7** | MFA false-accept = 0 | false-accept = 0% | [E-N1](EVAL/E-N1.md) |

Kết quả đo lường: [`RESULTS.md`](RESULTS.md)

---

## Cấu trúc thư mục

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
│       │
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

## Yêu cầu hệ thống

| Thành phần | Phiên bản |
|---|---|
| Docker & Docker Compose | ≥ 24.x / v2.x |
| Node.js | ≥ 18 |
| Python | ≥ 3.11 |
| Git | ≥ 2.40 |
| RAM khuyến nghị | ≥ 8 GB |

---

## ⚡ Quick Start
 
> Chạy toàn bộ stack trong **4 bước**, từ clone đến 11 container healthy.
 
```bash
# Bước 1 — Clone repo
git clone https://github.com/FUCLU/Cloud_API_Security.git
cd Cloud_API_Security
 
# Bước 2 — Khởi động toàn bộ stack
docker compose up -d
 
# Bước 3 — Kiểm tra tất cả 11 container healthy
docker compose ps
 
# Bước 4 — Verify API hoạt động
curl http://localhost:8000/health          # qua Kong → {"status":"ok"}
curl http://localhost:9000/health          # trực tiếp backend → {"status":"ok"}
```
 
Mở trình duyệt: `http://localhost:5173` → trang Login frontend.
 
> ⚠️ Keycloak cần ~30 giây để khởi động. Nếu `docker compose ps` thấy keycloak `health: starting`, chờ thêm rồi chạy lại.
 
---
 
## 🖥 Hướng dẫn Frontend
![alt text](image.png)
### Chạy development (standalone)
 
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```
 
### Build production
 
```bash
cd frontend
npm run build
npm run preview
```
 
### Cấu trúc route
 
| URL | Trang | Role |
|---|---|---|
| `/login` | Đăng nhập | Tất cả |
| `/callback` | Keycloak PKCE callback | Tất cả |
| `/admin/dashboard` | Dashboard tổng quan | Admin |
| `/admin/orders` | Quản lý đơn hàng | Admin |
| `/admin/products` | Quản lý sản phẩm (CRUD) | Admin |
| `/admin/users` | Quản lý người dùng | Admin |
| `/admin/settings` | Cài đặt bảo mật hệ thống | Admin |
| `/staff/dashboard` | Dashboard nhân viên | Staff |
| `/staff/orders` | Xử lý đơn hàng | Staff |
| `/staff/products` | Cập nhật tồn kho | Staff |
| `/customer/productcatalog` | Danh sách sản phẩm | Customer |
| `/customer/myorders` | Đơn hàng của tôi | Customer |
| `/customer/profile` | Tài khoản cá nhân | Customer |
 
### Tài khoản demo
 
| Email | Mật khẩu | Role | MFA |
|---|---|---|---|
| `phuc@company.com` | `demo1234` | Admin | TOTP (nhập bất kỳ 6 số) |
| `kiet@company.com` | `demo1234` | Staff | TOTP (nhập bất kỳ 6 số) |
| `an@gmail.com` | `demo1234` | Customer | Không bắt buộc |
 
> 💡 Ở chế độ demo, nhập bất kỳ 6 chữ số nào (VD: `123456`) để vượt qua bước OTP.
 
### Tính năng chính theo role
 
**Admin:**
- Dashboard với KPI, biểu đồ doanh thu 7 ngày (hover để xem chi tiết), Security Audit Log
- Quản lý đơn hàng — lọc theo trạng thái, xem chi tiết qua drawer
- CRUD sản phẩm — thêm, sửa, xoá với modal
- Quản lý user — khoá/mở khoá tài khoản, thêm user mới, thông báo bảo mật
- Cài đặt hệ thống — toggle bật/tắt TLS, DPoP, MFA, WAF; Vault key rotation log; OPA policy viewer
 
**Staff:**
- Dashboard với đơn cần xử lý và tồn kho sắp hết
- Xử lý đơn hàng — cập nhật trạng thái (Xác nhận → Giao hàng → Hoàn thành)
- Cập nhật tồn kho — không có quyền thêm/xoá sản phẩm
 
**Customer:**
- Duyệt sản phẩm — tìm kiếm, lọc danh mục, thêm vào giỏ hàng
- Giỏ hàng — shared state qua React Context, cập nhật realtime trên navbar
- Đơn hàng — xem chi tiết, chọn phương thức thanh toán, đặt hàng, xoá khỏi giỏ
- Profile — cập nhật thông tin cá nhân, đổi mật khẩu
 
### Dependencies chính
 
```json
{
  "react": "^18.x",
  "react-dom": "^18.x",
  "react-router-dom": "^6.x",
  "vite": "^5.x"
}
```
 
---
 
## Địa chỉ truy cập sau khi stack chạy
 
| Service | URL | Mô tả |
|---|---|---|
| 🌐 Frontend | [`http://localhost:5173`](http://localhost:5173) | React SPA — giao diện chính |
| 🌐 FastAPI Swagger | [`http://localhost:9000/docs`](http://localhost:9000/docs) | Swagger UI — debug trực tiếp (bypass Kong) |
| ⚡ Kong Proxy | [`http://localhost:8000`](http://localhost:8000) | Entry point chính — mọi request đi qua đây |
| ⚡ Kong Admin | [`http://localhost:8001`](http://localhost:8001) | Kong Admin API — xem routes, services |
| 🔑 Keycloak Admin | [`http://localhost:8081`](http://localhost:8081) | Quản lý realm **cloudapi**, user, token |
| 🔑 Keycloak OIDC | [`http://localhost:8081/realms/cloudapi`](http://localhost:8081/realms/cloudapi) | OIDC discovery endpoint |
| 📋 OPA | [`http://localhost:8181/health`](http://localhost:8181/health) | Policy engine health |
| 🔐 Vault UI | [`http://localhost:8200`](http://localhost:8200) | KMS — token: `root` |
| 📊 Grafana | [`http://localhost:3000`](http://localhost:3000) | Dashboard — `admin` / `admin` |
| 📡 Loki | [`http://localhost:3100/ready`](http://localhost:3100/ready) | Log aggregation |
 
---
 
## Lấy token và gọi API có auth
 
```bash
# Lấy access token từ Keycloak — realm=cloudapi
TOKEN=$(curl -s -X POST \
  http://localhost:8081/realms/cloudapi/protocol/openid-connect/token \
  -d "client_id=backend-client" \
  -d "client_secret=<secret-from-keycloak>" \
  -d "grant_type=client_credentials" | jq -r '.access_token')
 
# Gọi API qua Kong (đúng đường — JWT verify + OPA)
curl -i -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/users
 
# Gọi trực tiếp backend (bypass Kong — chỉ debug)
curl -i -H "Authorization: Bearer $TOKEN" \
  http://localhost:9000/api/v1/users
 
# Test không cần token
curl http://localhost:8000/health
curl http://localhost:9000/health
```
 
Chi tiết đầy đủ: [`DEPLOY/D1/Runbook.md`](DEPLOY/D1/Runbook.md)
 
---
 
## Chạy kiểm thử
 
### Unit & Policy tests
 
```bash
# Unit tests (backend)
docker compose exec backend pytest tests/ -v
 
# OPA policy tests (≥50 cases, pass rate ≥95%)
docker compose exec opa opa test /policies /tests -v
```
 
### Integration tests
 
```bash
python tests/integration/test_api_flow.py
python tests/integration/test_auth_flow.py
python tests/integration/test_policy_flow.py
```
 
### Security / Attack simulation
 
```bash
python scripts/attacks/alg_none_attack.py       # JWT alg=none bypass
python scripts/attacks/bola_attack.py           # BOLA / IDOR
python scripts/attacks/replay_dpop_attack.py    # DPoP replay
python scripts/attacks/nonce_reuse_test.py      # DPoP nonce reuse (50 threads)
```
 
### Evaluation scripts (theo invariants)
 
```bash
bash   scripts/evaluation/e_c1_tls_capture.sh        # I1 — TLS plaintext check
python scripts/evaluation/e_c2_nonce_test.py         # I2 — DPoP nonce reuse
python scripts/evaluation/e_c3_aead_integrity.py     # I2/I3 — AEAD tamper
python scripts/evaluation/e_n1_totp_test.py          # I3/I7 — TOTP 100 tests
bash   scripts/evaluation/e_x1_rotation_test.sh      # I6 — Key rotation SLA ≤10 phút
bash   scripts/evaluation/e_z1_policy_test.sh        # I5 — OPA decision log ≥95%
bash   scripts/evaluation/e_z2_token_hardening.sh    # I4 — Token binding 3 vectors
```
 
### SAST / DAST / Fuzzing / SCA
 
```bash
bash scripts/security_testing/run_sast.sh
bash scripts/security_testing/run_dast.sh
bash scripts/security_testing/run_fuzz.sh
pip-audit -r backend/requirements.txt -o EVIDENCE/security_scans/sca_report.txt
```
 
---
 
## Triển khai D2 — Linux VM + mTLS
 
Deployment D2 chạy trên VM Ubuntu 22.04 với phân vùng mạng 3 zone và mTLS east-west thay thế DPoP+Redis.
 
| Zone | Subnet | Thành phần |
|---|---|---|
| DMZ | `192.168.10.x` | NGINX reverse proxy (thay Kong) |
| Private | `10.10.0.x` | FastAPI, Keycloak, OPA, Vault, PostgreSQL |
| Mgmt | `10.20.0.x` | Grafana, Loki, Promtail |
 
```bash
cd DEPLOY/D2
chmod +x iptables.sh
sudo bash iptables.sh
nginx -c $(pwd)/nginx.conf
```
 
Chi tiết đầy đủ: [`DEPLOY/D2/Runbook.md`](DEPLOY/D2/Runbook.md)
 
---
 
## CI/CD & Bảo mật supply chain
 
GitHub Actions tự động chạy khi push lên `main` và `dev`:
 
| Bước | Tool | Output |
|---|---|---|
| **SAST** | Bandit (Python) | `EVIDENCE/security_scans/bandit_report.json` |
| **Secrets scan** | detect-secrets, GitLeaks | Fail build nếu phát hiện secret |
| **SCA** | pip-audit | `EVIDENCE/security_scans/sca_report.txt` |
| **DAST** | OWASP ZAP (merge → main) | `EVIDENCE/security_scans/zap_report.html` |
| **Fuzzing** | RESTler | `EVIDENCE/security_scans/restler_results/` |
| **Artifact signing** | cosign | Container image signed trước khi deploy |
 
---
 
## Phân công
 
| Thành viên | MSSV | Phụ trách |
|---|---|---|
| Lưu Hồng Phúc | 24521382 | Docker Compose · Kong · DPoP backend · Frontend PKCE+DPoP · mTLS D2 · ARCH · RUNBOOK |
| Phan Thái Hưng | 24520624 | FastAPI CRUD · Keycloak realm cloudapi · Postgres AEAD · BOLA · Webhook HMAC · CORS · DAST ZAP |
| Võ Tưởng Tuấn Kiệt | 24520919 | OPA RBAC/ABAC · Grafana/Loki · Vault rotation · Eval E-C2/E-Z1/E-X1/E-X2 · RESTler fuzzing |
 
---
 
## Lưu ý bảo mật
 
- **Không commit** file `.env`, `*.key`, `*.pem`, `*.p12` vào repo — đã có trong `.gitignore`
- Dùng **synthetic data** cho tất cả test, không dùng dữ liệu thật
- Chỉ pentest trên **lab infrastructure** — không scan third-party services
- Sanitize logs trước khi đưa vào `EVIDENCE/`
- File `.env.example` là template — copy sang `.env` và điền secret thực trước khi chạy
- Keycloak realm: **`cloudapi`** — không phải `lab`
- Kong custom plugins (`jwt-hardening`, `hsts-header`, `opa-authz`) chưa implement — `KONG_PLUGINS: bundled`
- Vault UI token mặc định: `root` (dev mode only)
 
---
## License