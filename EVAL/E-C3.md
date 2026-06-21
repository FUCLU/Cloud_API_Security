# E-C3 — Đánh giá AEAD Integrity với AES-256-GCM

## 1. Mục tiêu

Chứng minh field nhạy cảm được mã hoá bằng AES-256-GCM có tính bảo mật và toàn vẹn: nếu ciphertext bị sửa, quá trình decrypt phải thất bại nhờ GCM authentication tag.

## 2. Thành phần liên quan

| Thành phần | Vai trò |
|---|---|
| `backend/app/security/aead_encryption.py` | `encrypt_field()`, `decrypt_field()`, unwrap DEK từ Vault Transit |
| `vault/init/wrap-dek.sh` | Sinh `VAULT_WRAPPED_DEK` |
| `scripts/evaluation/e_c3_aead_integrity.py` | Script kiểm thử encrypt/decrypt và tamper detection |
| `backend/app/db/seed_data.py` | Dữ liệu seed/demo có email/phone mã hoá |

## 3. Lệnh kiểm thử

```bash
python scripts/evaluation/e_c3_aead_integrity.py
```

Nếu script cần gọi Vault đang chạy trong Docker, chạy từ host và trỏ biến môi trường về endpoint Vault phù hợp. Ví dụ khi dùng production compose, Vault TLS proxy nằm trong Docker network nên có thể cần chạy script trong cùng môi trường mạng hoặc điều chỉnh `VAULT_ADDR`.

## 4. Evidence cần lưu

| Evidence | Nội dung |
|---|---|
| `EVIDENCE/crypto/e_c3_aead_integrity.txt` | Output script: encrypt OK, decrypt OK, tamper reject |
| Ảnh terminal | Chụp kết quả script nếu nộp báo cáo dạng ảnh |

## 5. Tiêu chí đạt

- Plaintext sau decrypt đúng với input ban đầu.
- Ciphertext bị sửa một byte phải làm `decrypt_field()` lỗi.
- Không lưu DEK plaintext ra disk.
- `VAULT_WRAPPED_DEK` được lấy từ Vault Transit thay vì hard-code DEK trong source.

## 6. Kết luận

ĐẠT nếu AES-GCM reject ciphertext bị tamper và project không cần lưu DEK plaintext trong repo.
