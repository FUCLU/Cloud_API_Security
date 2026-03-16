## NT219.Q21.ANTT - MẬT MÃ HỌC

**Tên đề tài:** Cloud API-Based Network Application Security for Small Company Services

## Mục lục
- [Tổng quan](#tổng-quan)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Giải pháp mật mã 3 lớp](#giải-pháp-mật-mã-3-lớp)
- [Invariants hệ thống](#invariants-hệ-thống)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Quick Start](#-quick-start)
- [Địa chỉ truy cập](#địa-chỉ-truy-cập-sau-khi-stack-chạy)
- [Xác thực và gọi API](#lấy-token-và-gọi-api-có-auth)
- [Chạy kiểm thử](#chạy-kiểm-thử)
- [Triển khai D2 — Linux VM + mTLS](#triển-khai-d2--linux-vm--mtls)
- [CI/CD & Bảo mật supply chain](#cicd--bảo-mật-supply-chain)
- [Phân công](#phân-công)
- [Lưu ý bảo mật](#lưu-ý-bảo-mật)

---

## Tổng quan

Dự án xây dựng một hệ thống API security hoàn chỉnh, bao gồm:

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| **API Gateway** | Kong | JWT hardening, DPoP/PoP, rate-limiting, WAF, CORS, HSTS |
| **Identity Provider** | Keycloak | OIDC, WebAuthn/TOTP, PKCE, refresh token rotation |
| **Authorization** | OPA / Rego | RBAC→ABAC, deny-by-default, log 100% quyết định |
| **Key Management** | HashiCorp Vault | Envelope encryption KEK/DEK, rotation ≤ 10 phút |
| **Replay Protection** | Redis | DPoP jti store (SET NX + TTL), thay bằng mTLS ở D2 |
| **Observability** | Grafana + Loki + Promtail | Structured logs, security dashboard, anomaly detection |
| **CI/CD** | GitHub Actions | SAST, secrets scan, SCA, DAST, artifact signing |

---

## Kiến trúc hệ thống
```
Internet — Client (SPA / Mobile / 3rd-party)
        │  HTTPS / TLS 1.3
        ▼
  ┌──────────────────────┐
  │      WAF Layer       │  Cloudflare / ModSecurity
  │  [production only]   │  (không có trong Docker lab)
  └──────────┬───────────┘
             │
             │  ◀ Trust Boundary: edge-net
             ▼
  ┌─────────────────────────────────────────────────────┐
  │               API Gateway — Kong                    │
  │   gateway/kong.yml · deck/kong-declarative.yml      │
  │   • TLS 1.3 termination                             │
  │   • JWT verify RS256 · alg=none block · kid list    │
  │   • Rate limiting · CORS · HSTS                     │
  │   Plugins: jwt-hardening.lua · opa-authz.lua        │
  │            hsts-header.lua                          │
  └────┬──────────────────────┬──────────────────┬──────┘
       │ JWKS fetch / PKCE    │ policy check     │ request (auth OK)
       ▼                      ▼                  │
  ┌────────────────┐  ┌───────────────────────┐  │
  │ Keycloak (IdP) │  │      OPA — PDP        │  │
  │ idp/keycloak/  │  │  opa/policies/        │  │
  │ • OAuth2/OIDC  │  │  • authz.rego         │  │
  │ • PKCE flow    │  │  • admin.rego         │  │
  │ • TOTP MFA     │  │  • rate_limit.rego    │  │
  │ • JWKS endpoint│  │  • deny-by-default    │  │
  └────────────────┘  │  • decision logs      │  │
                      └───────────────────────┘  │
                                                 │
            ◀ Trust Boundary: internal-net      │
             ┌───────────────────────────────────┘
             ▼
  ┌───────────────────────────────────────────────────┐
  │             Backend API — FastAPI                 │
  │   backend/app/                                    │
  │   Middleware: auth_middleware · logging_middleware│
  │   Security:  dpop_verifier · aead_encryption      │
  │              totp_verify · jwt_verify             │
  │   Services:  user · order · product               │
  └─────────┬──────────────┬───────────────┬──────────┘
            │ jti check    │ DEK encrypt   │ AEAD read/write
            ▼              ▼               ▼
  ┌──────────────┐  ┌─────────────────┐  ┌───────────────┐
  │    Redis     │  │ HashiCorp Vault │  │  PostgreSQL   │
  │ DPoP jti     │  │  vault/init/    │  │  backend/db/  │
  │ replay store │  │ • KEK/DEK cycle │  │ • AEAD fields │
  │ SET NX + TTL │  │ • rotation≤10m  │  │ • AES-256-GCM │
  │ (D2 → mTLS)  │  │ • dek-policy    │  │ • nonce/record│
  └──────────────┘  └─────────────────┘  └───────────────┘

  ◀ obs-net — Observability (thu thập log từ tất cả services)
  ┌────────────────────────────────────────────────────┐
  │  kong.log · auth.log (OPA) · FastAPI logs          │
  │          │                                         │
  │          ▼                                         │
  │   Promtail ──► Loki ──► Grafana Dashboard          │
  │                         api-security-dashboard.json│
  └────────────────────────────────────────────────────┘
```
Sơ đồ đầy đủ: [`ARCH/ARCH.drawio`](ARCH/ARCH.drawio) (mở bằng [draw.io](https://app.diagrams.net)) hoặc [`ARCH/ARCH.pdf`](ARCH/ARCH.pdf).

**Port mapping Docker (D1):**

| Service | Port |
|---|---|
| FastAPI (Backend) | `:9000` |
| Kong API Gateway | `:8000` |
| Keycloak | `:8081` |
| OPA | `:8181` |
| HashiCorp Vault | `:8200` |
| Grafana | `:3000` |

> ⚠️ **Lưu ý:** FastAPI expose ở `:9000` chỉ để debug nội bộ. Mọi request từ client **phải** đi qua **Kong `:8000`** để được JWT verify, rate-limit và OPA authz kiểm tra.

---

## Giải pháp mật mã 3 lớp

### Lớp 1 — Crypto (Bảo vệ dữ liệu)

- **Truyền tải:** TLS 1.3, ciphersuites thu gọn, 0-RTT tắt, HSTS header bắt buộc
- **Lưu trữ:** AES-256-GCM (AEAD), nonce `os.urandom(12)` per-record, envelope encryption DEK/KEK qua HashiCorp Vault Transit Engine
- **Chữ ký:** Ed25519 / RS256 (Keycloak), toàn bộ tham số được tài liệu hóa đầy đủ

### Lớp 2 — AuthN (Xác thực)

- **Người dùng:** WebAuthn/FIDO2 (primary), TOTP fallback (không có bypass)
- **Flow:** Authorization Code + PKCE (public clients), Client Credentials (S2S)
- **Session:** cookie `Secure` + `HttpOnly` + `SameSite`, refresh token rotation + reuse-detection
- **S2S:** mTLS east-west (D2), SPIFFE/SPIRE (optional)

### Lớp 3 — AuthZ (Cấp quyền)

- **Mô hình:** deny-by-default → least-privilege → RBAC → ABAC (OPA/Rego)
- **Thi hành:** PEP tại Kong gateway, PDP tại OPA — log reason cho mọi quyết định (100%)
- **Token:** JWT pin `alg=RS256`, kiểm soát `kid`, TTL ngắn, DPoP/mTLS-bound (PoP)

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

Kết quả đo lường: [`RESULTS.md`](RESULTS.md)

---

## Cấu trúc thư mục

```
.
├── ARCH/
│   ├── ARCH.drawio                  # Sơ đồ kiến trúc (draw.io)
│   └── ARCH.pdf                     # Export kiến trúc + invariants I1–I6
├── CRYPTO_SOLUTION.md               # Giải pháp mật mã 3 lớp
├── RESULTS.md                       # Bảng metric + kết luận invariants đạt/chưa
├── RUNBOOK.md                       # Hướng dẫn chạy từ máy sạch
├── docker-compose.yml               # D1: toàn bộ stack 1 lệnh
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── api/v1/                  # FastAPI endpoints: users, products, orders
│       ├── core/                    # config.py, security.py
│       ├── db/                      # database.py, models.py, seed_data.py
│       ├── middleware/              # auth_middleware.py, logging_middleware.py
│       ├── security/                # aead_encryption.py, dpop_verifier.py,
│       │                            #   jwt_verify.py, totp_verify.py
│       ├── services/                # order_service.py, product_service.py, user_service.py
│       └── tests/                   # test_orders.py, test_security.py, test_users.py
│
├── gateway/
│   ├── kong.conf
│   ├── kong.yml                     # Kong declarative config
│   ├── deck/kong-declarative.yml
│   └── plugins/                     # hsts-header.lua, jwt-hardening.lua, opa-authz.lua
│
├── idp/keycloak/                    # realm-export.json, clients.json, users.json
│
├── opa/
│   ├── config/opa-config.yaml
│   ├── policies/                    # authz.rego, admin.rego, rate_limit.rego
│   └── tests/                       # authz_test.rego, admin_test.rego, rate_test.rego
│
├── vault/
│   ├── init/                        # vault-init.sh, enable-transit.sh
│   └── policies/dek-policy.hcl
│
├── observability/
│   ├── grafana/
│   │   ├── dashboards/api-security-dashboard.json
│   │   └── provisioning/
│   ├── loki/loki-config.yml
│   └── promtail/promtail-config.yml
│
├── DEPLOY/
│   ├── D1/Runbook.md                # Docker Compose local
│   └── D2/                          # Linux VM + mTLS
│       ├── nginx.conf               # NGINX reverse proxy (thay Kong)
│       ├── iptables.sh              # Zone firewall: DMZ / Private / Mgmt
│       ├── Runbook.md
│       └── certs/                   # ca.crt, svc.crt, svc.key
│
├── EVAL/                            # E-C1 → E-Z2: thủ tục đo từng invariant
│
├── EVIDENCE/
│   ├── attack_results/
│   ├── captures/                    # http_capture.pcap, tls_capture.pcap
│   ├── logs/                        # auth.log, kong.log, opa.log
│   ├── screenshots/
│   └── security_scans/
│       ├── bandit_report.json
│       ├── zap_report.html
│       └── restler_results/
│
├── scripts/
│   ├── attacks/                     # bola_attack.py, replay_dpop_attack.py,
│   │                                #   alg_none_attack.py, nonce_reuse_test.py
│   ├── evaluation/                  # e_c1_tls_capture.sh, e_c2_nonce_test.py,
│   │                                #   e_c3_aead_integrity.py, e_n1_totp_test.py,
│   │                                #   e_x1_rotation_test.sh, e_z1_policy_test.sh,
│   │                                #   e_z2_token_hardening.sh
│   └── security_testing/            # run_dast.sh, run_fuzz.sh, run_sast.sh
│
└── tests/
    ├── integration/                 # test_api_flow.py, test_auth_flow.py, test_policy_flow.py
    ├── security/                    # test_replay.py, test_token.py
    └── security_scans/
        ├── dast/zap_scan.sh
        ├── fuzz/restler_config.json
        └── sast/bandit.sh
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
git clone https://github.com/FUCLU/Cloud_API_Security.git
cd Cloud_API_Security

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

---

## Địa chỉ truy cập sau khi stack chạy

| Service | URL | Mô tả |
|---|---|---|
| 🌐 FastAPI (Backend) | [`http://localhost:9000/docs`](http://localhost:9000/docs) | Swagger UI, thử API trực tiếp (debug only) |
| ⚡ Kong API Gateway | [`http://localhost:8000/api`](http://localhost:8000/api) | Entry point chính cho mọi request |
| 🔑 Keycloak Admin | [`http://localhost:8081`](http://localhost:8081) | Quản lý realm, user, token |
| 📋 OPA | [`http://localhost:8181`](http://localhost:8181) | Policy engine, decision log |
| 🔐 Vault UI | [`http://localhost:8200`](http://localhost:8200) | KMS, quản lý KEK/DEK |
| 📊 Grafana | [`http://localhost:3000`](http://localhost:3000) | Dashboard bảo mật, log stream |

---

## Lấy token và gọi API có auth

```bash
# Lấy access token từ Keycloak (Client Credentials flow)
TOKEN=$(curl -s -X POST \
  http://localhost:8081/realms/apirealm/protocol/openid-connect/token \
  -d "client_id=backend-client" \
  -d "client_secret=<secret-from-keycloak>" \
  -d "grant_type=client_credentials" | jq -r '.access_token')

# Gọi endpoint cần auth qua Kong (đường đi đúng — qua JWT verify + OPA)
curl -i -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/users

# Gọi trực tiếp backend (bypass Kong — chỉ dùng khi debug nội bộ)
curl -i -H "Authorization: Bearer $TOKEN" \
  http://localhost:9000/api/v1/users
```

Chi tiết đầy đủ: [`DEPLOY/D1/Runbook.md`](DEPLOY/D1/Runbook.md)

---

## Chạy kiểm thử

### Unit & Policy tests

```bash
# Unit tests (backend)
docker compose exec backend pytest tests/ -v

# OPA policy tests
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
python scripts/attacks/nonce_reuse_test.py      # Nonce reuse
```

### Evaluation scripts (theo invariants)

```bash
bash   scripts/evaluation/e_c1_tls_capture.sh        # I1 — TLS plaintext check
python scripts/evaluation/e_c2_nonce_test.py         # I2 — nonce uniqueness
python scripts/evaluation/e_c3_aead_integrity.py     # I2/I3 — AEAD tamper
python scripts/evaluation/e_n1_totp_test.py          # I3 — TOTP / AuthN
bash   scripts/evaluation/e_x1_rotation_test.sh      # I6 — Key rotation SLA
bash   scripts/evaluation/e_z1_policy_test.sh        # I5 — OPA decision log
bash   scripts/evaluation/e_z2_token_hardening.sh    # I4 — Token binding
```

### SAST / DAST / Fuzzing

```bash
bash scripts/security_testing/run_sast.sh    # Bandit → EVIDENCE/security_scans/bandit_report.json
bash scripts/security_testing/run_dast.sh    # OWASP ZAP → zap_report.html
bash scripts/security_testing/run_fuzz.sh    # RESTler → restler_results/
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

# Áp dụng firewall rules phân zone
chmod +x iptables.sh
sudo bash iptables.sh

# Khởi động NGINX gateway với cert mTLS
nginx -c $(pwd)/nginx.conf
```

- Certificates: `DEPLOY/D2/certs/ca.crt`, `svc.crt`, `svc.key`
- mTLS thay thế hoàn toàn DPoP+Redis cho S2S authentication

Chi tiết đầy đủ: [`DEPLOY/D2/Runbook.md`](DEPLOY/D2/Runbook.md)

---

## CI/CD & Bảo mật supply chain

GitHub Actions tự động chạy khi push lên `main` và `dev`:

| Bước | Tool | Output |
|---|---|---|
| **SAST** | Bandit (Python) | `EVIDENCE/security_scans/bandit_report.json` |
| **Secrets scan** | detect-secrets, GitLeaks | Fail build nếu phát hiện secret |
| **SCA** | Snyk dependency audit | Báo cáo CVE trong dependencies |
| **DAST** | OWASP ZAP (merge → main) | `EVIDENCE/security_scans/zap_report.html` |
| **Fuzzing** | RESTler | `EVIDENCE/security_scans/restler_results/` |
| **Artifact signing** | cosign | Container image signed trước khi deploy |

---

## Phân công

| Thành viên | Trụ kỹ thuật | Owns |
|---|---|---|
| **Lưu Hồng Phúc** | Kong Edge · TLS 1.3 · DPoP · JWT hardening | `ARCH/` · `CRYPTO_SOLUTION.md` · `docker-compose.yml` · `gateway/` |
| **Phan Thái Hưng** | FastAPI · Keycloak · AEAD at-rest · Vault · Postgres | `backend/` · `idp/` · `vault/` · `DEPLOY/D1/Runbook.md` |
| **Võ Tưởng Tuấn Kiệt** | OPA/Rego · Evaluation · Docs · Video demo | `opa/` · `EVAL/` · `EVIDENCE/` · `scripts/` · `RESULTS.md` · `RUNBOOK.md` |

---

## Lưu ý bảo mật

- **Không commit** file `.env`, `*.key`, `*.pem`, `*.p12` vào repo — đã có trong `.gitignore`
- Dùng **synthetic data** cho tất cả test, không dùng dữ liệu thật
- Chỉ pentest trên **lab infrastructure** — không scan third-party services
- Sanitize logs trước khi đưa vào `EVIDENCE/`
- File `.env.example` là template — copy sang `.env` và điền secret thực trước khi chạy

---

## License
