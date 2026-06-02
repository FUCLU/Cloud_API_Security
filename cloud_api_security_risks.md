# Tổng hợp chi tiết các rủi ro Cloud API đã xử lý

Tài liệu này tổng hợp các rủi ro Cloud API trong project, cách project đã xử lý, cách chứng minh lỗ hổng đã được xử lý, và cách tự kiểm thử/tấn công lại trên môi trường local của chính mình.

> Lưu ý: chỉ chạy các lệnh tấn công/kiểm thử dưới đây trên hệ thống của bạn, trong môi trường local/dev được phép. Không dùng các script này với hệ thống của người khác.

## Bảng tổng quan

| # | Rủi ro đã xử lý | Giải pháp trong project | Kiểu tấn công bị chặn | Cách chứng minh nhanh |
|---|---|---|---|---|
| 1 | API không bắt buộc đăng nhập | `AuthMiddleware` bắt `Authorization: Bearer` | Gọi API không token | `python scripts/security_testing/run_dast.py --skip-zap --strict` |
| 2 | JWT giả mạo hoặc sai issuer/audience | Backend verify JWKS, issuer, audience, ES256 | Token forged, token từ realm/client khác | Kiểm tra `backend/app/security/jwt_verify.py`, DAST protected endpoint |
| 3 | JWT `alg=none` | Kong plugin `jwt-hardening` chặn `alg=none`, thiếu/unknown `kid` | JWT algorithm confusion | `python scripts/attacks/alg_none_attack.py` |
| 4 | Replay access token | DPoP verify `htu`, `htm`, `iat`, `ath`, `jti`; Redis lưu `jti` đã dùng | DPoP proof replay | `python scripts/attacks/replay_dpop_attack.py` |
| 5 | Token không bind với key client | So khớp `cnf.jkt` trong access token với public JWK của DPoP proof | Stolen bearer token reuse | DPoP replay script hoặc request thiếu/sai DPoP |
| 6 | OAuth login yếu | Authorization Code + PKCE S256 + `state` | Code interception, CSRF callback | Kiểm tra `frontend/src/auth/keycloak.js` |
| 7 | Role escalation | OPA policy + frontend `PrivateRoute` theo role | User vào route/API trái quyền | `python scripts/attacks/role_escalation_test.py` |
| 8 | BOLA / IDOR | `bola_guard.py` chỉ cho customer đọc order của mình | Đổi `order_id` để xem đơn người khác | `python scripts/attacks/bola_attack.py` |
| 9 | SSRF | `ssrf_guard.py` chặn localhost, private IP, link-local, metadata IP, scheme lạ | Gọi metadata/internal service | `python scripts/attacks/ssrf_attack.py` |
| 10 | Abuse / flooding | Kong rate limit `100 request/minute`, OPA có rate policy | API flood, brute force | DAST kiểm tra rate-limit headers |
| 11 | Thiếu security headers | HSTS, `X-Content-Type-Options`, `X-Frame-Options` qua Kong | Clickjacking, MIME sniffing, downgrade | DAST kiểm tra headers |
| 12 | Dữ liệu nhạy cảm bị lộ/tamper | AES-256-GCM AEAD, nonce random, tag integrity | Đọc/sửa ciphertext | Kiểm tra `aead_encryption.py`; nên bổ sung automated evidence |
| 13 | Quản lý khóa yếu | Vault Transit wrap/unwrap DEK, rotate key, revoke old version | Lộ key, dùng key cũ decrypt | Kiểm tra `vault/init/vault-rotate.sh`; có thể chạy rotation test thủ công |
| 14 | Webhook giả mạo | HMAC SHA-256 + `hmac.compare_digest` | Fake webhook, timing attack | Gửi webhook sai signature, kỳ vọng `401` |
| 15 | HTTP plaintext / TLS yếu ở API Gateway | Kong chỉ expose HTTPS `8443`, ép TLS 1.3, tắt HTTP proxy `8000` | Nghe lén, downgrade TLS, gọi API qua HTTP | `curl http://localhost:8000/health`, `openssl s_client -tls1_2` |
| 16 | Client không được xác thực ở gateway | Kong mTLS yêu cầu client cert ký bởi `certs/ca.crt` | Client lạ gọi API Gateway | `curl --cacert ...` không cert bị `400`, có cert được `200` |

## Cách khởi động môi trường để test

Nếu chưa chạy hệ thống:

```powershell
docker compose up -d
```

Nếu cần chạy thêm observability:

```powershell
docker compose --profile obs up -d
```

Các địa chỉ thường dùng:

- Frontend HTTPS: `https://localhost:5174`
- Kong/API Gateway HTTPS: `https://localhost:8443`
- Backend trực tiếp dev: `https://localhost:9000`
- Keycloak dev: `http://localhost:8082`

## Kiến thức nền cần hiểu trước khi test

### Cloud API security là gì?

Cloud API security là tập hợp các biện pháp bảo vệ API khi API được triển khai trong môi trường cloud hoặc kiến trúc nhiều service. API không chỉ cần "chạy được", mà còn phải đảm bảo:

- Đúng người mới được gọi API.
- Đúng quyền mới được truy cập tài nguyên.
- Token không bị giả mạo hoặc replay.
- Dữ liệu đi qua mạng được mã hóa.
- Dữ liệu nhạy cảm trong hệ thống được mã hóa.
- Gateway không nhận client lạ.
- Các endpoint không bị lạm dụng bằng brute force, flooding, SSRF hoặc IDOR/BOLA.

### Gateway, backend và frontend khác nhau thế nào?

- Frontend `https://localhost:5174`: giao diện web người dùng nhìn thấy.
- Kong/API Gateway `https://localhost:8443`: cửa vào của API. Kong xử lý TLS, mTLS, rate limit, security headers, OPA authorization và JWT hardening trước khi request vào backend.
- Backend `https://localhost:9000`: service FastAPI xử lý logic nghiệp vụ thật.
- Keycloak `http://localhost:8082`: Identity Provider, cấp token đăng nhập.

### Vì sao cần test bằng nhiều công cụ?

Mỗi công cụ chứng minh một lớp khác nhau:

- `curl`: mô phỏng client/attacker gọi HTTP API.
- `openssl x509`: đọc nội dung certificate để biết thuật toán, SAN, EKU, thời hạn.
- `openssl verify`: chứng minh cert được ký bởi CA đúng.
- `openssl s_client`: chứng minh TLS handshake thật, protocol/cipher thật.
- Python attack script: mô phỏng tấn công tự động như JWT `alg=none`, DPoP replay, SSRF, BOLA.
- Browser/UI: chứng minh trải nghiệm thực tế, ví dụ route guard, mTLS client cert, redirect/unauthorized.
- DAST: kiểm thử black-box từ bên ngoài qua HTTPS, giống góc nhìn attacker.

## Ma trận kiểm thử theo từng rủi ro

Phần này dùng như checklist khi báo cáo. Mỗi dòng trả lời 5 câu: rủi ro là gì, đã xử lý ở đâu, test bằng gì, tấn công thử thế nào, kết quả thế nào là đúng.

| # | Rủi ro | Kiến thức nền ngắn | Giải pháp đã triển khai | Lệnh/công cụ test | Kết quả đúng |
|---|---|---|---|---|---|
| 1 | API không bắt buộc đăng nhập | Endpoint nhạy cảm không có auth sẽ bị gọi trực tiếp bằng URL. | `backend/app/middleware/auth_middleware.py` bắt `Authorization: Bearer`. | `curl.exe --cacert certs\ca.crt --cert certs\client.crt --key certs\client.key -i https://localhost:8443/api/v1/users` | `401` hoặc `403`, không trả dữ liệu user. |
| 2 | JWT giả mạo/sai issuer/audience | JWT phải verify chữ ký, issuer, audience; decode payload thôi là không đủ. | `backend/app/security/jwt_verify.py` verify JWKS, `ES256`, issuer, audience. | `curl.exe --cacert certs\ca.crt --cert certs\client.crt --key certs\client.key -i https://localhost:8443/api/v1/users -H "Authorization: Bearer abc.def.ghi"` | `401`, token giả không được chấp nhận. |
| 3 | JWT `alg=none` | Attack tạo JWT không chữ ký nhưng claim role cao. | `gateway/plugins/jwt-hardening/handler.lua` chặn `alg=none`, thiếu/unknown `kid`. | `python scripts/attacks/alg_none_attack.py` | `401`, evidence ghi `result: PASS`. |
| 4 | DPoP replay | Replay là gửi lại y nguyên token/proof đã dùng. | `backend/app/security/dpop_verifier.py` kiểm tra `jti` và lưu Redis chống dùng lại. | `python scripts/attacks/replay_dpop_attack.py` | Lần 1 `200`, lần 2 `401` hoặc `400`. |
| 5 | Stolen bearer token reuse | Bearer token bị lộ thì ai cầm cũng dùng được nếu không bind key. | DPoP bind token với `cnf.jkt`, proof phải ký bằng đúng private key. | Gọi API chỉ có token, không có DPoP: `curl.exe --cacert certs\ca.crt --cert certs\client.crt --key certs\client.key -i https://localhost:8443/api/v1/products -H "Authorization: Bearer <ACCESS_TOKEN>"` | `401 Missing DPoP proof`. |
| 6 | OAuth code interception / CSRF callback | PKCE chống đánh cắp authorization code; `state` chống CSRF callback. | `frontend/src/auth/keycloak.js` dùng Authorization Code + PKCE S256 + `state`. | Mở `https://localhost:5174/callback?code=fake-code&state=fake-state` | Không login được, báo state/token exchange fail. |
| 7 | Role escalation | User role thấp không được vào UI/API role cao. | `PrivateRoute`, `roleAccess.js`, OPA policy `opa/policies/authz.rego`. | `python scripts/attacks/role_escalation_test.py`; UI: customer vào `/admin/dashboard`. | Script `PASS 9/9`; UI redirect `/unauthorized`. |
| 8 | BOLA / IDOR | Đổi object id để xem dữ liệu người khác. | `backend/app/security/bola_guard.py`, order owner dùng Keycloak `sub`, list/detail orders filter theo owner. | Unit: `python scripts/attacks/bola_attack.py`; E2E: `python scripts/attacks/bola_e2e_attack.py` | Unit `PASS 5/5`; E2E customer đọc order người khác phải `403`. |
| 9 | SSRF | Server bị ép gọi metadata/internal URL. | `backend/app/security/ssrf_guard.py` chặn private/loopback/link-local/metadata IP và scheme lạ. | `python scripts/attacks/ssrf_attack.py`; hoặc `curl.exe --cacert certs\ca.crt --cert certs\client.crt --key certs\client.key "https://localhost:8443/api/v1/security/url-check?url=http://169.254.169.254/latest/meta-data/"` | Script `PASS 6/6`; metadata URL bị `400`. |
| 10 | Abuse / flooding | Không rate limit thì API dễ bị spam/brute force. | Kong `rate-limiting` 100 request/phút; `opa/policies/rate_limit.rego`. | `1..120 | ForEach-Object { curl.exe --cacert certs\ca.crt --cert certs\client.crt --key certs\client.key -s -o NUL -w "%{http_code}`n" https://localhost:8443/health }` | Sau khi vượt ngưỡng có request `429`. |
| 11 | Thiếu security headers | Header giúp giảm clickjacking, MIME sniffing, downgrade. | Kong HSTS plugin + response transformer. | `curl.exe --cacert certs\ca.crt --cert certs\client.crt --key certs\client.key -I https://localhost:8443/health` | Có `strict-transport-security`, `x-content-type-options`, `x-frame-options`. |
| 12 | Dữ liệu nhạy cảm bị lộ/tamper | Mã hóa phải có confidentiality và integrity. | `backend/app/security/aead_encryption.py` dùng AES-256-GCM. | `Get-Content -Path backend\app\security\aead_encryption.py`; nên bổ sung test nonce/tamper tự động. | Thấy `AESGCM`, nonce `os.urandom(12)`, tamper sẽ fail khi decrypt. |
| 13 | Quản lý khóa yếu | Key hard-code hoặc không rotate sẽ nguy hiểm khi bị lộ. | Vault Transit wrap/unwrap DEK, `vault/init/vault-rotate.sh`. | `docker compose exec vault sh /vault/init/vault-rotate.sh` | Log có `Rotated to new key version` và `sla(<600s)=PASS`. |
| 14 | Webhook giả mạo | Không verify HMAC thì attacker gửi event giả. | Endpoint webhook dùng HMAC SHA-256 + `hmac.compare_digest`. | `curl.exe -k -X POST https://localhost:8443/api/v1/orders/webhooks/orders -H "Content-Type: application/json" -H "X-Timestamp: 1234567890" -H "X-Signature: fake" -d "{\"order_id\":1}"` | `401 Invalid signature`. |
| 15 | HTTP plaintext / TLS yếu | HTTP bị nghe lén; TLS thấp hơn TLS 1.3 có thể không đạt yêu cầu. | Kong chỉ expose `8443`, tắt `8000`, ép TLS 1.3. | `curl.exe -i --max-time 8 http://localhost:8000/health`; `openssl s_client -connect localhost:8443 -tls1_2 -brief ...` | HTTP `8000` không connect; TLS 1.2 bị từ chối. |
| 16 | Client không được xác thực ở gateway | Server TLS chỉ xác thực server; mTLS xác thực cả client. | Kong yêu cầu client cert ký bởi `certs/ca.crt`. | Không cert: `curl.exe --cacert certs\ca.crt -i https://localhost:8443/health`; có cert: `curl.exe --cacert certs\ca.crt --cert certs\client.crt --key certs\client.key -i https://localhost:8443/health` | Không cert: `400 No required SSL certificate`; có cert: `200 {"status":"ok"}`. |

## Bộ lệnh kiểm thử nhanh sau khi chạy hệ thống

Chạy toàn bộ DAST black-box:

```powershell
python scripts/security_testing/run_dast.py --skip-zap --strict
```

Kết quả đúng:

```text
Checks passed: 7/7
```

Chạy các attack script chính:

```powershell
python scripts/attacks/alg_none_attack.py
python scripts/attacks/bola_attack.py
python scripts/attacks/bola_e2e_attack.py
python scripts/attacks/ssrf_attack.py
python scripts/attacks/role_escalation_test.py
```

Kiểm tra TLS/cert/mTLS:

```powershell
openssl verify -CAfile certs\ca.crt certs\kong.crt certs\frontend.crt certs\backend.crt certs\client.crt
openssl verify -purpose sslserver -CAfile certs\ca.crt certs\kong.crt certs\frontend.crt certs\backend.crt
openssl verify -purpose sslclient -CAfile certs\ca.crt certs\client.crt
openssl s_client -connect localhost:8443 -servername localhost -CAfile certs\ca.crt -cert certs\client.crt -key certs\client.key -tls1_3 -brief
```

Kiểm tra bằng UI:

- Vào `https://localhost:5174` để test frontend.
- Vào `https://localhost:8443/health` khi chưa import client cert: phải bị báo `No required SSL certificate was sent`.
- Import `certs/client.p12` vào Windows/browser rồi vào lại `https://localhost:8443/health`: phải thấy `{"status":"ok"}`.

## Cơ chế sinh token hiện tại và cách lấy token để test

### Token hiện tại được sinh theo cơ chế nào?

Token của project hiện tại do **Keycloak** cấp trong realm:

```text
cloudapi
```

Client frontend là:

```text
spa-client
```

Flow chính của frontend là:

```text
OpenID Connect / OAuth2 Authorization Code Flow + PKCE S256
```

Trong `frontend/src/auth/keycloak.js`, frontend tạo:

- `code_verifier`
- `code_challenge = SHA256(code_verifier)`
- `state`
- `code_challenge_method = S256`

Sau đó user đăng nhập qua Keycloak. Khi callback về `/callback`, frontend dùng `authorization_code` + `code_verifier` để đổi lấy token.

### Token ký bằng thuật toán gì?

Trong `idp/keycloak/realm-export.json`:

```json
"defaultSignatureAlgorithm": "ES256"
```

Client cũng cấu hình:

```json
"access.token.signed.response.alg": "ES256",
"id.token.signed.response.alg": "ES256"
```

Nghĩa là access token và ID token được ký bằng:

```text
ES256 = ECDSA P-256 + SHA-256
```

Backend chỉ chấp nhận:

```python
algorithms=["ES256"]
```

trong `backend/app/security/jwt_verify.py`.

### Token có phải bearer token thường không?

Không hoàn toàn. Access token của project đang là:

```text
DPoP-bound access token
```

Trong `realm-export.json`:

```json
"dpop.bound.access.tokens": "true"
```

Nghĩa là access token có claim:

```json
"cnf": {
  "jkt": "..."
}
```

`cnf.jkt` là thumbprint của public key DPoP. Khi gọi API, chỉ gửi `Authorization: Bearer <token>` là chưa đủ. Client còn phải gửi:

```http
DPoP: <dpop_proof>
```

DPoP proof được ký bằng private key tương ứng. Backend kiểm tra `cnf.jkt`, `ath`, `htu`, `htm`, `iat`, `jti` để chống dùng token bị đánh cắp và chống replay.

### Cách 1: Lấy token từ trình duyệt sau khi đăng nhập UI

1. Mở frontend:

```text
https://localhost:5174
```

2. Đăng nhập bình thường.

3. Mở DevTools:

```text
F12 -> Application -> Local Storage
```

4. Chọn origin của frontend, tìm key:

```text
auth_ctx
```

5. Giá trị JSON thường có:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "idToken": "..."
}
```

Bạn có thể copy `accessToken` để decode hoặc test. Lưu ý: khi gọi API thủ công, bạn vẫn cần DPoP proof hợp lệ cho token đó, không chỉ copy access token.

### Cách 2: Dùng script lấy token để test local

Project có helper:

```powershell
python scripts/security_testing/get_dpop_token.py
```

Script này làm rõ từng bước:

1. Tạo DPoP key pair ECDSA P-256.
2. Tạo DPoP proof cho Keycloak token endpoint.
3. Gửi username/password demo tới Keycloak.
4. Nhận access token DPoP-bound.
5. Decode claim chính như `iss`, `aud`, `sub`, `roles`, `cnf.jkt`.
6. Tạo DPoP proof mẫu cho API.
7. In sẵn lệnh `curl` có đủ mTLS client cert, `Authorization` và `DPoP`.

Mặc định script dùng:

```text
KC_USERNAME=an@gmail.com
KC_PASSWORD=demo1234
CLIENT_ID=spa-client
API_URL=https://localhost:8443/api/v1/products
```

Nếu muốn đổi user:

```powershell
$env:KC_USERNAME="kiet@company.com"
$env:KC_PASSWORD="demo1234"
python scripts/security_testing/get_dpop_token.py
```

Nếu muốn lấy token để test endpoint khác:

```powershell
$env:API_URL="https://localhost:8443/api/v1/users"
python scripts/security_testing/get_dpop_token.py
```

Script sẽ lưu evidence tại:

```text
EVIDENCE/authn-logs/latest_dpop_token.json
```

### Cách decode token để xem claim

Access token là JWT gồm 3 phần:

```text
header.payload.signature
```

Bạn có thể decode payload bằng browser DevTools, jwt.io, hoặc script nội bộ. Không cần secret để decode payload, nhưng cần public key để verify chữ ký.

Cần kiểm tra các claim quan trọng:

- `iss`: issuer Keycloak.
- `aud`: audience.
- `sub`: user id.
- `realm_access.roles`: role như `admin`, `staff`, `customer`.
- `exp`: thời điểm hết hạn.
- `cnf.jkt`: chứng minh token là DPoP-bound.

### Cách test token thủ công qua Kong

Vì Kong đang bật mTLS, mọi request qua `https://localhost:8443` cần:

- CA server: `--cacert certs\ca.crt`
- Client cert: `--cert certs\client.crt`
- Client key: `--key certs\client.key`
- Access token: `Authorization: Bearer <ACCESS_TOKEN>`
- DPoP proof: `DPoP: <DPOP_PROOF>`

Mẫu:

```powershell
curl.exe --cacert certs\ca.crt --cert certs\client.crt --key certs\client.key `
  -H "Authorization: Bearer <ACCESS_TOKEN>" `
  -H "DPoP: <DPOP_PROOF>" `
  "https://localhost:8443/api/v1/products"
```

Nếu thiếu DPoP:

```powershell
curl.exe --cacert certs\ca.crt --cert certs\client.crt --key certs\client.key `
  -H "Authorization: Bearer <ACCESS_TOKEN>" `
  "https://localhost:8443/api/v1/products"
```

Kết quả mong đợi:

```text
401 Missing DPoP proof
```

Nếu dùng lại DPoP proof cũ lần thứ hai, kết quả mong đợi:

```text
401 DPoP proof replayed
```

## 1. API không bắt buộc đăng nhập

### Lỗ hổng là gì?

Nếu API nhạy cảm không bắt buộc xác thực, bất kỳ ai biết endpoint đều có thể đọc, sửa hoặc xóa dữ liệu. Đây là lỗi rất cơ bản trong Cloud API vì API thường được expose qua gateway, frontend, mobile app hoặc public internet.

### Project đã xử lý như thế nào?

File `backend/app/middleware/auth_middleware.py` thêm `AuthMiddleware`. Middleware này:

- Bỏ qua một số public path như `/`, `/health`, docs, webhook.
- Các endpoint còn lại phải có header `Authorization: Bearer <token>`.
- Nếu thiếu hoặc sai format thì trả `401`.
- Nếu token hợp lệ thì gán payload vào `request.state.user`.

### Cách chứng minh

Chạy DAST:

```powershell
python scripts/security_testing/run_dast.py --skip-zap --strict
```

Script gửi request black-box tới `https://localhost:8443/api/v1/users` mà không gửi token. Kết quả đúng là `401` hoặc `403`.

Vì sao script đúng? Vì script không gọi trực tiếp function nội bộ, mà đi qua Kong/API Gateway như một attacker thật. Nếu protected endpoint vẫn trả `200`, nghĩa là middleware hoặc gateway đang bị bypass.

### Cách tấn công thử trên local

```powershell
curl.exe -k https://localhost:8443/api/v1/users
```

Kết quả mong đợi: `401` hoặc `403`, không được trả danh sách user.

## 2. JWT giả mạo, sai issuer hoặc sai audience

### Lỗ hổng là gì?

JWT có thể bị giả mạo nếu server chỉ decode payload mà không verify chữ ký. Ngoài ra, token có chữ ký hợp lệ nhưng thuộc realm/client khác cũng không được chấp nhận, vì token đó không dành cho API này.

### Project đã xử lý như thế nào?

File `backend/app/security/jwt_verify.py`:

- Lấy public key từ JWKS của Keycloak.
- Chọn key theo `kid`.
- Verify chữ ký.
- Chỉ chấp nhận algorithm `ES256`.
- Verify `audience=settings.jwt_audience`.
- Verify `issuer=settings.jwt_issuer`.
- Nếu `kid` không có trong cache thì refresh JWKS một lần.

### Cách chứng minh

```powershell
python scripts/security_testing/run_dast.py --skip-zap --strict
```

Hoặc kiểm tra code:

```powershell
Get-Content -Path backend\app\security\jwt_verify.py
```

Điểm quan trọng cần thấy là `jwt.decode(... algorithms=["ES256"], audience=..., issuer=...)`.

Vì sao đúng? Điều kiện an toàn của JWT là verify chữ ký, issuer, audience và algorithm allow-list. Nếu bỏ một trong các điều kiện này, token có thể bị dùng sai ngữ cảnh.

### Cách tấn công thử trên local

```powershell
curl.exe -k https://localhost:8443/api/v1/users -H "Authorization: Bearer abc.def.ghi"
```

Kết quả mong đợi: `401`.

## 3. JWT `alg=none`

### Lỗ hổng là gì?

Một số hệ thống JWT cũ từng chấp nhận token có header `{"alg":"none"}`. Attacker có thể tạo payload `role=admin`, để trống chữ ký, và nếu server tin payload thì attacker chiếm quyền.

### Project đã xử lý như thế nào?

File `gateway/plugins/jwt-hardening/handler.lua`:

- Parse JWT header ở gateway.
- Nếu `alg == "none"` thì trả `401`.
- Nếu thiếu `kid` thì trả `401`.
- Nếu `kid` không nằm trong JWKS Keycloak thì trả `401`.

Đây là lớp chặn sớm ở Kong trước khi request vào backend.

### Cách chứng minh bằng script

```powershell
python scripts/attacks/alg_none_attack.py
```

Script làm các bước:

1. Tạo JWT header `{"alg":"none","typ":"JWT"}`.
2. Tạo payload giả mạo có `role=admin`.
3. Base64URL encode header và payload.
4. Tạo token dạng `header.payload.` không có chữ ký.
5. Gửi `GET https://localhost:8443/api/v1/users` với `Authorization: Bearer <token>`.
6. Kỳ vọng status `401`.

Vì sao script đúng? Nó mô phỏng đúng attack JWT `alg=none`: payload có quyền cao nhưng không có signature. Nếu hệ thống trả `200` hoặc cho phép admin action, nghĩa là JWT verification/hardening thất bại.

Evidence hiện có: `EVIDENCE/attack_results/token-hardening/alg_none_result.txt`, kết quả `PASS`, status `401`.

## 4. DPoP replay attack

### Lỗ hổng là gì?

Nếu attacker bắt được access token và DPoP proof, attacker có thể gửi lại y nguyên request đó. Đây là replay attack. Với API cloud, replay có thể lặp lại hành động nhạy cảm như thanh toán, tạo order, đổi profile.

### Project đã xử lý như thế nào?

File `backend/app/security/dpop_verifier.py`:

- Bắt buộc có header `DPoP`.
- Verify DPoP JWT bằng public JWK trong header.
- Chỉ chấp nhận `alg=ES256`.
- Kiểm tra `htm` khớp HTTP method.
- Kiểm tra `htu` khớp URL request.
- Kiểm tra `iat` còn mới trong 60 giây.
- Kiểm tra `ath` là SHA-256 hash của access token.
- Kiểm tra token có `cnf.jkt`, và JWK trong proof khớp với `jkt`.
- Lưu `jti` vào Redis với `nx=True`; nếu `jti` đã tồn tại thì trả `401 DPoP proof replayed`.

### Cách chứng minh bằng script

```powershell
python scripts/attacks/replay_dpop_attack.py
```

Mặc định script dùng authorization code flow. Nó sẽ in URL Keycloak để bạn mở trình duyệt, đăng nhập, rồi dán callback URL/code vào terminal.

Nếu muốn dùng password flow demo:

```powershell
$env:AUTH_FLOW="password"
$env:ATTACK_USERNAME="an@gmail.com"
$env:ATTACK_PASSWORD="demo1234"
python scripts/attacks/replay_dpop_attack.py
```

Script làm các bước:

1. Tạo EC P-256 private key.
2. Xin access token DPoP-bound từ Keycloak.
3. Tạo DPoP proof cho `GET https://localhost:8443/api/v1/products`.
4. Gửi request lần 1 với `Authorization` + `DPoP`.
5. Gửi lại lần 2 y nguyên hai header đó.
6. Kỳ vọng lần 1 `200`, lần 2 `401` hoặc `400`.

Vì sao script đúng? Replay attack nghĩa là dùng lại chính xác proof cũ. Nếu Redis `jti` store hoạt động, lần 2 phải bị chặn vì `jti` đã dùng. Nếu lần 2 vẫn `200`, replay protection hỏng.

Evidence hiện có: `EVIDENCE/attack_results/token-hardening/dpop_replay_result.txt`, kết quả `PASS`, lần 1 `200`, lần 2 `401`.

## 5. Stolen bearer token reuse / token không bind với key

### Lỗ hổng là gì?

Bearer token bình thường có nghĩa là ai cầm token thì dùng được. Nếu token bị lấy từ browser log, proxy hoặc extension độc hại, attacker có thể gọi API mà không cần private key của client.

### Project đã xử lý như thế nào?

DPoP biến access token thành token có ràng buộc với key:

- Frontend tạo DPoP key trong `frontend/src/utils/dpop.js`.
- Token endpoint nhận DPoP proof khi login/refresh trong `frontend/src/auth/keycloak.js`.
- Backend đọc `cnf.jkt` trong token và so với public JWK của DPoP proof.
- Nếu token không có `cnf.jkt` thì trả `401 Token is not DPoP bound`.
- Nếu JWK không khớp thì trả `401 DPoP key binding mismatch`.

### Cách chứng minh

Gửi request có token nhưng thiếu DPoP:

```powershell
curl.exe -k https://localhost:8443/api/v1/products -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Kết quả mong đợi: `401 Missing DPoP proof`.

Vì sao đúng? Điều này chứng minh access token không còn là bearer token thuần túy; token phải đi kèm proof được ký bởi đúng private key.

## 6. OAuth login yếu: code interception và CSRF callback

### Lỗ hổng là gì?

Nếu SPA dùng implicit flow hoặc authorization code mà không có PKCE, attacker có thể chặn authorization code. Nếu không có `state`, attacker có thể ép user login vào session sai.

### Project đã xử lý như thế nào?

File `frontend/src/auth/keycloak.js`:

- Tạo `code_verifier` random.
- Tạo `code_challenge = SHA-256(code_verifier)`.
- Gửi `code_challenge_method=S256` khi login.
- Lưu `state` trong `sessionStorage`.
- Callback phải có `state` khớp.
- Token exchange phải gửi `code_verifier`.
- Token request có DPoP proof.

### Cách chứng minh

```powershell
Get-Content -Path frontend\src\auth\keycloak.js
```

Cần thấy các trường:

- `code_challenge_method: 'S256'`
- `state`
- `code_verifier`
- `handleCallback()` check state mismatch

### Cách tấn công thử trên local

Mở URL callback giả:

```text
https://localhost:5174/callback?code=fake-code&state=fake-state
```

Kết quả mong đợi: frontend báo lỗi `State mismatch` hoặc không tạo session.

Vì sao đúng? CSRF callback thường dựa vào việc state không được verify. Nếu state sai mà vẫn login được thì có lỗi.

## 7. Role escalation

### Lỗ hổng là gì?

Role escalation xảy ra khi user role thấp truy cập được chức năng của role cao hơn, ví dụ customer vào admin dashboard hoặc gọi API staff/admin.

### Project đã xử lý như thế nào?

Có hai lớp:

1. Frontend route guard:
   - `frontend/src/App.jsx` bọc route `/admin`, `/staff`, `/customer` bằng `PrivateRoute`.
   - `frontend/src/auth/PrivateRoute.jsx` check role.
   - `frontend/src/auth/roleAccess.js` chỉ allow khi user có role nằm trong allowed roles.

2. Gateway policy:
   - `gateway/plugins/opa-authz/handler.lua` lấy role từ JWT payload và gửi input sang OPA.
   - `opa/policies/authz.rego` quy định admin/staff/customer được làm gì.

### Cách chứng minh bằng script

```powershell
python scripts/attacks/role_escalation_test.py
```

Script:

- Đọc `frontend/src/App.jsx`.
- Kiểm tra route `/admin` chỉ có `roles={['admin']}`.
- Kiểm tra route `/staff` chỉ có `roles={['staff']}`.
- Kiểm tra route `/customer` chỉ có `roles={['customer']}`.
- Test 9 tổ hợp role: admin không vào staff/customer, staff không vào admin/customer, customer không vào admin/staff.

Vì sao script đúng? Nó xác minh cả cấu hình route thật trong source và logic allow/deny theo role. Tuy nhiên đây là frontend evidence; bảo vệ API thật vẫn cần OPA/backend.

Evidence hiện có: `EVIDENCE/attack_results/role-escalation/role_escalation_result.json`, kết quả `PASS 9/9`.

### Cách tấn công thử trên web

1. Đăng nhập bằng customer.
2. Sửa URL thành:

```text
https://localhost:5174/admin/dashboard
```

Kết quả mong đợi: bị redirect về `/unauthorized`.

3. Đăng nhập bằng staff, thử:

```text
https://localhost:5174/admin/users
```

Kết quả mong đợi: bị chặn.

## 8. BOLA / IDOR

### Lỗ hổng là gì?

BOLA, hay IDOR, xảy ra khi user đổi object id trên URL để đọc tài nguyên của người khác. Ví dụ customer A gọi `/api/v1/orders/2` trong khi order 2 thuộc customer B.

### Project đã xử lý như thế nào?

File `backend/app/security/bola_guard.py`:

- Nếu role là `admin` hoặc `staff` thì cho xem order để vận hành.
- Nếu là customer thì `order_owner_id` phải bằng `token.sub`.
- Nếu thiếu owner hoặc thiếu subject thì deny.

File `backend/app/api/v1/orders.py`:

- Khi tạo order, backend tự gán `order.user_id = request.state.user["sub"]`.
- Khi list orders:
  - `admin/staff` xem toàn bộ.
  - `customer` chỉ xem order có `user_id == token.sub`.
- Endpoint `GET /api/v1/orders/{order_id}` lấy order.
- Lấy token payload từ `request.state.user`.
- Gọi `can_read_order(order_owner_id, token_payload)`.
- Nếu false thì trả `403`.

### Cách chứng minh bằng script

```powershell
python scripts/attacks/bola_attack.py
```

Script test 5 case:

- Customer đọc order của mình: allow.
- Customer đọc order người khác: deny.
- Customer thiếu subject: deny.
- Staff đọc order để vận hành: allow.
- Admin đọc order để vận hành: allow.

Vì sao script đúng? BOLA phụ thuộc vào logic object ownership. Script gọi trực tiếp `can_read_order()` với owner và token payload khác nhau, nên có thể chứng minh rule cốt lõi đúng/sai. Điểm giới hạn: đây là unit-style evidence, chưa phải HTTP end-to-end.

Evidence hiện có: `EVIDENCE/attack_results/bola/bola_result.txt`, kết quả `PASS 5/5`.

### Cách test thật end-to-end qua API

Sau khi đã bật Kong mTLS và DPoP, dùng script:

```powershell
python scripts/attacks/bola_e2e_attack.py
```

Script này test thật qua:

```text
Browser login -> Keycloak token -> Kong mTLS -> DPoP -> OPA -> Backend API -> Database
```

Kịch bản:

1. Đăng nhập customer A, ví dụ:

```text
an@gmail.com / demo1234
```

2. Script tạo order A bằng token của customer A.
3. Đăng nhập customer B, ví dụ:

```text
bich@gmail.com / demo1234
```

4. Script tạo order B bằng token của customer B.
5. Script dùng customer A đọc order A.
6. Script dùng customer A thử đọc order B.
7. Script dùng customer A list orders để kiểm tra danh sách không lộ order B.

Kết quả đúng:

```text
Customer A đọc order A       -> HTTP 200
Customer A đọc order B       -> HTTP 403
Customer A list orders       -> không có order B
Result                       -> PASS
```

Vì sao test này mạnh hơn unit test? Vì nó không dùng dữ liệu giả lập trong Python nữa. Nó dùng token thật từ Keycloak, DPoP proof thật, request thật qua Kong, policy OPA thật và dữ liệu order thật trong DB.

Evidence được lưu tại:

```text
EVIDENCE/attack_results/bola/bola_e2e_result.json
```

### Cách tấn công thử thủ công qua API

```powershell
curl.exe -k https://localhost:8443/api/v1/orders/<ORDER_ID_CUA_NGUOI_KHAC> -H "Authorization: Bearer <CUSTOMER_A_TOKEN>" -H "DPoP: <VALID_DPOP_PROOF>"
```

Kết quả mong đợi: `403 Forbidden`.

Nếu trả `200` và hiện order của người khác thì BOLA chưa được xử lý đúng.

## 9. SSRF

### Lỗ hổng là gì?

SSRF xảy ra khi API nhận URL từ user rồi server đi fetch URL đó. Attacker có thể ép server gọi vào nội bộ như:

- Cloud metadata: `http://169.254.169.254/latest/meta-data/`
- Localhost: `http://127.0.0.1`
- Private network: `http://10.0.0.5`
- File scheme: `file:///etc/passwd`

Trong cloud, SSRF có thể lấy credential, token metadata hoặc scan internal service.

### Project đã xử lý như thế nào?

File `backend/app/security/ssrf_guard.py`:

- Chỉ cho scheme `http` và `https`.
- Chặn hostname `localhost` và `*.localhost`.
- Chặn IP trực tiếp nếu là private, loopback, link-local, multicast, reserved, unspecified, metadata IP.
- Resolve DNS bằng `socket.getaddrinfo()`.
- Chặn cả IP sau khi resolve nếu nó trỏ về private/internal.

Endpoint evidence: `backend/app/api/v1/security.py` có `/api/v1/security/url-check`, endpoint này validate URL nhưng không fetch thật.

### Cách chứng minh bằng script

```powershell
python scripts/attacks/ssrf_attack.py
```

Script test 6 case:

- Block AWS metadata IP.
- Block loopback IP.
- Block localhost hostname.
- Block private IP.
- Block `file://`.
- Allow public HTTPS IP.

Vì sao script đúng? SSRF guard cần chặn cả IP trực tiếp, hostname đặc biệt, scheme nguy hiểm, và vẫn cho public URL hợp lệ. Sáu case này bao phủ các mẫu tấn công SSRF cơ bản nhất.

Evidence hiện có: `EVIDENCE/attack_results/ssrf/ssrf_result.txt`, kết quả `PASS 6/6`.

### Cách tấn công thử qua API

```powershell
curl.exe -k "https://localhost:8443/api/v1/security/url-check?url=http://169.254.169.254/latest/meta-data/"
```

Kết quả mong đợi: `400` với thông báo unsafe IP.

Thử localhost:

```powershell
curl.exe -k "https://localhost:8443/api/v1/security/url-check?url=http://127.0.0.1:8000/admin"
```

Kết quả mong đợi: `400`.

Thử public HTTPS:

```powershell
curl.exe -k "https://localhost:8443/api/v1/security/url-check?url=https://93.184.216.34/"
```

Kết quả mong đợi: `200`, `allowed=true`.

## 10. Abuse, brute force, flooding

### Lỗ hổng là gì?

Nếu API không giới hạn tần suất, attacker có thể spam request gây DoS nhẹ, brute force endpoint login/OTP, crawl dữ liệu hoặc làm tăng chi phí cloud.

### Project đã xử lý như thế nào?

File `gateway/kong.yml` cấu hình:

```yaml
- name: rate-limiting
  config:
    minute: 100
    policy: local
```

Ngoài ra `opa/policies/rate_limit.rego` có policy deny nếu `request_count > 100` trong window `1m`.

### Cách chứng minh

DAST kiểm tra header rate limit:

```powershell
python scripts/security_testing/run_dast.py --skip-zap --strict
```

Trong response `/health` phải có header như:

- `x-ratelimit-limit-minute`
- `x-ratelimit-remaining-minute`
- hoặc `ratelimit-limit`

Vì sao đúng? Header rate-limit cho thấy request đang đi qua Kong plugin rate-limiting. Tuy nhiên đây mới chứng minh plugin đang bật, chưa phải test vượt ngưỡng.

### Cách tấn công thử

Gửi hơn 100 request trong 1 phút:

```powershell
1..120 | ForEach-Object { curl.exe -k -s -o NUL -w "%{http_code}`n" https://localhost:8443/health }
```

Kết quả mong đợi: các request đầu `200`, sau khi vượt limit sẽ có request bị `429`.

## 11. Thiếu security headers

### Lỗ hổng là gì?

Thiếu security headers làm tăng nguy cơ:

- Clickjacking nếu thiếu `X-Frame-Options`.
- MIME sniffing nếu thiếu `X-Content-Type-Options`.
- HTTPS downgrade nếu thiếu HSTS.

### Project đã xử lý như thế nào?

File `gateway/plugins/hsts-header/handler.lua` set:

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

File `gateway/kong.yml` thêm response headers:

- `X-Content-Type-Options:nosniff`
- `X-Frame-Options:DENY`

### Cách chứng minh

```powershell
python scripts/security_testing/run_dast.py --skip-zap --strict
```

Hoặc thủ công:

```powershell
curl.exe -k -I https://localhost:8443/health
```

Kết quả mong đợi có:

- `strict-transport-security`
- `x-content-type-options: nosniff`
- `x-frame-options: DENY`

Vì sao đúng? Đây là black-box check trên response thật qua Kong, nên chứng minh header đã được inject vào traffic ra ngoài.

## 12. Mã hóa dữ liệu nhạy cảm và chống tamper

### Lỗ hổng là gì?

Nếu field nhạy cảm lưu plaintext, khi DB bị lộ thì attacker đọc được dữ liệu. Nếu mã hóa không có integrity, attacker có thể sửa ciphertext và gây thay đổi dữ liệu sau decrypt.

### Project đã xử lý như thế nào?

File `backend/app/security/aead_encryption.py`:

- Dùng `AESGCM`, tức AES-256-GCM nếu DEK dài 32 bytes.
- Mỗi lần encrypt tạo nonce 12 bytes bằng `os.urandom(12)`.
- Output là `nonce || ciphertext || GCM tag`.
- Khi decrypt, nếu ciphertext/tag bị sửa thì `AESGCM.decrypt()` sẽ throw `InvalidTag`.

DEK không hard-code trong code mà lấy qua Vault Transit unwrap.

### Cách chứng minh hiện tại

Hiện tại hai file `scripts/evaluation/e_c2_nonce_test.py` và `scripts/evaluation/e_c3_aead_integrity.py` đang rỗng, nên chưa có automated evidence sẵn cho nonce/integrity.

Có thể chứng minh bằng code review:

```powershell
Get-Content -Path backend\app\security\aead_encryption.py
```

Nên bổ sung test tốt hơn:

- Encrypt cùng plaintext 2 lần, ciphertext phải khác nhau do nonce random.
- Sửa 1 byte ciphertext, decrypt phải fail.

Vì sao đúng? AES-GCM yêu cầu nonce không lặp và có authentication tag. Hai test trên chứng minh tính bảo mật cần có của AEAD.

## 13. Quản lý khóa và rotation bằng Vault Transit

### Lỗ hổng là gì?

Nếu DEK/KEK hard-code trong source hoặc `.env`, khi repo/log/container bị lộ thì attacker có thể decrypt dữ liệu. Nếu không có rotation, key cũ bị lộ sẽ ảnh hưởng lâu dài.

### Project đã xử lý như thế nào?

File `backend/app/security/aead_encryption.py`:

- `wrap_dek_with_vault()` gọi Vault Transit encrypt để wrap DEK.
- `get_dek_from_vault()` gọi Vault Transit decrypt để unwrap DEK.

File `vault/init/vault-init.sh` tạo transit key `dek`.

File `vault/init/vault-rotate.sh`:

- Đợi Vault sẵn sàng.
- Đọc version hiện tại.
- Chạy `vault write -f transit/keys/dek/rotate`.
- Set `min_decryption_version` bằng version mới.
- Log SLA rotation nhỏ hơn 600 giây.

### Cách chứng minh

Kiểm tra script:

```powershell
Get-Content -Path vault\init\vault-rotate.sh
```

Chạy trong container Vault nếu hệ thống đang up:

```powershell
docker compose exec vault sh /vault/init/vault-rotate.sh
```

Kết quả mong đợi: log có `Rotated to new key version` và `sla(<600s)=PASS`.

Vì sao đúng? Rotation đúng khi latest version tăng lên và old versions bị revoke bằng `min_decryption_version`. Khi đó key cũ không còn được dùng để decrypt theo policy mới.

### Lưu ý

Trong `docker-compose.yml`, Vault đang chạy dev mode/root token. Đây là tốt cho demo, nhưng không nên dùng production.

## 14. Webhook giả mạo

### Lỗ hổng là gì?

Webhook endpoint nếu chỉ nhận body mà không verify signature thì attacker có thể gửi event giả, ví dụ tạo order fake hoặc cập nhật trạng thái thanh toán fake.

### Project đã xử lý như thế nào?

File `backend/app/api/v1/orders.py` endpoint `/api/v1/orders/webhooks/orders`:

- Đọc raw body.
- Bắt buộc có `X-Timestamp` và `X-Signature`.
- Tính HMAC SHA-256 trên `timestamp + "." + body`.
- So sánh bằng `hmac.compare_digest()` để giảm timing attack.
- Sai signature thì trả `401`.

### Cách chứng minh thủ công

Gửi webhook thiếu signature:

```powershell
curl.exe -k -X POST https://localhost:8443/api/v1/orders/webhooks/orders -H "Content-Type: application/json" -d "{\"order_id\":1}"
```

Kết quả mong đợi: `401 Missing X-Timestamp or X-Signature`.

Gửi signature sai:

```powershell
curl.exe -k -X POST https://localhost:8443/api/v1/orders/webhooks/orders -H "Content-Type: application/json" -H "X-Timestamp: 1234567890" -H "X-Signature: fake" -d "{\"order_id\":1}"
```

Kết quả mong đợi: `401 Invalid signature`.

Vì sao đúng? Attacker thường không biết shared secret, nên không tạo được HMAC đúng. Nếu signature sai mà vẫn `200`, webhook bị giả mạo được.

## 15. HTTP plaintext, TLS yếu và chứng minh thuật toán certificate

### Lỗ hổng là gì?

Nếu API Gateway vẫn mở HTTP plaintext, attacker trong cùng mạng có thể nghe lén token, DPoP proof, dữ liệu request/response hoặc ép người dùng đi qua kênh không mã hóa. Nếu gateway vẫn cho TLS 1.0/1.1/1.2 trong khi yêu cầu của bài là TLS 1.3 only, hệ thống vẫn còn rủi ro downgrade hoặc dùng cipher yếu hơn mong muốn.

Ngoài ra, nếu không chứng minh được certificate dùng thuật toán gì, SAN nào, chain nào, thì chỉ nói "có TLS" là chưa đủ.

### Project đã xử lý như thế nào?

Trong `docker-compose.yml`, service Kong đã được chỉnh:

```yaml
KONG_PROXY_LISTEN: "0.0.0.0:8443 ssl http2"
KONG_NGINX_PROXY_SSL_PROTOCOLS: "TLSv1.3"
```

Port HTTP proxy `8000` đã được bỏ khỏi phần `ports`, nên bên ngoài host không còn truy cập API qua HTTP plaintext.

Kong dùng:

```yaml
KONG_SSL_CERT: /certs/kong.crt
KONG_SSL_CERT_KEY: /certs/kong.key
```

Các certificate được sinh từ `scripts/gen_certs.py`:

- Thuật toán key: ECDSA P-256, tức curve `prime256v1`.
- Signature algorithm: `ecdsa-with-SHA256`.
- Server cert có Extended Key Usage: `TLS Web Server Authentication`.
- SAN của Kong gồm `localhost`, `api-gateway`, `kong`, `127.0.0.1`.

### Chứng minh certificate dùng thuật toán gì

Kiểm tra cert Kong:

```powershell
openssl x509 -in certs\kong.crt -noout -subject -issuer -dates -text
```

Các dòng cần nhìn:

```text
Signature Algorithm: ecdsa-with-SHA256
Public Key Algorithm: id-ecPublicKey
Public-Key: (256 bit)
ASN1 OID: prime256v1
NIST CURVE: P-256
X509v3 Extended Key Usage:
    TLS Web Server Authentication
X509v3 Subject Alternative Name:
    DNS:localhost, DNS:api-gateway, DNS:kong, IP Address:127.0.0.1
```

Vì sao lệnh này đúng? `openssl x509 -text` đọc trực tiếp nội dung X.509 certificate, không dựa vào code hay comment. Nếu cert dùng RSA, thiếu SAN, sai EKU hoặc hết hạn thì lệnh này sẽ hiện ra ngay.

Kiểm tra cert backend và frontend tương tự:

```powershell
openssl x509 -in certs\backend.crt -noout -subject -issuer -dates -text
openssl x509 -in certs\frontend.crt -noout -subject -issuer -dates -text
```

### Chứng minh chain certificate đúng

```powershell
openssl verify -CAfile certs\ca.crt certs\kong.crt certs\frontend.crt certs\backend.crt certs\client.crt
```

Kết quả mong đợi:

```text
certs\kong.crt: OK
certs\frontend.crt: OK
certs\backend.crt: OK
certs\client.crt: OK
```

Vì sao lệnh này đúng? Nó kiểm tra các cert có thật sự được ký bởi CA nội bộ `certs/ca.crt` hay không. Nếu attacker thay cert khác không do CA này ký, lệnh sẽ fail.

Kiểm tra đúng mục đích server/client:

```powershell
openssl verify -purpose sslserver -CAfile certs\ca.crt certs\kong.crt certs\frontend.crt certs\backend.crt
openssl verify -purpose sslclient -CAfile certs\ca.crt certs\client.crt
```

Kết quả mong đợi đều là `OK`.

### Chứng minh Kong không còn HTTP plaintext

```powershell
curl.exe -i --max-time 8 http://localhost:8000/health
```

Kết quả mong đợi:

```text
Failed to connect to localhost port 8000
```

Vì sao đúng? Nếu port HTTP plaintext còn mở, lệnh này sẽ trả `HTTP/1.1 200 OK`. Khi không connect được, chứng minh API không còn expose qua HTTP port 8000.

### Chứng minh Kong chỉ nhận TLS 1.3

Thử ép TLS 1.2:

```powershell
openssl s_client -connect localhost:8443 -servername localhost -CAfile certs\ca.crt -cert certs\client.crt -key certs\client.key -tls1_2 -brief
```

Kết quả mong đợi:

```text
tlsv1 alert protocol version
```

Thử TLS 1.3:

```powershell
openssl s_client -connect localhost:8443 -servername localhost -CAfile certs\ca.crt -cert certs\client.crt -key certs\client.key -tls1_3 -brief
```

Kết quả mong đợi:

```text
Protocol version: TLSv1.3
Ciphersuite: TLS_AES_256_GCM_SHA384
Peer certificate: CN=kong, O=NT219-KONG
Verification: OK
```

Vì sao đúng? `openssl s_client` thực hiện TLS handshake thật với service đang chạy. Khi TLS 1.2 bị từ chối và TLS 1.3 thành công, ta chứng minh cấu hình TLS version đang được áp dụng thật, không chỉ nằm trong file config.

## 16. Client certificate / mTLS ở Kong

### Lỗ hổng là gì?

Nếu chỉ có server TLS, bất kỳ client nào cũng có thể mở kết nối tới API Gateway. Token/JWT vẫn bảo vệ endpoint, nhưng gateway không phân biệt client thuộc hệ thống hay client lạ. Với mTLS, gateway yêu cầu client phải có certificate hợp lệ được CA nội bộ ký trước khi request vào lớp HTTP/API.

### Project đã xử lý như thế nào?

Trong `docker-compose.yml`, Kong được cấu hình:

```yaml
KONG_NGINX_PROXY_SSL_CLIENT_CERTIFICATE: /certs/ca.crt
KONG_NGINX_PROXY_SSL_VERIFY_CLIENT: "on"
KONG_NGINX_PROXY_SSL_VERIFY_DEPTH: "2"
```

Ý nghĩa:

- `ssl_client_certificate`: CA dùng để verify client certificate.
- `ssl_verify_client on`: bắt buộc client gửi certificate.
- `ssl_verify_depth 2`: cho phép chain verify có độ sâu phù hợp với CA nội bộ.

Client certificate hiện có:

- `certs/client.crt`
- `certs/client.key`

### Chứng minh không có client cert thì bị chặn

```powershell
curl.exe --cacert certs\ca.crt -i --max-time 8 https://localhost:8443/health
```

Kết quả mong đợi:

```text
HTTP/2 400
No required SSL certificate was sent
```

Vì sao đúng? Lệnh này có tin CA server bằng `--cacert`, nhưng không gửi client certificate. Nếu Kong bật mTLS bắt buộc, nó phải chặn trước khi request vào backend.

### Chứng minh có client cert hợp lệ thì được qua

```powershell
curl.exe --cacert certs\ca.crt --cert certs\client.crt --key certs\client.key -i https://localhost:8443/health
```

Kết quả mong đợi:

```text
HTTP/2 200
{"status":"ok"}
```

Vì sao đúng? Lệnh này vừa verify server bằng CA nội bộ, vừa gửi client cert/key hợp lệ. Nếu trả `200`, chứng minh Kong đã chấp nhận client certificate và forward request vào backend.

### Chứng minh client cert đúng loại client-auth

```powershell
openssl verify -purpose sslclient -CAfile certs\ca.crt certs\client.crt
```

Kết quả mong đợi:

```text
certs\client.crt: OK
```

Xem chi tiết client cert:

```powershell
openssl x509 -in certs\client.crt -noout -text
```

Cần thấy:

```text
X509v3 Extended Key Usage:
    TLS Web Client Authentication
```

Vì sao đúng? Server cert và client cert có mục đích khác nhau. `sslclient` và EKU `TLS Web Client Authentication` chứng minh certificate này phù hợp để client dùng trong mTLS.

### Chứng minh bằng UI / trình duyệt

Có thể kiểm tra theo cách trực quan:

1. Mở trình duyệt vào `https://localhost:8443/health`.
2. Nếu trình duyệt chưa import client certificate, Kong sẽ trả lỗi `400 No required SSL certificate was sent`.
3. Import `certs/client.crt` và `certs/client.key` vào certificate store của trình duyệt hoặc hệ điều hành. Một số trình duyệt cần file `.p12/.pfx`, có thể tạo bằng:

```powershell
openssl pkcs12 -export -out certs\client.p12 -inkey certs\client.key -in certs\client.crt -certfile certs\ca.crt
```

4. Mở lại `https://localhost:8443/health`, chọn client certificate nếu trình duyệt hỏi.
5. Kết quả mong đợi: thấy `{"status":"ok"}`.

Vì sao thao tác UI này có giá trị? Nó chứng minh mTLS không chỉ hoạt động với `curl`, mà còn tác động thật tới browser/client khi truy cập API Gateway.

### Chứng minh bằng DAST

```powershell
python scripts/security_testing/run_dast.py --skip-zap --strict
```

DAST hiện đã có check:

```text
kong_requires_client_certificate
```

Check này làm hai việc:

- Gọi Kong không kèm client cert, kỳ vọng bị chặn.
- Các request hợp lệ còn lại dùng `certs/client.crt` và `certs/client.key`.

Kết quả mong đợi:

```text
Built-in checks: 7/7 passed
```

## DAST tổng hợp

Lệnh:

```powershell
python scripts/security_testing/run_dast.py --skip-zap --strict
```

Script này kiểm tra:

- Frontend HTTPS sống.
- Kong mTLS chặn request không có client certificate.
- Kong HTTPS `/health` sống.
- Security headers có mặt.
- Rate-limit headers có mặt.
- Protected endpoint không token bị chặn.
- JWT `alg=none` bị chặn.

Output:

- HTML: `EVIDENCE/security_scans/zap_report.html`
- JSON: `EVIDENCE/security_scans/dast_summary.json`
- Markdown summary: `EVIDENCE/security_scans/dast_summary.md`

Vì sao DAST có giá trị? Vì nó test từ bên ngoài qua URL HTTPS, giống cách attacker nhìn thấy hệ thống. Nếu DAST pass thì ít nhất gateway và response surface đang có các control cần thiết.

## Các script tấn công nên chạy lại

```powershell
python scripts/attacks/alg_none_attack.py
python scripts/attacks/bola_attack.py
python scripts/attacks/ssrf_attack.py
python scripts/attacks/role_escalation_test.py
python scripts/security_testing/run_dast.py --skip-zap --strict
```

DPoP replay cần login Keycloak:

```powershell
python scripts/attacks/replay_dpop_attack.py
```

Nếu dùng password-flow demo:

```powershell
$env:AUTH_FLOW="password"
$env:ATTACK_USERNAME="an@gmail.com"
$env:ATTACK_PASSWORD="demo1234"
python scripts/attacks/replay_dpop_attack.py
```

Sau khi bật mTLS ở Kong, các script gọi API qua `https://localhost:8443` cần client cert. Project đã cập nhật sẵn mặc định:

```text
CLIENT_CERT=certs/client.crt
CLIENT_KEY=certs/client.key
```

Nếu muốn override:

```powershell
$env:CLIENT_CERT="certs/client.crt"
$env:CLIENT_KEY="certs/client.key"
python scripts/attacks/alg_none_attack.py
```

## Các điểm cần cẩn thận khi kết luận

- BOLA và SSRF script hiện tại là unit-style evidence, gọi trực tiếp guard function. Chúng chứng minh logic guard đúng, nhưng chưa mạnh bằng test HTTP end-to-end với token thật.
- DAST hiện có sẽ bỏ qua ZAP nếu image `ghcr.io/zaproxy/zaproxy:stable` chưa có local.
- CORS backend đang `allow_origins=["*"]`; Kong có cấu hình CORS riêng, nhưng nếu backend bị expose trực tiếp thì vẫn là rủi ro cần sửa.
- `docker-compose.yml` đã tắt Kong HTTP proxy `8000`, nhưng vẫn expose một số port nội bộ để dev/test: backend `9000`, OPA `8181`, Vault `8200`, Redis, Postgres. Production nên bỏ expose host port cho service nội bộ.
- Kong mTLS hiện dùng chung CA nội bộ trong `certs/ca.crt`. Production nên tách CA/chain và quy trình cấp phát, thu hồi client certificate rõ ràng.
- Trình duyệt muốn gọi trực tiếp API qua Kong sau khi bật mTLS cần import client certificate, nếu không request từ UI sẽ bị Kong chặn ở TLS layer.
- Vault đang dev mode/root token, chỉ phù hợp demo.
