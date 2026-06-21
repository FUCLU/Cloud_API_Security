# REFERENCES

> Tài liệu tham khảo cho đề tài **Cloud API-Based Network Application Security for Small Company Services**  
> Môn: NT219.Q21.ANTT — Mật mã học | UIT

---

## 1. OWASP — Rủi ro API và Web Security

**[REF-1]** OWASP Foundation. *OWASP API Security Top 10 — 2023 Edition*.  
URL: https://owasp.org/API-Security/editions/2023/en/0x00-header/

**Áp dụng trong project:**

- **API1:2023 — Broken Object Level Authorization:** `backend/app/security/bola_guard.py` kiểm tra `order.user_id == token.sub`; script liên quan: `scripts/attacks/bola_attack.py`, `scripts/attacks/bola_e2e_attack.py`.
- **API2:2023 — Broken Authentication:** OIDC/PKCE qua Keycloak, JWT ES256, backend verify bằng JWKS trong `jwt_verify.py`, gateway hardening bằng plugin `jwt-hardening`.
- **API4:2023 — Unrestricted Resource Consumption:** Kong `rate-limiting` plugin giới hạn 100 request/phút/IP.
- **API7:2023 — Server Side Request Forgery:** `backend/app/security/ssrf_guard.py` block localhost/private/link-local/metadata IP và kiểm tra IP sau DNS resolve.
- **API8:2023 — Security Misconfiguration:** CORS, HSTS, security headers, TLS/mTLS, Docker network segmentation.

**[REF-2]** OWASP Foundation. *OWASP Top 10 Web Application Security Risks — 2021*.  
URL: https://owasp.org/www-project-top-ten/

**Áp dụng trong project:**

- A01 Broken Access Control: OPA policy + backend RBAC + BOLA guard.
- A02 Cryptographic Failures: TLS/mTLS, AES-256-GCM, Vault Transit.
- A05 Security Misconfiguration: Kong declarative config, CORS/HSTS/security headers.
- A10 SSRF: SSRF guard và endpoint kiểm thử `/api/v1/security/url-check`.

---

## 2. IETF / OpenID — Chuẩn xác thực và token

**[REF-3]** Hardt, D. *RFC 6749 — The OAuth 2.0 Authorization Framework*. IETF, 2012.  
URL: https://datatracker.ietf.org/doc/html/rfc6749

**Áp dụng:** Authorization Code flow được triển khai qua Keycloak và backend callback `/api/v1/auth/callback`.

**[REF-4]** Sakimura, N., Bradley, J., Jones, M., de Medeiros, B., & Mortimore, C. *OpenID Connect Core 1.0*. OpenID Foundation, 2014.  
URL: https://openid.net/specs/openid-connect-core-1_0.html

**Áp dụng:** Keycloak realm `cloudapi`, OIDC discovery, JWKS, `id_token`, issuer/audience validation.

**[REF-5]** Sakimura, N., Bradley, J., & Lodderstedt, T. *RFC 7636 — Proof Key for Code Exchange by OAuth Public Clients*. IETF, 2015.  
URL: https://datatracker.ietf.org/doc/html/rfc7636

**Áp dụng:** Frontend SPA dùng PKCE S256, gửi `code_verifier` về backend callback để đổi authorization code lấy token.

**[REF-6]** Jones, M., Bradley, J., & Sakimura, N. *RFC 7519 — JSON Web Token (JWT)*. IETF, 2015.  
URL: https://datatracker.ietf.org/doc/html/rfc7519

**Áp dụng:** Backend `jwt_verify.py` verify JWT bằng JWKS, `issuer`, `audience`, `exp`; gateway `jwt-hardening` chặn token yếu ở edge.

**[REF-7]** Jones, M., & Hildebrand, J. *RFC 7515 — JSON Web Signature (JWS)*. IETF, 2015.  
URL: https://datatracker.ietf.org/doc/html/rfc7515

**Áp dụng:** Keycloak ký access token bằng ES256; backend chỉ giữ public key qua JWKS, không giữ signing key.

**[REF-8]** Bertocci, V. *RFC 9068 — JSON Web Token Profile for OAuth 2.0 Access Tokens*. IETF, 2021.  
URL: https://datatracker.ietf.org/doc/html/rfc9068

**Áp dụng:** Chuẩn hoá cách kiểm tra claim OAuth2 access token như `iss`, `sub`, `aud`, `exp`, `iat`.

---

## 3. NIST / Mật mã học

**[REF-9]** Dworkin, M. *NIST SP 800-38D — Recommendation for Block Cipher Modes of Operation: GCM and GMAC*. NIST, 2007.  
URL: https://csrc.nist.gov/publications/detail/sp/800-38d/final

**Áp dụng:** `backend/app/security/aead_encryption.py` dùng AES-GCM với nonce 12 byte random, output `nonce || ciphertext || tag`; test integrity bằng `scripts/evaluation/e_c3_aead_integrity.py`.

**[REF-10]** Barker, E. *NIST SP 800-57 Part 1 Rev. 5 — Recommendation for Key Management*. NIST, 2020.  
URL: https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final

**Áp dụng:** Mô hình KEK/DEK với Vault Transit, wrapped DEK qua `VAULT_WRAPPED_DEK`, key rotation bằng `vault/init/vault-rotate.sh`.

**[REF-11]** Grassi, P., Garcia, M., & Fenton, J. *NIST SP 800-63B — Digital Identity Guidelines: Authentication and Lifecycle Management*. NIST, 2017, updated.  
URL: https://pages.nist.gov/800-63-3/sp800-63b.html

**Áp dụng:** TOTP cho tài khoản quyền cao, session/refresh token lifecycle qua Keycloak.

**[REF-12]** Rescorla, E. *RFC 8446 — The Transport Layer Security Protocol Version 1.3*. IETF, 2018.  
URL: https://datatracker.ietf.org/doc/html/rfc8446

**Áp dụng:** WAF, Frontend Nginx và Kong edge cấu hình TLS 1.3; nội bộ dùng TLS/mTLS với internal CA.

---

## 4. Công cụ / Stack chính

**[TOOL-1] Kong Gateway 3.6**  
URL: https://docs.konghq.com/gateway/

**Vai trò:** API Gateway, route `/api/v1/*`, custom plugins `jwt-hardening`, `opa-authz`, `hsts-header`, CORS, rate limiting, response transformer, upstream TLS verify.  
**File liên quan:** `gateway/kong.yml`, `gateway/kong.local.yml`, `gateway/plugins/`.

**[TOOL-2] Keycloak 24.0**  
URL: https://www.keycloak.org/documentation

**Vai trò:** Identity Provider, OIDC/OAuth2, PKCE, ES256 token signing, TOTP required action cho tài khoản demo.  
**File liên quan:** `idp/keycloak/realm-export.json`.

**[TOOL-3] Open Policy Agent 0.65.0**  
URL: https://www.openpolicyagent.org/docs/latest/

**Vai trò:** Policy Decision Point, Rego policy cho authorization theo role × method × path.  
**File liên quan:** `opa/policies/authz.rego`, `opa/tests/`.

**[TOOL-4] HashiCorp Vault 1.15**  
URL: https://developer.hashicorp.com/vault/docs

**Vai trò:** Transit engine cho KEK/DEK, wrap/unwrap DEK, key rotation lab.  
**File liên quan:** `vault/init/`, `vault/policies/dek-policy.hcl`.

**[TOOL-5] FastAPI 0.110 + Python cryptography**  
URL: https://fastapi.tiangolo.com/

**Vai trò:** Backend API, auth middleware, RBAC/BOLA, SSRF guard, webhook HMAC, AEAD encryption/decryption, OIDC callback.  
**File liên quan:** `backend/app/main.py`, `backend/app/api/v1/`, `backend/app/security/`.

**[TOOL-6] Docker Compose**  
URL: https://docs.docker.com/compose/

**Vai trò:** Orchestration single-host, phân tách `dmz-net`, `app-net`, `data-net`, `obs-net`, profile observability/tools.  
**File liên quan:** `docker-compose.yml`, `docker-compose.local.yml`.

---

## 5. Bảng đồng bộ version với project

| Thành phần | File cấu hình | Version/Image hiện tại |
|---|---|---|
| Kong | `docker-compose.yml` | `kong:3.6` |
| Keycloak | `docker-compose.yml` | `quay.io/keycloak/keycloak:24.0` |
| OPA | `docker-compose.yml` | `openpolicyagent/opa:0.65.0` |
| Vault | `docker-compose.yml` | `hashicorp/vault:1.15` |
| PostgreSQL | `docker-compose.yml` | `postgres:16` |
| Redis | `docker-compose.yml` | `redis:7` |
| Grafana | `docker-compose.yml` | `grafana/grafana:10.0.0` |
| Loki | `docker-compose.yml` | `grafana/loki:2.9.0` |
| FastAPI | `backend/requirements.txt` | `fastapi==0.110.0` |
| Python cryptography | `backend/requirements.txt` | `cryptography==42.0.5` |

---
