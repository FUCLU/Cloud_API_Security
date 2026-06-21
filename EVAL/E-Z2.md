# E-Z2 — Đánh giá JWT Hardening và Token Verification

## 1. Mục tiêu

Kiểm tra các lớp bảo vệ token: Keycloak ký token ES256, Kong plugin `jwt-hardening` chặn token yếu ở gateway, backend `jwt_verify.py` verify lại bằng JWKS, issuer và audience.

## 2. Thành phần liên quan

| Thành phần | Vai trò |
|---|---|
| `idp/keycloak/realm-export.json` | ES256 token signing, realm `cloudapi` |
| `gateway/plugins/jwt-hardening/` | Chặn token yếu ở Kong |
| `backend/app/security/jwt_verify.py` | Verify token cuối cùng ở backend |
| `scripts/attacks/alg_none_attack.py` | Mô phỏng token `alg=none` |
| `scripts/attacks/role_escalation_test.py` | Mô phỏng tự thêm role |
| `scripts/evaluation/e_z2_token_hardening.sh` | Script gom kiểm thử token hardening |

## 3. Lệnh kiểm thử

```bash
bash scripts/evaluation/e_z2_token_hardening.sh
```

Chạy từng script:

```bash
python scripts/attacks/alg_none_attack.py
python scripts/attacks/role_escalation_test.py
```

Kiểm tra backend verify:

```bash
grep -n "algorithms=\\[\"ES256\"\\]\\|issuer=settings.jwt_issuer\\|audience=settings.jwt_audience" backend/app/security/jwt_verify.py
```

Kiểm tra realm signing:

```bash
grep -n "defaultSignatureAlgorithm\\|ES256\\|ecdsaCurve" idp/keycloak/realm-export.json
```

## 4. Evidence cần lưu

| Evidence | Nội dung |
|---|---|
| `EVIDENCE/attack_results/token-hardening/alg-none.txt` | Kết quả token `alg=none` bị chặn |
| `EVIDENCE/attack_results/token-hardening/role-escalation.txt` | Kết quả token sửa role bị chặn |
| `EVIDENCE/attack_results/token-hardening/jwt-verify-config.txt` | Grep cấu hình ES256/issuer/audience |

## 5. Tiêu chí đạt

- Token `alg=none` bị reject.
- Token bị sửa payload/role không vượt qua verify chữ ký.
- Backend verify ES256, issuer, audience.
- Nếu `kid` không tìm thấy, backend refresh JWKS cache và vẫn reject nếu không có public key hợp lệ.

## 6. Kết luận

ĐẠT nếu attack script không truy cập được endpoint bảo vệ và backend/gateway cấu hình đúng với Keycloak ES256.

