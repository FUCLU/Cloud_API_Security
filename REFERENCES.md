# REFERENCES

> Tài liệu tham khảo cho đề tài **Cloud API-Based Network Application Security for Small Company Services**
> Môn: NT219.Q21.ANTT — Mật mã học | UIT

---

## 1. OWASP — Tiêu chuẩn bảo mật API

**[REF-1]** OWASP Foundation. *OWASP API Security Top 10 — 2023 Edition*. Open Web Application Security Project, 2023.
URL: https://owasp.org/API-Security/editions/2023/en/0x00-header/
> **Áp dụng trong project:**
> - **API1:2023 – BOLA (Broken Object Level Authorization):** Kiểm thử bằng `scripts/attacks/bola_attack.py`; Kong + OPA trả `403 Forbidden` khi user cố truy cập resource không thuộc quyền sở hữu (invariant I5 — `EVAL/E-Z1.md`).
> - **API2:2023 – Broken Authentication:** Chặn JWT `alg=none` tại plugin `gateway/plugins/jwt-hardening.lua`; kiểm thử bằng `scripts/attacks/alg_none_attack.py` → `401 Unauthorized`.
> - **API4:2023 – Unrestricted Resource Consumption:** Kong rate-limiting plugin cấu hình trong `gateway/kong.yml`; policy bổ sung tại `opa/policies/rate_limit.rego`; verify 429 khi vượt ngưỡng.
> - **API8:2023 – Security Misconfiguration:** `alg=none` block, HSTS header (`hsts-header.lua`), CORS strict, TLS 1.3 enforce.

**[REF-2]** OWASP Foundation. *OWASP Top 10 Web Application Security Risks — 2021*. Open Web Application Security Project, 2021.
URL: https://owasp.org/www-project-top-ten/
> **Áp dụng:** Tham chiếu cho thiết kế middleware xác thực backend (`backend/app/middleware/auth_middleware.py`) và cấu hình bảo mật PostgreSQL (AES-256-GCM at-rest). SSRF protection theo A10:2021.

---

## 2. IETF RFCs — Chuẩn kỹ thuật

**[REF-3]** Jones, M., Bradley, J., & Sakimura, N. *RFC 7519 — JSON Web Token (JWT)*. Internet Engineering Task Force, May 2015.
URL: https://datatracker.ietf.org/doc/html/rfc7519
> **Áp dụng:** Kiểm tra cấu trúc JWT (header, payload, signature) tại `backend/app/security/jwt_verify.py`; enforce `alg=RS256`, kiểm soát `exp`, `iat`, `iss`, `sub` claims; reject token không có `kid` hợp lệ trong `gateway/plugins/jwt-hardening.lua`.

**[REF-4]** Jones, M., & Hildebrand, J. *RFC 7515 — JSON Web Signature (JWS)*. Internet Engineering Task Force, May 2015.
URL: https://datatracker.ietf.org/doc/html/rfc7515
> **Áp dụng:** Cơ sở kỹ thuật cho ký số token RS256 (Keycloak v24.0 + RSA-2048/4096); xác minh chữ ký JWKS endpoint `http://localhost:8081/realms/cloudapi/protocol/openid-connect/certs`; kiểm tra `e_z2_token_hardening.sh` (invariant I4).

**[REF-5]** Hardt, D. (Ed.). *RFC 6749 — The OAuth 2.0 Authorization Framework*. Internet Engineering Task Force, October 2012.
URL: https://datatracker.ietf.org/doc/html/rfc6749
> **Áp dụng:** Authorization Code Flow (user-facing SPA) và Client Credentials Flow (S2S) được cấu hình trong Keycloak realm `cloudapi` (`idp/keycloak/realm-export.json`); token endpoint `POST /realms/cloudapi/protocol/openid-connect/token`.

**[REF-6]** Sakimura, N., Bradley, J., Flinn, T., & Lodderstedt, T. *RFC 7636 — Proof Key for Code Exchange by OAuth Public Clients (PKCE)*. Internet Engineering Task Force, September 2015.
URL: https://datatracker.ietf.org/doc/html/rfc7636
> **Áp dụng:** PKCE (S256 method) bắt buộc cho public clients (spa-client) trong Keycloak realm cloudapi; `code_challenge` và `code_verifier` xử lý tại `frontend/src/auth/` với Web Crypto API; bảo vệ chống authorization code interception attack.

**[REF-7]** Fett, D., Campbell, B., Bradley, J., Lodderstedt, T., Jones, M., & Waite, D. *RFC 9449 — OAuth 2.0 Demonstrating Proof of Possession (DPoP)*. Internet Engineering Task Force, September 2023.
URL: https://datatracker.ietf.org/doc/html/rfc9449
> **Áp dụng:** DPoP proof verification tại `backend/app/security/dpop_verifier.py`; ephemeral ES256 keypair tạo tại frontend (`frontend/src/utils/dpop.js`); `jti` (JWT ID) lưu vào Redis `api-redis:6379` với `SET NX + TTL` để chống replay attack; kiểm thử bằng `scripts/attacks/replay_dpop_attack.py` và `e_c2_nonce_test.py` → 1/50 threads pass (invariant I4 — `EVAL/E-N2.md`). Deployment D2 thay thế bằng mTLS east-west.

**[REF-8]** Sakimura, N., Bradley, J., Jones, M., de Medeiros, B., & Mortimore, C. *OpenID Connect Core 1.0*. OpenID Foundation, November 2014.
URL: https://openid.net/specs/openid-connect-core-1_0.html
> **Áp dụng:** OIDC flow hoàn chỉnh qua Keycloak v24.0: Discovery endpoint (`http://localhost:8081/realms/cloudapi/.well-known/openid-configuration`), `id_token` validation, `UserInfo` endpoint, JWKS rotation; realm `cloudapi` cấu hình tại `idp/keycloak/realm-export.json`.

---

## 3. NIST — Hướng dẫn bảo mật

**[REF-9]** Grassi, P., Garcia, M., & Fenton, J. *NIST Special Publication 800-63B — Digital Identity Guidelines: Authentication and Lifecycle Management*. National Institute of Standards and Technology, 2017 (updated 2022).
URL: https://pages.nist.gov/800-63-3/sp800-63b.html
> **Áp dụng:** TOTP (HMAC-based OTP, AAL2) triển khai tại `backend/app/security/totp_verify.py` với thư viện `pyotp==2.9.0`; refresh token rotation + reuse-detection (Keycloak realm cloudapi); token TTL 15 phút; kiểm thử tại `scripts/evaluation/e_n1_totp_test.py` — 100 tests, false-accept=0 (invariant I4, I7).

**[REF-10]** Barker, E. *NIST Special Publication 800-57 Part 1 Rev. 5 — Recommendation for Key Management*. National Institute of Standards and Technology, May 2020.
URL: https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final
> **Áp dụng:** Envelope encryption KEK/DEK (AES-256-GCM) qua HashiCorp Vault **1.15** Transit Engine (`vault/init/enable-transit.sh`); key rotation SLA ≤10 phút (`scripts/evaluation/e_x1_rotation_test.sh`); blast-radius ≤24h (invariant I6 — `EVAL/E-X1.md`, `EVAL/E-X2.md`).

**[REF-11]** Dworkin, M. *NIST Special Publication 800-38D — Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM) and GMAC*. National Institute of Standards and Technology, November 2007.
URL: https://csrc.nist.gov/publications/detail/sp/800-38d/final
> **Áp dụng:** AES-256-GCM (AEAD) triển khai tại `backend/app/security/aead_encryption.py` sử dụng thư viện `cryptography==42.0.5`; nonce `os.urandom(12)` per-record (96-bit IV theo SP 800-38D §8.2); xác minh integrity tại `scripts/evaluation/e_c3_aead_integrity.py` (invariant I2, I3).

---

## 4. Công cụ / Stack chính (Tool Citations)

**[TOOL-1] Kong API Gateway v3.6**
Kong Inc. *Kong Gateway — Open Source API Gateway*. 2024.
URL: https://docs.konghq.com/gateway/latest/
> **Vai trò trong project:** Policy Enforcement Point (PEP); JWT verification (`jwt-hardening.lua`), rate limiting (429 khi vượt ngưỡng), WAF lightweight, CORS, HSTS header injection, OPA authorization sidecar (`opa-authz.lua`). Cấu hình declarative tại `gateway/kong.yml`. Container: `kong:3.6`, port `:8000`/`:8443`.

**[TOOL-2] Keycloak v24.0**
Red Hat / Keycloak Community. *Keycloak — Open Source Identity and Access Management*. 2024.
URL: https://www.keycloak.org/documentation
> **Vai trò trong project:** Identity Provider (IdP); OIDC/OAuth 2.0 Authorization Server; PKCE flow (spa-client), Client Credentials flow (backend-client), refresh token rotation với reuse-detection, TOTP MFA bắt buộc admin, JWKS endpoint cho Kong fetch. Realm: **`cloudapi`**. Container: `quay.io/keycloak/keycloak:24.0`, port `:8081`.

**[TOOL-3] HashiCorp Vault v1.15**
HashiCorp. *Vault — Secrets Management & Encryption as a Service*. 2024.
URL: https://developer.hashicorp.com/vault/docs
> **Vai trò trong project:** Key Management Service (KMS); Transit Secrets Engine cho envelope encryption (KEK/DEK AES-256-GCM); key rotation API (`/v1/transit/keys/dek/rotate`); policy DEK tại `vault/policies/dek-policy.hcl`; init script tại `vault/init/enable-transit.sh`. Container: `hashicorp/vault:1.15`, port `:8200`. Invariant I6: rotation ≤10 phút.

**[TOOL-4] Open Policy Agent (OPA) v0.65.0**
CNCF / Styra. *Open Policy Agent — Policy-as-Code*. 2024.
URL: https://www.openpolicyagent.org/docs/latest/
> **Vai trò trong project:** Policy Decision Point (PDP); Rego policies tại `opa/policies/` (authz, rate_limit); deny-by-default, RBAC→ABAC, WAF policy enforcement; 100% decision logging với trường `reason` (invariant I5). Tích hợp với Kong qua `opa-authz.lua`. Container: `openpolicyagent/opa:0.65.0`, port `:8181`. Test suite: ≥50 cases, pass rate ≥95%.

**[TOOL-5] FastAPI v0.110.0 + Python cryptography v42.0.5**
Ramírez, S. *FastAPI — High Performance Web Framework for Building APIs*. Tiangolo, 2024.
URL: https://fastapi.tiangolo.com
> **Vai trò trong project:** Backend API framework; middleware xác thực (`auth_middleware.py`), DPoP verifier (tích hợp Redis `api-redis:6379`), AEAD encryption/decryption, TOTP verify, BOLA check (token.sub vs orders.user_id), Webhook HMAC verify, SSRF IP blocklist, structured JSON logging. CORS: `origins=["http://localhost:5173"]`.

---

## 5. Tài liệu bổ sung

**[REF-12]** Rescorla, E. *RFC 8446 — The Transport Layer Security (TLS) Protocol Version 1.3*. IETF, August 2018.
URL: https://datatracker.ietf.org/doc/html/rfc8446
> **Áp dụng:** TLS 1.3 enforce tại Kong edge (`:8443`) và NGINX D2; 0-RTT tắt; ciphersuites thu gọn (TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256); HSTS header `max-age=31536000; includeSubDomains`. Kiểm tra không rò rỉ plaintext: `scripts/evaluation/e_c1_tls_capture.sh` → `EVIDENCE/captures/tls_capture.pcap` (invariant I1).

**[REF-13]** Bertocci, V. *RFC 9068 — JSON Web Token (JWT) Profile for OAuth 2.0 Access Tokens*. IETF, October 2021.
URL: https://datatracker.ietf.org/doc/html/rfc9068
> **Áp dụng:** Chuẩn hóa claim set cho access token (`sub`, `iss`, `exp`, `iat`, `jti`, `client_id`, `scope`); kiểm tra tại `jwt_verify.py` và `e_z2_token_hardening.sh`.

---

## Tóm tắt bảng trích dẫn theo yêu cầu Section 6

| Loại | Số lượng | Tài liệu |
|---|---|---|
| **OWASP** | 2 | REF-1 (API Top 10 2023), REF-2 (Top 10 2021) |
| **IETF RFCs** | 6 | REF-3 (RFC 7519), REF-4 (RFC 7515), REF-5 (RFC 6749), REF-6 (RFC 7636), REF-7 (RFC 9449), REF-8 (OIDC Core) |
| **NIST SP** | 3 | REF-9 (SP 800-63B), REF-10 (SP 800-57), REF-11 (SP 800-38D) |
| **RFC bổ sung** | 2 | REF-12 (RFC 8446), REF-13 (RFC 9068) |
| **Công cụ/Stack** | 5 | Kong 3.6, Keycloak 24.0, HashiCorp Vault **1.15**, OPA 0.65.0, FastAPI 0.110.0 |
| **Tổng nguồn chính thức** | **13** | ≥5 yêu cầu ✅ |
| **Tổng công cụ** | **5** | ≥3 yêu cầu ✅ |

---

## Ghi chú đồng bộ với docker-compose.yml

Tất cả phiên bản tool trong REFERENCES.md đã được đồng bộ với `docker-compose.yml`:

| Tool | Image trong docker-compose | Version trong REF |
|---|---|---|
| Kong | `kong:3.6` | v3.6 ✅ |
| Keycloak | `quay.io/keycloak/keycloak:24.0` | v24.0, realm=**cloudapi** ✅ |
| OPA | `openpolicyagent/opa:0.65.0` | v0.65.0 ✅ |
| Vault | `hashicorp/vault:1.15` | **v1.15** ✅ |
| PostgreSQL | `postgres:16` | v16 ✅ |
| Redis | `redis:7` | v7 (DPoP jti store) ✅ |
| Loki | `grafana/loki:2.9.0` | v2.9.0 ✅ |
| Grafana | `grafana/grafana:10.0.0` | v10.0.0 ✅ |