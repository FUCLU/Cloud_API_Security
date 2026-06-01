# AIM — Project Objectives & Research Questions

**Đề tài:** Cloud API-Based Network Application Security for Small Company Services  
**Môn:** NT219.Q21.ANTT — Mật mã học | UIT

---

## 1. Bối cảnh & Động lực

Các công ty nhỏ (SME) ngày càng phụ thuộc vào API để vận hành dịch vụ — từ mobile app, SPA, đến tích hợp bên thứ ba. Tuy nhiên, phần lớn SME thiếu nhân lực bảo mật chuyên biệt và ngân sách hạn chế, dẫn đến các lỗ hổng phổ biến: token bị đánh cắp, BOLA (Broken Object Level Authorization), Broken Authentication, và thiếu rate limiting.

Theo OWASP API Security Top 10 (2023), BOLA và Broken Authentication chiếm tỷ lệ khai thác cao nhất trong các hệ thống API thực tế. Một incident đơn lẻ có thể gây tổn thất uy tín và tài chính nghiêm trọng cho tổ chức nhỏ không có năng lực phục hồi nhanh.

Đề tài này xuất phát từ câu hỏi thực tế: **liệu một SME có thể triển khai hệ thống API an toàn với stack mã nguồn mở, chi phí vận hành thấp, và khả năng tự động hóa cao không?**

---

## 2. Mục tiêu Tổng thể

Thiết kế, triển khai và đánh giá một **hệ thống API security hoàn chỉnh** phù hợp với quy mô công ty nhỏ, bao gồm:

- Bảo vệ mặt phẳng API (authentication, authorization, token lifecycle)
- Bảo vệ luồng mạng (TLS 1.3, mTLS east-west, network segmentation)
- Phát hiện và phản ứng tự động (structured logging, Grafana alerting, attack simulation)
- Vận hành tiết kiệm chi phí (toàn bộ stack mã nguồn mở, Docker Compose một lệnh)

---

## 3. Câu hỏi Nghiên cứu

**RQ1 — Kiến trúc:**  
Kiến trúc nào (API Gateway + IdP + OPA + KMS) cân bằng tốt nhất giữa bảo mật, vận hành và chi phí cho SME sử dụng công nghệ mã nguồn mở?

**RQ2 — Phòng chống tấn công:**  
Các vector tấn công API phổ biến nhất với SME (BOLA, JWT alg=none, DPoP replay, nonce reuse) có thể được phòng chống hoàn toàn bằng policy-as-code và token binding không?

**RQ3 — Mật mã học:**  
Giải pháp mật mã 3 lớp (TLS 1.3 + AES-256-GCM AEAD + Envelope Encryption KEK/DEK) có đảm bảo confidentiality và integrity toàn diện cho dữ liệu in-transit và at-rest không?

**RQ4 — Vận hành:**  
Hệ thống có thể đạt SLA key rotation ≤ 10 phút và blast-radius ≤ 24h trong điều kiện kiểm thử với HashiCorp Vault Transit Engine không?

---

## 4. Giả thuyết Nghiên cứu

> Một stack gồm **Kong API Gateway** (rate limit + WAF + JWT validation) + **Keycloak** (OIDC/PKCE) + **OPA** (deny-by-default RBAC→ABAC) + **HashiCorp Vault** (envelope encryption KEK/DEK) + **AES-256-GCM** (AEAD at-rest) sẽ:
>
> 1. Chặn **100%** các cuộc tấn công JWT alg=none, DPoP replay, và BOLA/IDOR trong điều kiện kiểm thử.
> 2. Đảm bảo **0 byte** plaintext rò rỉ trên kênh TLS 1.3.
> 3. Đạt SLA key rotation **≤ 10 phút** và phát hiện toàn bộ tamper qua AEAD auth tag.
> 4. Cho phép **100%** quyết định AuthZ được giải thích từ OPA decision log.

---

## 5. Phạm vi & Giới hạn

**Trong phạm vi:**
- Deployment D1: Docker Compose — môi trường kiểm thử một máy
- Deployment D2: Linux VM Ubuntu 22.04 + mTLS east-west
- Các attack vector: JWT alg=none, DPoP replay, BOLA/IDOR, nonce reuse
- Đánh giá theo 6 invariants (I1–I6) đo lường được

**Ngoài phạm vi:**
- Môi trường production multi-region
- ML-based anomaly detection
- Tích hợp SOAR/automated incident response
- WAF rule tuning dựa trên traffic thực

**Giới hạn đạo đức:**
- Pentest chỉ thực hiện trên hạ tầng kiểm thử tự kiểm soát
- Toàn bộ dữ liệu test là synthetic — không dùng dữ liệu người dùng thật
- Logs được sanitize trước khi đưa vào EVIDENCE/

---

## 6. Đóng góp Dự kiến

1. **Kiến trúc tham chiếu** cho SME: sơ đồ đầy đủ từ Client Layer → Security & Service Layer → Observability, tái sử dụng được.
2. **Giải pháp mật mã 3 lớp** có thể verify: mỗi lớp có invariant đo lường, script evaluation, và evidence (pcap, log, screenshot).
3. **Bộ attack simulation** reproducible: 4 kịch bản tấn công với expected output cụ thể.
4. **Tài liệu vận hành** hoàn chỉnh: RUNBOOK, key rotation procedure, incident response checklist.

---

## 7. Liên kết với Môn học

| Chủ đề NT219 | Áp dụng trong project |
|---|---|
| Mật mã đối xứng (AES) | AES-256-GCM AEAD at-rest, TLS 1.3 record encryption |
| Mật mã bất đối xứng (RSA/EC) | JWT RS256 signing (Keycloak), DPoP proof EC keypair, mTLS certificates |
| Hàm băm & MAC | AEAD auth tag (GCM), TOTP HMAC-SHA1, DPoP jti tracking |
| Quản lý khóa | HashiCorp Vault KEK/DEK, key rotation SLA, envelope encryption |
| Giao thức xác thực | OAuth 2.0 + PKCE (RFC 7636), OIDC, DPoP (RFC 9449) |
| Bảo mật mạng | TLS 1.3 (RFC 8446), mTLS east-west, network segmentation D2 |