# AIM — Mục tiêu & Câu hỏi nghiên cứu

**Đề tài:** Cloud API-Based Network Application Security for Small Company Services  
**Môn:** NT219.Q21.ANTT — Mật mã học | UIT

---

## 1. Bối cảnh & Động lực

Các công ty nhỏ ngày càng phụ thuộc vào API để vận hành dịch vụ: frontend SPA, hệ thống quản trị, tích hợp đăng nhập bên thứ ba, webhook và các luồng dữ liệu giữa backend với database/cache/KMS. Tuy nhiên, mô hình triển khai phổ biến của SME thường có ba vấn đề:

- API public nhưng thiếu lớp gateway/policy rõ ràng.
- Dữ liệu và token đi qua nhiều service container nhưng vẫn tin vào "mạng nội bộ".
- Secret, certificate và khóa mã hoá thường được quản lý thủ công, dễ lộ hoặc khó rotate.

Đề tài này xây dựng một hệ thống mô phỏng thương mại điện tử nhỏ (`users`, `products`, `orders`) để trả lời câu hỏi thực tế: **một SME có thể triển khai Cloud API an toàn bằng stack mã nguồn mở, Docker Compose và quy trình vận hành có thể kiểm chứng được hay không?**

---

## 2. Mục tiêu tổng thể

Thiết kế, triển khai và đánh giá một hệ thống **Cloud API Security** theo hướng Zero Trust, tập trung vào các mục tiêu:

- **Xác thực an toàn:** OIDC Authorization Code + PKCE qua Keycloak, token ES256, HttpOnly cookie/session.
- **Phân quyền nhiều lớp:** OPA tại Kong gateway, RBAC tại backend, BOLA guard theo ownership.
- **Bảo vệ đường truyền:** TLS/mTLS cho các kết nối quan trọng, WAF -> Kong dùng client certificate.
- **Mã hoá dữ liệu nhạy cảm:** AES-256-GCM tại application layer, DEK được unwrap từ Vault Transit.
- **Chống tấn công API phổ biến:** JWT `alg=none`, BOLA/IDOR, SSRF, webhook giả mạo, brute force/flood cơ bản.
- **Vận hành và đánh giá:** có script kiểm thử, log, dashboard, bằng chứng deploy server và runbook cấu hình.

---

## 3. Câu hỏi nghiên cứu

**RQ1 — Kiến trúc:**  
Kiến trúc gồm Frontend Nginx, WAF Nginx, Kong API Gateway, Keycloak, OPA, FastAPI, PostgreSQL, Redis và Vault có đủ rõ ràng để áp dụng cho một SME mà vẫn giữ chi phí vận hành thấp không?

**RQ2 — Xác thực & phân quyền:**  
OIDC/PKCE, JWT ES256, OPA policy và backend RBAC/BOLA có thể giảm các rủi ro Broken Authentication, Broken Function Level Authorization và BOLA/IDOR đến mức kiểm thử được không?

**RQ3 — Mật mã học:**  
Kết hợp TLS/mTLS, AES-256-GCM và Vault Transit có bảo vệ được dữ liệu in-transit và field nhạy cảm at-rest trong phạm vi hệ thống demo không?

**RQ4 — Vận hành:**  
Các thao tác như deploy server Ubuntu, sinh certificate, rotate Vault key, chạy DAST/SAST và thu thập evidence có đủ đơn giản để tái lập trong môi trường lab không?

---

## 4. Giả thuyết nghiên cứu

Project kiểm chứng các giả thuyết sau trong phạm vi lab:

1. Kong + backend JWT verification có thể chặn token giả mạo như `alg=none` và token sai issuer/audience.
2. OPA policy tại gateway kết hợp backend RBAC/BOLA có thể chặn truy cập sai role và truy cập đơn hàng không thuộc owner.
3. SSRF guard có thể chặn URL trỏ đến localhost, private IP, link-local và metadata endpoint sau khi resolve DNS.
4. AES-256-GCM phát hiện ciphertext bị chỉnh sửa thông qua GCM authentication tag.
5. WAF + mTLS giữa WAF và Kong giúp giảm khả năng bypass gateway và chặn request độc hại cơ bản ở edge.
6. Vault Transit hỗ trợ mô hình KEK/DEK và rotation trong môi trường lab, nhưng Vault dev mode không đại diện cho production thật.

---

## 5. Phạm vi & Giới hạn

**Trong phạm vi:**

- Docker Compose single-host cho local và server Ubuntu.
- OIDC/PKCE qua Keycloak realm `cloudapi`.
- Kong declarative config, custom plugins `jwt-hardening`, `opa-authz`, `hsts-header`.
- OPA Rego policy cho role × method × path.
- TLS/mTLS, internal CA, public cert cho domain production.
- AES-256-GCM + Vault Transit cho field nhạy cảm trong dữ liệu seed/demo.
- Attack simulation: JWT `alg=none`, BOLA, SSRF, role escalation.
- Observability bằng Grafana, Loki, Prometheus, Promtail.

**Ngoài phạm vi:**

- Production multi-region, autoscaling, Kubernetes hoặc service mesh.
- Vault production cluster có storage backend bền vững.
- WAF rule tuning bằng traffic thật.
- SIEM/SOAR hoặc incident response tự động.
- Chống DDoS layer 3/4 quy mô lớn.

**Giới hạn hiện tại cần ghi rõ:**

- TOTP setup/verify đã có, nhưng muốn enforce mọi request admin/staff thì cần bảo đảm endpoint hoặc middleware gọi `check_totp_required()`.
- Rate limit hiện là limit toàn cục theo IP tại Kong; chưa phải lockout riêng theo user/session.
- `.github/workflows` chưa được commit, nên CI/CD hiện là pipeline đề xuất.
- Một số certificate demo có thể tồn tại trong repo để phục vụ lab; production thật phải sinh lại và thay secret.

---

## 6. Đóng góp chính

1. **Kiến trúc tham chiếu Cloud API Security cho SME:** đầy đủ edge, gateway, IdP, policy engine, backend, database, cache, KMS và observability.
2. **Bộ cơ chế bảo mật có thể kiểm chứng:** JWT hardening, OPA authz, BOLA guard, SSRF guard, WAF filtering, webhook HMAC, TLS/mTLS, AES-GCM.
3. **Bộ tài liệu vận hành:** README hướng dẫn local/server, copy code lên Ubuntu, tạo `.env`, certificate, Vault DEK, health check và evidence.

---

## 7. Liên kết với môn Mật mã học

| Chủ đề NT219 | Áp dụng trong project |
|---|---|
| Mật mã đối xứng | AES-256-GCM cho field nhạy cảm; TLS record encryption |
| Mật mã bất đối xứng | ES256 JWT signing, certificate TLS/mTLS, internal CA |
| Hàm băm & MAC | HMAC trong TOTP, HMAC-SHA256 cho webhook signature, GCM auth tag |
| Quản lý khóa | Vault Transit KEK/DEK, wrapped DEK, key rotation |
| Giao thức xác thực | OAuth 2.0 Authorization Code, PKCE, OpenID Connect |
| Bảo mật mạng | TLS, mTLS, gateway/WAF, network segmentation bằng Docker networks |

