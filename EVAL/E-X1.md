# E-X1 — Đánh giá Vault Key Rotation

## 1. Mục tiêu

Kiểm tra khả năng rotate KEK trong Vault Transit mà không phải commit khóa vào source code và không làm mất khả năng decrypt dữ liệu đã mã hoá trong phạm vi lab.

## 2. Thành phần liên quan

| Thành phần | Vai trò |
|---|---|
| `vault-dev` | Vault dev backend trong lab |
| `vault` | Nginx TLS proxy cho Vault |
| `vault/init/vault-init.sh` | Enable Transit và tạo key |
| `vault/init/wrap-dek.sh` | Wrap DEK, in ra `VAULT_WRAPPED_DEK` |
| `vault/init/vault-rotate.sh` | Rotate Vault Transit key |
| `backend/app/security/aead_encryption.py` | Unwrap DEK và AES-GCM encrypt/decrypt |

## 3. Lệnh kiểm thử

Khởi chạy stack:

```bash
docker compose up -d vault-dev vault vault-init
```

Rotate key:

```bash
docker compose exec vault-dev sh /vault/init/vault-rotate.sh
```

Hoặc thao tác trực tiếp:

```bash
docker compose exec vault-dev vault write -f transit/keys/${VAULT_KEY_NAME:-orders-dek}/rotate
```

Kiểm tra lại AEAD:

```bash
python scripts/evaluation/e_c3_aead_integrity.py
```

## 4. Evidence cần lưu

| Evidence | Nội dung |
|---|---|
| `EVIDENCE/vault/rotation.txt` | Output rotate key |
| `EVIDENCE/vault/aead-after-rotation.txt` | Output AEAD vẫn decrypt được |
| Ảnh terminal | Chụp lệnh rotate + kết quả kiểm thử |

## 5. Tiêu chí đạt

- Vault Transit key rotate thành công.
- Backend vẫn unwrap được `VAULT_WRAPPED_DEK`.
- AES-GCM test vẫn pass sau rotation.

## 6. Giới hạn

Vault hiện chạy dev mode trong lab. Kết quả này chứng minh workflow và integration, không thay thế yêu cầu production Vault cluster có storage backend bền vững.

