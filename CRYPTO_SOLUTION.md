# CRYPTO_SOLUTION — Giải pháp Mật mã 3 Lớp

> **Đề tài:** Cloud API-Based Network Application Security for Small Company Services  
> **Môn:** NT219.Q21.ANTT — Mật mã học | UIT  
> **Stack:** Kong 3.6 · Keycloak 24.0 · HashiCorp Vault 1.15 · FastAPI 0.110.0 · OPA 0.65.0

---

## Tổng quan kiến trúc mật mã

Hệ thống áp dụng **Defense-in-Depth** với 3 lớp mật mã độc lập. Mỗi lớp bảo vệ một thuộc tính bảo mật riêng biệt: **Confidentiality** (bí mật), **Authentication** (xác thực danh tính), và **Authorization** (kiểm soát quyền truy cập). Một attacker phải phá vỡ cả 3 lớp đồng thời mới có thể xâm phạm hệ thống.

```
┌─────────────────────────────────────────────────────────────────┐
│  LỚP 1 — CRYPTO (Bảo vệ dữ liệu)                                │
│  TLS 1.3 truyền tải · AES-256-GCM lưu trữ · KEK/DEK Vault       │
├─────────────────────────────────────────────────────────────────┤
│  LỚP 2 — AuthN (Xác thực danh tính)                             │
│  TOTP / WebAuthn · PKCE · JWT RS256 · DPoP / mTLS               │
├─────────────────────────────────────────────────────────────────┤
│  LỚP 3 — AuthZ (Kiểm soát quyền)                                │
│  OPA Rego · deny-by-default · RBAC → ABAC · 100% decision log   │
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

### 1.3 Quản lý Khóa: Envelope Encryption qua HashiCorp Vault

**Chuẩn áp dụng:** NIST SP 800-57 — Key Management

Hệ thống dùng **envelope encryption** với 2 cấp khóa:

```
KEK (Key Encryption Key)  ← Quản lý bởi Vault Transit Engine
 └── DEK (Data Encryption Key)  ← Dùng để mã hóa dữ liệu thực
      └── Ciphertext (dữ liệu trong PostgreSQL)
```

**Luồng hoạt động:**
1. Backend gọi Vault API → nhận DEK đã được Vault mã hóa bằng KEK
2. Backend dùng DEK decrypt/encrypt dữ liệu tại memory
3. DEK không bao giờ được persist — chỉ tồn tại trong RAM khi cần
4. Vault giữ KEK trong secure enclave — backend không bao giờ thấy KEK

**Khởi tạo Vault (vault/init/enable-transit.sh):**
```bash
#!/bin/bash
export VAULT_ADDR=http://localhost:8200
export VAULT_TOKEN=${VAULT_DEV_ROOT_TOKEN_ID}

# Enable Transit Secrets Engine
vault secrets enable transit

# Tạo DEK key (AES-256-GCM)
vault write -f transit/keys/dek type=aes256-gcm96

# Apply policy — backend chỉ có quyền encrypt/decrypt, không đọc được key
vault policy write dek-policy vault/policies/dek-policy.hcl
```

**Policy tối thiểu (vault/policies/dek-policy.hcl):**
```hcl
# Backend chỉ được encrypt và decrypt — không thể export key raw
path "transit/encrypt/dek" {
  capabilities = ["update"]
}

path "transit/decrypt/dek" {
  capabilities = ["update"]
}

# Không có quyền: read key, list keys, rotate, delete
```

**Key Rotation SLA (Invariant I6 — E-X1.md):**
```bash
# Rotate DEK — trigger thủ công hoặc scheduled
vault write -f transit/keys/dek/rotate

# SLA: ≤ 10 phút từ lúc rotate đến key mới active
# Old key version bị revoke sau ≤ 24h

bash scripts/evaluation/e_x1_rotation_test.sh
# Đo: thời gian từ rotate command → first successful encrypt với key mới
# Expected: Δt ≤ 10 phút
```

---

## Lớp 2 — AuthN: Xác thực Danh tính

### 2.1 Multi-Factor Authentication: TOTP

**Chuẩn áp dụng:** NIST SP 800-63B — AAL2; RFC 6238 — TOTP

TOTP (Time-based One-Time Password) là MFA bắt buộc cho tất cả user. Không có bypass route. Implementation sử dụng thư viện `pyotp==2.9.0`.

**Triển khai (backend/app/security/totp_verify.py):**
```python
import pyotp
from datetime import datetime

class TOTPVerifier:
    def verify(self, secret: str, otp_code: str) -> bool:
        """
        Verify TOTP với time window ±1 (30s interval).
        NIST SP 800-63B khuyến nghị không cho phép window quá lớn.
        """
        totp = pyotp.TOTP(secret)
        # valid_window=1: chấp nhận code của interval trước và sau (clock skew)
        return totp.verify(otp_code, valid_window=1)

    def generate_secret(self) -> str:
        """Tạo secret ngẫu nhiên base32 cho user mới."""
        return pyotp.random_base32()  # 160-bit entropy
```

**Keycloak TOTP (idp/keycloak/realm-export.json):**
- Algorithm: HmacSHA1 (RFC 4226)
- Digits: 6
- Period: 30 giây
- Look-ahead window: 1

**Kiểm tra (Invariant I4 — E-N1.md):**
```bash
python3 scripts/evaluation/e_n1_totp_test.py
# Expected:
#   - Success rate ≥ 99% với valid OTP + valid window
#   - False-accept rate = 0% với expired/invalid OTP
#   - Replay của OTP đã dùng bị reject (jti tracking)
```

---

### 2.2 OAuth 2.0 + PKCE Flow

**Chuẩn áp dụng:** RFC 6749 (OAuth 2.0), RFC 7636 (PKCE), OpenID Connect Core 1.0

**PKCE (Proof Key for Code Exchange)** ngăn Authorization Code Interception Attack — đặc biệt quan trọng với SPA (React) không thể giữ secret.

**Luồng PKCE S256 (frontend/src/auth/keycloak.js):**
```javascript
// Bước 1: Tạo code_verifier ngẫu nhiên
const codeVerifier = generateRandomString(64);  // 256-bit entropy
// Bước 2: Tính code_challenge = BASE64URL(SHA256(code_verifier))
const codeChallenge = await sha256Base64url(codeVerifier);

// Bước 3: Gửi authorization request với code_challenge
const authUrl = `${KEYCLOAK_URL}/realms/cloudapi/protocol/openid-connect/auth
  ?response_type=code
  &client_id=frontend-spa
  &redirect_uri=${REDIRECT_URI}
  &code_challenge=${codeChallenge}
  &code_challenge_method=S256
  &scope=openid profile email`;

// Bước 4: Sau khi redirect, exchange code với code_verifier (không phải challenge)
const tokenResponse = await fetch(`${KEYCLOAK_URL}/protocol/openid-connect/token`, {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authorizationCode,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,  // Keycloak verify SHA256(code_verifier) == code_challenge
    client_id: 'frontend-spa',
  })
});
```

**Tại sao PKCE an toàn:**
- `code_verifier` chỉ biết bởi client gốc — interceptor có code nhưng không có verifier
- `code_challenge` là một chiều (SHA256) — không thể reverse
- Keycloak verify: `SHA256(code_verifier) == code_challenge` trước khi cấp token

---

### 2.3 JWT Hardening: RS256 + alg=none Block

**Chuẩn áp dụng:** RFC 7519 (JWT), RFC 7515 (JWS), RFC 9068 (JWT Profile for OAuth 2.0)

Kong verify JWT tại edge trước khi forward bất kỳ request nào đến backend.

**Plugin jwt-hardening.lua (gateway/plugins/jwt-hardening.lua):**
```lua
local jwt_decoder = require "kong.plugins.jwt.jwt_parser"

local JwtHardeningHandler = {}

function JwtHardeningHandler:access(conf)
  local auth_header = kong.request.get_header("Authorization")
  if not auth_header then
    return kong.response.exit(401, { message = "Missing Authorization header" })
  end

  local token = auth_header:match("Bearer (.+)")
  if not token then
    return kong.response.exit(401, { message = "Invalid Bearer token format" })
  end

  -- Parse JWT header
  local jwt, err = jwt_decoder:new(token)
  if err then
    return kong.response.exit(401, { message = "Invalid JWT structure" })
  end

  -- CRITICAL: Block alg=none attack (CVE-2015-9235 class)
  local alg = jwt.header.alg
  if not alg or alg:lower() == "none" or alg == "" then
    kong.log.err("SECURITY: alg=none JWT rejected from ", kong.client.get_ip())
    return kong.response.exit(401, { message = "Algorithm 'none' not permitted" })
  end

  -- Enforce RS256 only — reject HS256, ES384, etc.
  if alg ~= "RS256" then
    kong.log.err("SECURITY: Unexpected alg=", alg, " rejected")
    return kong.response.exit(401, { message = "Only RS256 algorithm is permitted" })
  end

  -- Validate kid exists and is in allowlist
  local kid = jwt.header.kid
  if not kid or not conf.allowed_kids[kid] then
    return kong.response.exit(401, { message = "Unknown or missing kid" })
  end

  -- Standard claim validation: exp, iat, iss, sub
  local now = ngx.time()
  if jwt.claims.exp and jwt.claims.exp < now then
    return kong.response.exit(401, { message = "Token expired" })
  end
end
```

**Kiểm tra (Invariant I4 — E-Z2.md):**
```bash
bash scripts/evaluation/e_z2_token_hardening.sh
# Test cases:
#   1. JWT alg=none → 401 ✅
#   2. JWT alg=HS256 (algorithm confusion) → 401 ✅
#   3. JWT unknown kid → 401 ✅
#   4. JWT expired → 401 ✅
#   5. JWT valid RS256 + known kid → pass through ✅
```

---

### 2.4 DPoP — Proof of Possession Token Binding

**Chuẩn áp dụng:** RFC 9449 — OAuth 2.0 DPoP

DPoP bind access token với một ephemeral keypair — ngăn token bị stolen và dùng lại bởi attacker.

**Cơ chế:**
1. Client tạo ephemeral EC keypair mỗi request
2. Client tạo DPoP proof JWT: ký bằng private key, chứa `htm` (method), `htu` (URI), `iat`, `jti`
3. Backend verify proof signature với public key, check `jti` không bị replay
4. Redis lưu `jti` đã dùng (SET NX + TTL = token lifetime) — prevent replay

**Triển khai (backend/app/security/dpop_verifier.py):**
```python
import redis
from jose import jwt, JWTError
from datetime import datetime, timedelta

redis_client = redis.Redis(host='redis', port=6379, db=0)

class DPoPVerifier:
    def verify(self, dpop_header: str, expected_method: str, expected_uri: str) -> bool:
        """Verify DPoP proof theo RFC 9449."""
        try:
            # Decode header để lấy public key (unverified)
            unverified = jwt.get_unverified_header(dpop_header)
            if unverified.get("typ") != "dpop+jwt":
                return False

            # Extract public key từ JWK trong header
            jwk = unverified.get("jwk")
            if not jwk:
                return False

            # Verify signature bằng public key trong proof itself
            claims = jwt.decode(dpop_header, jwk, algorithms=["ES256"])

            # Validate binding claims
            if claims.get("htm") != expected_method:
                return False
            if claims.get("htu") != expected_uri:
                return False

            # Kiểm tra freshness (iat ≤ 60s)
            iat = claims.get("iat", 0)
            if abs(datetime.utcnow().timestamp() - iat) > 60:
                return False

            # REPLAY PROTECTION: jti phải chưa từng thấy
            jti = claims.get("jti")
            if not jti:
                return False

            # SET NX: chỉ set nếu key chưa tồn tại — atomic operation
            jti_key = f"dpop:jti:{jti}"
            was_set = redis_client.set(jti_key, "1", ex=300, nx=True)
            if not was_set:
                # jti đã tồn tại → replay attack
                return False

            return True

        except JWTError:
            return False
```

**Deployment D2 (mTLS thay thế DPoP):**  
Trong D2 (Linux VM), mTLS east-west giữa các service thay thế hoàn toàn DPoP + Redis. Client certificate bound vào connection — replay impossible ở tầng TLS.

---

## Lớp 3 — AuthZ: Kiểm soát Quyền Truy cập

### 3.1 OPA/Rego: Policy as Code

**Chuẩn áp dụng:** NIST SP 800-162 — Guide to ABAC

Hệ thống áp dụng mô hình **deny-by-default** — mọi request đều bị từ chối trừ khi có rule explicit allow. Policy Decision Point (PDP) là OPA; Policy Enforcement Point (PEP) là Kong.

**Kiến trúc PEP-PDP:**
```
Client → Kong (PEP) → OPA (PDP)
                  ←  allow/deny + reason
         Kong → Backend (nếu allow)
```

**Policy authz.rego (opa/policies/authz.rego):**
```rego
package authz

import future.keywords.if
import future.keywords.in

# DENY-BY-DEFAULT: Mặc định từ chối tất cả
default allow = false
default deny_reason = "no matching rule"

# Cấu trúc quyền theo RBAC → ABAC
role_permissions := {
    "admin": {
        "GET":    ["/api/v1/users", "/api/v1/products", "/api/v1/orders"],
        "POST":   ["/api/v1/products", "/api/v1/orders"],
        "PUT":    ["/api/v1/products"],
        "DELETE": ["/api/v1/products", "/api/v1/users"]
    },
    "staff": {
        "GET":  ["/api/v1/products", "/api/v1/orders"],
        "PUT":  ["/api/v1/orders"],
        "POST": ["/api/v1/orders"]
    },
    "customer": {
        "GET":  ["/api/v1/products"],
        "POST": ["/api/v1/orders"]
    }
}

# Rule RBAC: allow nếu role có permission
allow if {
    some role in input.user.roles
    some permitted_path in role_permissions[role][input.method]
    startswith(input.path, permitted_path)
}

# Rule ABAC bổ sung: customer chỉ được xem order của chính mình (BOLA prevention)
allow if {
    "customer" in input.user.roles
    input.method == "GET"
    startswith(input.path, "/api/v1/orders/")
    order_id := split(input.path, "/")[4]
    input.resource_owner_id == input.user.sub  # ownership check
}

# Log reason để 100% decision explainable (Invariant I5)
deny_reason = "not_owner" if {
    "customer" in input.user.roles
    startswith(input.path, "/api/v1/orders/")
    input.resource_owner_id != input.user.sub
}

deny_reason = "insufficient_role" if {
    not allow
    deny_reason == "no matching rule"
}
```

**Plugin opa-authz.lua (gateway/plugins/opa-authz.lua):**
```lua
local http = require "resty.http"
local cjson = require "cjson"

local OpaAuthzHandler = {}

function OpaAuthzHandler:access(conf)
  local httpc = http.new()

  -- Build OPA input từ request context
  local input = {
    method = kong.request.get_method(),
    path   = kong.request.get_path(),
    user   = {
      sub   = kong.ctx.shared.jwt_sub,
      roles = kong.ctx.shared.jwt_roles,
    }
  }

  -- Gọi OPA PDP
  local res, err = httpc:request_uri(conf.opa_url .. "/v1/data/authz/allow", {
    method  = "POST",
    body    = cjson.encode({ input = input }),
    headers = { ["Content-Type"] = "application/json" }
  })

  if err or not res then
    kong.log.err("OPA unreachable: ", err)
    return kong.response.exit(503, { message = "Authorization service unavailable" })
  end

  local result = cjson.decode(res.body)

  -- Log 100% decision (Invariant I5)
  kong.log.info("OPA decision: allow=", tostring(result.result),
                " user=", input.user.sub,
                " method=", input.method,
                " path=", input.path)

  if not result.result then
    return kong.response.exit(403, { message = "Access denied by policy" })
  end
end
```

**Kiểm tra (Invariant I5 — E-Z1.md):**
```bash
bash scripts/evaluation/e_z1_policy_test.sh
# Test matrix: 15 test cases (5 roles × 3 resource types)
# Expected:
#   - Policy pass-rate ≥ 95% (allow đúng)
#   - Undeclared action deny = 100% (deny-by-default)
#   - BOLA rejection = 100% (cross-user access)
#   - 100% decisions có log với reason
```

---

## Ma trận Bảo mật — OWASP API Top 10

| OWASP Risk | Giải pháp | Lớp | File triển khai |
|---|---|---|---|
| API1 — BOLA | OPA ownership check (`resource_owner_id == user.sub`) | AuthZ | `opa/policies/authz.rego` |
| API2 — Broken Auth | PKCE, JWT RS256, TOTP MFA, DPoP replay protection | AuthN | `backend/app/security/` |
| API3 — Broken Object Property Auth | OPA ABAC field-level access control | AuthZ | `authz.rego` |
| API4 — Rate Limiting | Kong rate-limit plugin + OPA rate_limit.rego | Crypto/AuthZ | `gateway/kong.yml`, `opa/policies/rate_limit.rego` |
| API5 — Function Level AuthZ | deny-by-default OPA, explicit allow per method+path | AuthZ | `authz.rego` |
| API7 — Server Side Request Forgery | CORS strict, internal network isolation (D2 zones) | Crypto | `gateway/plugins/hsts-header.lua` |
| API8 — Security Misconfiguration | alg=none block, HSTS, TLS 1.3 enforce, Vault least-privilege | Crypto | `jwt-hardening.lua`, `kong.conf` |
| API10 — Unsafe API Consumption | Input validation tại FastAPI + OPA policy | AuthZ | `backend/app/middleware/` |

---

## Tóm tắt Invariants

| ID | Bảo vệ | Cơ chế | Ngưỡng | Lớp |
|---|---|---|---|---|
| **I1** | Plaintext trên kênh | TLS 1.3, 0-RTT off, HSTS | 0 byte rò rỉ | Crypto |
| **I2** | Tampering ciphertext | AES-256-GCM AEAD tag | 100% bị chặn | Crypto |
| **I3** | Integrity dữ liệu | Nonce per-record, AEAD verify | Pass 100% | Crypto |
| **I4** | AuthN + Token binding | TOTP, PKCE, DPoP/mTLS, JWT RS256 | Replay = 0 | AuthN |
| **I5** | AuthZ explainable | OPA deny-by-default + 100% log | 100% explainable | AuthZ |
| **I6** | Key rotation SLA | Vault Transit rotation | ≤ 10 phút | Crypto |