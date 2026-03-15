# Cloud API-Based Network Application Security for Small Company Services

---

## Tổng quan
Dự án thiết kế, triển khai và đánh giá một hệ thống **API-first bảo mật 3 lớp** (Crypto / AuthN / AuthZ) phù hợp với công ty nhỏ (SME), bao gồm:

- **API Gateway** (Kong) với JWT hardening, DPoP/PoP, rate-limiting, WAF
- **Identity Provider** (Keycloak) với OIDC, WebAuthn/TOTP, PKCE, refresh token rotation
- **Authorization** (OPA/Rego) với RBAC→ABAC, deny-by-default, log reason mọi quyết định
- **Key Management** (HashiCorp Vault) với envelope encryption KEK/DEK, rotation ≤ 10 phút
- **Observability** (Grafana Loki + Promtail) với structured logs, anomaly detection
- **CI/CD** (GitHub Actions) với SAST, secrets scan, artifact signing

---

## Cấu trúc thư mục

```
.
├── ARCH/
│   ├── ARCH.drawio                 # Sơ đồ kiến trúc (draw.io)
│   └── ARCH.pdf                    # Export kiến trúc + invariants I1–I6
├── CRYPTO_SOLUTION.md              # Giải pháp mật mã 3 lớp
├── RESULTS.md                      # Bảng metric + kết luận invariants đạt/chưa
├── RUNBOOK.md                      # Hướng dẫn chạy từ máy sạch
├── docker-compose.yml              # D1: toàn bộ stack 1 lệnh
├── backend/
│   ├── app/
│   │   ├── api/v1/                 # FastAPI endpoints: users, products, orders
│   │   ├── core/                   # config.py, security.py
│   │   ├── db/                     # database.py, models.py, seed_data.py
│   │   ├── middleware/             # auth_middleware.py, logging_middleware.py
│   │   ├── security/               # aead_encryption.py, dpop_verifier.py,
│   │   │                           #   jwt_verify.py, totp_verify.py
│   │   └── services/               # order_service.py, product_service.py, user_service.py
│   └── tests/                      # test_orders.py, test_security.py, test_users.py
├── gateway/
│   ├── kong.yml                    # Kong declarative config
│   ├── deck/kong-declarative.yml
│   └── plugins/                    # hsts-header.lua, jwt-hardening.lua, opa-authz.lua
├── idp/keycloak/                   # realm-export.json, clients.json, users.json
├── opa/
│   ├── policies/                   # authz.rego, admin.rego, rate_limit.rego
│   └── tests/                      # authz_test.rego, admin_test.rego, rate_test.rego
├── vault/
│   ├── init/                       # vault-init.sh, enable-transit.sh
│   └── policies/dek-policy.hcl
├── observability/
│   ├── grafana/dashboards/         # api-security-dashboard.json
│   ├── loki/loki-config.yml
│   └── promtail/promtail-config.yml
├── DEPLOY/
│   ├── D1/Runbook.md               # Docker Compose local
│   └── D2/                         # Linux VM + mTLS (nginx.conf, iptables.sh, certs/)
├── EVAL/                           # E-C1 đến E-Z2: thủ tục đo từng invariant
├── EVIDENCE/
│   ├── captures/                   # http_capture.pcap, tls_capture.pcap
│   ├── logs/                       # auth.log, kong.log, opa.log
│   └── screenshots/
├── scripts/
│   ├── attacks/                    # bola_attack.py, replay_dpop_attack.py,
│   │                               #   alg_none_attack.py, nonce_reuse_test.py
│   └── evaluation/                 # e_c1_tls_capture.sh, e_z1_policy_test.sh, ...
└── tests/
    ├── integration/                # test_api_flow.py, test_auth_flow.py
    └── security/                   # test_replay.py, test_token.py
```

---

## Yêu cầu hệ thống

| Thành phần | Phiên bản |
|---|---|
| Docker & Docker Compose | ≥ 24.x / v2.x |
| Python | ≥ 3.11 |
| Node.js (optional, Kong deck) | ≥ 18 |
| Git | ≥ 2.40 |
| RAM khuyến nghị | ≥ 8 GB |

---

## ⚡ Quick Start

> Chạy toàn bộ stack trong **5 bước**, từ clone đến API hoạt động.

```bash
# Bước 1 — Clone repo
git clone https://github.com/<your-org>/Cloud_Api_Security.git
cd Cloud_Api_Security

# Bước 2 — Tạo file cấu hình (không commit file này)
cp .env.example .env

# Bước 3 — Khởi động toàn bộ stack
docker compose up -d

# Bước 4 — Seed dữ liệu tổng hợp
docker compose exec backend python -m app.db.seed_data

# Bước 5 — Kiểm tra nhanh
curl http://localhost:8000/api/v1/products   # qua Kong → 200 OK
curl http://localhost:9000/docs              # FastAPI Swagger UI
```

### Địa chỉ truy cập sau khi stack chạy

| Service | URL | Mô tả |
|---|---|---|
| 🌐 FastAPI (Backend) | [`http://localhost:9000/docs`](http://localhost:9000/docs) | Swagger UI, thử API trực tiếp |
| ⚡ Kong API Gateway | [`http://localhost:8000/api`](http://localhost:8000/api) | Entry point cho mọi request |
| 🔑 Keycloak Admin | [`http://localhost:8081`](http://localhost:8081) | Quản lý realm, user, token |
| 📋 OPA | [`http://localhost:8181`](http://localhost:8181) | Policy engine, decision log |
| 🔐 Vault UI | [`http://localhost:8200`](http://localhost:8200) | KMS, quản lý KEK/DEK |
| 📊 Grafana | [`http://localhost:3000`](http://localhost:3000) | Dashboard bảo mật, log |

> ⚠️ **Lưu ý kiến trúc:** FastAPI expose ở `:9000` chỉ để debug nội bộ. Mọi request từ client nên đi qua **Kong `:8000`** để được JWT verify, rate-limit và OPA authz kiểm tra.

### Lấy token và gọi API có auth

```bash
# Lấy access token từ Keycloak (Client Credentials flow)
TOKEN=$(curl -s -X POST \
  http://localhost:8081/realms/apirealm/protocol/openid-connect/token \
  -d "client_id=backend-client" \
  -d "client_secret=<secret-from-keycloak>" \
  -d "grant_type=client_credentials" | jq -r '.access_token')

# Gọi endpoint cần auth qua Kong
curl -i -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/users

# Gọi trực tiếp backend (bypass Kong — chỉ dùng khi debug)
curl -i -H "Authorization: Bearer $TOKEN" \
  http://localhost:9000/api/v1/users
```

Chi tiết đầy đủ xem [`DEPLOY/D1/Runbook.md`](DEPLOY/D1/Runbook.md).

---

## Kiến trúc hệ thống

```
Client (SPA/Mobile/3rd-party)
        │  HTTPS / TLS 1.3 + Auth Code + PKCE
        ▼
  ┌─────────────┐
  │  WAF Layer  │  Cloudflare WAF / ModSecurity
  └──────┬──────┘
         │
  ┌──────▼──────────────────────────┐
  │  API Gateway (Kong / Envoy)     │
  │  • TLS 1.3 termination          │
  │  • JWT verify (pin alg, kid)    │
  │  • DPoP / mTLS-bound (PoP)      │
  │  • Rate limit per-IP/user       │
  │  • CORS · HSTS · Tracing        │
  └──────┬──────────────┬───────────┘
         │              │
         │         ┌────▼───────────────┐
         │         │  OPA (PDP)         │
         │         │  deny-by-default   │
         │         │  RBAC→ABAC Rego    │
         │         │  log reason 100%   │
         │         └────────────────────┘
         │
  ┌──────▼──────────────────────────┐
  │  Backend Microservices          │
  │  User · Order · Product · Admin │
  │  (FastAPI + PEP per-request)    │
  └──────┬──────────────────────────┘
         │                       │
  ┌──────▼──────┐    ┌───────────▼──────────┐
  │  PostgreSQL │    │  HashiCorp Vault     │
  │  AEAD enc.  │    │  KEK/DEK lifecycle   │
  │  at-rest    │    │  rotate ≤ 10 min     │
  └─────────────┘    └──────────────────────┘
```

Sơ đồ đầy đủ: [`ARCH/ARCH.drawio`](ARCH/ARCH.drawio) (mở bằng [draw.io](https://app.diagrams.net)) hoặc [`ARCH/ARCH.pdf`](ARCH/ARCH.pdf).

> **Port mapping Docker (D1):** FastAPI `:9000` · Kong `:8000` · Keycloak `:8081` · OPA `:8181` · Vault `:8200` · Grafana `:3000`

---

## Giải pháp mật mã 3 lớp

### Lớp 1 — Crypto (bảo vệ dữ liệu)
- **Truyền:** TLS 1.3, ciphersuites thu gọn, 0-RTT tắt, HSTS
- **Lưu trữ:** AES-256-GCM (AEAD), nonce `os.urandom(12)` per-record, envelope encryption (DEK/KEK qua Vault)
- **Chữ ký:** Ed25519 / RS256 (Keycloak), tham số tài liệu hóa đầy đủ

### Lớp 2 — AuthN (xác thực)
- **Người dùng:** WebAuthn/FIDO2 (primary), TOTP fallback (không bypass)
- **Flow:** Authorization Code + PKCE (public clients), Client Credentials (S2S)
- **Session:** cookie Secure + HttpOnly + SameSite, refresh token rotation + reuse-detect
- **S2S:** mTLS east-west (D2), SPIFFE/SPIRE optional

### Lớp 3 — AuthZ (cấp quyền)
- **Mô hình:** deny-by-default → least-privilege → RBAC → ABAC (OPA/Rego)
- **Thi hành:** PEP tại Kong gateway, PDP tại OPA — log reason mọi quyết định
- **Token:** JWT pin `alg=RS256`, kiểm soát `kid`, TTL ngắn, DPoP/mTLS-bound (PoP)

Chi tiết: [`CRYPTO_SOLUTION.md`](CRYPTO_SOLUTION.md)

---

## Invariants hệ thống

| ID | Mô tả | Ngưỡng |
|---|---|---|
| **I1** | Không rò rỉ plaintext trên kênh bảo vệ | 0 byte |
| **I2** | Tampering (ciphertext/token) bị từ chối, có log | 100% bị chặn |
| **I3** | Dữ liệu nguyên gốc, không bị chỉnh sửa | Integrity verify pass |
| **I4** | AuthN chống phishing; PoP token bound, replay = 0 | Replay = 0 |
| **I5** | Quyết định AuthZ giải thích được từ log/policy | 100% explainable |
| **I6** | Key rotation ≤ 10 phút; blast-radius ≤ 24h | SLA đạt |

---

## Chạy kiểm thử

```bash
# Unit tests (backend)
docker compose exec backend pytest tests/ -v

# OPA policy tests
docker compose exec opa opa test /policies /tests -v

# Integration tests
python tests/integration/test_api_flow.py

# Security / attack simulation
python scripts/attacks/alg_none_attack.py
python scripts/attacks/bola_attack.py
python scripts/attacks/replay_dpop_attack.py

# Evaluation scripts (theo invariants)
bash scripts/evaluation/e_c1_tls_capture.sh
python scripts/evaluation/e_c2_nonce_test.py
bash scripts/evaluation/e_z1_policy_test.sh
bash scripts/evaluation/e_z2_token_hardening.sh
```

---

## Triển khai D2 — Linux VM + mTLS

Deployment D2 chạy trên VM Ubuntu 22.04 với network segmentation (private / dmz / mgmt) và mTLS east-west giữa các service.

```bash
cd DEPLOY/D2
# Cấp quyền và chạy cài đặt mTLS
chmod +x iptables.sh
sudo bash iptables.sh

# Khởi động NGINX gateway với cert mTLS
nginx -c $(pwd)/nginx.conf
```

Chi tiết đầy đủ: [`DEPLOY/D2/Runbook.md`](DEPLOY/D2/Runbook.md)

---

## CI/CD & Bảo mật supply chain

GitHub Actions tự động chạy khi push lên `main` và `dev`:

- **SAST:** Bandit (Python), ESLint security plugin
- **Secrets scan:** detect-secrets, GitLeaks
- **SCA:** Snyk dependency audit
- **DAST:** OWASP ZAP (khi merge vào main)
- **Artifact signing:** cosign

---

## Đóng góp & Phân công

| Thành viên | Trụ kỹ thuật | Owns |
|---|---|---|
| **Lưu Hồng Phúc** | Kong Edge · TLS 1.3 · DPoP · JWT hardening | AIM.md · ARCH.pdf · CRYPTO_SOLUTION.md · docker-compose.yml |
| **Võ Tưởng Tuấn Kiệt** | FastAPI · Keycloak · AEAD at-rest · Vault · Postgres | DEPLOY/D1/Runbook.md · idp/ · services/ |
| **Phan Thái Hưng** | OPA/Rego · Evaluation · Docs · Video demo | POLICIES/ · EVAL/ · EVIDENCE/ · RESULTS.md · RUNBOOK.md |

---

## Lưu ý bảo mật

- **Không commit** file `.env`, `*.key`, `*.pem`, `*.p12` vào repo — đã có trong `.gitignore`
- Dùng **synthetic data** cho tất cả test, không dùng dữ liệu thật
- Chỉ pentest trên lab infra — không scan third-party services
- Sanitize logs trước khi đưa vào `EVIDENCE/`

---

## License
