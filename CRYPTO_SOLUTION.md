# CRYPTO_SOLUTION — Giải pháp Mật mã 3 Lớp

> **Đề tài:** Cloud API-Based Network Application Security for Small Company Services
> **Môn:** NT219.Q21.ANTT — Mật mã học | UIT
> **Stack:** Kong 3.6 · Keycloak 24.0 (realm: **lab**) · HashiCorp Vault **1.15** · FastAPI 0.110.0 · OPA 0.65.0

---

## Tổng quan kiến trúc mật mã

Hệ thống áp dụng **Defense-in-Depth** với 3 lớp mật mã độc lập. Mỗi lớp bảo vệ một thuộc tính bảo mật riêng biệt: **Confidentiality** (bí mật), **Authentication** (xác thực danh tính), và **Authorization** (kiểm soát quyền truy cập). Một attacker phải phá vỡ cả 3 lớp đồng thời mới có thể xâm phạm hệ thống.

```
┌─────────────────────────────────────────────────────────────────┐
│  LỚP 1 — CRYPTO (Bảo vệ dữ liệu)                                │
│  TLS 1.3 truyền tải · AES-256-GCM lưu trữ · KEK/DEK Vault 1.15  │
├─────────────────────────────────────────────────────────────────┤
│  LỚP 2 — AuthN (Xác thực danh tính)                             │
│  TOTP / PKCE · JWT RS256 · DPoP (RFC 9449) / mTLS               │
├─────────────────────────────────────────────────────────────────┤
│  LỚP 3 — AuthZ (Kiểm soát quyền)                                │
│  OPA Rego · deny-by-default · RBAC → ABAC · 100% decision log   │
├─────────────────────────────────────────────────────────────────┤
│  WAF EQUIVALENT — Kong + OPA (phù hợp SME)                      │
│  Rate-limit · JWT malformed block · HSTS · Policy enforcement   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Lớp 1 — CRYPTO: Bảo vệ Dữ liệu

### 1.1 Bảo vệ Truyền tải: TLS 1.3

**Chuẩn áp dụng:** RFC 8446 — The Transport Layer Security (TLS) Protocol Version 1.3

Tất cả kết nối từ client đến Kong và từ Kong đến backend đều bắt buộc TLS 1.3. Không có fallback về TLS 1.2.

**Cấu hình tại Kong (gateway/kong.conf):**
```nginx
ssl_protocols TLSv1.3;
ssl_ciphers TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256;
ssl_session_tickets off;   # Chống session resumption attack
```

**Cấu hình tại NGINX D2 (DEPLOY/D2/nginx.conf):**
```nginx
ssl_protocols TLSv1.3;
ssl_early_data off;        # Tắt 0-RTT — chống replay tại TLS layer
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

**Thuộc tính bảo mật đạt được:**
- **Forward Secrecy:** ECDHE key exchange — session key cũ không bị lộ dù private key bị compromise sau này.
- **AEAD tích hợp:** AES-256-GCM và ChaCha20-Poly1305 đều là AEAD — đảm bảo cả confidentiality lẫn integrity ở tầng transport.
- **0-RTT tắt:** Ngăn TLS resumption replay attack.
- **HSTS:** Buộc browser dùng HTTPS, ngăn SSL stripping.

**Kiểm tra (Invariant I1 — E-C1.md):**
```bash
bash scripts/evaluation/e_c1_tls_capture.sh
# Capture 60s traffic → tls_capture.pcap
# Verify: 0 byte plaintext trong EVIDENCE/captures/tls_capture.pcap
```

---

### 1.2 Bảo vệ Lưu trữ: AES-256-GCM (AEAD)

**Chuẩn áp dụng:** NIST SP 800-38D — GCM Mode; NIST SP 800-57 — Key Management

Dữ liệu nhạy cảm (email, địa chỉ, thông tin cá nhân) được mã hóa trước khi lưu vào PostgreSQL. Mỗi record có nonce riêng — không bao giờ tái sử dụng.

**Thuật toán:** AES-256-GCM (AEAD)
- Key size: 256-bit DEK
- IV/Nonce: 96-bit (`os.urandom(12)`) — random per-record
- Auth tag: 128-bit
- Thư viện: `cryptography==42.0.5` (PyCA)

**Triển khai (backend/app/security/aead_encryption.py):**
```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

class AEADEncryption:
    def encrypt(self, plaintext: bytes, dek: bytes) -> dict:
        """Mã hóa với nonce random per-record."""
        nonce = os.urandom(12)          # 96-bit IV — NIST SP 800-38D §8.2
        aesgcm = AESGCM(dek)           # AES-256-GCM
        ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data=None)
        return {
            "nonce": nonce.hex(),       # Lưu cùng record — không secret
            "ciphertext": ciphertext.hex()
        }

    def decrypt(self, ciphertext_hex: str, nonce_hex: str, dek: bytes) -> bytes:
        """Giải mã và verify AEAD tag."""
        aesgcm = AESGCM(dek)
        ciphertext = bytes.fromhex(ciphertext_hex)
        nonce = bytes.fromhex(nonce_hex)
        # Raises InvalidTag nếu ciphertext bị tamper → tự động reject
        return aesgcm.decrypt(nonce, ciphertext, associated_data=None)
```

**Tại sao GCM an toàn hơn CBC:**

| Thuộc tính | AES-CBC | AES-256-GCM |
|---|---|---|
| Confidentiality | ✅ | ✅ |
| Integrity | ❌ (cần HMAC riêng) | ✅ (AEAD built-in) |
| Padding oracle | ❌ Dễ bị tấn công | ✅ Không có padding |
| Nonce reuse | N/A | ❌ Catastrophic — nên dùng random |

**Kiểm tra (Invariant I2, I3 — E-C2.md, E-C3.md):**
```bash
python3 scripts/evaluation/e_c2_nonce_test.py
# Expected: 0 nonce collision trong 10,000 encryptions

python3 scripts/evaluation/e_c3_aead_integrity.py
# Tamper 1 bit trong ciphertext → InvalidTag exception → request reject
```

---

### 1.3 Quản lý Khóa: Envelope Encryption qua HashiCorp Vault 1.15

**Chuẩn áp dụng:** NIST SP 800-57 — Key Management

Hệ thống dùng **envelope encryption** với 2 cấp khóa:

```
KEK (Key Encryption Key)  ← Quản lý bởi Vault Transit Engine (hashicorp/vault:1.15)
 └── DEK (Data Encryption Key)  ← Dùng để mã hóa dữ liệu thực
      └── Ciphertext (dữ liệu trong PostgreSQL 16)
```

**Luồng hoạt động:**
1. Backend gọi Vault API (`http://vault:8200`) → nhận DEK đã được Vault mã hóa bằng KEK
2. Backend dùng DEK decrypt/encrypt dữ liệu tại memory
3. DEK không bao giờ được persist — chỉ tồn tại trong RAM khi cần
4. Vault giữ KEK trong secure enclave — backend không bao giờ thấy KEK

**Khởi tạo Vault (vault/init/enable-transit.sh):**
```bash
#!/bin/bash
export VAULT_ADDR=http://localhost:8200
export VAULT_TOKEN=${VAULT_DEV_ROOT_TOKEN_ID}

vault secrets enable transit
vault write -f transit/keys/dek type=aes256-gcm96
vault policy write dek-policy vault/policies/dek-policy.hcl
```

**Policy tối thiểu (vault/policies/dek-policy.hcl):**
```hcl
path "transit/encrypt/dek" {
  capabilities = ["update"]
}
path "transit/decrypt/dek" {
  capabilities = ["update"]
}
```

**Key Rotation SLA (Invariant I6 — E-X1.md):**
```bash
vault write -f transit/keys/dek/rotate
# SLA: ≤10 phút từ lúc rotate đến key mới active
# Old key version bị revoke sau ≤24h

bash scripts/evaluation/e_x1_rotation_test.sh
```

---

## Lớp 2 — AuthN: Xác thực Danh tính

### 2.1 Multi-Factor Authentication: TOTP

**Chuẩn áp dụng:** NIST SP 800-63B — AAL2; RFC 6238 — TOTP

TOTP bắt buộc cho admin (role `admin`). Không có bypass route. Keycloak realm `lab` xử lý toàn bộ TOTP flow — frontend không render OTP form.

**Triển khai (backend/app/security/totp_verify.py):**
```python
import pyotp  # pyotp==2.9.0

class TOTPVerifier:
    def verify(self, secret: str, otp_code: str) -> bool:
        totp = pyotp.TOTP(secret)
        return totp.verify(otp_code, valid_window=1)  # ±30s clock skew

    def generate_secret(self) -> str:
        return pyotp.random_base32()  # 160-bit entropy
```

**Keycloak TOTP config (idp/keycloak/realm-export.json, realm=lab):**
- Algorithm: HmacSHA1 (RFC 4226)
- Digits: 6
- Period: 30 giây
- Required Action: CONFIGURE_TOTP bắt buộc cho role admin

**Kiểm tra (Invariant I4, I7 — E-N1.md):**
```bash
python3 scripts/evaluation/e_n1_totp_test.py
# 100 tests: 90 valid + 10 invalid
# Expected: success ≥99%, false-accept = 0%
```

---

### 2.2 Authorization Code + PKCE

**Chuẩn áp dụng:** RFC 6749 (OAuth 2.0), RFC 7636 (PKCE), RFC 8414 (OIDC Discovery)

PKCE bắt buộc cho public clients (SPA). Không thể thiếu `code_challenge`.

**Luồng Frontend:**
```
1. Frontend tạo code_verifier (random 43–128 ký tự)
2. code_challenge = BASE64URL(SHA256(code_verifier))
3. Redirect đến Keycloak:
   GET http://localhost:8081/realms/lab/protocol/openid-connect/auth
       ?response_type=code
       &client_id=spa-client
       &code_challenge=<hash>
       &code_challenge_method=S256
4. Keycloak yêu cầu login + TOTP (nếu admin)
5. Keycloak redirect về frontend với authorization_code
6. Frontend đổi code → token:
   POST http://localhost:8081/realms/lab/protocol/openid-connect/token
       grant_type=authorization_code
       &code=<auth_code>
       &code_verifier=<original>
7. Nhận access_token (JWT RS256, TTL 15 phút) + refresh_token
```

**Token storage:**
- `access_token` → memory (biến JS, không localStorage)
- `refresh_token` → sessionStorage
- Rotating refresh token: `revoke_refresh_token=true` trong realm settings

---

### 2.3 JWT Hardening: RS256 + kid control

**Chuẩn áp dụng:** RFC 7519 (JWT), RFC 7515 (JWS), RFC 9068 (JWT Profile)

**Kong plugin (gateway/plugins/jwt-hardening.lua):**
- Pin algorithm: chỉ chấp nhận `RS256` — reject mọi alg khác kể cả `none`
- kid whitelist: chỉ chấp nhận kid có trong JWKS endpoint Keycloak
- JWKS endpoint: `http://keycloak:8080/realms/lab/protocol/openid-connect/certs`

**3 attack vectors bị block (Invariant I4 — E-Z2.md):**

| Vector | Cơ chế block | Log reason |
|---|---|---|
| `alg=none` JWT | plugin check `alg != 'none'` | `alg_none_rejected` |
| Fake kid injection | JWKS whitelist check | `kid_not_whitelisted` |
| Algorithm confusion (RS256 as HS256) | alg pin enforce | `alg_mismatch` |

```bash
bash scripts/evaluation/e_z2_token_hardening.sh
# Expected: tất cả 3 vectors → 401, log rõ ràng
```

---

### 2.4 DPoP Token Binding (RFC 9449)

**Chuẩn áp dụng:** RFC 9449 — OAuth 2.0 Demonstrating Proof of Possession (DPoP)

DPoP bind access token với một ephemeral keypair — ngăn token bị stolen và dùng lại bởi attacker.

**Cơ chế:**
1. Frontend (browser) tạo ephemeral EC keypair mỗi session (Web Crypto API)
2. Mỗi request: tạo DPoP proof JWT ký bằng private key, chứa `htm`, `htu`, `iat`, `jti`, `ath`
3. Backend verify: proof signature, htu+htm khớp request, jti chưa dùng (Redis SET NX), ath khớp access_token
4. Redis (container `api-redis:6379`) lưu `dpop:jti:<uuid>` với TTL = token lifetime

**DPoP utility Frontend (frontend/src/utils/dpop.js):**
```javascript
async function createDpopProof(url, method, accessToken) {
  const { privateKey, publicKey } = await window.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]
  );
  const jwk = await window.crypto.subtle.exportKey("jwk", publicKey);
  const ath = btoa(String.fromCharCode(...new Uint8Array(
    await window.crypto.subtle.digest("SHA-256",
      new TextEncoder().encode(accessToken))
  ))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");

  // Build proof JWT with htu, htm, jti (uuid), iat, ath
  // ... (full implementation in frontend/src/utils/dpop.js)
}
```

**DPoP verifier Backend (backend/app/security/dpop_verifier.py):**
```python
# Verify htu, htm, iat freshness (≤60s), jti (Redis SET NX), ath
jti_key = f"dpop:jti:{jti}"
was_set = redis_client.set(jti_key, "1", ex=300, nx=True)
if not was_set:
    raise HTTPException(401, "DPoP proof replayed")
```

**Test replay:**
```bash
python3 scripts/attacks/replay_dpop_attack.py
# Lần 1: 200 OK
# Lần 2 (same proof): 401 "DPoP proof replayed"
```

**E-C2 — nonce reuse (50 threads):**
```bash
python3 scripts/evaluation/e_c2_nonce_test.py
# 50 threads, cùng DPoP proof → 1/50 pass, 49/50 → 401 replayed
```

**Deployment D2 (mTLS thay thế DPoP):**
Trong D2 (Linux VM), mTLS east-west giữa các service thay thế hoàn toàn DPoP + Redis.

---

## Lớp 3 — AuthZ: Kiểm soát Quyền Truy cập

### 3.1 OPA/Rego: Policy as Code

**Chuẩn áp dụng:** NIST SP 800-162 — Guide to ABAC

Hệ thống áp dụng **deny-by-default** — mọi request đều bị từ chối trừ khi có rule explicit allow. Policy Decision Point (PDP) là OPA; Policy Enforcement Point (PEP) là Kong.

**Kiến trúc PEP-PDP:**
```
Client → Kong (PEP) → [jwt-hardening.lua → opa-authz.lua]
                  →   OPA (PDP): POST /v1/data/authz/allow
                  ←   {"result": {"allow": true/false, "reason": "..."}}
         Kong → Backend (nếu allow)
```

**OPA response có trường `reason`** (frontend log ra console để debug):
```json
{"result": {"allow": false, "reason": "not_owner"}}
```

**Policy authz.rego (opa/policies/authz.rego):**
```rego
package authz
import future.keywords.if
import future.keywords.in

default allow = false
default deny_reason = "no matching rule"

role_permissions := {
    "admin": {
        "GET":    ["/api/v1/users", "/api/v1/products", "/api/v1/orders"],
        "POST":   ["/api/v1/products", "/api/v1/orders"],
        "PUT":    ["/api/v1/products", "/api/v1/orders"],
        "DELETE": ["/api/v1/products", "/api/v1/users"]
    },
    "staff": {
        "GET":  ["/api/v1/products", "/api/v1/orders"],
        "PUT":  ["/api/v1/orders"]
    },
    "customer": {
        "GET":  ["/api/v1/products"],
        "POST": ["/api/v1/orders"],
        "GET":  ["/api/v1/orders"]   # Chỉ order của mình (ABAC check bên dưới)
    }
}

# RBAC base rule
allow if {
    some role in input.user.roles
    some permitted_path in role_permissions[role][input.method]
    startswith(input.path, permitted_path)
}

# ABAC: customer chỉ được xem order của chính mình (BOLA prevention)
allow if {
    "customer" in input.user.roles
    input.method == "GET"
    startswith(input.path, "/api/v1/orders/")
    input.resource_owner_id == input.user.sub
}

# Admin-only paths
allow if {
    "admin" in input.user.roles
    startswith(input.path, "/api/v1/admin/")
}

# Webhook: yêu cầu hmac_verified claim
allow if {
    startswith(input.path, "/api/v1/webhooks/")
    input.hmac_verified == true
}

# Log reason cho mọi quyết định (Invariant I5)
deny_reason = "not_owner" if {
    "customer" in input.user.roles
    startswith(input.path, "/api/v1/orders/")
    input.resource_owner_id != input.user.sub
}

deny_reason = "admin_only" if {
    not "admin" in input.user.roles
    startswith(input.path, "/api/v1/admin/")
}

deny_reason = "hmac_required" if {
    startswith(input.path, "/api/v1/webhooks/")
    not input.hmac_verified
}

deny_reason = "insufficient_role" if {
    not allow
    deny_reason == "no matching rule"
}
```

**Test suite (opa/tests/) — ≥50 cases:**
```bash
docker compose exec opa opa test opa/policies/ opa/tests/ --format json \
  > EVIDENCE/security_scans/opa_results.json
# Expected: pass rate ≥95%
```

---

## Lớp 4 — WAF Equivalent: Kong + OPA cho SME

> **Lý do không dùng WAF riêng:** Cloudflare WAF, AWS WAF, hay ModSecurity đều có chi phí vận hành và licensing không phù hợp với SME (tổ chức nhỏ). Stack hiện tại đã tích hợp sẵn các cơ chế phòng thủ tương đương cho API workload thực tế.

### Kong đóng vai trò WAF lightweight

Kong API Gateway (port `:8000`/`:8443`) thực hiện các chức năng tương đương WAF:

| Tính năng WAF | Cơ chế Kong | File cấu hình |
|---|---|---|
| Rate limiting per-IP | `rate-limit` plugin | `gateway/kong.yml` |
| Rate limiting per-user | `rate-limit` plugin (by consumer) | `gateway/kong.yml` |
| Block malformed JWT | `jwt-hardening.lua` (alg=none, kid injection) | `gateway/plugins/` |
| HSTS enforcement | `hsts-header.lua` | `gateway/plugins/` |
| TLS downgrade prevention | `ssl_protocols TLSv1.3` | `gateway/kong.conf` |
| CORS protection | CORS plugin strict config | `gateway/kong.yml` |

**Verify rate-limit hoạt động:**
```bash
for i in $(seq 1 15); do curl -s -o /dev/null -w "%{http_code}\n" \
  http://localhost:8000/api/v1/products; done
# Request thứ 11+ → 429 Too Many Requests
```

### OPA đóng vai trò Policy Enforcement

OPA (port `:8181`) thực hiện các chức năng tương đương WAF policy engine:

| Tính năng WAF | Cơ chế OPA | File |
|---|---|---|
| Block unauthenticated | `default allow = false` | `authz.rego` |
| Block unauthorized paths | per-role path permissions | `authz.rego` |
| BOLA/IDOR prevention | ABAC ownership check | `authz.rego` |
| Rate limit policy | `rate_limit.rego` deny >100 req/phút | `rate_limit.rego` |
| Admin path protection | `admin_only` rule | `authz.rego` |

### Giới hạn so với WAF thực sự

| Tính năng | Kong+OPA | WAF thực (Cloudflare/ModSecurity) |
|---|---|---|
| Deep packet inspection | ❌ Không | ✅ Có |
| Signature-based detection | ❌ Không | ✅ Có (CVE signatures) |
| SQL injection detection | ❌ Chỉ ở FastAPI validation | ✅ Tầng gateway |
| Rate limiting | ✅ Per-IP, per-user | ✅ Có |
| JWT/Auth protection | ✅ Đầy đủ | ✅ Có |
| OWASP API Top 10 | ✅ Phủ ~80% | ✅ Phủ ~95% |
| Chi phí | ✅ Free (open source) | ❌ $20–500/tháng |

**Kết luận:** Đối với SME với ràng buộc chi phí, Kong + OPA đủ phòng thủ các attack vector phổ biến nhất trong OWASP API Top 10. Thiếu sót chính là deep packet inspection và signature-based detection — có thể bổ sung ModSecurity như module NGINX khi scale lên. Đây là đánh đổi có chủ ý và được tài liệu hóa rõ ràng.

---

## Ma trận Bảo mật — OWASP API Top 10

| OWASP Risk | Giải pháp | Lớp | File triển khai |
|---|---|---|---|
| API1 — BOLA | OPA ownership check (`resource_owner_id == user.sub`) | AuthZ | `opa/policies/authz.rego` |
| API2 — Broken Auth | PKCE, JWT RS256, TOTP MFA, DPoP replay protection | AuthN | `backend/app/security/` |
| API3 — Broken Object Property Auth | Pydantic response_model DTO filter | AuthZ | `backend/app/routers/` |
| API4 — Rate Limiting | Kong rate-limit plugin + OPA rate_limit.rego | WAF/AuthZ | `gateway/kong.yml`, `opa/policies/rate_limit.rego` |
| API5 — Function Level AuthZ | deny-by-default OPA, explicit allow per method+path | AuthZ | `authz.rego` |
| API6 — Unrestricted Access to Sensitive Business | OPA ABAC field-level + DTO | AuthZ | `authz.rego`, routers |
| API7 — SSRF | IP blocklist nội bộ (169.254.0.0/16, 10.0.0.0/8...) | Backend | `backend/app/middleware/` |
| API8 — Security Misconfiguration | alg=none block, HSTS, TLS 1.3, Vault least-privilege | WAF/Crypto | `jwt-hardening.lua`, `kong.conf` |
| API9 — Improper Inventory Management | OpenAPI schema strict, Pydantic models | Backend | `backend/app/routers/` |
| API10 — Unsafe API Consumption | Input validation FastAPI + OPA policy | AuthZ/Backend | `backend/app/middleware/` |

---

## Tóm tắt Invariants

| ID | Bảo vệ | Cơ chế | Ngưỡng | Lớp |
|---|---|---|---|---|
| **I1** | Plaintext trên kênh | TLS 1.3, 0-RTT off, HSTS | 0 byte rò rỉ | Crypto |
| **I2** | Tampering ciphertext | AES-256-GCM AEAD tag | 100% bị chặn | Crypto |
| **I3** | Integrity dữ liệu | Nonce per-record, AEAD verify | Pass 100% | Crypto |
| **I4** | AuthN + Token binding | TOTP, PKCE, DPoP/mTLS, JWT RS256 | Replay = 0 | AuthN |
| **I5** | AuthZ explainable | OPA deny-by-default + 100% log + reason | 100% explainable | AuthZ |
| **I6** | Key rotation SLA | Vault 1.15 Transit rotation | ≤10 phút | Crypto |
| **I7** | MFA false-accept | TOTP strict verify, no bypass | false-accept = 0% | AuthN |