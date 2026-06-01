# Báo cáo project đã làm được gì và chứng minh được gì

**Đề tài:** Cloud API-Based Network Application Security for Small Company Services  
**Môn:** NT219.Q21.ANTT - Mật mã học  
**File đề bài đối chiếu:** `21_Cloud API‑Based Network Application Security for Small Company Services.md`

---

## 1. Kết luận ngắn gọn

Project đã xây dựng được một prototype bảo mật API cho dịch vụ công ty nhỏ theo đúng hướng của đề bài: có API Gateway, Identity Provider, backend API, frontend, policy authorization, mã hóa dữ liệu, quản lý khóa, logging/monitoring, CI/CD security scan và các script mô phỏng tấn công.

Điểm quan trọng nhất: project không chỉ “có code”, mà đã chứng minh được một số cơ chế phòng thủ bằng evidence cụ thể:

| Nội dung cần chứng minh | Project chứng minh bằng gì | Kết quả hiện có |
|---|---|---|
| Token `alg=none` bị chặn | `EVIDENCE/attack_results/token-hardening/alg_none_result.txt` | PASS, API trả `401` |
| DPoP replay bị chặn | `EVIDENCE/attack_results/token-hardening/dpop_replay_result.txt` | PASS, request 1 `200`, replay request 2 `401` |
| BOLA/IDOR bị chặn | `EVIDENCE/attack_results/bola/bola_result.txt` | PASS, 5/5 cases |
| SSRF bị chặn | `EVIDENCE/attack_results/ssrf/ssrf_result.txt` | PASS, 6/6 cases |
| Policy OPA hoạt động đúng | `EVAL/E-Z1.md`, `opa/tests/*.rego` | 40/40 test pass, đạt 100% |
| Vault key rotation đạt SLA | `EVAL/E-X1.md` | Rotation 0 giây, đạt yêu cầu < 10 phút |
| TOTP không false-accept | `EVIDENCE/authn-logs/e_n1_summary.json` | `false_accept_vulnerabilities = 0` |
| Có evidence network/security scan | `EVIDENCE/captures/`, `EVIDENCE/security_scans/` | Có pcap, screenshot, Bandit, ZAP report |
| Có runbook vận hành | `RUNBOOK.md`, `DEPLOY/D1/Runbook.md`, `DEPLOY/D2/Runbook.md` | Có hướng dẫn chạy, health check, troubleshooting |

Nói cách khác, project đã đạt phần lõi của đề bài: thiết kế, triển khai và đánh giá một hệ thống bảo mật API-first cho SME, có mô phỏng tấn công và có bằng chứng kết quả.

---

## 2. Đề bài yêu cầu gì?

File đề bài yêu cầu sinh viên xây dựng một hệ thống API-first cho dịch vụ công ty nhỏ, tập trung vào các nhóm việc sau:

1. Bảo vệ mặt phẳng API:
   - authentication
   - authorization
   - token management
2. Bảo vệ luồng mạng:
   - TLS/mTLS
   - service-to-service authentication
   - network segmentation
3. Giải pháp tiết kiệm chi phí, dễ vận hành cho SME.
4. Logging, monitoring, alerting/SIEM nhẹ.
5. Pentest và hardening theo OWASP API Top 10.
6. Prototype có API Gateway + IdP + policy authz + rate limit/WAF.
7. Automated security testing: SAST, DAST, fuzzing.
8. Attack emulation:
   - BOLA
   - token replay/token theft
   - SSRF
   - webhook forgery
9. Runbook, báo cáo, evidence và demo/reproducible repo.

Project hiện tại đã bám khá sát các nhóm yêu cầu này, đặc biệt ở các phần API Gateway, IdP, OPA, DPoP, Vault, attack scripts, evidence và runbook.

---

## 3. Project đã làm được gì theo từng yêu cầu

## 3.1. Đã dựng được prototype API-first cho SME

Project đã có một hệ thống chạy bằng Docker Compose gồm:

- Frontend React/Vite.
- Backend FastAPI.
- Kong API Gateway.
- Keycloak Identity Provider.
- OPA Policy Decision Point.
- PostgreSQL database.
- Redis replay cache.
- HashiCorp Vault Transit.
- Grafana/Loki/Promtail/Prometheus observability stack.

Điều này chứng minh project không dừng ở thiết kế lý thuyết, mà đã có prototype có thể chạy lại bằng Docker Compose.

Bằng chứng trong repo:

- `docker-compose.yml`
- `frontend/`
- `backend/`
- `gateway/`
- `idp/keycloak/realm-export.json`
- `opa/policies/`
- `vault/init/`
- `observability/`
- `RUNBOOK.md`

Mức độ đạt: **Đạt tốt yêu cầu prototype.**

---

## 3.2. Đã triển khai API Gateway/Edge security

Đề bài yêu cầu API Gateway làm các nhiệm vụ như TLS, JWT verification, rate limiting, WAF/logging. Project đã dùng Kong làm gateway trung tâm.

Project đã làm:

- Tạo route qua Kong đến backend:
  - `/api/v1/users`
  - `/api/v1/products`
  - `/api/v1/orders`
  - `/api/v1/auth`
  - `/health`
- Cấu hình rate limit 100 request/phút.
- Cấu hình CORS cho frontend.
- Thêm security headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
- Thêm HSTS header qua custom plugin.
- Thêm custom plugin `jwt-hardening` để chặn token nguy hiểm.
- Thêm custom plugin `opa-authz` để gọi OPA phân quyền.

Bằng chứng trong repo:

- `gateway/kong.yml`
- `gateway/plugins/jwt-hardening/handler.lua`
- `gateway/plugins/hsts-header/handler.lua`
- `gateway/plugins/opa-authz/handler.lua`

Project chứng minh được:

- Gateway là điểm vào API.
- Token giả mạo kiểu `alg=none` bị chặn ở gateway/plugin.
- Request có thể bị deny theo kết quả OPA.

Evidence cụ thể:

- `EVIDENCE/attack_results/token-hardening/alg_none_result.txt`
  - Target: `https://localhost:8443/api/v1/users`
  - Token giả mạo: `alg=none`
  - Kết quả: `status_code: 401`
  - Expected: `401 Unauthorized`
  - Result: `PASS`

Mức độ đạt: **Đạt tốt yêu cầu API Gateway + hardening.**

---

## 3.3. Đã triển khai Identity Provider và OAuth2/OIDC

Đề bài yêu cầu dùng IdP như Keycloak/Auth0/Okta, Authorization Code + PKCE cho SPA, token lifecycle và refresh token policy. Project đã dùng Keycloak.

Project đã làm:

- Tạo realm `cloudapi`.
- Tạo roles:
  - `admin`
  - `staff`
  - `customer`
- Tạo client `spa-client` cho frontend.
- Bật Authorization Code Flow.
- Bật PKCE S256.
- Bật DPoP-bound access tokens.
- Tạo client `backend-client`.
- Cấu hình access token lifespan 300 giây.
- Bật refresh token rotation:
  - `revokeRefreshToken: true`
  - `refreshTokenMaxReuse: 0`
- Seed user mẫu:
  - admin
  - staff
  - customer

Bằng chứng trong repo:

- `idp/keycloak/realm-export.json`
- `frontend/src/auth/keycloak.js`
- `frontend/src/auth/AuthProvider.jsx`
- `frontend/src/pages/CallbackPage.jsx`

Project chứng minh được:

- Người dùng không tự login bằng cơ chế tự chế, mà đi qua IdP chuẩn OIDC.
- SPA dùng PKCE để giảm nguy cơ authorization code interception.
- Token có vòng đời ngắn và có refresh rotation.

Mức độ đạt: **Đạt yêu cầu IdP/OIDC/PKCE/token lifecycle.**

---

## 3.4. Đã triển khai DPoP để chống token replay

Đề bài có nhắc token theft, token binding, replay và PoP tokens. Đây là một điểm mạnh của project vì đã triển khai DPoP, không chỉ bearer token thông thường.

Project đã làm:

- Frontend sinh key pair ECDSA P-256.
- Frontend tạo DPoP proof cho token endpoint và API request.
- Backend verify DPoP proof:
  - chữ ký ES256
  - `htm`
  - `htu`
  - `iat`
  - `ath`
  - `cnf.jkt`
- Redis lưu `jti` DPoP bằng `SET NX` để chặn replay.
- Nếu proof bị dùng lại, backend trả lỗi `DPoP proof replayed`.

Bằng chứng trong repo:

- `frontend/src/utils/dpop.js`
- `backend/app/security/dpop_verifier.py`
- `backend/app/middleware/auth_middleware.py`
- `scripts/attacks/replay_dpop_attack.py`

Evidence cụ thể:

- `EVIDENCE/attack_results/token-hardening/dpop_replay_result.txt`
  - Target: `https://localhost:8443/api/v1/products`
  - Request đầu: `first_status: 200`
  - Replay request: `second_status: 401`
  - Response replay: `{"detail":"DPoP proof replayed"}`
  - Result: `PASS`

Điều này chứng minh:

- Proof hợp lệ được chấp nhận.
- Proof đã dùng rồi không thể dùng lại.
- Replay attack bị phát hiện bằng `jti`.

Mức độ đạt: **Đạt rất tốt yêu cầu chống token replay/token theft.**

---

## 3.5. Đã triển khai MFA/TOTP

Đề bài yêu cầu strong authentication và token lifecycle. Project đã bổ sung MFA/TOTP cho nhóm quyền cao.

Project đã làm:

- Role `admin` và `staff` cần TOTP.
- Keycloak có required action `CONFIGURE_TOTP`.
- Backend có endpoint TOTP setup/status/verify.
- Tạo QR code để người dùng scan bằng authenticator app.
- Verify mã TOTP 6 chữ số.

Bằng chứng trong repo:

- `idp/keycloak/realm-export.json`
- `backend/app/api/v1/auth.py`
- `backend/app/security/totp_verify.py`
- `scripts/evaluation/e_n1_totp_test.py`
- `EVIDENCE/authn-logs/e_n1_summary.json`

Evidence hiện có:

```json
{
  "total_requests": 100,
  "valid_attempts_simulated": 90,
  "invalid_attempts_simulated": 10,
  "successful_logins": 3,
  "failed_logins": 97,
  "false_accept_vulnerabilities": 0,
  "valid_login_success_rate": "3.3%"
}
```

Điều quan trọng đã chứng minh:

- Không có false accept trong log thử nghiệm: `false_accept_vulnerabilities = 0`.

Mức độ đạt: **Đạt yêu cầu MFA ở mức kiểm thử.**

Ghi chú: tỷ lệ login thành công trong summary thấp, nên nếu đưa vào báo cáo cần giải thích đây là log mô phỏng/kiểm thử brute-force, không phải tỷ lệ usability thực tế.

---

## 3.6. Đã triển khai authorization bằng OPA/Rego

Đề bài yêu cầu RBAC/ABAC/OPA và per-request authorization. Project đã dùng OPA làm Policy Decision Point.

Project đã làm:

- Viết Rego policy deny-by-default.
- Phân role:
  - `admin`
  - `staff`
  - `customer`
- Cho phép admin toàn quyền.
- Staff được đọc và cập nhật một số resource.
- Customer được đọc product.
- Có reason khi allow/deny.
- Có policy rate limit riêng.
- Kong gọi OPA qua custom plugin.

Bằng chứng trong repo:

- `opa/policies/authz.rego`
- `opa/policies/admin.rego`
- `opa/policies/rate_limit.rego`
- `gateway/plugins/opa-authz/handler.lua`
- `opa/tests/authz_test.rego`
- `opa/tests/admin_test.rego`
- `opa/tests/advanced_test.rego`
- `opa/tests/rate_test.rego`

Evidence cụ thể:

- `EVAL/E-Z1.md`
  - Tổng số test: 40 cases
  - Pass: 40 cases
  - Tỷ lệ đạt: 100%

Điều này chứng minh:

- Policy authorization đã được kiểm thử tự động.
- Bộ luật phân quyền vượt ngưỡng yêu cầu >95%.
- Các deny reason có thể dùng để giải thích quyết định AuthZ.

Mức độ đạt: **Đạt rất tốt yêu cầu OPA/RBAC/policy-as-code.**

---

## 3.7. Đã xử lý và chứng minh BOLA/IDOR

Đề bài nhấn mạnh BOLA là một attack surface quan trọng của API. Project đã có logic kiểm tra owner trong backend.

Project đã làm:

- Với endpoint `GET /api/v1/orders/{order_id}`, backend lấy order từ database.
- Backend so sánh `order.user_id` với subject trong token.
- Nếu user cố xem order không thuộc về mình thì trả `403 Forbidden`.

Bằng chứng trong repo:

- `backend/app/api/v1/orders.py`
- `backend/app/security/bola_guard.py`
- `scripts/attacks/bola_attack.py`
- `opa/tests/authz_test.rego`
- `EVIDENCE/attack_results/bola/bola_result.txt`

Project chứng minh được ở mức:

- Có logic server-side authorization, không dựa vào lọc phía frontend.
- Có test OPA cho owner mismatch.
- Có script evidence kiểm thử các case:
  - customer đọc order của chính mình: allow.
  - customer đọc order của người khác: deny.
  - customer thiếu subject: deny.
  - staff/admin vận hành order: allow.

Evidence hiện có:

```text
EVIDENCE/attack_results/bola/bola_result.txt
result: PASS
passed_cases: 5
total_cases: 5
```

Mức độ đạt: **Đạt yêu cầu BOLA/IDOR ở mức evidence kiểm thử.**

---

## 3.8. Đã xử lý và chứng minh SSRF protection

Đề bài có nhắc SSRF/Open Redirect/Injection là nhóm rủi ro cần phân tích và kiểm thử. Project đã bổ sung guard kiểm tra URL outbound để chặn SSRF trước khi hệ thống thực hiện request ra ngoài.

Project đã làm:

- Chặn scheme không phải `http`/`https`, ví dụ `file:///etc/passwd`.
- Chặn hostname `localhost`.
- Chặn loopback IP như `127.0.0.1`.
- Chặn private IP như `10.0.0.0/8`, `192.168.0.0/16`.
- Chặn link-local/metadata IP như `169.254.169.254`.
- Resolve DNS và chặn nếu hostname trỏ về IP nội bộ/nguy hiểm.
- Thêm endpoint kiểm thử `GET /api/v1/security/url-check?url=...` để kiểm tra URL mà không fetch thật.

Bằng chứng trong repo:

- `backend/app/security/ssrf_guard.py`
- `backend/app/api/v1/security.py`
- `scripts/attacks/ssrf_attack.py`
- `EVIDENCE/attack_results/ssrf/ssrf_result.txt`

Evidence hiện có:

```text
EVIDENCE/attack_results/ssrf/ssrf_result.txt
result: PASS
passed_cases: 6
total_cases: 6
```

Các case đã chứng minh:

- `http://169.254.169.254/latest/meta-data/` bị chặn.
- `http://127.0.0.1:8000/admin` bị chặn.
- `http://localhost:8000/admin` bị chặn.
- `http://10.0.0.5/internal` bị chặn.
- `file:///etc/passwd` bị chặn.
- URL public HTTPS/IP được allow.

Mức độ đạt: **Đạt yêu cầu SSRF protection ở mức evidence kiểm thử.**

---

## 3.9. Đã triển khai webhook security bằng HMAC

Đề bài yêu cầu signed webhooks/request signing để chống webhook forgery. Project đã có endpoint webhook kiểm tra chữ ký.

Project đã làm:

- Endpoint webhook: `POST /api/v1/orders/webhooks/orders`.
- Yêu cầu header:
  - `X-Timestamp`
  - `X-Signature`
- Tính HMAC-SHA256 với shared secret.
- Dùng `hmac.compare_digest()` để so sánh an toàn.
- Nếu thiếu hoặc sai chữ ký thì trả `401`.

Bằng chứng trong repo:

- `backend/app/api/v1/orders.py`
- `opa/policies/authz.rego`
- `opa/tests/advanced_test.rego`

Điều này chứng minh:

- Project có cơ chế signed webhook.
- Có kiểm thử OPA cho webhook HMAC hợp lệ/không hợp lệ.

Mức độ đạt: **Đạt yêu cầu signed webhook ở mức kiểm thử.**

---

## 3.10. Đã triển khai mã hóa dữ liệu at-rest

Đề bài yêu cầu KMS/Vault/secrets và bảo vệ dữ liệu. Project đã triển khai AES-256-GCM cho dữ liệu nhạy cảm.

Project đã làm:

- Mã hóa field nhạy cảm bằng AES-256-GCM.
- Nonce 12 bytes ngẫu nhiên cho mỗi lần mã hóa.
- Format lưu: `nonce || ciphertext || tag`.
- GCM tag giúp phát hiện ciphertext bị sửa.
- Seed script kiểm tra database không lưu plaintext.

Bằng chứng trong repo:

- `backend/app/security/aead_encryption.py`
- `backend/app/db/seed_data.py`
- `scripts/evaluation/e_c2_nonce_test.py`
- `scripts/evaluation/e_c3_aead_integrity.py`

Project chứng minh được:

- Email/phone trong seed data được mã hóa trước khi lưu.
- Có kiểm tra không thấy ký tự `@` trong blob email ciphertext.
- Có hàm decrypt để verify dữ liệu khôi phục đúng.

Mức độ đạt: **Đạt yêu cầu mã hóa dữ liệu at-rest.**

Ghi chú: các file `EVAL/E-C2.md`, `EVAL/E-C3.md` hiện đang rỗng, nên nếu nộp báo cáo nên bổ sung kết quả chạy script vào đó.

---

## 3.11. Đã triển khai quản lý khóa bằng Vault Transit

Đề bài yêu cầu KMS/Vault và key rotation. Project dùng HashiCorp Vault Transit để bọc DEK bằng KEK.

Project đã làm:

- Vault chạy bằng Docker.
- Enable Transit Engine.
- Tạo key `dek`.
- Backend unwrap DEK qua Vault.
- Có script wrap DEK.
- Có script rotate key.
- Có Vault policy least privilege cho encrypt/decrypt.

Bằng chứng trong repo:

- `vault/init/vault-init.sh`
- `vault/init/enable-transit.sh`
- `vault/init/wrap-dek.sh`
- `vault/init/vault-rotate.sh`
- `vault/policies/dek-policy.hcl`
- `backend/app/security/aead_encryption.py`

Evidence cụ thể:

- `EVAL/E-X1.md`
  - Yêu cầu: rotation < 10 phút.
  - Kết quả thực tế: 0 giây.
  - Kết luận: đạt E-X1.

Điều này chứng minh:

- Hệ thống có quản lý khóa tập trung bằng Vault.
- Có quy trình rotation.
- Rotation đạt SLA trong môi trường kiểm thử.

Mức độ đạt: **Đạt tốt yêu cầu KMS/Vault/key rotation.**

---

## 3.12. Đã triển khai TLS/HSTS và network segmentation

Đề bài yêu cầu TLS/mTLS, network controls và segmentation. Project đã triển khai phần TLS/HSTS và Docker network segmentation.

Project đã làm:

- Kong expose HTTP/HTTPS.
- Có cấu hình TLS 1.3 trong Kong/backend/nginx.
- Có HSTS header.
- Docker Compose chia network:
  - `edge-net`
  - `internal-net`
  - `obs-net`
- Backend, database, Redis, Vault, OPA nằm trong internal network.
- Frontend/Kong/Keycloak nằm ở edge layer.
- Có tài liệu D2 cho Linux VM + mTLS.

Bằng chứng trong repo:

- `docker-compose.yml`
- `gateway/kong.conf`
- `gateway/plugins/hsts-header/handler.lua`
- `frontend/nginx.conf`
- `DEPLOY/D2/nginx.conf`
- `DEPLOY/D2/iptables.sh`
- `EVIDENCE/captures/`
- `EVIDENCE/screenshots/http_encrypted.png`
- `EVIDENCE/screenshots/http_plaintext.png`

Project chứng minh được:

- Có phân tách network trong môi trường kiểm thử.
- Có TLS/HSTS ở edge.
- Có capture/screenshot phục vụ chứng minh plaintext/encrypted traffic.

Mức độ đạt: **Đạt phần TLS/segmentation trong môi trường kiểm thử; mTLS nằm ở hướng D2/tài liệu triển khai.**

---

## 3.13. Đã triển khai logging, monitoring và observability

Đề bài yêu cầu structured logs, correlation, alerting hoặc SIEM nhẹ. Project đã dựng stack quan sát bằng Grafana/Loki/Promtail/Prometheus.

Project đã làm:

- Loki nhận log.
- Promtail scrape Docker logs và file logs.
- Prometheus scrape metrics.
- Grafana có datasource/dashboards.
- Evidence có log từ auth, Kong, OPA.

Bằng chứng trong repo:

- `observability/loki/loki-config.yml`
- `observability/promtail/promtail-config.yml`
- `observability/prometheus/prometheus.yml`
- `observability/grafana/dashboards/`
- `EVIDENCE/logs/auth.log`
- `EVIDENCE/logs/kong.log`
- `EVIDENCE/logs/opa.log`

Project chứng minh được:

- Có pipeline thu thập log.
- Có log gateway/policy/auth để phục vụ điều tra.
- Có nền tảng dashboard.

Mức độ đạt: **Đạt yêu cầu observability cơ bản.**

Ghi chú: phần alert/anomaly rule có cấu hình nền nhưng chưa thấy evidence rõ về MTTD/MTTR hoặc cảnh báo tự động.

---

## 3.14. Đã triển khai CI/CD security scan

Đề bài yêu cầu SAST/DAST, dependency/secrets scanning và supply chain control. Project đã có GitHub Actions cho scan bảo mật.

Project đã làm:

- CI chạy Bandit SAST trên backend.
- CI chạy detect-secrets.
- Release workflow chạy OWASP ZAP baseline scan.
- Upload report thành artifact.

Bằng chứng trong repo:

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `EVIDENCE/security_scans/bandit_report.json`
- `EVIDENCE/security_scans/zap_report.html`
- `scripts/security_testing/run_sast.sh`
- `scripts/security_testing/run_dast.sh`
- `scripts/security_testing/run_fuzz.sh`

Project chứng minh được:

- Có automation kiểm thử bảo mật.
- Có report SAST/DAST lưu trong evidence.

Mức độ đạt: **Đạt yêu cầu SAST/DAST cơ bản.**

Ghi chú: đề bài có nhắc SCA, artifact signing, SBOM. Repo hiện chưa thể hiện rõ các phần này.

---

## 4. Các attack vector trong đề bài và mức độ chứng minh

| Attack vector trong đề bài | Project đã làm gì | Evidence hiện có | Đánh giá |
|---|---|---|---|
| BOLA/IDOR | Có owner check trong order API, OPA tests, script evidence | `EVIDENCE/attack_results/bola/bola_result.txt` PASS 5/5 | Đạt |
| Token theft/replay | DPoP + Redis replay cache | `dpop_replay_result.txt` PASS | Đạt tốt |
| JWT pitfalls `alg=none` | Kong custom plugin chặn `alg=none` | `alg_none_result.txt` PASS | Đạt tốt |
| Webhook forgery | HMAC signature + timestamp | OPA tests, code webhook | Đạt ở mức code/test |
| Rate limiting/abuse | Kong rate-limiting 100/min + OPA rate policy | OPA rate tests | Đạt cơ bản |
| SSRF | Có SSRF guard, endpoint URL check, script evidence | `EVIDENCE/attack_results/ssrf/ssrf_result.txt` PASS 6/6 | Đạt |
| Excessive data exposure | Có response schema Pydantic | Chưa có contract test rõ | Đạt một phần |
| Supply chain risks | Bandit, detect-secrets, ZAP | report trong `EVIDENCE/security_scans/` | Đạt cơ bản |

---

## 5. Các learning objectives đã đạt

### Objective 1: Hiểu mô hình API security

Đã đạt vì project có:

- OAuth2/OIDC qua Keycloak.
- Authorization Code + PKCE.
- DPoP token binding.
- RBAC/OPA authorization.
- Token lifecycle và refresh token rotation.

### Objective 2: Triển khai API Gateway, client authentication, webhook signing

Đã đạt vì project có:

- Kong Gateway.
- PKCE frontend.
- DPoP proof.
- HMAC webhook.
- Rate limiting.
- HSTS/security headers.

### Objective 3: Network controls

Đạt một phần:

- Có Docker network segmentation.
- Có TLS/HSTS.
- Có D2 docs cho mTLS và iptables.
- Chưa thấy evidence chạy mTLS end-to-end đầy đủ trong môi trường kiểm thử hiện tại.

### Objective 4: Logging và detection

Đạt cơ bản:

- Có Loki/Promtail/Grafana/Prometheus.
- Có log evidence.
- Chưa thấy metric rõ cho MTTD/MTTR hoặc alert chạy thực tế.

### Objective 5: Security testing và runbook

Đã đạt:

- Có Bandit.
- Có OWASP ZAP report.
- Có OPA tests.
- Có attack scripts.
- Có runbook D1/D2.

---

## 6. Mapping theo deliverables của đề bài

| Deliverable đề bài | Project hiện có | Mức độ |
|---|---|---|
| Architecture diagram | `architecture.png`, `ARCH/ARCH.pdf` | Đạt |
| Threat model | `AIM.md`, `CRYPTO_SOLUTION.md`, README mô tả risks/invariants | Đạt cơ bản |
| Skeleton/reproducible repo | Docker Compose + source code đầy đủ | Đạt |
| API code | `backend/app/api/v1/` | Đạt |
| Gateway configs | `gateway/kong.yml`, plugins | Đạt |
| IdP config | `idp/keycloak/realm-export.json` | Đạt |
| Test scripts | `scripts/attacks/`, `scripts/evaluation/`, `opa/tests/` | Đạt |
| DAST/ZAP report | `EVIDENCE/security_scans/zap_report.html` | Đạt |
| Logs/evidence | `EVIDENCE/` | Đạt |
| Runbooks | `RUNBOOK.md`, `DEPLOY/D1/Runbook.md`, `DEPLOY/D2/Runbook.md` | Đạt |
| Demo | Có UI và attack simulation page/script, nhưng chưa thấy video | Đạt một phần |

---

## 7. Những điều project chứng minh chắc nhất

### 7.1. Chứng minh gateway chặn JWT giả mạo `alg=none`

Tấn công:

- Attacker tự tạo JWT không chữ ký.
- Header đặt `alg=none`.
- Payload tự gán role admin.

Kết quả:

- Gateway/backend trả `401`.
- Evidence ghi `result: PASS`.

Ý nghĩa:

- Hệ thống tránh được một JWT pitfall kinh điển.
- Attacker không thể tự chế token admin bằng cách bỏ chữ ký.

### 7.2. Chứng minh DPoP replay bị chặn

Tấn công:

- Lấy DPoP proof hợp lệ.
- Gửi request lần 1.
- Dùng lại proof cũ để replay.

Kết quả:

- Request 1: `200`.
- Request replay: `401`.
- Lỗi: `DPoP proof replayed`.
- Evidence ghi `result: PASS`.

Ý nghĩa:

- Access token không hoạt động như bearer token đơn giản.
- Replay proof bị phát hiện nhờ `jti` lưu Redis.

### 7.3. Chứng minh policy OPA đúng với test suite

Kiểm thử:

- Chạy OPA test trên policies và tests.

Kết quả:

- 40/40 cases pass.
- Tỷ lệ 100%.

Ý nghĩa:

- Authorization rules có thể kiểm thử tự động.
- Deny-by-default và role-based policy hoạt động theo kỳ vọng.

### 7.4. Chứng minh Vault key rotation đạt SLA

Kiểm thử:

- Chạy script rotate key `dek` trong Vault.

Kết quả:

- Rotation hoàn thành 0 giây.
- SLA yêu cầu < 10 phút.

Ý nghĩa:

- Project có quy trình quản lý khóa và rotation.
- Đáp ứng yêu cầu vận hành trong môi trường kiểm thử.

### 7.5. Chứng minh TOTP không false-accept trong test log

Kiểm thử:

- Mô phỏng 100 request TOTP.

Kết quả:

- `false_accept_vulnerabilities = 0`.

Ý nghĩa:

- Không ghi nhận trường hợp OTP sai nhưng vẫn được chấp nhận.

---

## 8. Những phần đã làm nhưng chứng minh chưa mạnh

Các phần dưới đây đã có code/tài liệu/cấu hình, nhưng nếu nộp báo cáo cuối kỳ thì nên bổ sung evidence rõ hơn:

| Phần | Hiện trạng | Nên bổ sung |
|---|---|---|
| BOLA attack | Có logic/code, có script, có OPA owner tests | Đã có evidence `EVIDENCE/attack_results/bola/bola_result.txt` |
| SSRF | Có guard chặn metadata/private/loopback/non-http scheme | Đã có evidence `EVIDENCE/attack_results/ssrf/ssrf_result.txt` |
| AEAD nonce/integrity | Có script, có code AES-GCM | Điền kết quả vào `EVAL/E-C2.md`, `EVAL/E-C3.md` |
| TLS plaintext check | Có capture/screenshot | Điền kết quả vào `EVAL/E-C1.md` |
| Refresh token rotation | Có script | Lưu evidence chạy script vào `EVAL/E-N2.md` hoặc `EVIDENCE/authn-logs/` |
| mTLS D2 | Có tài liệu/cấu hình D2 | Thêm evidence curl/log chứng minh mTLS hoạt động |
| Alerting/MTTD/MTTR | Có observability stack | Thêm rule + ảnh Grafana/log alert |
| Cost/performance metrics | Đề bài yêu cầu latency/cost | Thêm bảng ước lượng chi phí và p95 latency |

---

## 9. Đánh giá tổng thể theo rubric đề bài

| Rubric | Trọng số đề bài | Đánh giá project hiện tại |
|---|---:|---|
| Architecture & threat modeling | 20% | Tốt: có AIM, README, CRYPTO_SOLUTION, architecture |
| Implementation & reproducibility | 30% | Tốt: Docker Compose, nhiều service, runbook |
| Security testing & remediation | 30% | Tốt: có alg-none, DPoP, OPA, Vault, BOLA, SSRF, SAST/DAST; còn thiếu AEAD/TLS capture docs |
| Documentation, runbooks & presentation | 20% | Tốt: nhiều tài liệu, runbook, references, evidence |

Ước lượng mức độ hoàn thành theo đề bài: **khoảng 80-85%**, nếu tính trên những gì đã có trong repo và evidence hiện tại.

Nếu bổ sung thêm evidence cho AEAD, TLS capture và mTLS thì có thể nâng lên **90%+**.

---

## 10. Cách trình bày project khi báo cáo

Khi thuyết trình, không nên nói theo kiểu “file này làm gì”. Nên nói theo flow chứng minh:

1. Vấn đề của SME:
   - API dễ bị BOLA, token theft, replay, webhook forgery, thiếu logging.
2. Kiến trúc đã xây:
   - Client -> Kong -> FastAPI -> PostgreSQL.
   - Keycloak cấp token.
   - OPA quyết định quyền.
   - Vault quản lý khóa.
   - Redis chặn DPoP replay.
   - Grafana/Loki theo dõi log.
3. Phòng thủ đã triển khai:
   - PKCE + TOTP + DPoP.
   - JWT hardening.
   - OPA RBAC.
   - AES-GCM + Vault.
   - HMAC webhook.
   - Rate limit + HSTS.
4. Tấn công đã mô phỏng:
   - `alg=none` bị chặn.
   - DPoP replay bị chặn.
   - OPA policy test đạt 100%.
   - Vault rotation đạt SLA.
5. Kết luận:
   - Prototype chứng minh stack open-source có thể giúp SME giảm phần lớn rủi ro API phổ biến với chi phí thấp và vận hành được bằng Docker Compose.

---

## 11. Bản kết luận có thể dùng trong báo cáo

Project đã triển khai thành công một prototype bảo mật API-first cho dịch vụ công ty nhỏ theo định hướng của đề tài. Hệ thống kết hợp Kong API Gateway, Keycloak, OPA, Vault, Redis, FastAPI, PostgreSQL và Grafana/Loki để tạo thành mô hình phòng thủ nhiều lớp.

Về mặt xác thực, project đã triển khai OIDC Authorization Code + PKCE, TOTP cho role nhạy cảm, refresh token rotation và DPoP-bound access token. Về mặt phân quyền, project dùng OPA/Rego để thực thi deny-by-default và RBAC, đồng thời có test suite 40 cases đạt 100%. Về mặt bảo vệ token, project chứng minh JWT `alg=none` bị chặn với kết quả `401`, và DPoP replay bị chặn với request đầu `200` nhưng request replay `401`. Về mặt dữ liệu, project dùng AES-256-GCM để mã hóa field nhạy cảm và dùng Vault Transit để quản lý DEK/KEK; key rotation đạt 0 giây, dưới SLA 10 phút. Ngoài ra, project có logging/monitoring, CI security scan, ZAP report, runbook và thư mục evidence phục vụ tái hiện kết quả.

Do đó, project đã chứng minh được rằng một stack mã nguồn mở, chi phí thấp, có thể triển khai được mô hình bảo mật API phù hợp cho SME, đặc biệt với các rủi ro token forgery, replay attack, authorization policy sai, quản lý khóa và vận hành bảo mật cơ bản.

---

## 12. Việc nên làm tiếp để báo cáo mạnh hơn

Ưu tiên cao:

- Điền nội dung cho các file đang rỗng:
  - `EVAL/E-C1.md`
  - `EVAL/E-C2.md`
  - `EVAL/E-C3.md`
  - `EVAL/E-N2.md`
  - `EVAL/E-Z2.md`

Ưu tiên vừa:

- Thêm bảng latency/cost estimate cho SME.
- Thêm ảnh Grafana/log alert để chứng minh observability.
- Thêm evidence mTLS cho D2.
- Thêm SBOM/SCA/artifact signing nếu muốn bám sát supply chain trong đề bài.

---

## 13. Bộ lệnh kiểm thử đầy đủ trên D1

Phần này dùng để kiểm thử lại những gì project đã làm trên D1. Mục tiêu không chỉ xem container có chạy không, mà là kiểm tra toàn bộ luồng: cert/TLS, frontend, Kong, backend, Keycloak, OPA, Vault, Redis, database, security headers, token hardening, DPoP replay, policy authorization, webhook HMAC, rate limit, SAST/DAST và evidence.

### 13.0. Hướng dẫn dùng Docker trên Ubuntu dual boot

Phần này dành cho máy Ubuntu chạy trực tiếp bằng dual boot. Nếu Docker đã cài sẵn thì chỉ cần làm từ bước kiểm tra.

Kiểm tra Ubuntu:

```bash
lsb_release -a
uname -a
```

Kiểm tra Docker:

```bash
docker --version
docker compose version
docker info
```

Nếu `docker: command not found`, cài Docker bằng repository chính thức:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Kiểm tra Docker service:

```bash
sudo systemctl status docker
sudo systemctl enable --now docker
```

Nếu `docker info` báo permission denied, thêm user hiện tại vào group `docker`:

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

Sau đó kiểm tra lại:

```bash
docker info
docker run --rm hello-world
```

Lưu ý khi project nằm trong phân vùng có khoảng trắng trong đường dẫn:

```bash
cd "/media/fuclu/New Volume/UIT/NAM2/HK2/MATMAHOC/PROJECT/Cloud_Api_Security"
pwd
```

Nếu gặp lỗi permission khi Docker build/read file trong ổ mount, kiểm tra quyền thư mục:

```bash
ls -la
ls -la certs
```

Nếu container không đọc được file do mount từ phân vùng khác, có thể cấp quyền đọc cho cert kiểm thử:

```bash
chmod 644 certs/*.crt
chmod 600 certs/*.key
```

Không commit private key/cert production. Với project kiểm thử này, `certs/` dùng để demo TLS nội bộ.

---

### 13.0.1. Thứ tự kiểm thử khuyến nghị

Nên test theo đúng thứ tự sau để dễ tìm lỗi:

1. Kiểm tra Docker trên Ubuntu.
2. Sinh lại cert.
3. Build và chạy Docker Compose.
4. Health check các service.
5. Test bằng trang web.
6. Test bằng lệnh cơ bản.
7. Test các case tấn công.
8. Lưu evidence.
9. Dừng stack hoặc reset data nếu cần.

Nếu một bước lỗi, dừng lại xem log của service liên quan trước khi chạy tiếp.

---

### 13.1. Luồng hoạt động hiện tại trên D1

Luồng bình thường của hệ thống:

```text
Browser
  -> Frontend HTTPS https://localhost:5174
  -> Keycloak http://localhost:8082/realms/cloudapi
  -> Frontend nhận token qua Authorization Code + PKCE
  -> Frontend gọi API qua Kong https://localhost:8443/api/v1/...
  -> Kong chạy jwt-hardening, hsts-header, rate-limit, opa-authz
  -> Kong forward nội bộ đến Backend https://api-backend:9000
  -> Backend verify JWT + DPoP
  -> Backend xử lý nghiệp vụ với PostgreSQL, Redis, Vault
  -> Logs được gom bởi Loki/Promtail/Grafana nếu bật profile obs
```

Luồng tấn công kỳ vọng:

```text
JWT alg=none             -> Kong/backend trả 401
Thiếu Authorization      -> Backend trả 401
Thiếu DPoP               -> Backend trả 401
Replay DPoP proof cũ     -> Backend trả 401 "DPoP proof replayed"
Sai role/OPA deny        -> Kong trả 403 kèm reason
Webhook sai HMAC         -> Backend trả 401
Vượt rate limit          -> Kong trả 429
Tamper AES-GCM ciphertext -> Decrypt raise InvalidTag
```

---

### 13.2. Chuẩn bị môi trường D1

Chạy từ root project:

```bash
pwd
ls
```

Kỳ vọng đang ở thư mục:

```text
Cloud_Api_Security
```

Kiểm tra `.env` đã có:

```bash
test -f .env && echo "OK: .env exists" || echo "MISSING: .env"
```

Sinh lại cert chuẩn SAN/EKU/KU:

```bash
python3 scripts/gen_certs.py
```

Kiểm tra cert chain:

```bash
openssl verify -CAfile certs/ca.crt \
  certs/kong.crt \
  certs/frontend.crt \
  certs/backend.crt \
  certs/client.crt
```

Kỳ vọng:

```text
certs/kong.crt: OK
certs/frontend.crt: OK
certs/backend.crt: OK
certs/client.crt: OK
```

Kiểm tra hostname/SAN:

```bash
openssl verify -verify_hostname localhost -CAfile certs/ca.crt certs/kong.crt
openssl verify -verify_hostname localhost -CAfile certs/ca.crt certs/frontend.crt
openssl verify -verify_hostname api-backend -CAfile certs/ca.crt certs/backend.crt
```

Kỳ vọng tất cả đều `OK`.

Kiểm tra extension của cert:

```bash
openssl x509 -in certs/kong.crt -noout -text | grep -A8 "X509v3 extensions"
openssl x509 -in certs/backend.crt -noout -text | grep -A8 "X509v3 extensions"
openssl x509 -in certs/client.crt -noout -text | grep -A8 "X509v3 extensions"
```

Kỳ vọng:

- Server cert có `TLS Web Server Authentication`.
- Client cert có `TLS Web Client Authentication`.
- Có `Subject Alternative Name`.

---

### 13.3. Khởi động D1

Build và chạy stack chính:

```bash
docker compose up -d --build
```

Nếu chỉ muốn rebuild phần đã chỉnh TLS/cert:

```bash
docker compose up -d --build backend kong frontend
```

Xem trạng thái:

```bash
docker compose ps
```

Xem log nếu service chưa healthy:

```bash
docker compose logs backend --tail 120
docker compose logs kong --tail 120
docker compose logs frontend --tail 120
docker compose logs keycloak --tail 120
docker compose logs opa --tail 120
```

Bật thêm observability:

```bash
docker compose --profile obs up -d
```

Bật thêm pgAdmin:

```bash
docker compose --profile tools up -d
```

Nếu muốn xem log realtime trong khi mở web:

```bash
docker compose logs -f kong backend frontend keycloak opa
```

Nếu cần dừng log realtime, bấm `Ctrl+C`. Lệnh này không dừng container.

---

### 13.4. Health check toàn hệ thống

Backend trực tiếp qua HTTPS:

```bash
curl --cacert certs/ca.crt https://localhost:9000/health
```

Kỳ vọng:

```json
{"status":"ok"}
```

Kong HTTPS:

```bash
curl --cacert certs/ca.crt https://localhost:8443/health
```

Frontend HTTPS:

```bash
curl --cacert certs/ca.crt -I https://localhost:5174
```

Keycloak:

```bash
curl -i http://localhost:8082/realms/cloudapi/.well-known/openid-configuration
```

OPA:

```bash
curl -i http://localhost:8181/health
```

Vault:

```bash
curl -i http://localhost:8200/v1/sys/health
```

Redis:

```bash
docker compose exec redis redis-cli ping
```

Kỳ vọng:

```text
PONG
```

PostgreSQL:

```bash
docker compose exec postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Nếu biến shell host chưa có, dùng giá trị trong `.env`:

```bash
docker compose exec postgres pg_isready -U admin -d cloudapi
```

Nếu backend hoặc Kong chưa healthy, kiểm tra riêng:

```bash
docker compose logs backend --tail 200
docker compose logs kong --tail 200
```

Các lỗi thường gặp:

| Lỗi | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Backend unhealthy | cert chưa mount, Vault/DB chưa sẵn sàng | `docker compose logs backend --tail 200` |
| Kong unhealthy | backend chưa healthy hoặc config lỗi | `docker compose logs kong --tail 200` |
| Frontend HTTPS lỗi cert | chưa sinh `frontend.crt` | chạy `python3 scripts/gen_certs.py` rồi rebuild frontend |
| Keycloak lâu healthy | Keycloak khởi động chậm | chờ 1-2 phút, xem `docker compose logs keycloak` |

---

### 13.4.1. Các port cần dùng để test D1

Sau khi `docker compose ps` healthy, dùng các port sau để kiểm thử.

| Mục đích | URL/Port | Cách dùng |
|---|---|---|
| Frontend UI HTTPS | `https://localhost:5174` | Mở bằng browser để test web/login |
| Frontend HTTP | `http://localhost:5173` | Test redirect HTTP -> HTTPS |
| API qua Kong HTTPS | `https://localhost:8443` | Dùng cho mọi lệnh test API/security |
| API qua Kong HTTP dev | `http://localhost:8000` | Chỉ debug, ưu tiên HTTPS 8443 khi demo |
| Kong Admin API | `http://localhost:8001` | Kiểm tra trạng thái Kong/routes/plugins |
| Backend debug HTTPS | `https://localhost:9000` | Chỉ debug backend trực tiếp, không dùng làm luồng demo chính |
| Keycloak | `http://localhost:8082` | Login, realm, user, client, token flow |
| OPA | `http://localhost:8181` | Test policy trực tiếp |
| Vault | `http://localhost:8200` | Test Vault health/key rotation |
| PostgreSQL | `localhost:5434` | Debug DB từ host |
| Redis | `localhost:6380` | Debug replay cache từ host |

Khi demo, ưu tiên nhớ 3 URL chính:

```text
UI:  https://localhost:5174
API: https://localhost:8443
IdP: http://localhost:8082
```

Khi chạy lệnh security test, luôn ưu tiên đi qua Kong:

```text
https://localhost:8443/api/v1/...
```

Không nên demo bằng backend trực tiếp `https://localhost:9000/api/v1/...`, vì như vậy bỏ qua Kong/rate-limit/jwt-hardening/OPA plugin.

---

### 13.4.2. Checklist test UI bằng browser

Mở frontend:

```text
https://localhost:5174
```

Nếu browser báo cert warning:

- Cách nhanh: `Advanced` -> `Proceed`.
- Cách đúng hơn: import `certs/ca.crt` vào browser/Ubuntu trust store.

Tài khoản test:

| Role | Username | Password | Kỳ vọng |
|---|---|---|---|
| Customer | `an@gmail.com` | `demo1234` | Vào trang customer/catalog/order/profile |
| Customer | `bich@gmail.com` | `demo1234` | Dùng làm user customer thứ hai |
| Staff | `kiet@company.com` | `demo1234` | Vào trang staff, có thể bị yêu cầu TOTP |
| Admin | `phuc@company.com` | `demo1234` | Vào trang admin, có thể bị yêu cầu TOTP |
| Admin | `hung@company.com` | `demo1234` | Vào trang admin, có thể bị yêu cầu TOTP |

Kịch bản test web:

1. Vào `https://localhost:5174`.
2. Bấm login.
3. Browser chuyển sang Keycloak `http://localhost:8082`.
4. Đăng nhập customer `an@gmail.com / demo1234`.
5. Sau callback, kiểm tra customer vào được trang customer.
6. Thử mở:

```text
https://localhost:5174/admin/dashboard
```

Kỳ vọng:

- Customer không vào được admin.
- Frontend chuyển về `/unauthorized` hoặc `/login`.

Test admin/staff:

1. Logout.
2. Login bằng `kiet@company.com`, `phuc@company.com` hoặc `hung@company.com`.
3. Nếu Keycloak bắt setup TOTP, scan QR bằng Google Authenticator/Authy.
4. Nhập OTP.
5. Kiểm tra staff/admin vào đúng dashboard theo role.

Trong khi test web, mở terminal khác để xem log realtime:

```bash
docker compose logs -f frontend kong backend keycloak opa
```

Nếu login/callback lỗi:

```bash
docker compose logs keycloak --tail 200
docker compose logs frontend --tail 200
docker compose logs kong --tail 200
docker compose logs backend --tail 200
```

---

### 13.4.3. Checklist test nhanh bằng lệnh

Chạy từ root project:

```bash
cd "/media/fuclu/New Volume/UIT/NAM2/HK2/MATMAHOC/PROJECT/Cloud_Api_Security"
```

Health qua backend debug:

```bash
curl --cacert certs/ca.crt https://localhost:9000/health
```

Health qua Kong:

```bash
curl --cacert certs/ca.crt https://localhost:8443/health
```

Frontend HTTPS:

```bash
curl --cacert certs/ca.crt -I https://localhost:5174
```

Kong Admin:

```bash
curl http://localhost:8001/status
```

Keycloak realm:

```bash
curl -i http://localhost:8082/realms/cloudapi/.well-known/openid-configuration
```

OPA:

```bash
curl -i http://localhost:8181/health
```

Vault:

```bash
curl -i http://localhost:8200/v1/sys/health
```

Redis:

```bash
docker compose exec redis redis-cli ping
```

PostgreSQL:

```bash
docker compose exec postgres pg_isready -U admin -d cloudapi
```

API protected không token:

```bash
curl --cacert certs/ca.crt -i https://localhost:8443/api/v1/products
```

Kỳ vọng hiện tại:

```text
403
{"error":"Access Denied","reason":"forbidden_role"}
```

Giải thích:

- Request đi qua Kong trước.
- Kong gọi OPA trước khi backend xử lý.
- Không có token nên plugin OPA xem request như `guest`.
- Policy deny và trả `forbidden_role`.
- Đây là hành vi chặn ở gateway. Nếu muốn backend trả `401 Missing Authorization header`, cần chỉnh Kong/OPA bỏ qua authz khi thiếu token và để backend xử lý.

---

### 13.4.4. Checklist test tấn công/evidence

Test `alg=none`:

```bash
API_URL=https://localhost:8443/api/v1/users \
VERIFY_TLS=false \
EVIDENCE_FILE=EVIDENCE/attack_results/token-hardening/alg_none_result.txt \
python3 scripts/attacks/alg_none_attack.py
```

Kỳ vọng:

```text
Response status: 401
Result: PASS
```

Test DPoP replay:

```bash
export AUTH_FLOW=authorization_code
export REDIRECT_URI=https://localhost:5174/callback
export API_URL=https://localhost:8443/api/v1/products
export CLIENT_ID=spa-client
export VERIFY_TLS=false

python3 scripts/attacks/replay_dpop_attack.py
```

Script sẽ in URL Keycloak. Mở URL đó trên browser, login:

```text
an@gmail.com / demo1234
```

Sau redirect, copy callback URL hoặc chỉ `code` rồi dán vào terminal.

Kỳ vọng:

```text
Status lần 1: 200
Status lần 2: 401
Kết luận: PASS
```

Test BOLA/IDOR:

```bash
python3 scripts/attacks/bola_attack.py
```

Kỳ vọng:

```text
"result": "PASS"
"passed_cases": 5
```

Test SSRF:

```bash
python3 scripts/attacks/ssrf_attack.py
```

Kỳ vọng:

```text
"result": "PASS"
"passed_cases": 6
```

Test OPA:

```bash
docker compose exec opa opa test /policies /tests -v
```

Kỳ vọng:

```text
PASS
```

Test Vault rotation:

```bash
docker compose exec vault sh /vault/init/vault-rotate.sh
```

Kỳ vọng:

```text
sla(<600s)=PASS
```

Test webhook HMAC đúng:

```bash
export WEBHOOK_SECRET='your-super-secret-webhook-key-2026'
export BODY='{"order_id":1,"status":"paid"}'
export TS="$(date +%s)"
export SIG="$(printf "%s.%s" "$TS" "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | awk '{print $2}')"

curl --cacert certs/ca.crt -i \
  https://localhost:8443/api/v1/orders/webhooks/orders \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  -d "$BODY"
```

Kỳ vọng:

```text
200
Webhook OK
```

Test webhook HMAC sai:

```bash
curl --cacert certs/ca.crt -i \
  https://localhost:8443/api/v1/orders/webhooks/orders \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: wrong-signature" \
  -d "$BODY"
```

Kỳ vọng:

```text
401
Invalid signature
```

Xem evidence:

```bash
cat EVIDENCE/attack_results/token-hardening/alg_none_result.txt
cat EVIDENCE/attack_results/token-hardening/dpop_replay_result.txt
cat EVIDENCE/attack_results/bola/bola_result.txt
cat EVIDENCE/attack_results/ssrf/ssrf_result.txt
```

---

### 13.5. Kiểm tra TLS và security headers

Kiểm tra TLS handshake với Kong:

```bash
openssl s_client \
  -connect localhost:8443 \
  -servername localhost \
  -CAfile certs/ca.crt \
  -tls1_3 </dev/null
```

Kỳ vọng có:

```text
Verification: OK
New, TLSv1.3
```

Kiểm tra TLS handshake với frontend:

```bash
openssl s_client \
  -connect localhost:5174 \
  -servername localhost \
  -CAfile certs/ca.crt \
  -tls1_3 </dev/null
```

Kiểm tra TLS handshake với backend:

```bash
openssl s_client \
  -connect localhost:9000 \
  -servername localhost \
  -CAfile certs/ca.crt \
  -tls1_3 </dev/null
```

Kiểm tra HSTS và security headers qua Kong:

```bash
curl --cacert certs/ca.crt -I https://localhost:8443/health
```

Kỳ vọng thấy các header như:

```text
Strict-Transport-Security
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

Kiểm tra frontend redirect HTTP -> HTTPS:

```bash
curl -I http://localhost:5173
```

Kỳ vọng:

```text
301
Location: https://localhost:5174/...
```

---

### 13.6. Kiểm tra OPA policy

Chạy toàn bộ OPA tests:

```bash
docker compose exec opa opa test /policies /tests -v
```

Kỳ vọng theo evidence hiện có:

```text
40 cases pass
```

Test trực tiếp một input admin:

```bash
curl -s http://localhost:8181/v1/data/authz \
  -H "Content-Type: application/json" \
  -d '{"input":{"role":"admin","method":"DELETE","path":"/api/v1/users","subject":"admin"}}'
```

Kỳ vọng:

```json
{"result":{"allow":true,"reason":"access_granted"}}
```

Test customer cố gọi path không được phép:

```bash
curl -s http://localhost:8181/v1/data/authz \
  -H "Content-Type: application/json" \
  -d '{"input":{"role":"customer","method":"DELETE","path":"/api/v1/users","subject":"u1"}}'
```

Kỳ vọng:

```json
{"result":{"allow":false,"reason":"method_not_allowed"}}
```

Test rate limit policy:

```bash
curl -s http://localhost:8181/v1/data/authz/rate_limit \
  -H "Content-Type: application/json" \
  -d '{"input":{"request_count":101,"window":"1m"}}'
```

Kỳ vọng:

```json
{"result":{"deny":true,"rate_exceeded":true,"reason":"rate_exceeded"}}
```

---

### 13.7. Kiểm tra Vault và key rotation

Kiểm tra Vault status:

```bash
docker compose exec vault vault status
```

Kiểm tra Transit key:

```bash
docker compose exec vault sh -lc \
  'VAULT_ADDR=http://127.0.0.1:8200 VAULT_TOKEN=root vault read transit/keys/dek'
```

Chạy rotate key:

```bash
docker compose exec vault sh /vault/init/vault-rotate.sh
```

Kỳ vọng:

```text
DONE duration=...s sla(<600s)=PASS
```

Lưu evidence:

```bash
docker compose exec vault sh /vault/init/vault-rotate.sh | tee EVIDENCE/logs/vault-rotation.log
```

---

### 13.8. Kiểm tra database và AES-GCM at-rest

Seed dữ liệu mã hóa:

```bash
docker compose exec backend python -m app.db.seed_data
```

Kỳ vọng trong output có:

```text
email+phone encrypted
DB: plaintext=0, ciphertext=100%
```

Kiểm tra trực tiếp trong PostgreSQL:

```bash
docker compose exec postgres psql -U admin -d cloudapi \
  -c "select id, encode(email::bytea, 'hex') as email_hex from users limit 3;"
```

Kỳ vọng:

- Email hiển thị dạng hex/ciphertext.
- Không thấy plaintext dạng `abc@example.com`.

Kiểm tra có ký tự `@` trong email lưu DB hay không:

```bash
docker compose exec postgres psql -U admin -d cloudapi \
  -c "select count(*) as plaintext_like from users where position('@' in email::text) > 0;"
```

Kỳ vọng:

```text
0
```

Ghi chú: các file `scripts/evaluation/e_c2_nonce_test.py` và `scripts/evaluation/e_c3_aead_integrity.py` hiện đang rỗng, nên nếu muốn có evidence đẹp cho nonce và AEAD tamper thì cần bổ sung script hoặc ghi lại output từ `seed_data.py`.

---

### 13.9. Kiểm tra API không có token

Gọi API qua Kong nhưng không gửi token:

```bash
curl --cacert certs/ca.crt -i https://localhost:8443/api/v1/products
```

Kỳ vọng:

```text
401
Missing or invalid Authorization header
```

Ý nghĩa:

- API không cho truy cập tự do.
- Request phải có bearer token hợp lệ.

---

### 13.9.1. Kiểm thử bằng trang web

Mục tiêu của phần này là kiểm tra luồng người dùng thật trên browser trước khi test bằng lệnh.

Mở frontend:

```text
https://localhost:5174
```

Nếu browser cảnh báo cert:

- Cách nhanh cho môi trường kiểm thử: chọn `Advanced` rồi `Proceed`.
- Cách đúng hơn: import `certs/ca.crt` vào trust store của browser/Ubuntu.

Tài khoản test trong Keycloak:

| Role | Username | Password | Ghi chú |
|---|---|---|---|
| Customer | `an@gmail.com` | `demo1234` | Dùng để test catalog/order/profile |
| Customer | `bich@gmail.com` | `demo1234` | Dùng để test user thứ hai |
| Staff | `kiet@company.com` | `demo1234` | Có required action TOTP |
| Admin | `phuc@company.com` | `demo1234` | Có required action TOTP |
| Admin | `hung@company.com` | `demo1234` | Có required action TOTP |

Luồng web cần test:

1. Vào `https://localhost:5174`.
2. Bấm login.
3. Browser redirect sang Keycloak.
4. Đăng nhập bằng customer `an@gmail.com / demo1234`.
5. Sau callback, kiểm tra user vào được trang customer.
6. Vào thử URL admin:

```text
https://localhost:5174/admin/dashboard
```

Kỳ vọng:

- Customer không được vào admin.
- Nếu frontend route guard hoạt động, user bị chuyển về `/unauthorized` hoặc `/login`.

Test staff/admin:

1. Logout.
2. Login bằng `kiet@company.com / demo1234` hoặc admin.
3. Nếu Keycloak yêu cầu setup OTP, scan QR bằng Google Authenticator/Authy.
4. Nhập OTP để hoàn tất login.
5. Kiểm tra staff vào được trang staff.
6. Kiểm tra admin vào được trang admin.

Trong lúc test web, mở terminal xem log:

```bash
docker compose logs -f frontend kong backend keycloak opa
```

Khi login lỗi, kiểm tra:

```bash
docker compose logs keycloak --tail 200
docker compose logs frontend --tail 200
docker compose logs kong --tail 200
docker compose logs backend --tail 200
```

Các lỗi thường gặp khi test web:

| Hiện tượng | Nguyên nhân có thể | Cách xử lý |
|---|---|---|
| Browser báo cert không tin cậy | CA kiểm thử chưa được import | Proceed tạm hoặc import `certs/ca.crt` |
| Callback báo state mismatch | sessionStorage cũ hoặc mở nhiều tab | logout, xóa site data, login lại |
| Login xong API trả 401 | token không có DPoP hoặc backend verify fail | xem log backend/kong |
| User đúng mật khẩu nhưng bị bắt OTP | role admin/staff có required action TOTP | setup OTP theo Keycloak |
| Frontend gọi sai API URL | `VITE_KONG_URL` trong `.env` sai | kiểm tra `.env`, rebuild frontend |

---

### 13.10. Kiểm thử JWT `alg=none` attack

Chạy script có sẵn:

```bash
API_URL=https://localhost:8443/api/v1/users \
VERIFY_TLS=true \
EVIDENCE_FILE=EVIDENCE/attack_results/token-hardening/alg_none_result.txt \
python3 scripts/attacks/alg_none_attack.py
```

Nếu gặp lỗi CA trong môi trường Python/requests, dùng chế độ kiểm thử:

```bash
API_URL=https://localhost:8443/api/v1/users \
VERIFY_TLS=false \
EVIDENCE_FILE=EVIDENCE/attack_results/token-hardening/alg_none_result.txt \
python3 scripts/attacks/alg_none_attack.py
```

Kỳ vọng:

```text
Response status: 401
Expected: 401
Result: PASS
```

Evidence:

```bash
cat EVIDENCE/attack_results/token-hardening/alg_none_result.txt
```

Ý nghĩa:

- Token tự chế không chữ ký bị chặn.
- Attacker không thể tự gán role admin bằng JWT `alg=none`.

---

### 13.11. Kiểm thử DPoP replay attack

Script này cần lấy authorization code từ trình duyệt nếu dùng flow chuẩn.

Thiết lập biến môi trường:

```bash
export AUTH_FLOW=authorization_code
export REDIRECT_URI=https://localhost:5174/callback
export API_URL=https://localhost:8443/api/v1/products
export CLIENT_ID=spa-client
export VERIFY_TLS=false
```

Chạy script:

```bash
python3 scripts/attacks/replay_dpop_attack.py
```

Script sẽ in ra URL Keycloak. Mở URL đó trong browser, đăng nhập bằng user customer, ví dụ:

```text
an@gmail.com / demo1234
```

Sau khi browser redirect về `/callback?code=...`, copy toàn bộ callback URL hoặc chỉ giá trị `code` rồi dán vào terminal.

Kỳ vọng:

```text
Status lần 1: 200
Status lần 2: 401
Kết luận: PASS
```

Evidence:

```bash
cat EVIDENCE/attack_results/token-hardening/dpop_replay_result.txt
```

Ý nghĩa:

- DPoP proof hợp lệ dùng lần đầu được chấp nhận.
- Replay lại cùng proof bị chặn vì `jti` đã tồn tại trong Redis.

Kiểm tra Redis có lưu `jti`:

```bash
docker compose exec redis redis-cli --scan --pattern 'dpop:jti:*' | head
```

Nếu script báo `Token is not DPoP bound`:

- Kiểm tra Keycloak chạy với `--features=dpop`.
- Kiểm tra client `spa-client` có `dpop.bound.access.tokens=true`.
- Dùng flow `authorization_code`, không dùng token cũ.

Nếu script báo `DPoP htu mismatch`:

- Kiểm tra `API_URL` phải đúng URL gọi thật qua Kong:

```bash
export API_URL=https://localhost:8443/api/v1/products
```

Nếu request 1 bị `403`:

- Role hoặc OPA policy đang chặn trước khi đến replay check.
- Đổi endpoint sang `/api/v1/products` và dùng customer token.

---

### 13.12. Kiểm thử thiếu DPoP

Sau khi lấy được access token hợp lệ từ flow login, gọi API chỉ với Authorization nhưng không có `DPoP`.

```bash
export ACCESS_TOKEN='<paste_access_token_here>'

curl --cacert certs/ca.crt -i https://localhost:8443/api/v1/products \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Kỳ vọng:

```text
401
Missing DPoP proof
```

Ý nghĩa:

- Token không còn là bearer token thuần.
- API yêu cầu proof-of-possession.

---

### 13.13. Kiểm thử OPA deny qua API

Mục tiêu: dùng token role không đủ quyền gọi endpoint bị cấm.

Ví dụ customer gọi danh sách users:

```bash
export ACCESS_TOKEN='<customer_access_token>'
export DPOP_PROOF='<valid_dpop_proof_for_this_request>'

curl --cacert certs/ca.crt -i https://localhost:8443/api/v1/users \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "DPoP: $DPOP_PROOF"
```

Kỳ vọng:

```text
403
Access Denied
```

Ghi chú:

- DPoP proof phải đúng `htu=https://localhost:8443/api/v1/users` và `htm=GET`.
- Nếu dùng proof tạo cho endpoint khác, backend sẽ trả `DPoP htu mismatch`.

---

### 13.14. Kiểm thử BOLA/IDOR

Project đã có script evidence cho BOLA/IDOR:

```bash
python3 scripts/attacks/bola_attack.py
```

Kỳ vọng:

```text
"result": "PASS"
"passed_cases": 5
"total_cases": 5
```

Evidence:

```bash
cat EVIDENCE/attack_results/bola/bola_result.txt
```

Ý nghĩa:

- Customer đọc order của chính mình được allow.
- Customer đọc order của người khác bị deny.
- Customer thiếu subject bị deny.
- Staff/admin được phép vận hành order.

Luồng test mong muốn:

```text
1. Tạo hoặc xác định order A thuộc user A.
2. Đăng nhập user B.
3. User B gọi GET /api/v1/orders/{order_id_cua_user_A}.
4. Kỳ vọng 403 Forbidden.
```

Lệnh mẫu sau khi có token user B và DPoP proof đúng endpoint:

```bash
export ACCESS_TOKEN_USER_B='<customer_B_access_token>'
export DPOP_PROOF_USER_B='<valid_dpop_proof_for_order_endpoint>'
export ORDER_ID_OF_USER_A='<order_id>'

curl --cacert certs/ca.crt -i \
  "https://localhost:8443/api/v1/orders/${ORDER_ID_OF_USER_A}" \
  -H "Authorization: Bearer $ACCESS_TOKEN_USER_B" \
  -H "DPoP: $DPOP_PROOF_USER_B"
```

Kỳ vọng:

```text
403 Forbidden
```

Ghi chú trạng thái hiện tại:

- Phần mismatch `request.state.user`/`request.state.token` đã được sửa.
- Logic object-level check hiện nằm trong `backend/app/security/bola_guard.py`.

Evidence nên tạo:

```bash
mkdir -p EVIDENCE/attack_results/bola
```

Sau khi chạy test, lưu output:

```bash
curl ... | tee EVIDENCE/attack_results/bola/bola_result.txt
```

---

### 13.14.2. Kiểm thử SSRF protection

Project đã có script evidence cho SSRF:

```bash
python3 scripts/attacks/ssrf_attack.py
```

Kỳ vọng:

```text
"result": "PASS"
"passed_cases": 6
"total_cases": 6
```

Evidence:

```bash
cat EVIDENCE/attack_results/ssrf/ssrf_result.txt
```

Các case được kiểm thử:

- Metadata IP `169.254.169.254` bị chặn.
- Loopback IP `127.0.0.1` bị chặn.
- Hostname `localhost` bị chặn.
- Private IP `10.0.0.5` bị chặn.
- Scheme `file://` bị chặn.
- Public HTTPS IP được allow.

Nếu muốn test qua API endpoint sau khi có token + DPoP hợp lệ:

```bash
curl --cacert certs/ca.crt -i \
  "https://localhost:8443/api/v1/security/url-check?url=http://169.254.169.254/latest/meta-data/" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "DPoP: $DPOP_PROOF"
```

Kỳ vọng:

```text
400
SSRF blocked
```

---

### 13.14.3. Gợi ý script thủ công để tạo DPoP proof cho curl

Nhiều test bằng lệnh cần DPoP proof đúng `htu` và `htm`. Nếu không muốn viết tay, dùng script Python nhỏ tạm thời trong `/tmp` để tạo proof. Đây là script hỗ trợ test, không nhất thiết commit vào repo.

Tạo file:

```bash
cat > /tmp/make_dpop.py <<'PY'
import base64
import hashlib
import sys
import time
import uuid

import jwt
from cryptography.hazmat.primitives.asymmetric import ec

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def public_jwk(private_key):
    pub = private_key.public_key().public_numbers()
    return {
        "kty": "EC",
        "crv": "P-256",
        "x": b64url(pub.x.to_bytes(32, "big")),
        "y": b64url(pub.y.to_bytes(32, "big")),
    }

if len(sys.argv) < 4:
    print("usage: make_dpop.py METHOD HTU ACCESS_TOKEN", file=sys.stderr)
    sys.exit(2)

method, htu, access_token = sys.argv[1], sys.argv[2], sys.argv[3]
private_key = ec.generate_private_key(ec.SECP256R1())
ath = b64url(hashlib.sha256(access_token.encode()).digest())
payload = {
    "jti": str(uuid.uuid4()),
    "htm": method.upper(),
    "htu": htu,
    "iat": int(time.time()),
    "ath": ath,
}
headers = {
    "typ": "dpop+jwt",
    "alg": "ES256",
    "jwk": public_jwk(private_key),
}
print(jwt.encode(payload, private_key, algorithm="ES256", headers=headers))
PY
```

Ví dụ dùng:

```bash
export ACCESS_TOKEN='<paste_access_token>'
export HTU='https://localhost:8443/api/v1/products'
export DPOP_PROOF="$(python3 /tmp/make_dpop.py GET "$HTU" "$ACCESS_TOKEN")"

curl --cacert certs/ca.crt -i "$HTU" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "DPoP: $DPOP_PROOF"
```

Lưu ý:

- Proof sinh bằng script này chỉ đúng nếu access token có `cnf.jkt` khớp với key trong proof.
- Với DPoP-bound token thật, key dùng lấy token và key dùng gọi API phải là cùng một key.
- Vì vậy script này chỉ hữu ích cho một số test thủ công; test replay chuẩn vẫn nên dùng `scripts/attacks/replay_dpop_attack.py`.

---

### 13.15. Kiểm thử webhook HMAC

Webhook endpoint được public trong middleware nhưng tự bảo vệ bằng HMAC.

Payload mẫu:

```bash
export WEBHOOK_SECRET='your-super-secret-webhook-key-2026'
export BODY='{"order_id":1,"status":"paid"}'
export TS="$(date +%s)"
```

Tạo chữ ký đúng:

```bash
export SIG="$(printf "%s.%s" "$TS" "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | awk '{print $2}')"
```

Gửi webhook hợp lệ:

```bash
curl --cacert certs/ca.crt -i \
  https://localhost:8443/api/v1/orders/webhooks/orders \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  -d "$BODY"
```

Kỳ vọng:

```text
200
Webhook OK
```

Gửi webhook sai chữ ký:

```bash
curl --cacert certs/ca.crt -i \
  https://localhost:8443/api/v1/orders/webhooks/orders \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: wrong-signature" \
  -d "$BODY"
```

Kỳ vọng:

```text
401
Invalid signature
```

Ý nghĩa:

- Attacker không thể giả mạo webhook nếu không biết shared secret.

---

### 13.16. Kiểm thử rate limit

Kong đang cấu hình rate limit 100 request/phút.

Gửi nhanh 120 request vào health endpoint:

```bash
for i in $(seq 1 120); do
  code=$(curl --cacert certs/ca.crt -s -o /dev/null -w "%{http_code}" https://localhost:8443/health)
  echo "$i $code"
done | tee EVIDENCE/logs/rate-limit-test.log
```

Kỳ vọng:

- Các request đầu trả `200` hoặc status health hợp lệ.
- Sau khi vượt ngưỡng, có request trả `429`.

Ghi chú:

- Nếu `/health` bị plugin auth/OPA ảnh hưởng, đổi sang endpoint public phù hợp hoặc kiểm tra Kong plugin route cụ thể.
- Rate limit local policy phụ thuộc instance Kong đang chạy.

---

### 13.17. Kiểm thử refresh token rotation

Script hiện có:

```bash
python3 scripts/evaluation/e_n2_refresh_token_test.py
```

Kỳ vọng:

- Lần dùng refresh token đầu tiên thành công.
- Dùng lại refresh token cũ bị Keycloak trả `400 invalid_grant`.

Ghi chú quan trọng:

- Script đang hard-code `KEYCLOAK_TOKEN_URL`, username/password, TOTP secret.
- Cần cập nhật lại user, password, client secret, TOTP secret đúng với môi trường của bạn trước khi chạy.

Evidence nên lưu:

```bash
python3 scripts/evaluation/e_n2_refresh_token_test.py \
  | tee EVIDENCE/authn-logs/e_n2_refresh_rotation_result.txt
```

---

### 13.18. Kiểm thử TOTP

Script hiện có:

```bash
python3 scripts/evaluation/e_n1_totp_test.py
```

Ghi chú:

- Script hiện đang dùng URL/user/password mẫu cũ.
- Trước khi chạy cần sửa:
  - `KEYCLOAK_URL`
  - `USERNAME`
  - `PASSWORD`
  - `CLIENT_ID`

Evidence hiện có:

```bash
cat EVIDENCE/authn-logs/e_n1_summary.json
cat EVIDENCE/authn-logs/e_n1_details.json
```

Kỳ vọng quan trọng:

```json
"false_accept_vulnerabilities": 0
```

---

### 13.19. Kiểm thử SAST, DAST, fuzzing

Các file script hiện tại trong `scripts/security_testing/` đang rỗng, nên có hai cách kiểm thử.

Chạy Bandit trực tiếp:

```bash
pip install bandit
mkdir -p EVIDENCE/security_scans
bandit -r backend/ -f json -o EVIDENCE/security_scans/bandit_report.json --exit-zero
```

Xem report:

```bash
cat EVIDENCE/security_scans/bandit_report.json
```

Chạy OWASP ZAP bằng Docker nếu máy có Docker:

```bash
mkdir -p EVIDENCE/security_scans
docker run --rm --network host \
  -v "$(pwd)/EVIDENCE/security_scans:/zap/wrk" \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t https://localhost:8443 -r zap_report.html -I
```

Report:

```bash
ls -l EVIDENCE/security_scans/zap_report.html
```

Fuzzing:

```bash
ls tests/security_scans/fuzz/restler_config.json
```

Ghi chú:

- Repo có file cấu hình RESTler nhưng chưa có script chạy fuzz hoàn chỉnh.
- Nếu cần chứng minh fuzzing, nên bổ sung lệnh RESTler hoặc Postman/Newman rõ ràng.

---

### 13.20. Kiểm thử observability

Trong project này, observability **không tự bật khi chạy D1 mặc định**. Loki/Grafana/Prometheus nằm trong Docker Compose profile `obs`.

Bật profile observability:

```bash
docker compose --profile obs up -d
```

Kiểm tra container:

```bash
docker compose --profile obs ps
```

Kỳ vọng thấy:

```text
loki
promtail
grafana
api-prometheus
api-cadvisor
```

Kiểm tra Loki:

```bash
curl -i http://localhost:3100/ready
```

Kỳ vọng:

```text
HTTP/1.1 200 OK
ready
```

Kiểm tra Grafana:

```bash
curl -i http://localhost:3000/api/health
```

Kỳ vọng:

```json
{"database":"ok","version":"...","commit":"..."}
```

Kiểm tra Prometheus:

```bash
curl -i http://localhost:9091/-/ready
```

Kỳ vọng:

```text
HTTP/1.1 200 OK
Prometheus Server is Ready.
```

Tạo log bằng cách gọi vài API:

```bash
curl --cacert certs/ca.crt -i https://localhost:8443/health
curl --cacert certs/ca.crt -i https://localhost:8443/
```

Xem logs container:

```bash
docker compose logs kong --tail 100
docker compose logs backend --tail 100
docker compose logs opa --tail 100
```

Kiểm tra Promtail có đang gửi log sang Loki:

```bash
docker compose logs promtail --tail 120
```

Query Loki trực tiếp:

```bash
curl -G -s "http://localhost:3100/loki/api/v1/query" \
  --data-urlencode 'query={service=~".+"}'
```

Nếu muốn query log Kong:

```bash
curl -G -s "http://localhost:3100/loki/api/v1/query" \
  --data-urlencode 'query={service="kong"}'
```

Nếu kết quả trả `data.result: []`, kiểm tra:

```bash
docker compose ps promtail loki
docker compose logs promtail --tail 120
docker compose logs loki --tail 120
```

Nguyên nhân thường gặp:

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Loki ready nhưng không có log | Promtail chưa chạy hoặc chưa đọc Docker logs | `docker compose --profile obs up -d promtail` |
| Promtail báo permission denied Docker socket | User/container không đọc được `/var/run/docker.sock` hoặc `/var/lib/docker/containers` | chạy lại Docker Compose trên Ubuntu chính, không chạy trong môi trường bị sandbox |
| Grafana không thấy datasource | provisioning chưa load hoặc Grafana chưa restart | `docker compose restart grafana` |
| Port 3000/3100/9091 bị chiếm | service khác đang dùng port | `sudo ss -ltnp | grep ':3000\|:3100\|:9091'` |

Truy cập Grafana:

```text
http://localhost:3000
```

Tài khoản lấy từ `.env`:

```text
GRAFANA_USER
GRAFANA_PASSWORD
```

Ghi chú:

- Phần này chứng minh log/metric pipeline chạy.
- Trang Admin Settings hiện chỉ hiển thị các mục có nguồn kiểm chứng hoặc lệnh test, không dùng các số thống kê tĩnh như telemetry thật.
- Nếu muốn chứng minh alerting/MTTD/MTTR, cần thêm rule và ảnh evidence alert.

---

### 13.21. Bảng tổng hợp test D1 nên chạy trước khi báo cáo

| Nhóm | Lệnh chính | Kỳ vọng |
|---|---|---|
| Cert chain | `openssl verify -CAfile certs/ca.crt ...` | OK |
| Hostname SAN | `openssl verify -verify_hostname ...` | OK |
| Start stack | `docker compose up -d --build` | Services healthy |
| Backend HTTPS | `curl --cacert certs/ca.crt https://localhost:9000/health` | `{"status":"ok"}` |
| Kong HTTPS | `curl --cacert certs/ca.crt https://localhost:8443/health` | OK |
| Frontend HTTPS | `curl --cacert certs/ca.crt -I https://localhost:5174` | 200 |
| OPA tests | `docker compose exec opa opa test /policies /tests -v` | 40/40 pass |
| Vault rotate | `docker compose exec vault sh /vault/init/vault-rotate.sh` | SLA PASS |
| No token | `curl ... /api/v1/products` | 401 |
| `alg=none` | `python3 scripts/attacks/alg_none_attack.py` | PASS/401 |
| DPoP replay | `python3 scripts/attacks/replay_dpop_attack.py` | PASS: 200 then 401 |
| Webhook HMAC đúng | `curl ... X-Signature:$SIG` | 200 |
| Webhook HMAC sai | `curl ... X-Signature:wrong-signature` | 401 |
| Rate limit | loop 120 requests | có 429 |
| Bandit | `bandit -r backend/ ...` | report JSON |
| ZAP | `zap-baseline.py` | report HTML |

---

### 13.22. Những test D1 hiện chưa tự động hóa hoàn chỉnh

Các phần dưới đây project đã có ý tưởng hoặc một phần code, nhưng command tự động hoàn chỉnh chưa có sẵn:

| Phần | Lý do | Cách hoàn thiện |
|---|---|---|
| BOLA attack | Đã có script/evidence PASS 5/5 | Có thể bổ sung thêm test end-to-end qua token thật nếu cần |
| SSRF | Đã có guard/endpoint/script/evidence PASS 6/6 | Có thể bổ sung thêm test qua API với token + DPoP thật |
| AEAD nonce/integrity | `e_c2_nonce_test.py`, `e_c3_aead_integrity.py` rỗng | Viết script encrypt 10k lần, tamper ciphertext, expect InvalidTag |
| TLS plaintext capture | `e_c1_tls_capture.sh` rỗng | Viết tcpdump/tshark script và grep plaintext |
| SAST/DAST shell scripts | `run_sast.sh`, `run_dast.sh`, `run_fuzz.sh` rỗng | Gói các lệnh Bandit/ZAP/RESTler vào script |
| mTLS D2 | D1 mới có TLS edge/upstream, chưa bắt buộc client cert | Dùng `DEPLOY/D2` hoặc cấu hình NGINX/Kong verify client cert |

Khi báo cáo, nên nói rõ:

```text
D1 đã chứng minh được phần lõi API security: Gateway, IdP, PKCE, DPoP replay protection, OPA policy, Vault rotation, TLS kiểm thử, SAST/DAST evidence.
D1 chưa chứng minh đầy đủ mTLS và một số evaluation script tự động; các phần này cần bổ sung evidence hoặc triển khai ở D2.
```

---

### 13.23. Checklist chạy nhanh trên Ubuntu

Nếu chỉ muốn chạy nhanh toàn bộ phần quan trọng nhất, dùng checklist này.

```bash
cd "/media/fuclu/New Volume/UIT/NAM2/HK2/MATMAHOC/PROJECT/Cloud_Api_Security"

docker --version
docker compose version

python3 scripts/gen_certs.py

docker compose up -d --build
docker compose ps

curl --cacert certs/ca.crt https://localhost:9000/health
curl --cacert certs/ca.crt https://localhost:8443/health
curl --cacert certs/ca.crt -I https://localhost:5174

docker compose exec opa opa test /policies /tests -v
docker compose exec vault sh /vault/init/vault-rotate.sh

curl --cacert certs/ca.crt -i https://localhost:8443/api/v1/products

API_URL=https://localhost:8443/api/v1/users \
VERIFY_TLS=false \
EVIDENCE_FILE=EVIDENCE/attack_results/token-hardening/alg_none_result.txt \
python3 scripts/attacks/alg_none_attack.py
```

Sau đó test web:

```text
https://localhost:5174
```

Và test DPoP replay:

```bash
export AUTH_FLOW=authorization_code
export REDIRECT_URI=https://localhost:5174/callback
export API_URL=https://localhost:8443/api/v1/products
export CLIENT_ID=spa-client
export VERIFY_TLS=false
python3 scripts/attacks/replay_dpop_attack.py
```

Kết quả quan trọng cần chụp/lưu:

- `docker compose ps`
- `curl https://localhost:8443/health`
- OPA test pass.
- Vault rotation PASS.
- `alg=none` PASS.
- DPoP replay PASS.
- Screenshot web login/callback hoặc dashboard.

---

### 13.24. Kiểm tra cert hiện tại đang dùng thuật toán gì

Project hiện dùng bộ cert kiểm thử trong thư mục:

```text
certs/
```

Các file chính:

| File | Vai trò |
|---|---|
| `certs/ca.crt`, `certs/ca.key` | Root CA kiểm thử |
| `certs/kong.crt`, `certs/kong.key` | TLS server cert cho Kong |
| `certs/frontend.crt`, `certs/frontend.key` | TLS server cert cho frontend |
| `certs/backend.crt`, `certs/backend.key` | TLS server cert cho backend |
| `certs/client.crt`, `certs/client.key` | TLS client cert cho mTLS/D2 hoặc test client |

Bộ cert này được sinh bởi:

```bash
python3 scripts/gen_certs.py
```

Hiện tại generator dùng ECDSA P-256:

```python
ec.generate_private_key(ec.SECP256R1())
```

Nói ngắn gọn:

```text
Public key algorithm: id-ecPublicKey
Curve: prime256v1 / NIST P-256
Signature algorithm: ecdsa-with-SHA256
```

Lệnh kiểm tra cert Kong:

```bash
openssl x509 -in certs/kong.crt -noout -text \
  | grep -E "Signature Algorithm|Public Key Algorithm|ASN1 OID|NIST CURVE" -A2
```

Kỳ vọng thấy:

```text
Signature Algorithm: ecdsa-with-SHA256
Public Key Algorithm: id-ecPublicKey
ASN1 OID: prime256v1
NIST CURVE: P-256
```

Kiểm tra server cert có SAN và EKU:

```bash
openssl x509 -in certs/kong.crt -noout -text \
  | sed -n '/X509v3 extensions:/,/Signature Algorithm/p'
```

Kỳ vọng có:

```text
X509v3 Key Usage: Digital Signature
X509v3 Extended Key Usage: TLS Web Server Authentication
X509v3 Subject Alternative Name: DNS:localhost, DNS:api-gateway, DNS:kong, IP Address:127.0.0.1
```

Kiểm tra client cert:

```bash
openssl x509 -in certs/client.crt -noout -text \
  | sed -n '/X509v3 extensions:/,/Signature Algorithm/p'
```

Kỳ vọng có:

```text
X509v3 Extended Key Usage: TLS Web Client Authentication
```

Kiểm tra chain:

```bash
openssl verify -CAfile certs/ca.crt \
  certs/kong.crt \
  certs/frontend.crt \
  certs/backend.crt \
  certs/client.crt
```

Kỳ vọng:

```text
certs/kong.crt: OK
certs/frontend.crt: OK
certs/backend.crt: OK
certs/client.crt: OK
```

Kiểm tra hostname:

```bash
openssl verify -verify_hostname localhost -CAfile certs/ca.crt certs/kong.crt
openssl verify -verify_hostname localhost -CAfile certs/ca.crt certs/frontend.crt
openssl verify -verify_hostname api-backend -CAfile certs/ca.crt certs/backend.crt
```

Kỳ vọng tất cả đều `OK`.

Kiểm tra TLS 1.3 qua Kong:

```bash
openssl s_client \
  -connect localhost:8443 \
  -servername localhost \
  -CAfile certs/ca.crt \
  -tls1_3 </dev/null
```

Kỳ vọng có:

```text
Verification: OK
New, TLSv1.3
```

Nếu browser vẫn báo không tin cậy:

- Đây là bình thường vì `ca.crt` là CA tự ký trong môi trường kiểm thử.
- Muốn browser xanh khóa thì import `certs/ca.crt` vào trust store hoặc dùng domain thật + public CA như ZeroSSL/Let's Encrypt.

---

### 13.25. Giải thích chi tiết các test tấn công

Phần này giải thích “tấn công gì, hệ thống chặn ở đâu, lỗi kỳ vọng là gì”.

#### 13.25.1. JWT `alg=none`

Mục tiêu tấn công:

```text
Attacker tự tạo JWT không chữ ký, gán role admin, rồi gửi vào API.
```

Script:

```bash
API_URL=https://localhost:8443/api/v1/users \
VERIFY_TLS=false \
EVIDENCE_FILE=EVIDENCE/attack_results/token-hardening/alg_none_result.txt \
python3 scripts/attacks/alg_none_attack.py
```

Hệ thống chặn ở:

```text
gateway/plugins/jwt-hardening/handler.lua
```

Kết quả kỳ vọng:

```text
HTTP 401
result: PASS
```

Nếu lỗi:

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Connection refused | Kong chưa chạy | `docker compose ps`, `docker compose logs kong` |
| SSL verify failed | Python requests không trust CA kiểm thử | dùng `VERIFY_TLS=false` cho môi trường kiểm thử |
| Status khác 401 | plugin chưa load hoặc route không qua Kong | kiểm tra `KONG_PLUGINS`, `gateway/kong.yml` |

#### 13.25.2. DPoP replay

Mục tiêu tấn công:

```text
Attacker dùng lại cùng một DPoP proof đã được gửi trước đó.
```

Script:

```bash
export AUTH_FLOW=authorization_code
export REDIRECT_URI=https://localhost:5174/callback
export API_URL=https://localhost:8443/api/v1/products
export CLIENT_ID=spa-client
export VERIFY_TLS=false

python3 scripts/attacks/replay_dpop_attack.py
```

Hệ thống chặn ở:

```text
backend/app/security/dpop_verifier.py
Redis key: dpop:jti:<jti>
```

Luồng đúng:

```text
Request 1: proof mới -> 200
Request 2: replay proof cũ -> 401 DPoP proof replayed
```

Kết quả kỳ vọng:

```text
Status lần 1: 200
Status lần 2: 401
Kết luận: PASS
```

Lỗi thường gặp:

| Lỗi | Ý nghĩa | Cách xử lý |
|---|---|---|
| `Token is not DPoP bound` | Token không có `cnf.jkt` | dùng authorization code flow, kiểm tra Keycloak `--features=dpop` |
| `DPoP htu mismatch` | Proof tạo cho URL khác URL đang gọi | đảm bảo `API_URL=https://localhost:8443/api/v1/products` |
| Request 1 = 403 | OPA chặn trước khi test replay | dùng endpoint `/api/v1/products` với customer |
| State mismatch | sessionStorage cũ hoặc nhiều tab login | xóa site data/logout rồi login lại |

#### 13.25.3. BOLA/IDOR

Mục tiêu tấn công:

```text
Customer B cố đọc order thuộc Customer A bằng cách đổi order_id.
```

Phần quan trọng: BOLA là **object-level authorization**, khác với việc admin vào staff page.

- BOLA kiểm tra: user có được đọc object/order này không.
- Route guard kiểm tra: role có được vào page `/staff` hay `/admin` không.

Logic chống BOLA nằm ở:

```text
backend/app/security/bola_guard.py
backend/app/api/v1/orders.py
```

Script evidence:

```bash
python3 scripts/attacks/bola_attack.py
```

Kết quả kỳ vọng:

```text
"result": "PASS"
"passed_cases": 5
"total_cases": 5
```

Evidence:

```bash
cat EVIDENCE/attack_results/bola/bola_result.txt
```

Các case:

| Case | Kỳ vọng |
|---|---|
| Customer đọc order của chính mình | Allow |
| Customer đọc order người khác | Deny |
| Customer thiếu subject | Deny |
| Staff vận hành order | Allow |
| Admin vận hành order | Allow |

Lưu ý bug đã sửa:

```text
Trước đây /staff cho roles ['staff', 'admin'], nên admin vẫn vào staff page.
Hiện đã sửa frontend/src/App.jsx để /staff chỉ cho ['staff'].
```

Sau khi sửa, rebuild frontend:

```bash
docker compose up -d --build frontend
```

Test bằng browser:

```text
Login admin -> mở https://localhost:5174/staff/dashboard
```

Kỳ vọng:

```text
Admin bị chuyển về /unauthorized hoặc không vào được staff dashboard.
```

Test customer vào admin:

```text
Login customer -> mở https://localhost:5174/admin/dashboard
```

Kỳ vọng:

```text
Customer bị chặn.
```

Test tự động lỗi leo thang đặc quyền theo route:

```bash
python3 scripts/attacks/role_escalation_test.py
```

Kết quả kỳ vọng:

```text
"result": "PASS"
"passed_cases": 9
"total_cases": 9
"passed_route_config_cases": 3
"total_route_config_cases": 3
```

Evidence:

```bash
cat EVIDENCE/attack_results/role-escalation/role_escalation_result.json
```

Ý nghĩa evidence:

| Kiểm tra | Ý nghĩa |
|---|---|
| `admin_cannot_access_staff_ui` | Admin không còn leo sang UI staff |
| `admin_cannot_access_customer_ui` | Admin không còn leo sang UI customer |
| `staff_cannot_access_admin` | Staff không vào được UI admin |
| `customer_cannot_access_admin` | Customer không vào được UI admin |
| `staff_route_allows_only_staff` | File `App.jsx` thật sự cấu hình `/staff` chỉ cho `staff` |

Nếu test browser vẫn thấy admin vào staff sau khi code đã sửa, nguyên nhân thường là frontend container/browser cache còn bản cũ. Chạy:

```bash
docker compose up -d --build frontend
docker compose logs frontend --tail 80
```

Sau đó mở tab ẩn danh hoặc hard reload browser.

Kiểm tra render đúng user sau đăng nhập:

```text
Login user A -> xem tên ở sidebar/navbar/profile.
Logout -> login user B -> tên hiển thị phải đổi sang user B.
```

Các file đã lấy thông tin user thật từ token thay vì ghi cứng:

```text
frontend/src/auth/AuthProvider.jsx
frontend/src/auth/userDisplay.js
frontend/src/layouts/AdminLayout.jsx
frontend/src/layouts/StaffLayout.jsx
frontend/src/layouts/CustomerLayout.jsx
frontend/src/pages/customer/Profile.jsx
frontend/src/pages/customer/MyOrders.jsx
```

Lưu ý: nếu 2 user cùng role, ví dụ cùng là customer, thì vào cùng trang `/customer/productcatalog` là đúng logic. Điểm cần khác nhau là tên/email/avatar/tài khoản phải render theo token của user hiện tại.

#### 13.25.4. SSRF

Mục tiêu tấn công:

```text
Attacker gửi URL nội bộ/metadata để server fetch và lộ thông tin.
```

Ví dụ URL nguy hiểm:

```text
http://169.254.169.254/latest/meta-data/
http://127.0.0.1:8000/admin
http://localhost:8000/admin
http://10.0.0.5/internal
file:///etc/passwd
```

Hệ thống chặn ở:

```text
backend/app/security/ssrf_guard.py
backend/app/api/v1/security.py
```

Script:

```bash
python3 scripts/attacks/ssrf_attack.py
```

Kết quả kỳ vọng:

```text
"result": "PASS"
"passed_cases": 6
"total_cases": 6
```

Evidence:

```bash
cat EVIDENCE/attack_results/ssrf/ssrf_result.txt
```

Nếu test qua API, cần token + DPoP hợp lệ:

```bash
curl --cacert certs/ca.crt -i \
  "https://localhost:8443/api/v1/security/url-check?url=http://169.254.169.254/latest/meta-data/" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "DPoP: $DPOP_PROOF"
```

Kỳ vọng:

```text
400
SSRF blocked
```

#### 13.25.5. Webhook HMAC

Mục tiêu tấn công:

```text
Attacker giả mạo webhook callback để thay đổi trạng thái đơn hàng.
```

Hệ thống chặn ở:

```text
backend/app/api/v1/orders.py
```

Webhook yêu cầu:

```text
X-Timestamp
X-Signature = HMAC_SHA256(secret, timestamp + "." + body)
```

Test chữ ký đúng:

```bash
export WEBHOOK_SECRET='your-super-secret-webhook-key-2026'
export BODY='{"order_id":1,"status":"paid"}'
export TS="$(date +%s)"
export SIG="$(printf "%s.%s" "$TS" "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | awk '{print $2}')"

curl --cacert certs/ca.crt -i \
  https://localhost:8443/api/v1/orders/webhooks/orders \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  -d "$BODY"
```

Kỳ vọng:

```text
200
Webhook OK
```

Test chữ ký sai:

```bash
curl --cacert certs/ca.crt -i \
  https://localhost:8443/api/v1/orders/webhooks/orders \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: wrong-signature" \
  -d "$BODY"
```

Kỳ vọng:

```text
401
Invalid signature
```

#### 13.25.6. OPA authorization

Mục tiêu:

```text
Kiểm tra policy deny-by-default và role-based access.
```

Lệnh:

```bash
docker compose exec opa opa test /policies /tests -v
```

Kỳ vọng:

```text
PASS
40/40 cases
```

Nếu fail:

```bash
docker compose logs opa --tail 120
```

Kiểm tra policy trực tiếp:

```bash
curl -s http://localhost:8181/v1/data/authz \
  -H "Content-Type: application/json" \
  -d '{"input":{"role":"customer","method":"DELETE","path":"/api/v1/users","subject":"u1"}}'
```

Kỳ vọng:

```json
{"result":{"allow":false,"reason":"method_not_allowed"}}
```

---
