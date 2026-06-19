# NT219.Q21.ANTT - MẬT MÃ HỌC

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![Kong](https://img.shields.io/badge/Kong-3.6-003459?logo=kong&logoColor=white)
![Keycloak](https://img.shields.io/badge/Keycloak-24.0-4D4D4D?logo=keycloak&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Vault](https://img.shields.io/badge/Vault-1.15-FFEC6E?logo=vault&logoColor=black)
![Grafana](https://img.shields.io/badge/Grafana-10-F46800?logo=grafana&logoColor=white)
![OPA](https://img.shields.io/badge/OPA-0.65-7D9FC2?logoColor=white)

**Tên đề tài:** Cloud API-Based Network Application Security for Small Company Services

Hệ thống API bảo mật đa tầng được xây dựng theo kiến trúc Zero-Trust, triển khai bằng Docker Compose. Dự án mô phỏng môi trường thương mại điện tử (users / products / orders) và tích hợp đầy đủ các cơ chế bảo mật API hiện đại: từ xác thực danh tính, phân quyền chính sách, mã hoá dữ liệu, cho đến giám sát bảo mật và kiểm thử tấn công.

---

## Mục lục
 
1. [Kiến trúc tổng quan](#1-kiến-trúc-tổng-quan)
2. [Thành phần hệ thống](#2-thành-phần-hệ-thống)
3. [Cơ chế bảo mật](#3-cơ-chế-bảo-mật)
4. [Rủi ro & Giải pháp](#4-rủi-ro--giải-pháp)
5. [Cấu trúc thư mục](#5-cấu-trúc-thư-mục)
6. [Yêu cầu hệ thống](#6-yêu-cầu-hệ-thống)
7. [Cài đặt & Cấu hình](#7-cài-đặt--cấu-hình)
8. [Khởi chạy hệ thống](#8-khởi-chạy-hệ-thống)
9. [Các điểm truy cập](#9-các-điểm-truy-cập)
10. [Luồng xác thực (Auth Flow)](#10-luồng-xác-thực-auth-flow)
11. [Phân quyền & Vai trò](#11-phân-quyền--vai-trò)
12. [Kiểm thử bảo mật](#12-kiểm-thử-bảo-mật)
13. [Observability & Giám sát](#13-observability--giám-sát)
14. [CI/CD Pipeline](#14-cicd-pipeline)
15. [Scripts tiện ích](#15-scripts-tiện-ích)
16. [Triển khai Production](#16-triển-khai-production)
---
 
## 1. Kiến trúc tổng quan
 
Hệ thống được chia thành 7 tầng độc lập, giao tiếp qua các mạng Docker riêng biệt:
 
```
Internet
    │
    ▼
[Frontend – Nginx TLS]        ← HTTPS 443 / 80  (dmz-net)
    │
    ▼
[WAF – Nginx mTLS Proxy]      ← port 8443        (dmz-net)
    │  (mTLS client cert bắt buộc)
    ▼
[API Gateway – Kong 3.6]      ← TLS 1.3 only     (dmz-net / app-net)
    │  JWT Hardening · OPA Authz · Rate Limit · HSTS · CORS
    ▼
[Backend – FastAPI / Python]  ← HTTPS 9000       (app-net / data-net)
    │  BOLA Guard · SSRF Guard · TOTP · AEAD Encrypt
    │
    ├──▶ [Keycloak 24.0]   OIDC IdP             (app-net / dmz-net)
    ├──▶ [OPA 0.65.0]      Policy Engine         (app-net)
    ├──▶ [Redis 7 TLS]     Nonce / Session cache (app-net)
    ├──▶ [PostgreSQL 16 TLS+mTLS] Datastore      (data-net)
    └──▶ [Vault 1.15 + TLS Proxy] Secret / KEK  (data-net)
```
 
Toàn bộ traffic nội bộ giữa các service đều chạy qua TLS (TLS 1.3 ưu tiên). Frontend và WAF dùng certificate ZeroSSL công khai; các service nội bộ dùng CA nội bộ (`internal-certs/ca.crt`) tự sinh.
 
---
 
## 2. Thành phần hệ thống
 
| Service | Image | Vai trò | Mạng |
|---|---|---|---|
| `frontend` | Nginx + Vite/React | SPA – giao diện người dùng | `dmz-net` |
| `api-waf` | Nginx 1.27-alpine | WAF – mTLS proxy, lọc request | `dmz-net` |
| `api-gateway` | Kong 3.6 | API Gateway – JWT, Rate Limit, OPA | `dmz-net`, `app-net` |
| `keycloak` | Keycloak 24.0 | IdP – OIDC, realm management | `dmz-net`, `app-net` |
| `opa` | OPA 0.65.0 | Policy Engine – Rego authorization | `app-net` |
| `api-backend` | Python 3.12 / FastAPI | Business logic + security modules | `app-net`, `data-net` |
| `api-redis` | Redis 7 TLS | Cache nonce / DPoP / session | `app-net` |
| `api-postgres` | PostgreSQL 16 TLS | Datastore chính | `data-net` |
| `vault` | Nginx TLS Proxy | Vault TLS endpoint | `data-net` |
| `vault-dev` | HashiCorp Vault 1.15 | KMS – Transit Engine (KEK) | `vault-backend-net` |
| `vault-init` | HashiCorp Vault 1.15 | One-shot init: enable Transit, wrap DEK | `data-net` |
| `loki` *(obs)* | Grafana Loki 2.9 | Log aggregation | `obs-net` |
| `promtail` *(obs)* | Grafana Promtail 2.9 | Log shipping | `obs-net`, `app-net` |
| `grafana` *(obs)* | Grafana 10.0 | Dashboard logs + metrics | `obs-net` |
| `prometheus` *(obs)* | Prometheus 2.53 | Metrics scrape & storage | `obs-net` |
| `cadvisor` *(obs)* | cAdvisor 0.49 | Container metrics | `obs-net` |
| `pgadmin` *(tools)* | pgAdmin 4 | DB admin tool | `data-net` |
 
---
 
## 3. Cơ chế bảo mật
 
### 3.1 Xác thực (Authentication)
 
**OIDC Authorization Code + PKCE** — Frontend khởi tạo PKCE flow (SHA-256 challenge), sau khi nhận `code` từ Keycloak thì gọi backend `/api/v1/auth/callback` để đổi lấy token. Backend xác thực token bằng JWKS của Keycloak (cache có TTL, tự refresh nếu `kid` không khớp), verify đầy đủ: chữ ký ES256, `exp`, `iss`, `aud`.
 
**TOTP (Time-based OTP)** — Bắt buộc với role `admin` và `staff`. Mỗi request phải kèm header `X-TOTP-Code`. Backend sử dụng `pyotp` với window ±1 step để tolerate clock skew.
 
**JWT Hardening (Kong plugin Lua)** — Plugin `jwt-hardening` tại Kong layer thực hiện pre-validation trước khi request đến backend: reject `alg: none`, kiểm tra `kid` có trong JWKS whitelist (cache 60s), validate `iss`, `exp`, `nbf`, `azp/aud`. Mọi token không hợp lệ bị chặn tại gateway, không bao giờ đến backend.
 
### 3.2 Phân quyền (Authorization)
 
**OPA (Open Policy Agent)** — Kong gửi metadata request đến OPA (`https://opa:8181/v1/data/authz`) trước khi forward đến backend. Chính sách Rego trong `opa/policies/authz.rego` kiểm soát quyền truy cập theo role × method × path.
 
**RBAC tại Backend** — Module `backend/app/security/authorization.py` đọc `realm_access.roles` từ JWT payload đã verify và thực thi role-check ở từng endpoint bằng `require_roles()`.
 
**BOLA Guard** — `backend/app/security/bola_guard.py` chặn Broken Object Level Authorization: chỉ admin/staff mới đọc mọi đơn hàng, customer chỉ đọc đơn của chính mình (so sánh `order.owner_id` với JWT `sub`).
 
### 3.3 Bảo mật truyền tải (Transport Security)
 
- **TLS 1.3 only** trên toàn bộ Kong, Keycloak, Backend, PostgreSQL, Redis, Vault.
- **mTLS** giữa WAF và Kong: Kong yêu cầu `ssl_verify_client: on` với CA nội bộ — chỉ WAF có client cert hợp lệ mới được forward request vào.
- **HSTS** được inject bởi plugin Kong `hsts-header` trên mọi response.
- **TLS verify chuỗi** tại Kong khi upstream đến Backend: `tls_verify: true`, `ca_certificates` chỉ định CA nội bộ.
### 3.4 Mã hoá dữ liệu (Data Encryption at Rest)
 
**Envelope Encryption với Vault Transit KEK:**
 
```
Vault Transit (KEK) ──wrap──▶  VAULT_WRAPPED_DEK (env var)
                                       │
                              backend ─┘ unwrap tại runtime
                                       ▼
                               DEK (AES-256) in memory
                                       │
                         AES-256-GCM encrypt/decrypt
                                       ▼
                             field nhạy cảm trong DB
```
 
Module `backend/app/security/aead_encryption.py` thực hiện AES-256-GCM với nonce 12 byte ngẫu nhiên. Output: `12B nonce || ciphertext || 16B GCM tag`. DEK không bao giờ persist trên disk; tất cả unencrypted data nằm trong memory.
 
### 3.5 Bảo vệ tấn công (Attack Mitigation)
 
**SSRF Guard** — `backend/app/security/ssrf_guard.py` validate URL trước mọi outbound call: block scheme không phải http/https, hostname `localhost`, mọi IP private/loopback/link-local/multicast (bao gồm metadata endpoint `169.254.169.254`), resolve hostname và kiểm tra IP sau resolve.
 
**Rate Limiting** — Kong rate-limiting plugin: 100 request/phút/IP.
 
**CORS** — Chỉ cho phép origin `https://app.fmsec.shop`; cả Kong và Backend đều cấu hình CORS.
 
**Security Headers** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` được inject qua Kong `response-transformer`.
 
---
 
## 4. Rủi ro & Giải pháp
 
Phần này trình bày các rủi ro bảo mật cụ thể mà hệ thống đối mặt, phân tích tại sao chúng nguy hiểm trong bối cảnh API, và lý do chọn giải pháp đã triển khai thay vì các phương án thay thế.
 
---
 
### 4.1 Broken Authentication — Token giả mạo & thuật toán yếu
 
**Rủi ro:** JWT hỗ trợ nhiều thuật toán, trong đó `alg: none` cho phép token không cần chữ ký vẫn được chấp nhận bởi các thư viện cũ hoặc cấu hình sai. Ngoài ra, HS256 (symmetric) yêu cầu backend giữ cùng secret với IdP — nếu secret lộ, kẻ tấn công có thể tự ký token hợp lệ. Rủi ro leo thang khi API nhận token từ nhiều client khác nhau.
 
**Tại sao nguy hiểm:** Một token giả mạo thành công bypass toàn bộ lớp xác thực, cho phép attacker giả danh bất kỳ user hoặc admin nào mà không cần password.
 
**Giải pháp đã chọn:** Keycloak ký token bằng **ES256** (ECDSA — asymmetric). Backend và Kong chỉ cần giữ public key (JWKS), không bao giờ có signing key. Kong plugin `jwt-hardening` **từ chối cứng** mọi token có `alg: none` hoặc `alg` không phải ES256 ngay tại gateway — request không bao giờ đến backend. Backend (`jwt_verify.py`) verify lại độc lập bằng JWKS, pinning đúng `algorithms=["ES256"]` trong `jose.jwt.decode()`.
 
**Lý do không dùng HS256:** Với symmetric key, nếu backend bị compromise thì signing key cũng lộ — attacker có thể ký token bất kỳ. ES256 đảm bảo chỉ Keycloak có private key; ngay cả khi backend hoàn toàn bị chiếm, attacker vẫn không thể tạo token mới.
 
---
 
### 4.2 Broken Object Level Authorization (BOLA / IDOR)
 
**Rủi ro:** BOLA là lỗ hổng phổ biến nhất trong OWASP API Security Top 10. API nhận ID tài nguyên trực tiếp từ request (ví dụ `GET /api/v1/orders/42`) mà không kiểm tra liệu user hiện tại có quyền truy cập object đó hay không. Chỉ kiểm tra "đã đăng nhập" là không đủ — customer A có thể đọc đơn hàng của customer B bằng cách đoán ID.
 
**Tại sao nguy hiểm:** Trong hệ thống thương mại, đơn hàng chứa địa chỉ giao hàng, thông tin thanh toán, lịch sử mua hàng. BOLA cho phép liệt kê dữ liệu của toàn bộ user chỉ bằng cách increment ID.
 
**Giải pháp đã chọn:** Module `bola_guard.py` implement hàm `can_read_order(order_owner_id, token_payload)` so sánh trực tiếp `order.owner_id` với `sub` trong JWT payload. Logic tường minh: admin/staff được phép đọc tất cả; customer chỉ đọc đơn hàng mà `owner_id == token.sub`. Hàm này được gọi tại tầng service, trước khi serialize dữ liệu trả về.
 
**Lý do không dùng chỉ role-check:** Role-check (`require_roles`) chỉ trả lời "user có đúng vai trò không" — không trả lời "user có quyền trên object cụ thể này không". Cần kết hợp cả hai: role-check tại handler level + ownership-check tại service level.
 
---
 
### 4.3 Broken Function Level Authorization — Leo thang đặc quyền
 
**Rủi ro:** Kẻ tấn công tự sửa JWT payload (thêm role `admin` vào `realm_access.roles`) hoặc dùng token của staff để gọi endpoint chỉ dành cho admin. Nếu API chỉ kiểm tra xác thực mà không kiểm tra quyền theo từng endpoint, mọi user đã đăng nhập đều có thể gọi mọi chức năng.
 
**Tại sao nguy hiểm:** Trong môi trường thương mại, endpoint admin có thể xoá user, thay đổi giá sản phẩm, hoặc truy cập log hệ thống. Một staff leo thang lên admin nghĩa là breach toàn bộ hệ thống.
 
**Giải pháp đã chọn:** Hai tầng phân quyền hoạt động độc lập và bổ sung cho nhau. **Tầng 1 (OPA tại Kong):** Mọi request đến Kong đều bị intercept bởi plugin `opa-authz`, gửi `{role, method, path}` đến OPA. Chính sách Rego (`authz.rego`) kiểm tra tổ hợp ba chiều này — nếu OPA trả về `allow: false`, Kong block ngay, backend không nhận request. **Tầng 2 (Backend):** Hàm `require_roles(request, allowed_roles)` trong `authorization.py` đọc roles từ JWT payload *đã được verify chữ ký*, không từ request header. Attacker không thể tự thêm role vì ES256 chữ ký sẽ không còn hợp lệ.
 
**Lý do cần cả hai tầng:** OPA tại gateway giảm tải cho backend và block sớm; backend RBAC là lớp phòng thủ cuối cùng nếu Kong bị bypass hoặc misconfigure. Defense-in-depth không dựa vào điểm kiểm soát duy nhất.
 
---
 
### 4.4 Broken Authentication — Thiếu xác thực bước hai (MFA)
 
**Rủi ro:** Password đơn có thể bị brute-force, phishing, hoặc lộ qua data breach. Với tài khoản admin/staff có quyền cao, password-only authentication là điểm yếu nghiêm trọng — một lần mất mật khẩu là mất toàn bộ quyền kiểm soát hệ thống.
 
**Tại sao nguy hiểm:** Admin có thể xoá user, thay đổi cấu hình, truy cập log. Staff có thể sửa đơn hàng và giá sản phẩm. Không có MFA nghĩa là credential stuffing attack có thể thành công ngay lần đầu.
 
**Giải pháp đã chọn:** **TOTP** (RFC 6238) bắt buộc cho role `admin` và `staff`, implement tại backend (`totp_verify.py`). Mỗi request phải kèm header `X-TOTP-Code` chứa mã 6 chữ số hợp lệ trong window hiện tại. Backend dùng `pyotp.TOTP.verify(code, valid_window=1)` — cho phép lệch ±30 giây để tolerate clock skew, nhưng không cho phép reuse trong cùng window (replay protection cần kết hợp với Redis nonce nếu muốn strict).
 
**Lý do chọn TOTP thay vì SMS OTP:** TOTP không phụ thuộc vào carrier, không bị SIM-swapping, và hoàn toàn offline sau khi seed. SMS OTP có thể bị intercept qua SS7 vulnerability. TOTP secret được lưu mã hoá trong database, không phụ thuộc dịch vụ bên ngoài.
 
---
 
### 4.5 Server-Side Request Forgery (SSRF)
 
**Rủi ro:** API có endpoint nhận URL từ user (webhook, product image URL, preview...). Nếu không validate, attacker có thể truyền vào `http://169.254.169.254/latest/meta-data/` (AWS metadata), `http://redis:6379`, hoặc `http://postgres:5432` để thăm dò và tấn công hạ tầng nội bộ từ bên trong container network.
 
**Tại sao nguy hiểm:** Cloud metadata endpoint thường chứa IAM credentials. Trong môi trường Docker, các service nội bộ như Redis, Postgres, Vault không có authentication ngoài mạng container — SSRF có thể đọc dữ liệu trực tiếp, thậm chí ghi vào Redis để poisoning cache hoặc session.
 
**Giải pháp đã chọn:** `ssrf_guard.py` implement `validate_outbound_url(url)` với nhiều lớp kiểm tra tuần tự. Đầu tiên kiểm tra scheme (chỉ http/https), sau đó block hostname `localhost` và các biến thể. Tiếp theo parse IP trực tiếp nếu hostname là địa chỉ IP và kiểm tra các dải private/loopback/link-local/multicast/reserved. Quan trọng nhất: **resolve DNS rồi kiểm tra lại IP sau resolve** — phòng chống DNS rebinding attack (hostname public ban đầu resolve đến IP an toàn, sau đó rebind về IP nội bộ). Toàn bộ kiểm tra ném `SSRFBlocked` exception trước khi bất kỳ HTTP request nào được gửi đi.
 
**Lý do cần kiểm tra sau DNS resolve:** Attacker có thể tạo domain `evil.com` ban đầu trỏ đến IP public để vượt whitelist, sau đó đổi DNS về `127.0.0.1`. Validate sau resolve loại bỏ toàn bộ vector này.
 
---
 
### 4.6 Thiếu mã hoá dữ liệu nhạy cảm tại rest
 
**Rủi ro:** Dữ liệu nhạy cảm (địa chỉ, thông tin thanh toán, số điện thoại) lưu plaintext trong database. Nếu database bị breach (SQL injection, backup lộ, insider threat), toàn bộ dữ liệu người dùng lập tức bị lộ.
 
**Tại sao nguy hiểm:** Mã hoá ở tầng disk (filesystem encryption) không bảo vệ trong trường hợp attacker có SQL access — họ đọc được dữ liệu qua query dù disk được mã hoá. Cần mã hoá tại tầng ứng dụng, trước khi ghi vào DB.
 
**Giải pháp đã chọn:** **Envelope Encryption** kết hợp **AES-256-GCM** và **HashiCorp Vault Transit** (Key Encryption Key). DEK (Data Encryption Key) 256-bit được wrap bởi KEK trong Vault Transit và lưu dưới dạng `VAULT_WRAPPED_DEK` trong environment variable. Tại runtime, backend unwrap DEK từ Vault qua HTTPS, giữ trong memory. Field nhạy cảm được mã hoá bằng `AESGCM` với nonce 12 byte random — output `nonce || ciphertext || GCM tag` không bao giờ để nonce trùng. GCM tag đảm bảo **tính toàn vẹn**: nếu ciphertext bị tamper, `decrypt_field()` ném `InvalidTag` ngay lập tức.
 
**Lý do chọn AES-GCM thay vì AES-CBC:** GCM là AEAD (Authenticated Encryption with Associated Data) — kết hợp mã hoá và MAC trong một operation. CBC chỉ mã hoá, không authenticate — cần thêm HMAC riêng. GCM còn cho phép gắn `associated data` (metadata không mã hoá nhưng được authenticate) để chống context confusion attack. **Lý do cần Vault:** Nếu chỉ lưu DEK trong env var plaintext, backup env lộ thì toàn bộ data lộ. Vault cho phép rotation KEK mà không cần re-encrypt toàn bộ data ngay lập tức, và audit log mọi lần unwrap DEK.
 
---
 
### 4.7 Thiếu bảo mật truyền tải — Man-in-the-Middle nội bộ
 
**Rủi ro:** Trong môi trường Docker, các container giao tiếp qua Docker network — traffic giữa Kong và Backend, giữa Backend và PostgreSQL thường là plaintext HTTP/TCP. Nếu một container bị compromise (supply chain attack, container escape), attacker có thể sniff toàn bộ traffic nội bộ bao gồm JWT, query SQL, DEK unwrap request.
 
**Tại sao nguy hiểm:** Mô hình "trust nội bộ" (plaintext inside perimeter) không còn phù hợp với kiến trúc container — ranh giới "bên trong" và "bên ngoài" không rõ ràng. Container escape hoặc malicious image có thể eavesdrop mọi service ngang hàng.
 
**Giải pháp đã chọn:** TLS end-to-end cho toàn bộ service-to-service communication, kể cả trong cùng Docker network. Mỗi service có certificate riêng được ký bởi internal CA (`internal-certs/ca.crt`): PostgreSQL, Redis, Backend, OPA, Vault đều bật TLS server. Kong verify certificate chain của backend khi upstream (`tls_verify: true`, `ca_certificates` chỉ định CA nội bộ). **mTLS** giữa WAF và Kong: Kong bật `ssl_verify_client: on` — chỉ WAF có client certificate hợp lệ mới được kết nối, chặn mọi request bypass WAF gọi thẳng vào Kong.
 
**Lý do cần internal CA riêng:** Public CA (Let's Encrypt, ZeroSSL) không cấp cert cho hostname nội bộ (`api-backend`, `opa`, `redis`). Internal CA cho phép cấp cert với hostname Docker service name, verify chuỗi tin cậy hoàn chỉnh mà không phụ thuộc bên ngoài.
 
---
 
### 4.8 Thiếu giới hạn tốc độ — Brute Force & DDoS
 
**Rủi ro:** Không có rate limiting cho phép attacker brute-force mật khẩu, TOTP code, hoặc đơn giản là flood API với request để làm sập service (application-level DoS). Các endpoint auth đặc biệt nhạy cảm — 6 chữ số TOTP có thể bị brute-force trong vài giây nếu không có throttle.
 
**Giải pháp đã chọn:** Kong `rate-limiting` plugin enforce 100 request/phút/IP ở gateway — trước khi request đến bất kỳ service nào. Limit áp dụng toàn cục cho mọi route, không cần cấu hình riêng từng endpoint. Vị trí tại gateway đảm bảo rate limit được enforce ngay tại điểm vào, không bị bypass qua các path khác nhau đến cùng backend.
 
---
 
### 4.9 Thiếu kiểm soát nguồn gốc request — CORS & Header Injection
 
**Rủi ro:** Không giới hạn CORS cho phép trang web độc hại gọi API thay mặt user đã đăng nhập (CSRF qua CORS). Thiếu security header (`X-Frame-Options`, `X-Content-Type-Options`) cho phép clickjacking và MIME-sniffing attack.
 
**Giải pháp đã chọn:** CORS chỉ whitelist `https://app.fmsec.shop` — cả tại Kong (plugin `cors`) và Backend (FastAPI `CORSMiddleware`). Kong `response-transformer` inject `X-Content-Type-Options: nosniff` và `X-Frame-Options: DENY` trên mọi response; Kong `hsts-header` plugin inject `Strict-Transport-Security` buộc browser luôn dùng HTTPS. Cấu hình song song tại cả gateway và backend đảm bảo header không bị miss ngay cả khi một tầng fail.
 
---
 
### 4.10 Credential & Secret Exposure trong Source Code
 
**Rủi ro:** Developer vô tình commit secret (database password, Vault token, private key) vào Git repository. Một khi secret vào Git history, xoá file không đủ — secret vẫn tồn tại trong history và có thể bị extract.
 
**Giải pháp đã chọn:** Ba lớp phòng ngừa. **Trước khi commit:** `.gitignore` loại trừ `.env`, private key (`*.key`), certificate (`*.crt`) — các file này không bao giờ được track. **Trong CI:** `detect-secrets scan` chạy trên mọi push/PR, quét toàn bộ file còn lại tìm pattern credential (API key, password, private key...). **Tại runtime:** Secret được inject qua Docker secrets (`/run/secrets/`) thay vì environment variable plaintext — file trong `/run/secrets/` được mount với permission 0400, chỉ process owner đọc được, không xuất hiện trong `docker inspect`.
 
---
 
## 5. Cấu trúc thư mục
 
```
Cloud_Api_Security/
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── api/v1/             # Route handlers: auth, users, products, orders, security
│   │   ├── core/               # Config (pydantic-settings)
│   │   ├── db/                 # SQLAlchemy models, database init, seed data
│   │   ├── middleware/         # AuthMiddleware, LoggingMiddleware
│   │   ├── routers/            # Router registration
│   │   ├── security/           # Security modules:
│   │   │   ├── aead_encryption.py   # AES-256-GCM + Vault Transit
│   │   │   ├── authorization.py     # Role extraction & enforcement
│   │   │   ├── bola_guard.py        # Object-level access control
│   │   │   ├── jwt_verify.py        # JWKS fetch & JWT decode
│   │   │   ├── ssrf_guard.py        # Outbound URL validation
│   │   │   └── totp_verify.py       # TOTP check for admin/staff
│   │   └── services/           # Business logic: order, product, user
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── auth/               # PKCE flow, Keycloak integration, role access
│   │   ├── api/                # API client modules
│   │   ├── pages/              # Admin, staff, customer pages + attack simulation
│   │   ├── components/         # Shared UI components
│   │   └── hooks/              # useAuth, useApi, useOrders, useProducts
│   ├── Dockerfile
│   └── nginx.conf
├── gateway/                    # Kong API Gateway
│   ├── kong.yml                # Declarative config: services, routes, plugins
│   └── plugins/
│       ├── jwt-hardening/      # Lua plugin: alg:none block, kid whitelist, OIDC claims
│       ├── opa-authz/          # Lua plugin: OPA policy enforcement
│       └── hsts-header/        # Lua plugin: HSTS injection
├── idp/keycloak/
│   └── realm-export.json       # Realm config: clients, roles, PKCE, TOTP
├── opa/
│   ├── policies/               # authz.rego, admin.rego, rate_limit.rego
│   └── tests/                  # OPA unit tests
├── vault/
│   ├── init/                   # vault-init.sh, enable-transit.sh, wrap-dek.sh
│   └── policies/               # dek-policy.hcl
├── observability/
│   ├── grafana/                # Dashboards (logs + metrics) & provisioning
│   ├── loki/                   # Loki config + security alert rules
│   ├── prometheus/             # prometheus.yml
│   └── promtail/               # promtail-config.yml
├── scripts/
│   ├── attacks/                # Attack simulation scripts
│   │   ├── alg_none_attack.py
│   │   ├── bola_attack.py
│   │   ├── bola_e2e_attack.py
│   │   ├── ssrf_attack.py
│   │   └── role_escalation_test.py
│   ├── evaluation/             # Evaluation scripts (TLS, TOTP, AEAD, rotation)
│   ├── security_testing/       # DAST (ZAP), SAST (Bandit), Fuzz (RESTler)
│   └── gen_certs.py            # Certificate generation helper
├── tests/
│   ├── integration/            # API flow, auth flow, policy flow
│   └── security/               # Token & replay attack tests
├── certs/                      # Public TLS certs (ZeroSSL)
├── internal-certs/             # Internal CA + service certs (mTLS)
│   └── mtls/                   # Client cert cho WAF → Kong
├── waf/nginx.conf              # WAF Nginx config
├── .env.example                # Template biến môi trường
├── docker-compose.yml          # Orchestration: 7 tầng, 4 mạng, multi-profile
└── .github/workflows/
    ├── ci.yml                  # SAST (Bandit) + Secrets scan (detect-secrets)
    └── release.yml             # Release workflow
```
 
---
 
## 6. Yêu cầu hệ thống
 
| Phần mềm | Phiên bản tối thiểu |
|---|---|
| Docker Engine | 24.x trở lên |
| Docker Compose | v2.20 trở lên (plugin, không phải standalone) |
| RAM khuyến nghị | 4 GB (full stack) |
| Python | 3.11+ (chỉ cần cho scripts bên ngoài container) |
| Node.js | 20+ (chỉ cần nếu dev frontend local) |
 
> **Lưu ý:** Toàn bộ ứng dụng chạy trong container. Python và Node.js chỉ cần thiết nếu bạn muốn chạy scripts attack/evaluation ngoài Docker.
 
---
 
## 7. Cài đặt & Cấu hình
 
### Bước 1: Clone repo và chuẩn bị môi trường
 
```bash
git clone <repo-url>
cd Cloud_Api_Security
```
 
### Bước 2: Tạo file `.env`
 
```bash
cp .env.example .env
```
 
Chỉnh sửa các giá trị `CHANGE_ME_*` trong `.env`:
 
```dotenv
# PostgreSQL
POSTGRES_PASSWORD=<strong-password>
 
# Vault Token (dùng cho dev mode)
VAULT_TOKEN=<vault-token>
 
# Keycloak admin
KEYCLOAK_ADMIN_PASSWORD=<strong-password>
 
# Grafana (nếu dùng profile obs)
GRAFANA_PASSWORD=<strong-password>
```
 
Các biến `VAULT_WRAPPED_DEK` và `VAULT_KEY_NAME` sẽ được populate sau khi `vault-init` chạy lần đầu. Xem hướng dẫn tại [`vault/init/wrap-dek.sh`](vault/init/wrap-dek.sh).
 
### Bước 3: Cấu hình hostname (local development)
 
Thêm các dòng sau vào `/etc/hosts` (Linux/macOS) hoặc `C:\Windows\System32\drivers\etc\hosts` (Windows):
 
```
127.0.0.1  app.fmsec.shop
127.0.0.1  api.fmsec.shop
127.0.0.1  auth.fmsec.shop
```
 
### Bước 4: Cấp quyền cho scripts
 
```bash
chmod +x scripts/*.sh scripts/evaluation/*.sh vault/init/*.sh
```
 
---
 
## 8. Khởi chạy hệ thống
 
### Chạy toàn bộ stack cơ bản
 
```bash
docker compose up -d
```
 
### Kèm Observability (Loki, Grafana, Prometheus, cAdvisor)
 
```bash
docker compose --profile obs up -d
```
 
### Kèm Dev Tools (pgAdmin)
 
```bash
docker compose --profile tools up -d
```
 
### Chạy tất cả profiles
 
```bash
docker compose --profile tools --profile obs up -d
```
 
### Kiểm tra trạng thái
 
```bash
docker compose ps
docker compose logs -f api-backend
```
 
### Dừng hệ thống
 
```bash
docker compose down
 
# Xóa cả volumes (reset toàn bộ data)
docker compose down -v
```
 
---
 
## 9. Các điểm truy cập
 
| Dịch vụ | URL | Ghi chú |
|---|---|---|
| Frontend (SPA) | `https://app.fmsec.shop` | HTTPS, port 443 |
| Keycloak Admin | `https://auth.fmsec.shop:8082` | Admin console |
| Keycloak OIDC | `https://auth.fmsec.shop/realms/cloudapi` | OIDC endpoints |
| API (qua WAF → Kong) | `https://api.fmsec.shop:8443` | mTLS required |
| Grafana | `http://localhost:3000` | profile obs |
| Prometheus | `http://localhost:9091` | profile obs |
| pgAdmin | `http://localhost:5050` | profile tools |
 
> **Lưu ý bảo mật:** Kong Admin API (`KONG_ADMIN_LISTEN: "off"`) bị tắt hoàn toàn trong production config. Không có cổng admin Kong nào được expose.
 
---
 
## 10. Luồng xác thực (Auth Flow)
 
```
User
 │
 ▼ (1) Truy cập app.fmsec.shop
Frontend
 │
 ▼ (2) Redirect đến Keycloak với PKCE code_challenge (S256)
 │     Params: response_type=code, code_challenge, code_challenge_method=S256
Keycloak
 │
 ▼ (3) User đăng nhập (+ TOTP nếu là admin/staff)
 │
 ▼ (4) Keycloak redirect về /callback với authorization code
Frontend
 │
 ▼ (5) POST /api/v1/auth/callback { code, code_verifier, redirect_uri }
Backend
 │
 ▼ (6) Exchange code → access_token + refresh_token (verify PKCE)
 │
 ▼ (7) Return token, set HttpOnly cookie
 │
 ▼ (8) Mọi request tiếp theo: Authorization: Bearer <token> + X-TOTP-Code
 │
Kong (JWT Hardening plugin)
 │ ├── Reject alg:none
 │ ├── Verify kid trong JWKS whitelist
 │ └── Validate iss, exp, nbf, azp/aud
 │
OPA (opa-authz plugin)
 │ └── Check role × method × path
 │
Backend
 │ ├── jwt_verify.py: JWKS decode, ES256 verify
 │ ├── totp_verify.py: TOTP check nếu admin/staff
 │ ├── bola_guard.py: Object-level ownership check
 │ └── Business logic
```
 
---
 
## 11. Phân quyền & Vai trò
 
Hệ thống có 3 role chính, định nghĩa trong Keycloak realm và enforce song song tại OPA (gateway) và backend:
 
| Role | Quyền truy cập |
|---|---|
| `admin` | Toàn quyền: đọc/ghi users, products, orders; system settings; attack simulation |
| `staff` | GET tất cả `/api/v1/*`; POST/PUT products; POST/PUT orders |
| `customer` | GET products; GET/POST orders của chính mình |
 
**Nguyên tắc phân quyền:**
- OPA enforce tại gateway theo `role × method × path`.
- Backend RBAC enforce lại tại handler level (`require_roles()`).
- BOLA guard enforce tại service level theo `user_id == order.owner_id`.
---
 
## 12. Kiểm thử bảo mật
 
### Scripts tấn công mô phỏng (`scripts/attacks/`)
 
| Script | Mô phỏng tấn công | Kết quả mong đợi |
|---|---|---|
| `alg_none_attack.py` | JWT với `alg: none` | `401` — Kong jwt-hardening block |
| `bola_attack.py` | Truy cập đơn hàng của user khác | `403` — BOLA guard block |
| `bola_e2e_attack.py` | BOLA end-to-end với token thật | `403` |
| `ssrf_attack.py` | SSRF qua internal URL (169.254.x.x) | `400` — SSRF guard block |
| `role_escalation_test.py` | Claim role cao hơn trong token | `403` — OPA/backend block |
 
### SAST
 
```bash
# Chạy Bandit (Python static analysis)
bash scripts/security_testing/run_sast.sh
 
# Hoặc trực tiếp
bandit -r backend/ -f json -o EVIDENCE/security_scans/bandit_report.json
```
 
### DAST (ZAP)
 
```bash
bash tests/security_scans/dast/zap_scan.sh
```
 
### Fuzz Testing (RESTler)
 
Cấu hình tại `tests/security_scans/fuzz/restler_config.json`. Chạy:
 
```bash
bash scripts/security_testing/run_fuzz.sh
```
 
### OPA Policy Tests
 
```bash
docker exec opa opa test /tests/ -v
```
 
---
 
## 13. Observability & Giám sát
 
Kích hoạt với `--profile obs`. Sau khi stack obs chạy:
 
- **Grafana**: `http://localhost:3000` — 2 dashboard có sẵn:
  - `logs.json` — Log viewer từ Loki
  - `metrics.json` — Container metrics từ Prometheus + cAdvisor
- **Loki**: Thu thập log từ Promtail (Docker log driver + `EVIDENCE/logs/`).
- **Security Alerts**: `observability/loki/rules/security-alerts.yml` định nghĩa alert rules cho các event bảo mật (rate limit, auth failure, SSRF attempt...).
- **Prometheus**: Scrape metrics từ cAdvisor (container resource usage).
---
 
## 14. CI/CD Pipeline
 
`.github/workflows/ci.yml` kích hoạt trên mọi push/PR vào nhánh `main` hoặc `dev`:
 
1. **Bandit SAST** — Scan toàn bộ `backend/` source code, output JSON report.
2. **detect-secrets** — Quét credential/secret bị commit vào repo.
3. **Upload artifacts** — Bandit report được upload lên GitHub Actions artifacts.
`.github/workflows/release.yml` — Workflow release (tùy chỉnh theo nhu cầu triển khai).
 
---
 
## 15. Scripts tiện ích
 
| Script | Mô tả |
|---|---|
| `scripts/gen_certs.py` | Tạo internal CA và các certificate service |
| `scripts/generate_backend_internal_cert.sh` | Tạo riêng cert cho backend |
| `scripts/inject_kong_backend_ca.sh` | Inject CA vào Kong container |
| `scripts/reset_keycloak_demo_otp.sh` | Reset TOTP seed cho tài khoản demo |
| `vault/init/vault-init.sh` | Init Vault Transit engine |
| `vault/init/vault-rotate.sh` | Rotate KEK |
| `vault/init/wrap-dek.sh` | Wrap DEK, in ra `VAULT_WRAPPED_DEK` |
| `scripts/evaluation/e_c1_tls_capture.sh` | Kiểm tra TLS handshake |
| `scripts/evaluation/e_n1_totp_test.py` | Test TOTP enforce |
| `scripts/evaluation/e_c3_aead_integrity.py` | Kiểm tra AEAD encrypt/decrypt + tamper detection |
| `scripts/evaluation/e_x1_rotation_test.sh` | Test Vault key rotation |
| `scripts/evaluation/e_z1_policy_test.sh` | Test OPA policy |
| `scripts/evaluation/e_z2_token_hardening.sh` | Test JWT hardening |
 
---
 
## 16. Triển khai Production
 
Thư mục `DEPLOY/` chứa cấu hình cho 2 kịch bản deploy:
 
- **D1** — Single-host deployment.
- **D2** — Cấu hình nginx reverse proxy bổ sung + iptables firewall rules (`DEPLOY/D2/iptables.sh`, `DEPLOY/D2/nginx.conf`).
**Lưu ý quan trọng trước khi deploy production:**
 
1. **Vault dev mode** (`vault-dev`) không dùng cho production. Thay bằng Vault production cluster có storage backend bền vững.
2. Thay toàn bộ `CHANGE_ME_*` trong `.env` bằng secret manager (Vault, AWS Secrets Manager...).
3. Tái tạo internal CA và toàn bộ service certificates với domain thực.
4. Bật `ssl_verify_client: optional_no_ca` → `on` tại nginx nếu cần mTLS phía client bên ngoài.
5. Cấu hình Keycloak `start` (production mode) thay vì `start-dev`.
6. Giới hạn `KONG_ADMIN_LISTEN` và không expose port admin bất kỳ.
---
 
## Biến môi trường quan trọng
 
| Biến | Mô tả | Ví dụ |
|---|---|---|
| `POSTGRES_USER` | PostgreSQL username | `apiuser` |
| `POSTGRES_PASSWORD` | PostgreSQL password | *(strong password)* |
| `POSTGRES_DB` | Database name | `apidb` |
| `VAULT_TOKEN` | Vault root token (dev) | *(UUID)* |
| `VAULT_KEY_NAME` | Tên key trong Transit engine | `orders-dek` |
| `VAULT_WRAPPED_DEK` | DEK đã được KEK wrap | `vault:v1:...` |
| `KEYCLOAK_ADMIN` | Keycloak admin username | `admin` |
| `KEYCLOAK_ADMIN_PASSWORD` | Keycloak admin password | *(strong password)* |
| `KC_HOSTNAME` | Public hostname của Keycloak | `auth.fmsec.shop` |
| `VITE_KEYCLOAK_URL` | Keycloak URL cho frontend | `https://auth.fmsec.shop` |
| `VITE_KONG_URL` | Kong URL cho frontend | `https://api.fmsec.shop:8443` |
| `VITE_REALM` | Keycloak realm | `cloudapi` |
| `VITE_CLIENT_ID` | OIDC Client ID | `spa-client` |
| `JWT_ISSUER` | Expected JWT issuer | `https://auth.fmsec.shop/realms/cloudapi` |
| `JWT_AUDIENCE` | Expected JWT audience | `account` |
| `BACKEND_CORS_ORIGINS` | Allowed CORS origins | `https://app.fmsec.shop` |
| `GRAFANA_PASSWORD` | Grafana admin password | *(strong password)* |
 