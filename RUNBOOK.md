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
# Tất cả container phải HEALTHY
docker compose ps

# Ping qua Kong (không cần token)
curl http://localhost:8000/api/v1/products

# Mở Swagger UI của backend
open http://localhost:9000/docs   # macOS
xdg-open http://localhost:9000/docs   # Linux
```

### Port mapping (Docker Compose D1)

| Service | URL | Ghi chú |
|---|---|---|
| 🌐 FastAPI Backend | `http://localhost:9002/docs` | Swagger UI, debug trực tiếp |
| ⚡ Kong API Gateway | `http://localhost:8000/api` | Entry point chính — dùng port này để test |
| 🔑 Keycloak Admin | `http://localhost:8081` | UI: `/admin` · OIDC: `/realms/apirealm` |
| 📋 OPA | `http://localhost:8181` | REST API: `/v1/policies`, `/v1/data` |
| 🔐 Vault UI | `http://localhost:8200` | Token: giá trị `VAULT_DEV_ROOT_TOKEN_ID` trong `.env` |
| 📊 Grafana | `http://localhost:3000` | `admin` / `GF_SECURITY_ADMIN_PASSWORD` trong `.env` |

> ⚠️ **Lưu ý:** FastAPI chạy nội bộ ở port `9000`, **không expose ra ngoài trực tiếp** — mọi request từ client phải đi qua Kong `:8000` để qua JWT verify, rate-limit và OPA authz.

---

## Mục lục

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Clone & cấu hình ban đầu](#2-clone--cấu-hình-ban-đầu)
3. [D1 — Docker Compose (Local)](#3-d1--docker-compose-local)
4. [D2 — Linux VM + mTLS](#4-d2--linux-vm--mtls)
5. [Bootstrap secrets & keys](#5-bootstrap-secrets--keys)
6. [Health checks & Observability](#6-health-checks--observability)
7. [Chạy kiểm thử & Evaluation](#7-chạy-kiểm-thử--evaluation)
8. [Key rotation](#8-key-rotation)
9. [Xử lý lỗi thường gặp](#9-xử-lý-lỗi-thường-gặp)
10. [Dừng & Dọn dẹp](#10-dừng--dọn-dẹp)

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
KC_DB_PASSWORD=<strong-password>

# Postgres
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=apidb

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

### 3.2 Kiểm tra tất cả container healthy

```bash
docker compose ps
```

Kết quả mong muốn — tất cả `STATUS` là `running (healthy)`:

```
NAME         SERVICE     STATUS              PORTS
kong         gateway     running (healthy)   0.0.0.0:8000->8000/tcp
keycloak     idp         running (healthy)   0.0.0.0:8081->8080/tcp
opa          opa         running (healthy)   0.0.0.0:8181->8181/tcp
vault        vault       running (healthy)   0.0.0.0:8200->8200/tcp
postgres     db          running (healthy)   5434/tcp
loki         loki        running (healthy)   3100/tcp
grafana      grafana     running (healthy)   0.0.0.0:3000->3000/tcp
backend      backend     running (healthy)   0.0.0.0:9002->9000/tcp
```

### 3.3 Seed dữ liệu

```bash
# Tạo bảng + synthetic data (50 records/bảng)
docker compose exec backend python -m app.db.seed_data

# Kiểm tra data
docker compose exec postgres psql -U postgres -d apidb -c "SELECT COUNT(*) FROM users;"
```

### 3.4 Kiểm tra API qua Kong

```bash
# Public endpoint (không cần token)
curl -i http://localhost:8000/api/v1/products

# Endpoint cần auth — sẽ trả 401
curl -i http://localhost:8000/api/v1/users

# Lấy token từ Keycloak (PKCE flow đơn giản cho test)
TOKEN=$(curl -s -X POST http://localhost:8081/realms/apirealm/protocol/openid-connect/token \
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
| FastAPI Swagger | `http://localhost:9002/docs` | — (JWT required cho secured routes) |
| Keycloak Admin | `http://localhost:8081/admin` | `admin` / giá trị `KEYCLOAK_ADMIN_PASSWORD` trong `.env` |
| Keycloak OIDC | `http://localhost:8081/realms/apirealm` | — |
| Vault UI | `http://localhost:8200` | Token: `VAULT_DEV_ROOT_TOKEN_ID` trong `.env` |
| Grafana | `http://localhost:3000` | `admin` / `GF_SECURITY_ADMIN_PASSWORD` trong `.env` |
| OPA REST API | `http://localhost:8181/v1/policies` | — |

---

## 4. D2 — Linux VM + mTLS

> Deployment D2 chạy trên VM Ubuntu 22.04 với network segmentation:  
> `private` (services ↔ DB), `dmz` (gateway ↔ internet), `mgmt` (ops)

### 4.1 Chuẩn bị VM

```bash
# Cài dependencies trên VM
sudo apt update && sudo apt install -y nginx openssl python3-pip vault

# Copy project lên VM
scp -r ./Cloud_Api_Security user@<vm-ip>:~/
ssh user@<vm-ip>
cd ~/Cloud_Api_Security
```

### 4.2 Tạo certificates mTLS

```bash
cd DEPLOY/D2/certs

# Tạo CA
openssl genrsa -out ca.key 4096
openssl req -new -x509 -days 365 -key ca.key -out ca.crt \
  -subj "/CN=Internal-CA/O=APIProject"

# Tạo cert cho backend service
openssl genrsa -out svc.key 2048
openssl req -new -key svc.key -out svc.csr \
  -subj "/CN=backend-svc/O=APIProject"
openssl x509 -req -days 365 -in svc.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out svc.crt
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

# Kiểm tra mTLS hoạt động
curl --cert certs/svc.crt --key certs/svc.key --cacert certs/ca.crt \
  https://localhost:443/api/v1/products
```

### 4.5 Khởi động backend services trên VM

```bash
cd ~/Cloud_Api_Security
pip3 install -r backend/requirements.txt
uvicorn backend.app.main:app --host 127.0.0.1 --port 8001 &

# Vault dev mode
vault server -dev -dev-root-token-id="$VAULT_DEV_ROOT_TOKEN_ID" &
bash vault/init/vault-init.sh
```

---

## 5. Bootstrap secrets & keys

### 5.1 Khởi tạo Vault Transit Engine

```bash
export VAULT_ADDR=http://localhost:8200
export VAULT_TOKEN=<root-token-từ-.env>

# Enable transit engine
vault secrets enable transit

# Tạo DEK key
vault write -f transit/keys/dek type=aes256-gcm96

# Kiểm tra
vault list transit/keys
```

Script tự động:
```bash
bash vault/init/enable-transit.sh
```

### 5.2 Import Keycloak realm

```bash
# Import realm với clients, roles, TOTP settings
docker compose exec keycloak \
  /opt/keycloak/bin/kc.sh import \
  --file /opt/keycloak/data/import/realm-export.json

# Verify realm import
curl http://localhost:8081/realms/apirealm/.well-known/openid-configuration | jq .
```

### 5.3 Apply OPA policies

```bash
# Load policies vào OPA
curl -X PUT http://localhost:8181/v1/policies/authz \
  -H "Content-Type: text/plain" \
  --data-binary @opa/policies/authz.rego

curl -X PUT http://localhost:8181/v1/policies/admin \
  -H "Content-Type: text/plain" \
  --data-binary @opa/policies/admin.rego

# Chạy OPA unit tests
docker compose exec opa opa test /policies /tests -v
```

---

## 6. Health checks & Observability

### 6.1 Kiểm tra sức khỏe từng service

```bash
# Kong
curl http://localhost:8001/status

# Keycloak
curl http://localhost:8081/health/ready

# OPA
curl http://localhost:8181/health

# Vault
curl http://localhost:8200/v1/sys/health

# Backend (trực tiếp)
curl http://localhost:9000/health
```

### 6.2 Xem logs

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

### 6.3 Grafana Dashboard

1. Mở http://localhost:3000
2. Login `admin` / password từ `.env`
3. Vào **Dashboards → API Security Dashboard**
4. Xem panels:
   - Request count by status code
   - Auth failures per minute
   - OPA deny decisions
   - Rate limit hits

### 6.4 Kiểm tra structured log format

```bash
# Log phải có dạng JSON với correlation_id và trace_id
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

## 7. Chạy kiểm thử & Evaluation

### 7.1 Unit tests

```bash
# Backend unit tests
docker compose exec backend pytest tests/ -v --tb=short

# OPA policy tests
docker compose exec opa opa test opa/policies/ opa/tests/ -v
```

### 7.2 Integration tests

```bash
# Toàn bộ API flow
python3 tests/integration/test_api_flow.py

# Auth flow (PKCE + token + refresh)
python3 tests/integration/test_auth_flow.py

# Policy flow
python3 tests/integration/test_policy_flow.py
```

### 7.3 Attack simulations

```bash
# BOLA — truy cập resource của người khác
python3 scripts/attacks/bola_attack.py
# Expected: 403 Forbidden + log "deny: not_owner"

# JWT alg=none attack
python3 scripts/attacks/alg_none_attack.py
# Expected: 401 Unauthorized + log "deny: invalid_alg"

# DPoP replay attack
python3 scripts/attacks/replay_dpop_attack.py
# Expected: 401 + log "deny: dpop_replay"

# Nonce reuse test
python3 scripts/attacks/nonce_reuse_test.py
# Expected: AEAD error logged, request rejected
```

### 7.4 Evaluation scripts (theo invariants)

```bash
# E-C1: TLS — không rò rỉ plaintext
bash scripts/evaluation/e_c1_tls_capture.sh
# Output: tls_capture.pcap → verify 0 byte plaintext

# E-C2: Nonce discipline
python3 scripts/evaluation/e_c2_nonce_test.py
# Expected: 0 nonce reuse dưới tải cao

# E-C3: AEAD integrity
python3 scripts/evaluation/e_c3_aead_integrity.py
# Expected: tampered ciphertext → rejected

# E-N1: TOTP AuthN
python3 scripts/evaluation/e_n1_totp_test.py
# Expected: success ≥ 99%, false-accept = 0

# E-X1: Key rotation SLA
bash scripts/evaluation/e_x1_rotation_test.sh
# Expected: rotation hoàn tất ≤ 10 phút

# E-Z1: AuthZ policy matrix
bash scripts/evaluation/e_z1_policy_test.sh
# Expected: pass-rate ≥ 95%, undeclared action deny = 100%

# E-Z2: Token hardening
bash scripts/evaluation/e_z2_token_hardening.sh
# Expected: alg=none reject, kid injection reject, header confusion reject
```

---

## 8. Key rotation

### 8.1 Rotate DEK (Vault transit)

```bash
export VAULT_ADDR=http://localhost:8200
export VAULT_TOKEN=<root-token>

# Rotate key
vault write -f transit/keys/dek/rotate

# Kiểm tra version mới
vault read transit/keys/dek

# Key cũ bị revoke sau 24h (tự động qua TTL policy)
# Để force revoke ngay:
vault write transit/keys/dek/config min_decryption_version=<new-version>
```

SLA: **≤ 10 phút** từ lúc trigger đến key mới active. Key cũ reject trong **≤ 24h**.

### 8.2 Rotate Keycloak signing key

```bash
# Qua Keycloak Admin API
curl -X POST http://localhost:8081/admin/realms/apirealm/keys \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"rsa-generated","providerId":"rsa-generated","providerType":"org.keycloak.keys.KeyProvider"}'
```

### 8.3 Rotate mTLS certs (D2)

```bash
cd DEPLOY/D2/certs

# Tạo cert mới
openssl genrsa -out svc-new.key 2048
openssl req -new -key svc-new.key -out svc-new.csr \
  -subj "/CN=backend-svc/O=APIProject"
openssl x509 -req -days 365 -in svc-new.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out svc-new.crt

# Swap cert (zero-downtime)
cp svc-new.crt svc.crt && cp svc-new.key svc.key
nginx -s reload
```

---

## 9. Xử lý lỗi thường gặp

### Container không healthy

```bash
# Xem lý do
docker compose logs <service-name> | tail -50

# Restart service cụ thể
docker compose restart <service-name>
```

### Keycloak không import realm

```bash
# Kiểm tra format JSON
python3 -m json.tool idp/keycloak/realm-export.json > /dev/null

# Import thủ công qua UI
# Mở http://localhost:8081/admin → Create Realm → Upload file
```

### Vault sealed sau restart

```bash
# Unseal Vault (dev mode tự unseal, prod mode cần unseal keys)
vault operator unseal <unseal-key>

# Hoặc restart ở dev mode
docker compose restart vault
bash vault/init/vault-init.sh
```

### OPA policy load thất bại

```bash
# Kiểm tra syntax Rego
opa check opa/policies/authz.rego

# Xem logs OPA
docker compose logs opa | grep "error"
```

### Kong không route request

```bash
# Kiểm tra Kong config
curl http://localhost:8001/services
curl http://localhost:8001/routes

# Apply lại declarative config
docker compose exec kong kong reload
```

### JWT bị reject khi alg hợp lệ

```bash
# Kiểm tra JWKS từ Keycloak
curl http://localhost:8080/realms/apirealm/protocol/openid-connect/certs | jq .

# So sánh kid trong token với JWKS
echo "<jwt-token>" | python3 -c "
import sys, base64, json
token = sys.stdin.read().strip()
header = token.split('.')[0]
print(json.loads(base64.b64decode(header + '==').decode()))
"
```

---

## 10. Dừng & Dọn dẹp

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

| Service | Image / Package | Phiên bản | Ghi chú |
|---|---|---|---|
| Kong | `kong:3.6-ubuntu` | 3.6 | API Gateway + PEP |
| Keycloak | `quay.io/keycloak/keycloak:24.0` | 24.0 | IdP + OIDC |
| OPA | `openpolicyagent/opa:0.65.0` | 0.65.0 | PDP + Rego |
| HashiCorp Vault | `hashicorp/vault:1.16` | 1.16 | KMS + Transit |
| PostgreSQL | `postgres:16-alpine` | 16 | Database |
| Grafana Loki | `grafana/loki:2.9.5` | 2.9.5 | Log aggregation |
| Grafana | `grafana/grafana:10.3.3` | 10.3.3 | Dashboard |
| Promtail | `grafana/promtail:2.9.5` | 2.9.5 | Log shipper |
| FastAPI | `fastapi==0.110.0` | 0.110.0 | Backend framework |
| cryptography | `cryptography==42.0.5` | 42.0.5 | AES-256-GCM AEAD |
| python-jose | `python-jose==3.3.0` | 3.3.0 | JWT verify |
| pyotp | `pyotp==2.9.0` | 2.9.0 | TOTP |

---

*Deployment ID: D1 (Docker Compose) + D2 (Linux VM mTLS) | NT219 Capstone — UIT*