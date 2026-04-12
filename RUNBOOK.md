# RUNBOOK — Cloud API Security Stack

## ⚡ Quick Start

> Không muốn đọc dài :)) Chạy 5 lệnh này là xong.

```bash
git clone https://github.com/FUCLU/Cloud_API_Security.git
cd Cloud_API_Security
cp .env.example .env          # chỉnh secrets trong .env trước khi chạy
docker compose up -d
docker compose exec backend python -m app.db.seed_data
```

Kiểm tra stack đã hoạt động:

```bash
# Tất cả 11 container phải HEALTHY
docker compose ps

# Ping qua Kong (không cần token)
curl http://localhost:8000/api/v1/products

# Mở Swagger UI của backend
open http://localhost:9000/docs      # macOS
xdg-open http://localhost:9000/docs  # Linux

# Mở Frontend
open http://localhost:5173           # macOS
xdg-open http://localhost:5173       # Linux
```

### Port mapping (Docker Compose D1) — 11 services

| Service | URL | Ghi chú |
|---|---|---|
| 🌐 Frontend (React/Vite) | `http://localhost:5173` | Giao diện 3 role: Admin, Staff, Customer |
| 🌐 FastAPI Backend | `http://localhost:9000/docs` | Swagger UI, debug trực tiếp (bypass Kong) |
| ⚡ Kong API Gateway | `http://localhost:8000/api` | Entry point chính — dùng port này để test |
| ⚡ Kong Admin API | `http://localhost:8001` | Internal admin — không expose ra ngoài |
| 🔑 Keycloak Admin | `http://localhost:8081` | UI: `/admin` · OIDC: `/realms/cloudapi` |
| 📋 OPA | `http://localhost:8181` | REST API: `/v1/policies`, `/v1/data` |
| 🔐 Vault UI | `http://localhost:8200` | Token: giá trị `VAULT_DEV_ROOT_TOKEN_ID` trong `.env` |
| 📊 Grafana | `http://localhost:3000` | `admin` / `GF_SECURITY_ADMIN_PASSWORD` trong `.env` |
| 🗄 PostgreSQL | `localhost:5434` | Internal — qua backend container |
| 🔴 Redis | `localhost:6379` | DPoP jti store — internal |
| 📡 Loki | `http://localhost:3100` | Log aggregation — internal |

> ⚠️ **Lưu ý:** FastAPI chạy nội bộ ở port `9000`, **không expose ra ngoài trực tiếp** — mọi request từ client phải đi qua Kong `:8000` để qua JWT verify, rate-limit và OPA authz. Port `:9000` chỉ dùng để debug nội bộ và Swagger UI.

---

## Mục lục

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Clone & cấu hình ban đầu](#2-clone--cấu-hình-ban-đầu)
3. [D1 — Docker Compose (Local)](#3-d1--docker-compose-local)
4. [D2 — Linux VM + mTLS](#4-d2--linux-vm--mtls)
5. [Bootstrap secrets & keys](#5-bootstrap-secrets--keys)
6. [Frontend — Luồng tích hợp](#6-frontend--luồng-tích-hợp)
7. [Health checks & Observability](#7-health-checks--observability)
8. [Chạy kiểm thử & Evaluation](#8-chạy-kiểm-thử--evaluation)
9. [Key rotation](#9-key-rotation)
10. [Xử lý lỗi thường gặp](#10-xử-lý-lỗi-thường-gặp)
11. [Dừng & Dọn dẹp](#11-dừng--dọn-dẹp)

---

## 1. Yêu cầu hệ thống

| Thành phần | Phiên bản tối thiểu | Ghi chú |
|---|---|---|
| Docker Engine | 24.x | `docker --version` |
| Docker Compose | v2.x (plugin) | `docker compose version` |
| Python | 3.11+ | `python3 --version` |
| Git | 2.40+ | `git --version` |
| RAM | 8 GB | Vault + Keycloak tốn ~3 GB |
| Disk | 10 GB free | Images + volumes |
| OS (D2) | Ubuntu 22.04 LTS | Cho deployment VM |

**Cài nhanh Docker (Ubuntu):**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

---

## 2. Clone & cấu hình ban đầu

```bash
# Clone repo
git clone https://github.com/FUCLU/Cloud_API_Security.git
cd Cloud_API_Security

# Tạo file .env từ mẫu
cp .env.example .env
```

Mở `.env` và điền các giá trị sau (dùng giá trị ngẫu nhiên mạnh cho production):

```bash
# Vault
VAULT_DEV_ROOT_TOKEN_ID=<random-uuid-4>

# Keycloak
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=<strong-password>

# Postgres
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=cloudapi
POSTGRES_USER=admin

# Backend app
SECRET_KEY=<random-32-byte-hex>
ALGORITHM=RS256
ACCESS_TOKEN_EXPIRE_MINUTES=15

# OPA
OPA_ADDR=http://opa:8181

# Grafana
GF_SECURITY_ADMIN_PASSWORD=<strong-password>
```

> ⚠️ **Không commit file `.env`** — đã có trong `.gitignore`.

---

## 3. D1 — Docker Compose (Local)

### 3.1 Khởi động stack

```bash
# Kéo images mới nhất
docker compose pull

# Khởi động toàn bộ stack (detached)
docker compose up -d

# Theo dõi logs
docker compose logs -f
```

### 3.2 Kiểm tra tất cả 11 container healthy

```bash
docker compose ps
```

Kết quả mong muốn — tất cả `STATUS` là `running (healthy)`:

```
NAME              SERVICE     STATUS              PORTS
api-postgres      postgres    running (healthy)   0.0.0.0:5434->5432/tcp
api-redis         redis       running (healthy)   0.0.0.0:6379->6379/tcp
vault             vault       running (healthy)   0.0.0.0:8200->8200/tcp
opa               opa         running (healthy)   0.0.0.0:8181->8181/tcp
api-backend       backend     running (healthy)   0.0.0.0:9000->9000/tcp
keycloak          keycloak    running (healthy)   0.0.0.0:8081->8080/tcp
api-gateway       kong        running (healthy)   0.0.0.0:8000->8000/tcp, 0.0.0.0:8443->8443/tcp, 0.0.0.0:8001->8001/tcp
api-frontend      frontend    running (healthy)   0.0.0.0:5173->80/tcp
loki              loki        running (healthy)   0.0.0.0:3100->3100/tcp
promtail          promtail    running
grafana           grafana     running (healthy)   0.0.0.0:3000->3000/tcp
```

### 3.3 Seed dữ liệu

```bash
# Tạo bảng + synthetic data (50 records/bảng)
docker compose exec backend python -m app.db.seed_data

# Kiểm tra data
docker compose exec postgres psql -U admin -d cloudapi -c "SELECT COUNT(*) FROM users;"
docker compose exec postgres psql -U admin -d cloudapi -c "SELECT COUNT(*) FROM products;"
docker compose exec postgres psql -U admin -d cloudapi -c "SELECT COUNT(*) FROM orders;"
# Kết quả mong đợi: 50 / 50 / 50
```

### 3.4 Kiểm tra API qua Kong

```bash
# Public endpoint (không cần token)
curl -i http://localhost:8000/api/v1/products

# Endpoint cần auth — sẽ trả 401
curl -i http://localhost:8000/api/v1/users

# Lấy token từ Keycloak (Client Credentials — cho test nhanh)
TOKEN=$(curl -s -X POST http://localhost:8081/realms/cloudapi/protocol/openid-connect/token \
  -d "client_id=backend-client" \
  -d "client_secret=<secret-from-keycloak>" \
  -d "grant_type=client_credentials" | jq -r '.access_token')

# Gọi API với token qua Kong
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/users

# Gọi trực tiếp backend (chỉ debug — bypass Kong)
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:9000/api/v1/users
```

### 3.5 Truy cập các UI

| Service | URL | Credentials |
|---|---|---|
| Kong Admin API | `http://localhost:8001` | — (internal admin port) |
| FastAPI Swagger | `http://localhost:9000/docs` | — (JWT required cho secured routes) |
| Keycloak Admin | `http://localhost:8081/admin` | `admin` / giá trị `KEYCLOAK_ADMIN_PASSWORD` trong `.env` |
| Keycloak OIDC | `http://localhost:8081/realms/cloudapi` | — |
| Keycloak JWKS | `http://localhost:8081/realms/cloudapi/protocol/openid-connect/certs` | — |
| Vault UI | `http://localhost:8200` | Token: `VAULT_DEV_ROOT_TOKEN_ID` trong `.env` |
| Grafana | `http://localhost:3000` | `admin` / `GF_SECURITY_ADMIN_PASSWORD` trong `.env` |
| OPA REST API | `http://localhost:8181/v1/policies` | — |
| Frontend | `http://localhost:5173` | Login thật qua Keycloak |

---

## 4. D2 — Linux VM + mTLS

> Deployment D2 chạy trên VM Ubuntu 22.04 với network segmentation:
> `dmz` (192.168.10.x), `private` (10.10.0.x), `mgmt` (10.20.0.x)

### 4.1 Chuẩn bị VM

```bash
# Cài dependencies trên VM
sudo apt update && sudo apt install -y nginx openssl python3-pip

# Copy project lên VM
scp -r ./Cloud_API_Security user@<vm-ip>:~/
ssh user@<vm-ip>
cd ~/Cloud_API_Security
```

### 4.2 Tạo certificates mTLS

```bash
cd DEPLOY/D2/certs

# Tạo CA (RSA 4096)
openssl req -x509 -newkey rsa:4096 \
  -keyout ca.key -out ca.crt \
  -days 365 -nodes \
  -subj "/CN=Lab-CA"

# Tạo cert cho service (với SAN)
openssl req -newkey rsa:2048 -nodes -keyout svc.key \
  -out svc.csr -subj "/CN=api-service"
openssl x509 -req -in svc.csr -CA ca.crt -CAkey ca.key \
  -extfile san.conf -extensions SAN -out svc.crt -days 90
```

### 4.3 Cấu hình iptables network segmentation

```bash
cd DEPLOY/D2
chmod +x iptables.sh
sudo bash iptables.sh

# Kiểm tra rules
sudo iptables -L -n --line-numbers
```

### 4.4 Khởi động NGINX gateway với mTLS

```bash
# Kiểm tra config trước
nginx -t -c $(pwd)/nginx.conf

# Start
sudo nginx -c $(pwd)/nginx.conf

# Test mTLS hoạt động
# Không cert → từ chối
curl https://10.10.0.x:8443/api/v1/users    # ERROR: certificate required

# Có cert → 200
curl --cert certs/svc.crt --key certs/svc.key --cacert certs/ca.crt \
  https://10.10.0.x:8443/api/v1/users       # 200 OK
```

### 4.5 Phân công zone D2

| Zone | Subnet | Thành phần |
|---|---|---|
| DMZ | `192.168.10.x` | NGINX reverse proxy (mTLS gateway) |
| Private | `10.10.0.x` | FastAPI, Keycloak, OPA, Vault, PostgreSQL, Redis |
| Mgmt | `10.20.0.x` | Grafana, Loki, Promtail |

---

## 5. Bootstrap secrets & keys

### 5.1 Khởi tạo Vault Transit Engine

```bash
export VAULT_ADDR=http://localhost:8200
export VAULT_TOKEN=root   # VAULT_DEV_ROOT_TOKEN_ID từ .env

# Enable transit engine
vault secrets enable transit

# Tạo DEK key (AES-256-GCM)
vault write -f transit/keys/dek type=aes256-gcm96

# Kiểm tra
vault list transit/keys
```

Script tự động:
```bash
bash vault/init/enable-transit.sh
```

### 5.2 Import Keycloak realm

Keycloak tự động import realm `cloudapi` từ mount volume khi container khởi động:
```yaml
volumes:
  - ./idp/keycloak/realm-export.json:/opt/keycloak/data/import/realm.json
```

Verify realm import:
```bash
curl http://localhost:8081/realms/cloudapi/.well-known/openid-configuration | jq .
# Phải thấy: "issuer": "http://localhost:8081/realms/cloudapi"
```

Import thủ công nếu cần:
```bash
docker compose exec keycloak \
  /opt/keycloak/bin/kc.sh import \
  --file /opt/keycloak/data/import/realm.json
```

### 5.3 Apply OPA policies

```bash
# OPA tự load từ volume mount /policies khi khởi động
# Verify deny-all active
curl http://localhost:8181/v1/data/authz/allow
# Kết quả: {"result": false}

# Chạy OPA unit tests
docker compose exec opa opa test /policies /tests -v
```

---

## 6. Frontend — Luồng tích hợp

> Frontend service chạy tại `:5173` — là service thứ 8 trong `docker compose ps`.

### 6.1 Luồng tích hợp đầy đủ

```
Browser (http://localhost:5173)
  ↓ PKCE redirect
Keycloak (http://localhost:8081/realms/cloudapi)
  ↓ authorization_code → access_token (JWT RS256)
Frontend (memory store)
  ↓ Authorization: Bearer <token>
  ↓ DPoP: <proof>  ← ephemeral ES256 key
Kong (http://localhost:8000)  ← JWT verify + OPA authz + rate-limit
  ↓ forward (nếu allow)
FastAPI (http://localhost:9000)  ← DPoP verify + BOLA check
  ↓ query (với AEAD decrypt)
PostgreSQL (localhost:5434)
```

> **Không gọi trực tiếp FastAPI `:9000` từ browser** — chỉ Kong `:8000`.

### 6.2 Verify frontend hoạt động

```bash
# 1. Kiểm tra container healthy
docker compose ps api-frontend
# STATUS: running (healthy)

# 2. Mở browser
open http://localhost:5173

# 3. Login với admin (Keycloak TOTP bắt buộc)
# Username: admin@lab.local  Password: admin123  OTP: (Google Authenticator)

# 4. Verify data thật từ Postgres hiển thị trên Dashboard
# 5. Mở DevTools → Network → kiểm tra mọi request có header:
#    Authorization: Bearer eyJ...
#    DPoP: eyJ...
```

### 6.3 Biến môi trường Frontend

```bash
VITE_KEYCLOAK_URL=http://localhost:8081
VITE_KONG_URL=http://localhost:8000
VITE_REALM=cloudapi
VITE_CLIENT_ID=spa-client
```

---

## 7. Health checks & Observability

### 7.1 Kiểm tra sức khỏe từng service

```bash
# Kong
curl http://localhost:8001/status

# Keycloak
curl http://localhost:8081/health/ready

# OPA
curl http://localhost:8181/health

# Vault
curl http://localhost:8200/v1/sys/health

# Backend
curl http://localhost:9000/health

# Loki
curl http://localhost:3100/ready
```

### 7.2 Xem logs

```bash
# Tất cả services
docker compose logs -f

# Từng service
docker compose logs -f kong
docker compose logs -f backend
docker compose logs -f opa

# Lọc log theo keyword
docker compose logs backend | grep "auth"
docker compose logs opa | grep "deny"
```

### 7.3 Grafana Dashboard

Dashboard **"API Security Monitor — NT219"** tự động load khi stack khởi động.

1. Mở `http://localhost:3000`
2. Login `admin` / `admin` (hoặc password từ `.env`)
3. Vào **Dashboards → General → API Security Monitor — NT219**
4. Xem panels:
   - Login Success vs Auth Failure (Keycloak realtime)
   - OPA Authorization Decisions (allow/deny)
   - HTTP Response Codes qua Kong (200/401/403/429)
   - DPoP Replay Attack Detection
   - Security Event Log (log thô tất cả services)

> Chạy attack scripts (`bola_attack.py`, `replay_dpop_attack.py`) rồi xem spike trên dashboard để lấy evidence.

**Troubleshoot nếu dashboard không hiện:**
```bash
docker compose restart grafana
# Nếu vẫn không hiện — xóa volume cũ:
docker compose down grafana
docker volume rm cloud_api_security_grafana_data
docker compose up -d grafana
```

### 7.4 Kiểm tra structured log format

```bash
docker compose logs backend | tail -5 | python3 -m json.tool
```

Ví dụ log đúng:
```json
{
  "timestamp": "2025-01-15T10:00:00Z",
  "level": "INFO",
  "correlation_id": "abc123",
  "trace_id": "xyz789",
  "method": "GET",
  "path": "/api/v1/users",
  "status": 200,
  "user_id": "u001",
  "duration_ms": 12
}
```

---

## 8. Chạy kiểm thử & Evaluation

### 8.1 Unit tests

```bash
# Backend unit tests
docker compose exec backend pytest tests/ -v --tb=short

# OPA policy tests (≥50 cases, pass rate ≥95%)
docker compose exec opa opa test opa/policies/ opa/tests/ -v
```

### 8.2 Integration tests

```bash
python3 tests/integration/test_api_flow.py
python3 tests/integration/test_auth_flow.py
python3 tests/integration/test_policy_flow.py
```

### 8.3 Attack simulations

```bash
# BOLA — truy cập resource của người khác
python3 scripts/attacks/bola_attack.py
# Expected: 403 Forbidden + log "deny: not_owner"

# JWT alg=none attack
python3 scripts/attacks/alg_none_attack.py
# Expected: 401 Unauthorized + log "deny: alg_none_rejected"

# DPoP replay attack
python3 scripts/attacks/replay_dpop_attack.py
# Expected: 401 + log "deny: dpop_replay"

# Nonce reuse test
python3 scripts/attacks/nonce_reuse_test.py
# Expected: AEAD error logged, request rejected
```

### 8.4 Evaluation scripts (theo invariants)

```bash
# E-C1: TLS — không rò rỉ plaintext
bash scripts/evaluation/e_c1_tls_capture.sh
# Output: tls_capture.pcap → EVIDENCE/captures/

# E-C2: DPoP nonce reuse (50 threads)
python3 scripts/evaluation/e_c2_nonce_test.py
# Expected: 1/50 pass, 49/50 → 401 replayed

# E-C3: AEAD integrity
python3 scripts/evaluation/e_c3_aead_integrity.py
# Expected: tampered ciphertext → InvalidTag → rejected

# E-N1: TOTP AuthN (100 tests)
python3 scripts/evaluation/e_n1_totp_test.py
# Expected: success ≥99%, false-accept=0

# E-X1: Key rotation SLA
bash scripts/evaluation/e_x1_rotation_test.sh
# Expected: rotation hoàn tất ≤10 phút

# E-Z1: OPA policy test suite
bash scripts/evaluation/e_z1_policy_test.sh
# Expected: ≥50 cases, pass-rate ≥95%, output JSON → EVIDENCE/security_scans/

# E-Z2: Token hardening (3 vectors)
bash scripts/evaluation/e_z2_token_hardening.sh
# Expected: alg=none, kid injection, alg confusion — tất cả bị block
```

### 8.5 SAST / DAST / Fuzzing

```bash
# SAST — Bandit
bash scripts/security_testing/run_sast.sh
# Output: EVIDENCE/security_scans/bandit_report.json

# DAST — OWASP ZAP (cần chạy thực, không chỉ skeleton!)
bash scripts/security_testing/run_dast.sh
# Output: EVIDENCE/security_scans/zap_report.html

# API Fuzzing — RESTler
bash scripts/security_testing/run_fuzz.sh
# Output: EVIDENCE/security_scans/restler_results/

# SCA — pip-audit
pip-audit -r backend/requirements.txt -o EVIDENCE/security_scans/sca_report.txt
```

---

## 9. Key rotation

### 9.1 Rotate DEK (Vault transit)

```bash
export VAULT_ADDR=http://localhost:8200
export VAULT_TOKEN=root

# Rotate key
vault write -f transit/keys/dek/rotate

# Kiểm tra version mới
vault read transit/keys/dek

# Force revoke key cũ:
vault write transit/keys/dek/config min_decryption_version=<new-version>
```

SLA: **≤10 phút** từ lúc trigger đến key mới active. Key cũ reject trong **≤24h**.

### 9.2 Rotate Keycloak signing key

```bash
curl -X POST http://localhost:8081/admin/realms/cloudapi/keys \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"rsa-generated","providerId":"rsa-generated","providerType":"org.keycloak.keys.KeyProvider"}'
```

### 9.3 Rotate mTLS certs (D2)

```bash
cd DEPLOY/D2/certs
openssl genrsa -out svc-new.key 2048
openssl req -new -key svc-new.key -out svc-new.csr -subj "/CN=backend-svc"
openssl x509 -req -days 90 -in svc-new.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out svc-new.crt
cp svc-new.crt svc.crt && cp svc-new.key svc.key
nginx -s reload
```

---

## 10. Xử lý lỗi thường gặp

### Container không healthy

```bash
docker compose logs <service-name> | tail -50
docker compose restart <service-name>
```

### Keycloak không import realm

```bash
# Kiểm tra format JSON
python3 -m json.tool idp/keycloak/realm-export.json > /dev/null

# Verify realm URL đúng (phải là "cloudapi", không phải "apirealm")
curl http://localhost:8081/realms/cloudapi/.well-known/openid-configuration | jq .issuer
# Expected: "http://localhost:8081/realms/cloudapi"

# Import thủ công qua UI: http://localhost:8081/admin → Create Realm → Upload file
```

### Vault sealed sau restart

```bash
docker compose restart vault
bash vault/init/vault-init.sh
```

### OPA policy load thất bại

```bash
opa check opa/policies/authz.rego
docker compose logs opa | grep "error"
```

### Kong không route request

```bash
curl http://localhost:8001/services
curl http://localhost:8001/routes
docker compose exec kong kong reload
```

### JWT bị reject khi alg hợp lệ

```bash
# Kiểm tra JWKS từ Keycloak (realm=cloudapi)
curl http://localhost:8081/realms/cloudapi/protocol/openid-connect/certs | jq .

# So sánh kid trong token với JWKS
echo "<jwt-token>" | python3 -c "
import sys, base64, json
token = sys.stdin.read().strip()
header = token.split('.')[0]
padded = header + '=='
print(json.loads(base64.b64decode(padded).decode()))
"
```

### Frontend không kết nối được Keycloak

```bash
# Verify Keycloak realm "cloudapi" (không phải apirealm)
curl http://localhost:8081/realms/cloudapi

# Verify biến môi trường frontend
docker compose exec api-frontend env | grep VITE

# Kiểm tra CORS backend cho :5173
docker compose logs backend | grep "CORS"
```

---

## 11. Dừng & Dọn dẹp

```bash
# Dừng tất cả container (giữ volumes)
docker compose down

# Dừng và xóa volumes (reset hoàn toàn)
docker compose down -v

# Xóa images đã build
docker compose down --rmi local

# Xóa tất cả (bao gồm networks)
docker compose down -v --remove-orphans
```

---

## BOM (Bill of Materials)

| Service | Image | Phiên bản | Port | Ghi chú |
|---|---|---|---|---|
| Kong | `kong:3.6` | **3.6** | 8000, 8443, 8001 | API Gateway + PEP |
| Keycloak | `quay.io/keycloak/keycloak:24.0` | **24.0** | 8081→8080 | IdP + OIDC, realm=**cloudapi** |
| OPA | `openpolicyagent/opa:0.65.0` | **0.65.0** | 8181 | PDP + Rego |
| HashiCorp Vault | `hashicorp/vault:1.15` | **1.15** | 8200 | KMS + Transit |
| PostgreSQL | `postgres:16` | **16** | 5434→5432 | Database, DB=cloudapi |
| Redis | `redis:7` | **7** | 6379 | DPoP jti store |
| Grafana Loki | `grafana/loki:2.9.0` | **2.9.0** | 3100 | Log aggregation |
| Grafana | `grafana/grafana:10.0.0` | **10.0.0** | 3000 | Dashboard |
| Promtail | `grafana/promtail:2.9.0` | **2.9.0** | — | Log shipper |
| Frontend | `./frontend/Dockerfile` | — | 5173→80 | React + Vite SPA |
| FastAPI | `./backend/Dockerfile` | 0.110.0 | 9000 | Backend framework |
| cryptography | pip | 42.0.5 | — | AES-256-GCM AEAD |
| python-jose | pip | 3.3.0 | — | JWT verify |
| pyotp | pip | 2.9.0 | — | TOTP |

---

*Deployment ID: D1 (Docker Compose — 11 services) + D2 (Linux VM mTLS) | NT219 Capstone — UIT*
# DEPLOY/D1 — Runbook
**Đề tài:** Cloud API-Based Network Application Security for Small Company Services
**Môn học:** NT219.Q21.ANTT — Mật mã học
**Phiên bản Runbook:** 0.1-skeleton (tuần 2)
**Trạng thái:** Draft — các mục đánh dấu `[TODO Week 3]` sẽ được điền đầy đủ ở tuần 3

---

## Mục lục

1. [Bill of Materials (BOM)](#1-bill-of-materials-bom)
2. [Trust Boundaries](#2-trust-boundaries)
3. [Prerequisites & Checklist trước khi deploy](#3-prerequisites--checklist-trước-khi-deploy)
4. [Quy trình khởi động (Startup Procedure)](#4-quy-trình-khởi-động-startup-procedure)
5. [Smoke Test & Health Check](#5-smoke-test--health-check)
6. [Rollback Procedure](#6-rollback-procedure)
7. [Incident Response](#7-incident-response)
8. [Maintenance & Key Rotation](#8-maintenance--key-rotation)

---

## 1. Bill of Materials (BOM)

Danh sách đầy đủ tất cả services, image và version được sử dụng trong triển khai D1 (single-node Docker Compose).

### 1.1 Core Infrastructure Services

| Service | Docker Image | Version | Port (host→container) | Vai trò |
|---------|-------------|---------|----------------------|---------|
| **Kong Gateway** | `kong/kong-gateway` | `3.9.x` | `8000→8000`, `8443→8443`, `8001→8001` | API Gateway / PEP — cửa ngõ duy nhất từ client vào hệ thống |
| **Keycloak** | `quay.io/keycloak/keycloak` | `26.x` | `8081→8080` | Identity Provider — OIDC, PKCE, TOTP, refresh token rotation |
| **OPA** | `openpolicyagent/opa` | `0.71.x` | `8181→8181` | Policy Decision Point — đánh giá Rego, trả `{allow, reason}` |
| **HashiCorp Vault** | `hashicorp/vault` | `1.18.x` | `8200→8200` | KMS — Transit Engine, envelope encryption DEK/KEK |
| **PostgreSQL** | `postgres` | `16.x` | `5434→5432` | Relational DB — lưu ciphertext AEAD (KHÔNG lưu plaintext) |
| **Redis** | `redis` | `7.x` | `6379→6379` | In-memory store — DPoP `jti` anti-replay với TTL |

### 1.2 Application Services

| Service | Image / Build | Version / Tag | Port | Vai trò |
|---------|--------------|--------------|------|---------|
| **FastAPI Backend** | `./backend` (build local) | `latest` / commit SHA | `9000→9000` | Business logic, DPoP verify, BOLA check, OPA client |
| **React Frontend** | `./frontend` (build local) | `latest` / commit SHA | `5173→5173` | SPA — PKCE + DPoP, route guard theo role |

### 1.3 Observability Stack

| Service | Docker Image | Version | Port | Vai trò |
|---------|-------------|---------|------|---------|
| **Grafana** | `grafana/grafana` | `11.x` | `3000→3000` | Dashboard — metrics, log visualization |
| **Loki** | `grafana/loki` | `3.x` | `3100→3100` | Log aggregation backend |
| **Promtail** | `grafana/promtail` | `3.x` | — (internal) | Log shipper — thu thập log từ containers → Loki |

### 1.4 Runtime Dependencies (trong container)

| Dependency | Version | Dùng trong |
|-----------|---------|-----------|
| Python | `3.12.x` | FastAPI Backend |
| FastAPI | `0.115.x` | FastAPI Backend |
| `python-jose` | `3.x` | JWT RS256 verify |
| `pyotp` | `2.x` | TOTP verify |
| `cryptography` | `43.x` | AES-256-GCM / AEAD |
| Node.js | `20.x LTS` | Frontend build (Vite) |
| React | `18.x` | Frontend SPA |
| Vite | `5.x` | Frontend bundler |
| Lua | `5.1.x` (built-in Kong) | Kong custom plugins |

---

## 2. Trust Boundaries

Hệ thống được chia thành **3 network zone** cô lập bằng Docker networks. Giao tiếp cross-zone đi qua các điểm kiểm soát rõ ràng — không có kết nối ngang (lateral) tùy ý.

### 2.1 Sơ đồ tổng quan Trust Zones

```
┌──────────────────────────────────────────────────────────────────────┐
│                         INTERNET / USER BROWSER                      │
│                     (Untrusted — Zero Trust Model)                   │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
   HTTPS :8000/:8443      HTTPS :8081               HTTP :5173
     (API Gateway)        (Keycloak)              (Frontend SPA)
        │                       │                        │
        ▼                       ▼                        ▼

┌──────────────────────────────────────────────────────────────────────┐
│                         ZONE 1: edge-net (DMZ)                       │
│                                                                      │
│     ┌────────────┐      ┌────────────┐      ┌──────────────┐         │
│     │ Frontend   │◄────►│   Kong     │◄────►│  Keycloak    │         │
│     │  :5173     │      │  :8000     │      │   :8081      │         │
│     └────────────┘      └────────────┘      └──────────────┘         │
│                                                                      │
│  Traffic Rules:                                                      │
│  • Browser → Frontend   : Load SPA assets                            │
│  • Browser → Kong       : ALL API requests                           │
│  • Browser → Keycloak   : Login / Token refresh ONLY                 │
│  • Kong → Keycloak      : Fetch JWKS for JWT verification            │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                │  Forward request (JWT + DPoP)
                                │  (Internal traffic only)
                                ▼

┌──────────────────────────────────────────────────────────────────────┐
│                    ZONE 2: internal-net (Private)                    │
│                                                                      │
│     ┌────────────┐        ┌──────────────┐                           │
│     │   Kong     │───────►│   FastAPI    │                           │
│     └────────────┘        │    :9000     │                           │
│                           └──────┬───────┘                           │
│                                  │                                   │
│        ┌──────────────┬──────────┼──────────┬──────────────┐         │
│        ▼              ▼          ▼          ▼              ▼         │
│   ┌────────┐   ┌──────────┐ ┌────────┐ ┌────────────┐ ┌────────┐     │
│   │  OPA   │   │  Vault   │ │Postgres│ │   Redis    │ │ (Other)│     
│   │ :8181  │   │  :8200   │ │ :5432  │ │  :6379     │ │        │     │
│   └────────┘   └──────────┘ └────────┘ └────────────┘ └────────┘     │
│                                                                      │
│  Internal Flows:                                                     │
│  • Kong → FastAPI     : Forward validated request                    │
│  • FastAPI → OPA      : AuthZ check {subject, action, resource}      │
│  • FastAPI → Vault    : Encrypt / Decrypt sensitive data             │
│  • FastAPI → Postgres : Store ciphertext ONLY                        │
│  • FastAPI → Redis    : SET NX (jti) → Prevent DPoP replay           │
│                                                                      │
│(!) FastAPI :9000 MUST NOT be exposed publicly                        |
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                │  Logs collection (Promtail)
                                ▼

┌──────────────────────────────────────────────────────────────────────┐
│                   ZONE 3: obs-net (Observability)                    │
│                         (Isolated Network)                           │
│                                                                      │
│     ┌────────────┐      ┌────────────┐      ┌────────────┐           │
│     │ Promtail   │─────►│    Loki    │─────►│  Grafana   │           │
│     │            │      │   :3100    │      │   :3000    │           │
│     └────────────┘      └────────────┘      └────────────┘           │
│                                                                      │
│  Observability Flow:                                                 │
│  • Promtail → Loki   : Push logs from all containers                 │
│  • Grafana → Loki    : Query logs / dashboards                       │
│                                                                      │
│      Grafana MUST be internal-only (no public exposure)              │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Ma trận giao tiếp (Communication Matrix)

| Nguồn (Source) | Đích (Destination) | Cho phép? | Giao thức / Port | Ghi chú |
|---------------|-------------------|-----------|-----------------|---------|
| Browser | Kong | ✅ | HTTPS `:8000` / `:8443` | TLS 1.3, mọi API call |
| Browser | Keycloak | ✅ | HTTPS `:8081` | Chỉ login flow / refresh token |
| Browser | FastAPI | ❌ | — | Blocked — FastAPI chỉ nhận từ Kong |
| Kong | FastAPI | ✅ | HTTP (internal-net) `:9000` | Sau khi pass JWT format check |
| Kong | Keycloak | ✅ | HTTP (internal/edge) `:8080` | Lấy JWKS để verify RS256/kid |
| Kong | OPA | ✅ | HTTP (internal-net) `:8181` | Plugin `opa-authz.lua` — PEP→PDP |
| FastAPI | OPA | ✅ | HTTP (internal-net) `:8181` | Business-level authz query |
| FastAPI | Vault | ✅ | HTTP (internal-net) `:8200` | Transit encrypt/decrypt DEK |
| FastAPI | PostgreSQL | ✅ | TCP (internal-net) `:5432` | Chỉ ghi ciphertext |
| FastAPI | Redis | ✅ | TCP (internal-net) `:6379` | DPoP jti `SET NX` với TTL |
| OPA | bất kỳ | ❌ | — | OPA là passive PDP, không tự gọi ra ngoài |
| Vault | bất kỳ | ❌ | — | Vault chỉ nhận request, không tự gọi |
| Promtail | Loki | ✅ | HTTP (obs-net) `:3100` | Log shipping |
| Grafana | Loki | ✅ | HTTP (obs-net) `:3100` | Log query |

### 2.3 Nguyên tắc Trust Boundary

- **Deny by default:** Mọi giao tiếp không được liệt kê trong bảng trên đều bị block ở tầng network (Docker network isolation).
- **Kong là cửa ngõ duy nhất:** Mọi request từ client vào backend phải đi qua Kong. FastAPI `:9000` không bao giờ được expose trực tiếp ra internet.
- **Keycloak chỉ tham gia lúc login:** Sau khi đã có access token, Keycloak không nằm trong luồng request thông thường. Kong chỉ cần lấy JWKS một lần và cache lại.
- **OPA là passive:** OPA không tự kết nối ra ngoài — chỉ nhận query và trả về quyết định.
- **Obs-net hoàn toàn tách biệt:** Stack observability không có đường vào internal-net hay edge-net.

---

## 3. Prerequisites & Checklist trước khi deploy

> **[TODO Week 3]** — Mục này sẽ được điền đầy đủ ở tuần 3.

Placeholder nội dung dự kiến:
- Yêu cầu phần cứng / OS tối thiểu
- Docker Engine & Docker Compose version yêu cầu
- File `.env` — các biến bắt buộc phải có trước khi chạy
- Kiểm tra cert / TLS certs cho Kong
- Checklist port conflict

---

## 4. Quy trình khởi động (Startup Procedure)

> **[TODO Week 3]** — Mục này sẽ được điền đầy đủ ở tuần 3.

Placeholder nội dung dự kiến:
- Thứ tự khởi động services (PostgreSQL → Vault → Keycloak → Kong → Backend → Frontend)
- Vault unseal procedure (nếu không dùng dev mode)
- Keycloak realm import (`realm-export.json`)
- Seed data khởi tạo (`seed_data.py`)
- Xác nhận 11 services `healthy`

---

## 5. Smoke Test & Health Check

> **[TODO Week 3]** — Mục này sẽ được điền đầy đủ ở tuần 3.

Placeholder nội dung dự kiến:
- `curl http://localhost:8000/health` qua Kong
- Lấy token client_credentials và gọi API thử
- Chạy `scripts/evaluation/` để verify 7 invariants (I1–I7)
- Kiểm tra Grafana dashboard lên đủ data

---

## 6. Rollback Procedure

> **[TODO Week 3]** — Mục này sẽ được điền đầy đủ ở tuần 3.

Placeholder nội dung dự kiến:
- Rollback Docker image về tag trước
- Restore PostgreSQL dump
- Re-import Vault snapshot nếu key bị corrupt
- Keycloak realm rollback

---

## 7. Incident Response

> **[TODO Week 3]** — Mục này sẽ được điền đầy đủ ở tuần 3.

Placeholder nội dung dự kiến:
- Phân loại sự cố (P1/P2/P3)
- Quy trình ứng phó token leak
- Quy trình ứng phó database breach (ciphertext exposed)
- Liên hệ escalation

---

## 8. Maintenance & Key Rotation

> **[TODO Week 3]** — Mục này sẽ được điền đầy đủ ở tuần 3.

Placeholder nội dung dự kiến:
- Vault Transit key rotation (`e_x1_rotation_test.sh`) — SLA ≤ 10 phút
- Keycloak JWKS rotation
- Redis TTL tuning cho DPoP jti
- Log retention policy (Loki)

---

*Runbook này được duy trì bởi nhóm NT219.Q21.ANTT — lần cập nhật gần nhất: Tuần 2.*