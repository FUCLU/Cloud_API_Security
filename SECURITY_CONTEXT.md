# SECURITY_CONTEXT.md
# Ngữ cảnh đầy đủ — NT219 Cloud API Security Project

> **Mục đích file này:** Cung cấp toàn bộ ngữ cảnh phân tích bảo mật, kiến trúc hệ thống,
> và mapping rủi ro → giải pháp → bằng chứng để AI assistant (Copilot/Cursor/Claude)
> hiểu đúng project khi làm việc trong VSCode.
>
> **Đọc file này cùng với:** `README.md`, `AIM.md`, `CRYPTO_SOLUTION.md`, `RESULTS.md`

---

## 0. Project Identity (đọc trước mọi thứ)

```
Môn học  : NT219 - Mật Mã Học (Cryptography)
Đề tài   : Cloud API-Based Network Application Security for Small Company Services
Stack D1 : Docker Compose — 11 containers, chạy local
Stack D2 : Ubuntu 22.04 VM — NGINX + mTLS, 3-zone network
Realm    : Keycloak realm tên "cloudapi" (KHÔNG phải "lab")
```

### Thành viên & phân công

| Thành viên | MSSV | Phụ trách chính |
|---|---|---|
| Lưu Hồng Phúc | 24521382 | Docker Compose · Kong gateway · DPoP backend · mTLS D2 · ARCH diagram · RUNBOOK |
| Phan Thái Hưng | 24520624 | FastAPI CRUD · Keycloak realm · Postgres AEAD · BOLA check · Webhook HMAC · DAST ZAP |
| Võ Tưởng Tuấn Kiệt | 24520919 | OPA RBAC/ABAC · Grafana/Loki · Vault rotation · Eval scripts E-C2/E-Z1/E-X1/E-X2 |

---

## 1. Mục tiêu hệ thống (System Objectives)

### 1.1 Bài toán thực tế

Một công ty nhỏ (SME) xây dựng web app B2B/B2C có:
- Frontend SPA (React) giao tiếp với backend qua REST API
- 3 loại người dùng: Admin, Staff, Customer — mỗi loại quyền khác nhau
- Dữ liệu nhạy cảm: email, phone, thông tin đơn hàng lưu trong PostgreSQL
- Tích hợp webhook 3rd-party (payment gateway, shipping provider)

**Vấn đề:** API không được bảo vệ đúng cách → 4 kịch bản tấn công thực tế:
1. Token bị đánh cắp → attacker dùng lại ở thiết bị khác mãi mãi
2. Đổi `order_id` trong URL → xem đơn hàng của khách hàng khác (BOLA)
3. File database bị lấy → đọc toàn bộ email/phone plaintext
4. Webhook giả mạo → inject đơn hàng ảo vào hệ thống

### 1.2 Ba mục tiêu bảo mật (CIA mapping)

| Mục tiêu | CIA | Cơ chế thực hiện |
|---|---|---|
| **Chỉ đúng người được vào** | Confidentiality + Authenticity | TOTP MFA + PKCE + DPoP token binding |
| **Đúng người chỉ làm đúng việc** | Integrity + Authorization | OPA RBAC/ABAC deny-by-default + BOLA check |
| **Dữ liệu không thể đọc trộm hoặc sửa** | Confidentiality + Integrity | TLS 1.3 in-transit + AES-256-GCM at-rest + Vault KMS |

### 1.3 SMART Goals (từ AIM.md)

| # | Goal | Metric | Đo tại |
|---|---|---|---|
| G1 | Zero plaintext leak | 0 byte plaintext trên kênh bảo vệ | E-C1 (TLS capture) |
| G2 | Key rotation SLA | ≤ 10 phút end-to-end | E-X1 (vault-rotate.sh) |
| G3 | MFA false-accept | false-accept = 0% trên 100 tests | E-N1 (totp_test.py) |
| G4 | Policy coverage | ≥ 95% request có OPA decision với reason | E-Z1 (opa test suite) |

---

## 2. Các bên liên quan (Stakeholders)

### 2.1 Internal stakeholders

| Bên liên quan | Vai trò trong hệ thống | Rủi ro nếu bị tấn công |
|---|---|---|
| **Admin** (1 người) | Quản lý toàn bộ: user, product, order, system settings | Chiếm quyền admin → toàn bộ hệ thống bị kiểm soát |
| **Staff** (N người) | Xử lý đơn hàng, cập nhật tồn kho | Escalate privilege → xóa sản phẩm, thay đổi đơn hàng trái phép |
| **Customer** (nhiều) | Mua hàng, xem đơn của mình | Lộ PII (email, phone, địa chỉ), xem/sửa đơn người khác |
| **Developer team** | Build & deploy hệ thống | Secret leak trong repo → full compromise |

### 2.2 External stakeholders

| Bên liên quan | Tương tác | Rủi ro |
|---|---|---|
| **3rd-party webhook** (payment/shipping) | Gọi callback URL khi có event | Attacker giả mạo webhook → inject event giả |
| **Mobile app / SPA client** | Authorization Code + PKCE | Token bị steal qua XSS → replay ở nơi khác |
| **Cloud provider** (nếu deploy thật) | Managed services (KMS, DB) | Misconfigured IAM → data exfil |

### 2.3 Trust levels

```
UNTRUSTED          SEMI-TRUSTED           TRUSTED
─────────────────────────────────────────────────
Internet           ┌──────────────────┐   Internal services
  │                │   Kong Gateway   │     │
  ├─ SPA client    │   (edge, PEP)    │   FastAPI backend
  ├─ Mobile app    └──────────────────┘   OPA (PDP)
  └─ Webhook           validates          Vault (KMS)
     caller            all tokens         Keycloak (IdP)
```

---

## 3. Phân tích rủi ro (Risk Matrix)

> **Scoring:** Likelihood (1-5) × Impact (1-5) = Risk Score

| ID | Rủi ro | Likelihood | Impact | Score | Xử lý |
|---|---|---|---|---|---|
| R1 | Token bị đánh cắp và replay | 4 | 5 | **20** | DPoP binding + short TTL |
| R2 | BOLA — truy cập resource người khác | 4 | 4 | **16** | Server-side owner check |
| R3 | Broken Auth — JWT forged/tampered | 3 | 5 | **15** | alg pin RS256 + kid whitelist |
| R4 | Plaintext data ở DB bị leak | 2 | 5 | **10** | AES-256-GCM + Vault DEK |
| R5 | Webhook giả mạo từ 3rd-party | 3 | 3 | **9** | HMAC-SHA256 signature verify |
| R6 | SSRF qua URL parameter | 2 | 4 | **8** | IP blocklist + host allowlist |
| R7 | Secret bị commit lên repo | 3 | 5 | **15** | detect-secrets + .gitignore |
| R8 | Brute force / credential stuffing | 3 | 3 | **9** | Rate limit Kong + OPA |
| R9 | Service-to-service impersonation | 2 | 4 | **8** | mTLS (D2) / short-lived creds |
| R10 | MFA bypass (TOTP false-accept) | 1 | 5 | **5** | pyotp strict verify, I7 = 0% |

---

## 4. Phân tích lỗ hổng theo component

> Map: Lỗ hổng → File/Component chứa lỗ hổng → Mitigation → Evidence

### 4.1 R1 — Token Theft & Replay (OWASP API2)

**Lỗ hổng xảy ra ở đâu:**
- `frontend/src/auth/keycloak.js` — nếu token lưu sai chỗ (localStorage thay vì memory)
- `backend/app/middleware/auth_middleware.py` — nếu không verify DPoP proof

**Điều kiện khai thác:**
```
attacker intercept access_token → dùng lại trên máy khác
→ không có DPoP keypair tương ứng → bị reject
```

**Mitigation đã implement:**
- `frontend/src/utils/dpop.js` — tạo ephemeral ES256 keypair per-session, sign mỗi request
- `backend/app/security/dpop_verifier.py` — verify `htu`, `htm`, `ath`, jti chống replay qua Redis SET NX
- Keycloak: access token TTL = 15 phút, refresh token rotation = true

**Evidence:** `EVAL/E-C2.md`, `EVAL/E-Z2.md`, `scripts/attacks/replay_dpop_attack.py`

---

### 4.2 R2 — BOLA / IDOR (OWASP API1)

**Lỗ hổng xảy ra ở đâu:**
- `backend/app/api/v1/orders.py` và `backend/app/routers/orders.py`
- `GET /api/v1/orders/{id}` nếu không check owner

**Điều kiện khai thác:**
```python
# Attacker: login as user_A, lấy token_A
# Biết order_id của user_B (sequential ID)
GET /api/v1/orders/42  # với Authorization: Bearer token_A
# Nếu không có check → 200 OK + data của user_B
```

**Mitigation đã implement:**
- `backend/app/services/order_service.py`:
```python
if order.user_id != token_sub:
    raise HTTPException(403, "Forbidden")
```
- `opa/policies/authz.rego`: rule `allow if { input.subject == data.resource_owner }`

**Evidence:** `EVAL/E-Z1.md`, `scripts/attacks/bola_attack.py`

---

### 4.3 R3 — Broken Authentication / JWT Forgery (OWASP API2)

**Lỗ hổng xảy ra ở đâu:**
- `gateway/plugins/jwt-hardening.lua` — đây là nơi enforce
- `backend/app/security/jwt_verify.py` — second-line verify

**3 attack vectors:**

| Vector | File tấn công | Detection |
|---|---|---|
| alg=none | `scripts/attacks/alg_none_attack.py` | Kong 401, log `alg_none_rejected` |
| fake kid | `scripts/evaluation/e_z2_token_hardening.sh` | Kong 401, log `kid_not_whitelisted` |
| alg confusion (RS256 key dùng như HS256) | `scripts/evaluation/e_z2_token_hardening.sh` | Kong 401, log `alg_mismatch` |

**Evidence:** `EVAL/E-Z2.md`, `EVIDENCE/attack_results/token-hardening/`

---

### 4.4 R4 — Plaintext Data At-Rest (OWASP API3)

**Lỗ hổng xảy ra ở đâu:**
- `backend/app/db/models.py` — cột `email`, `phone` trong bảng `users`

**Mitigation đã implement:**
- `backend/app/security/aead_encryption.py`:
```python
nonce = os.urandom(12)         # 12 bytes random per-record
aead  = AESGCM(dek)            # AES-256-GCM (authenticated)
ct    = aead.encrypt(nonce, plaintext.encode(), None)
stored = nonce + ct            # 12B nonce || ciphertext || 16B tag
```
- DEK lấy từ Vault Transit Engine (`vault/policies/dek-policy.hcl`)
- Envelope encryption: DEK → mã hóa bởi KEK trong Vault

**Evidence:** `EVAL/E-C3.md`, `scripts/evaluation/e_c3_aead_integrity.py`

---

### 4.5 R5 — Webhook Hijacking

**Mitigation** trong `backend/app/api/v1/orders.py`:
```python
sig = hmac.new(SECRET, f'{timestamp}.{body}'.encode(), sha256).hexdigest()
if not hmac.compare_digest(sig, header_sig):
    raise HTTPException(401, "Invalid signature")
```
- Constant-time compare chống timing attack
- Timestamp window ±5 phút chống replay

---

### 4.6 R6 — SSRF

**Mitigation** trong `backend/app/services/user_service.py`:
```python
BLOCKED_RANGES = ['169.254.0.0/16', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']
if ip_address(url_host) in BLOCKED_RANGES:
    raise HTTPException(400, "SSRF blocked")
```

---

### 4.7 R7 — Secret in Repo

**Mitigation:**
- `.gitignore`: loại trừ `*.env`, `*.key`, `*.pem`, `certs/`
- `scripts/gen_certs.py` — sinh cert tự động lúc runtime, không hardcode
- CI: `detect-secrets scan` + `GitLeaks` mỗi push

---

## 5. Kiến trúc hệ thống (Network Topology)

### 5.1 Deployment D1 — Docker Compose

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HOST MACHINE  (localhost)                                               │
│                                                                          │
│  ┌──────────────┐   PKCE + DPoP   ┌─────────────────────────────────┐  │
│  │   Frontend   │ ─────────────── │     Kong API Gateway :8000      │  │
│  │ React + Vite │                 │  edge-net                        │  │
│  │    :5173     │                 │  • TLS 1.3 (kong.conf)           │  │
│  └──────────────┘                 │  • jwt-hardening.lua             │  │
│                                   │  • opa-authz.lua (PEP→PDP)       │  │
│  ┌──────────────┐                 │  • hsts-header.lua               │  │
│  │   Keycloak   │ ◄── JWKS        │  • Rate limiting                  │  │
│  │ (IdP) :8081  │                 └─────────────────────────────────┘  │
│  │ realm:       │                          │ internal-net               │
│  │  cloudapi    │                          ▼                            │
│  └──────────────┘                 ┌─────────────────┐                  │
│                                   │  FastAPI :9000  │                  │
│  ┌──────────────┐ HTTP POST        │  • DPoP verify  │                  │
│  │ OPA :8181    │ ◄────────────── │  • BOLA check   │                  │
│  │ PDP / Rego   │  /v1/data/      │  • AEAD decrypt │                  │
│  │              │  authz/allow    │  • Webhook HMAC │                  │
│  └──────────────┘                 └─────────────────┘                  │
│                                          │                              │
│  ┌──────────────┐   ┌────────────┐      │                              │
│  │ Vault :8200  │   │ PostgreSQL │ ◄────┘                              │
│  │ Transit KMS  │   │  :5434     │                                     │
│  └──────────────┘   └────────────┘                                     │
│  ┌──────────────┐                                                       │
│  │ Redis :6379  │  DPoP jti SET NX (replay protection)                 │
│  └──────────────┘                                                       │
│                           obs-net                                        │
│  ┌──────────┐  ┌───────┐  ┌──────────────────────────┐                │
│  │  Grafana │  │  Loki │  │ Promtail                 │                │
│  │  :3000   │  │ :3100 │  │ scrape Kong+FastAPI+OPA  │                │
│  └──────────┘  └───────┘  └──────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────────┘
```

**3 Docker networks:**
- `edge-net`: Kong ↔ Frontend ↔ Keycloak
- `internal-net`: Kong ↔ FastAPI ↔ Postgres ↔ Vault ↔ OPA ↔ Redis
- `obs-net`: FastAPI/Kong/OPA → Promtail → Loki → Grafana

---

### 5.2 Deployment D2 — Ubuntu 22.04 VM + mTLS (3 zones)

```
ZONE: DMZ  (192.168.10.x) — eth0
  └── NGINX :443  [DEPLOY/D2/nginx.conf]
       ssl_verify_client on → reject nếu không có cert
       proxy_pass → Private zone :9000

ZONE: Private  (10.10.0.x) — eth1
  └── FastAPI :9000 · Keycloak :8081 · OPA :8181
      Vault :8200 · PostgreSQL :5434 · Redis :6379
      iptables: chỉ nhận DMZ→9000 và Private↔Private

ZONE: Mgmt  (10.20.0.x) — eth2
  └── Grafana :3000 · Loki :3100 · Promtail
      iptables: Mgmt → tất cả; ngược lại DROP

CA chain [DEPLOY/D2/certs/]:
  ca.crt (RSA 4096, 365 ngày)
    └── svc.crt (RSA 2048, 90 ngày) + svc.key
```

Firewall rules: `DEPLOY/D2/iptables.sh`

---

### 5.3 Vai trò từng node và lý do chọn framework

| Node | Framework | Port | Vai trò | Lý do chọn |
|---|---|---|---|---|
| **Kong** | Kong 3.6 | 8000/8443 | PEP — edge enforce JWT, rate-limit, route | Plugin Lua extensible, declarative config, mở rộng không sửa core |
| **Keycloak** | Keycloak 24.0 | 8081 | IdP — OIDC/OAuth2, TOTP, PKCE, token lifecycle | Open source self-hosted, PKCE+TOTP out-of-box, JWKS chuẩn |
| **FastAPI** | FastAPI 0.110 | 9000 | Business logic + second-line authz | Async, Pydantic validation, OpenAPI auto-gen |
| **OPA** | OPA 0.65 | 8181 | PDP — policy decision, Rego engine | Decision log built-in, tách policy khỏi code, testable |
| **Vault** | HashiCorp Vault 1.15 | 8200 | KMS — Transit Engine DEK/KEK | Encrypt-as-a-service, rotation built-in, audit log |
| **PostgreSQL** | PostgreSQL 16 | 5434 | Persistent store | bytea cho ciphertext, ACID |
| **Redis** | Redis 7 | 6379 | DPoP jti replay protection | SET NX atomic, TTL auto-expire |
| **Grafana + Loki** | Grafana 10 + Loki 2.x | 3000/3100 | Observability | Không cần Elasticsearch, LogQL đơn giản |
| **React + Vite** | React 18 + Vite 5 | 5173 | SPA — PKCE + DPoP client | Web Crypto API native cho ES256 keypair |

---

## 6. Luồng request đầy đủ (Request Flow)

### 6.1 Luồng chính — Authenticated API call

```
1. User nhập password + TOTP → Keycloak verify
2. Keycloak cấp authorization_code (PKCE flow)
3. CallbackPage.jsx: exchange code → access_token (RS256, 15') + refresh_token
4. frontend/src/utils/dpop.js: generate ephemeral ES256 keypair per-session
5. Mỗi request gửi 2 headers:
   Authorization: Bearer <access_token>
   DPoP: <proof_jwt chứa htu + htm + ath + jti>
6. Kong xử lý (theo thứ tự plugin):
   ├── jwt-hardening.lua: reject alg≠RS256 hoặc kid không whitelist → 401
   ├── Rate limit: check quota per-IP/per-user
   └── opa-authz.lua: POST → OPA {method, path, subject, role}
         ├── OPA allow=true  → Kong route → FastAPI
         └── OPA allow=false → Kong 403 + log reason
7. FastAPI (auth_middleware.py):
   ├── DPoP verify: htu, htm, ath, jti SET NX Redis → reject replay
   ├── BOLA: order.user_id != token.sub → 403
   ├── DB: AEAD decrypt qua Vault DEK
   └── Response: Pydantic response_model (chỉ expose fields cần thiết)
8. logging_middleware.py: structured JSON + correlation_id
   → Promtail → Loki → Grafana alert nếu anomaly
```

### 6.2 OPA PEP/PDP flow

```
Kong (PEP) ──POST──► OPA :8181/v1/data/authz/allow
  Input:
  { "input": {
      "method": "GET",
      "path": "/api/v1/orders/123",
      "subject": "user-uuid",
      "role": "customer",
      "resource_owner": "user-uuid"
  }}

  opa/policies/authz.rego:
  allow if { input.subject == data.resource_owner }
  reason := "owner_match"

  Output: {"result": {"allow": true/false, "reason": "..."}}
```

---

## 7. Risk → Mitigation → Evidence

| Rủi ro | Lỗ hổng | Component bị ảnh hưởng | Giải pháp | File implement | Evidence |
|---|---|---|---|---|---|
| R1 Token replay | JWT không binding | `auth_middleware.py` | DPoP RFC 9449 + Redis jti SET NX + TTL 15' | `security/dpop_verifier.py` | `EVAL/E-C2.md` |
| R2 BOLA | Thiếu owner check | `api/v1/orders.py` | `order.user_id != token.sub → 403` | `services/order_service.py` | `EVAL/E-Z1.md` |
| R3 JWT forgery | alg=none, kid spoof | Kong gateway | alg pin RS256, kid whitelist | `gateway/plugins/jwt-hardening.lua` | `EVAL/E-Z2.md` |
| R4 DB plaintext | email/phone exposed | `db/models.py` | AES-256-GCM + Vault DEK | `security/aead_encryption.py` | `EVAL/E-C3.md` |
| R5 Webhook hijack | Callback không verify | webhooks endpoint | HMAC-SHA256 + timestamp window | `api/v1/orders.py` | Manual test |
| R6 SSRF | URL param không validate | `services/user_service.py` | IP blocklist + host allowlist | `services/user_service.py` | Unit test |
| R7 Secret leak | `.env` trong repo | Toàn repo | `.gitignore` + detect-secrets CI + `gen_certs.py` | `.github/workflows/` | CI log |
| R8 Brute force | Không rate limit | Kong + OPA | Per-IP/user rate limit | `gateway/kong.yml`, `opa/policies/rate_limit.rego` | `EVAL/E-Z1.md` |
| R9 S2S impersonation | Internal traffic | D2 east-west | mTLS mutual cert verify | `DEPLOY/D2/nginx.conf`, `DEPLOY/D2/certs/` | `EVAL/E-N2.md` |
| R10 MFA false-accept | TOTP weak verify | Keycloak + totp_verify | pyotp strict, false-accept=0 | `security/totp_verify.py` | `EVAL/E-N1.md` |

---

## 8. Invariants hệ thống

| ID | Phát biểu | Ngưỡng | Eval file | Risk |
|---|---|---|---|---|
| **I1** | Không plaintext leak trên kênh TLS | 0 byte | E-C1 | R1, R4 |
| **I2** | Mọi tampering bị từ chối + có log | 100% | E-C2, E-C3 | R1, R3 |
| **I3** | Dữ liệu integrity không bị vi phạm | Verify pass | E-N1 | R4, R5 |
| **I4** | PoP token bound — replay = 0 | Replay = 0 | E-N2, E-Z2 | R1, R3 |
| **I5** | Mọi AuthZ decision explainable | 100% có `reason` | E-Z1, E-X2 | R2, R8 |
| **I6** | Key rotation ≤ 10 phút | SLA ≤ 600s | E-X1 | R4 |
| **I7** | MFA false-accept = 0 | 0% | E-N1 | R10 |

---

## 9. Cấu trúc thư mục thực tế (verified từ `tree`)

```
Cloud_Api_Security/
│
├── docker-compose.yml              # 11 services, 3 networks: edge/internal/obs-net
├── .env.example                    # Template — copy → .env, KHÔNG commit thật
├── .gitignore                      # Loại trừ *.env *.key *.pem certs/
├── README.md
├── RUNBOOK.md                      # Clone → up ≤5 phút từ máy sạch
├── AIM.md                          # A1–A5 + 4 SMART goals
├── CRYPTO_SOLUTION.md              # 3 lớp crypto chi tiết
├── REFERENCES.md                   # ≥13 nguồn canonical + 5 tools
├── RESULTS.md                      # Bảng 9 metrics + kết luận I1–I7
├── SECURITY_CONTEXT.md             # ← FILE NÀY
├── architecture.png                # Sơ đồ embed trong README
├── image.png                       # Ảnh demo frontend
├── package.json                    # Root-level (Vite workspace)
├── package-lock.json
├── certs/                          # Empty — cert sinh ra lúc runtime bởi gen_certs.py
│
├── ARCH/
│   └── ARCH.pdf                    # Diagram: trust boundaries + I1–I7
│
├── frontend/                       # React 18 + Vite 5
│   ├── vite.config.js
│   ├── index.html
│   ├── nginx.conf                  # Serve SPA, proxy /api → Kong
│   ├── Dockerfile
│   └── src/
│       ├── App.jsx                 # Router + routes (bao gồm /callback)
│       ├── main.jsx
│       ├── auth/
│       │   ├── AuthProvider.jsx    # Context: token, login, logout, auto-refresh
│       │   ├── PrivateRoute.jsx    # Route guard theo role
│       │   └── keycloak.js        # PKCE: code_verifier, redirect, token exchange
│       ├── utils/
│       │   ├── dpop.js            # DPoP proof generator — Web Crypto ES256, RFC 9449
│       │   └── apiFetch.js        # Fetch wrapper: auto Authorization + DPoP header
│       ├── api/
│       │   ├── index.js
│       │   ├── orders.js
│       │   ├── products.js
│       │   └── users.js
│       ├── hooks/
│       │   ├── useAuth.js
│       │   ├── useOrders.js
│       │   └── useProducts.js
│       ├── components/
│       │   ├── AccessDenied.jsx
│       │   ├── shared/
│       │   │   ├── LoadingScreen.jsx
│       │   │   ├── OrderRow.jsx
│       │   │   └── ProductCard.jsx
│       │   └── ui/
│       │       ├── Badge.jsx
│       │       ├── Drawer.jsx
│       │       └── Modal.jsx
│       ├── layouts/
│       │   ├── AdminLayout.jsx
│       │   ├── StaffLayout.jsx
│       │   └── CustomerLayout.jsx
│       ├── pages/
│       │   ├── CallbackPage.jsx           # Nhận code từ Keycloak, exchange → token
│       │   ├── auth/Login.jsx             # Redirect Keycloak PKCE + OTP step
│       │   ├── admin/
│       │   │   ├── Dashboard.jsx          # KPI, doanh thu 7 ngày, Security Audit Log
│       │   │   ├── Orders.jsx
│       │   │   ├── Products.jsx           # CRUD sản phẩm
│       │   │   ├── UserManagement.jsx     # Khoá/mở khoá account
│       │   │   ├── SystemSettings.jsx     # Toggle TLS/DPoP/MFA/WAF, Vault log, OPA viewer
│       │   │   └── AttackSimulation.jsx   # UI chạy attack scenarios từ frontend
│       │   ├── staff/
│       │   │   ├── Dashboard.jsx
│       │   │   ├── Orders.jsx
│       │   │   └── Products.jsx
│       │   └── customer/
│       │       ├── ProductCatalog.jsx
│       │       ├── MyOrders.jsx
│       │       └── Profile.jsx
│       ├── context/CartContext.jsx
│       └── styles/
│           ├── global.css
│           └── login.css
│
├── backend/                               # FastAPI 0.110 Python 3.11+
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py                        # App init, CORS, middleware mount
│   │   ├── api/v1/                        # Endpoint handlers (business logic)
│   │   │   ├── orders.py                  # GET/POST/PUT/DELETE + webhook HMAC
│   │   │   ├── products.py
│   │   │   └── users.py
│   │   ├── routers/                       # Router registration (tách khỏi handler)
│   │   │   ├── __init__.py
│   │   │   ├── orders.py
│   │   │   ├── products.py
│   │   │   └── users.py
│   │   ├── core/
│   │   │   ├── config.py                  # Env vars, settings
│   │   │   └── security.py               # JWT decode helpers
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── database.py               # SQLAlchemy engine + session
│   │   │   ├── models.py                 # ORM: User (email/phone = bytea), Product, Order
│   │   │   └── seed_data.py              # 50 synthetic records/table (Faker)
│   │   ├── middleware/
│   │   │   ├── auth_middleware.py        # JWT verify + DPoP verify per-request
│   │   │   └── logging_middleware.py    # Structured JSON log + correlation_id
│   │   ├── security/
│   │   │   ├── aead_encryption.py       # AES-256-GCM, nonce=os.urandom(12), Vault DEK
│   │   │   ├── dpop_verifier.py         # RFC 9449: htu/htm/ath/jti + Redis SET NX
│   │   │   ├── jwt_verify.py            # RS256 alg pin, kid whitelist
│   │   │   └── totp_verify.py           # pyotp strict, false-accept=0
│   │   ├── services/
│   │   │   ├── order_service.py         # Business logic + BOLA check
│   │   │   ├── product_service.py
│   │   │   └── user_service.py          # Business logic + SSRF block
│   │   └── test_totp_pkce.py            # Manual test script TOTP + PKCE flow
│   └── tests/
│       ├── test_orders.py
│       ├── test_security.py
│       └── test_users.py
│
├── gateway/                              # Kong 3.6
│   ├── kong.conf                         # TLS 1.3, ssl_session_tickets=off
│   ├── kong.yml                          # Declarative: routes, plugins, services
│   ├── deck/kong-declarative.yml
│   └── plugins/
│       ├── jwt-hardening.lua             # Block alg=none, kid whitelist
│       ├── hsts-header.lua              # Inject Strict-Transport-Security
│       └── opa-authz.lua                # Kong(PEP) → OPA:8181(PDP) HTTP POST
│
├── idp/keycloak/
│   ├── realm-export.json                # Realm "cloudapi": PKCE, TOTP, rotating refresh
│   ├── clients.json                     # spa-client(public+PKCE) + backend-client(confidential)
│   └── users.json                       # 3 users: admin/staff/customer
│
├── opa/
│   ├── config/opa-config.yaml           # OPA server config + decision log
│   ├── policies/
│   │   ├── authz.rego                   # deny-by-default RBAC+ABAC, reason mọi decision
│   │   ├── admin.rego                   # /admin/* → role=admin only
│   │   └── rate_limit.rego             # deny if request_count > 100/phút
│   └── tests/
│       ├── authz_test.rego              # RBAC + BOLA cases
│       ├── admin_test.rego
│       └── rate_test.rego              # Tổng ≥50 cases, target ≥95% pass
│
├── vault/
│   ├── init/
│   │   ├── vault-init.sh               # Enable transit, tạo DEK key
│   │   ├── enable-transit.sh
│   │   └── vault-rotate.sh             # Rotate DEK + revoke old version + timestamp log
│   └── policies/
│       └── dek-policy.hcl              # Least-privilege: chỉ encrypt/decrypt DEK
│
├── observability/
│   ├── grafana/
│   │   ├── dashboards/api-security-dashboard.json
│   │   └── provisioning/
│   │       ├── dashboards/dashboards.yml
│   │       └── datasources/datasources.yml
│   ├── loki/loki-config.yml
│   └── promtail/promtail-config.yml    # Scrape Kong + FastAPI + OPA decision logs
│
├── DEPLOY/
│   ├── D1/Runbook.md                   # 8 sections: BOM, trust boundaries, run, verify
│   └── D2/
│       ├── nginx.conf                  # mTLS: ssl_verify_client on
│       ├── iptables.sh                 # 3-zone firewall rules
│       ├── Runbook.md                  # CA bootstrap, cert rotation, zone diagram
│       └── certs/
│           ├── ca.crt                  # Self-signed CA (RSA 4096, 365d)
│           ├── svc.crt                 # Service cert (RSA 2048, 90d)
│           └── svc.key
│
├── EVAL/
│   ├── E-C1.md  → I1: TLS plaintext capture
│   ├── E-C2.md  → I2: DPoP nonce reuse (50 threads, 1/50 pass)
│   ├── E-C3.md  → I2/I3: AEAD tamper (flip tag → InvalidTag)
│   ├── E-N1.md  → I3/I7: TOTP 100 tests (false-accept=0)
│   ├── E-N2.md  → I4: mTLS revoke → reject; rotate → connect
│   ├── E-X1.md  → I6: Vault rotation ≤10 phút
│   ├── E-X2.md  → I6: OPA 100% decisions có reason
│   ├── E-Z1.md  → I5: OPA ≥50 cases, ≥95% pass
│   └── E-Z2.md  → I4: 3 token attack vectors blocked
│
├── EVIDENCE/
│   ├── attack_results/         # ⚠️ CẦN: logs bola/alg_none/replay scripts
│   ├── captures/               # ⚠️ CẦN: http_capture.pcap + tls_capture.pcap
│   ├── logs/                   # ⚠️ CẦN: opa_decisions.json, auth.log, rotation.log
│   ├── screenshots/            # ⚠️ CẦN: Wireshark TLS vs HTTP, Grafana alerts
│   └── security_scans/
│       ├── bandit_report.json  # ✅ Có
│       ├── zap_report.html     # ✅ Có
│       ├── restler_results/    # ✅ Có
│       ├── opa_results.json    # ⚠️ CẦN: chạy `opa test --format json`
│       └── sca_report.txt     # ⚠️ CẦN: chạy `pip-audit`
│
├── scripts/
│   ├── gen_certs.py                   # Tạo self-signed cert tự động lúc runtime
│   ├── test_totp.py                   # Quick TOTP verify test
│   ├── attacks/
│   │   ├── alg_none_attack.py         # JWT alg=none → Kong phải 401
│   │   ├── bola_attack.py             # User A GET /orders/{B_id} → phải 403
│   │   ├── nonce_reuse_test.py        # 50 threads cùng DPoP proof → 49 reject
│   │   └── replay_dpop_attack.py      # Replay DPoP → 401 "DPoP proof replayed"
│   ├── evaluation/
│   │   ├── e_c1_tls_capture.sh
│   │   ├── e_c2_nonce_test.py
│   │   ├── e_c3_aead_integrity.py
│   │   ├── e_n1_totp_test.py
│   │   ├── e_x1_rotation_test.sh
│   │   ├── e_z1_policy_test.sh
│   │   └── e_z2_token_hardening.sh
│   └── security_testing/
│       ├── run_sast.sh
│       ├── run_dast.sh
│       └── run_fuzz.sh
│
└── tests/
    ├── integration/
    │   ├── test_api_flow.py
    │   ├── test_auth_flow.py
    │   └── test_policy_flow.py
    ├── security/
    │   ├── test_replay.py
    │   └── test_token.py
    └── security_scans/
        ├── dast/zap_scan.sh
        ├── fuzz/restler_config.json
        └── sast/bandit.sh
```

---

## 10. Những gì còn thiếu — Cần hoàn thiện trước nộp

### 🔴 Ưu tiên cao (ảnh hưởng trực tiếp đến EVAL sheets)

```bash
# 1. OPA test suite JSON export
docker compose exec opa \
  opa test /policies /tests --format json \
  > EVIDENCE/security_scans/opa_results.json

# 2. SCA report
pip-audit -r backend/requirements.txt \
  -o EVIDENCE/security_scans/sca_report.txt

# 3. Attack logs (cần stack đang chạy)
python scripts/attacks/alg_none_attack.py   2>&1 | tee EVIDENCE/attack_results/alg_none.log
python scripts/attacks/bola_attack.py       2>&1 | tee EVIDENCE/attack_results/bola.log
python scripts/attacks/replay_dpop_attack.py 2>&1 | tee EVIDENCE/attack_results/replay.log

# 4. TLS capture
bash scripts/evaluation/e_c1_tls_capture.sh
# → EVIDENCE/captures/tls_capture.pcap

# 5. OPA decision log
docker compose logs opa | grep '"type":"openpolicyagent.org/v1/decision"' \
  > EVIDENCE/logs/opa_decisions.json

# 6. Vault rotation với timestamp
bash vault/init/vault-rotate.sh 2>&1 | tee EVIDENCE/logs/vault-rotation.log
```

### 🟡 Verify trước demo

```bash
# Kong plugins đang load?
curl http://localhost:8001/plugins | jq '[.data[].name]'
# Expect: ["jwt-hardening", "hsts-header", "opa-authz", ...]

# OPA pass rate
docker compose exec opa opa test /policies /tests -v | tail -3
# Expect: PASS >= 95%

# TOTP false-accept
python scripts/evaluation/e_n1_totp_test.py
# Expect: false_accept: 0

# DPoP replay
python scripts/attacks/replay_dpop_attack.py
# Expect: 401 "DPoP proof replayed"

# BOLA
python scripts/attacks/bola_attack.py
# Expect: 403 Forbidden

# Vault rotation SLA
bash scripts/evaluation/e_x1_rotation_test.sh
# Expect: time <= 600 seconds
```

---

## 11. Conventions — AI assistant cần biết

```python
# Keycloak realm: "cloudapi" — KHÔNG phải "lab"
# JWKS: http://localhost:8081/realms/cloudapi/protocol/openid-connect/certs
# Token endpoint: http://localhost:8081/realms/cloudapi/protocol/openid-connect/token

# Tất cả log PHẢI có correlation_id
logger.info("event", extra={"correlation_id": request.state.cid})

# OPA decision PHẢI có reason — không để rỗng
{"result": {"allow": false, "reason": "not_owner"}}

# Ciphertext format trong Postgres (bytea):
# [12 bytes nonce] || [ciphertext] || [16 bytes GCM tag]

# DPoP jti key Redis: f"dpop:jti:{jti}"  SET NX, ex=token_ttl_seconds

# FastAPI expose :9000 chỉ debug — mọi request client PHẢI qua Kong :8000
```

### Lỗi hay gặp

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| `401` từ Kong | Thiếu DPoP header | Thêm `DPoP: <proof>` |
| `403` từ FastAPI | BOLA — token.sub ≠ order.user_id | Dùng đúng token của owner |
| `401 kid_not_whitelisted` | JWT kid không trong JWKS | Lấy token mới từ Keycloak |
| `401 DPoP proof replayed` | jti đã dùng | Generate proof mới |
| `InvalidTag` | Ciphertext bị tamper hoặc sai DEK version | Check Vault key version |
| Keycloak 404 | Dùng `/realms/lab/` | Đổi thành `/realms/cloudapi/` |
| Kong plugin không load | Thiếu tên plugin trong `KONG_PLUGINS` env | Thêm plugin name vào env |

---

*Cập nhật lần cuối: trước submission — đảm bảo EVIDENCE/ đã có đủ file kết quả thực.*
