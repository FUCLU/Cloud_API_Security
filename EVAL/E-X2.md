# E-X2 — Đánh giá Quản lý Secret, Certificate và Key Material

## 1. Mục tiêu

Mô tả cách project quản lý secret/certificate/key material trong lab và production, đồng thời chỉ rõ các giới hạn cần xử lý khi triển khai thật.

## 2. Thành phần liên quan

| Thành phần | Vai trò |
|---|---|
| `.gitignore` | Loại trừ `.env`, private key, `certs-local/` |
| `docker-compose.yml` | Mount Docker secrets vào `/run/secrets/` |
| `scripts/gen_certs.py` | Sinh internal CA và cert service |
| `scripts/gen_local_certs.py` | Sinh cert local và CA bundle |
| `certs/` | Public cert production |
| `internal-certs/` | Internal CA/cert cho TLS/mTLS |
| `.env`, `.env.local` | Biến môi trường runtime, không commit secret thật |

## 3. Lệnh kiểm tra

```bash
grep -n ".env\\|certs-local\\|*.key\\|internal-certs" .gitignore
```

```bash
docker compose config | grep -n "/run/secrets" -n
```

```bash
ls -la certs internal-certs internal-certs/mtls
```

```bash
git status --short
```

## 4. Evidence cần lưu

| Evidence | Nội dung |
|---|---|
| `EVIDENCE/secrets/gitignore.txt` | Các rule loại trừ secret/key |
| `EVIDENCE/secrets/docker-secrets.txt` | Docker compose secret mount |
| `EVIDENCE/secrets/cert-tree.txt` | Cây thư mục cert không lộ private key ngoài ý muốn |

## 5. Tiêu chí đạt

- `.env` không được commit.
- `certs-local/` không được commit.
- Private key sinh runtime không bị track ngoài các file demo/lab có chủ đích.
- Production phải thay toàn bộ password/token/cert demo.
- Certificate/key runtime được mount qua Docker secrets khi container chạy.

## 6. Kết luận

Project có mô hình quản lý secret phù hợp lab và demo. Khi deploy production thật, cần dùng secret manager hoặc quy trình cấp phát secret riêng, không dùng giá trị demo trong README.

