# E-N1 — Đánh giá OIDC/PKCE và TOTP Setup

## 1. Mục tiêu

Ghi nhận luồng xác thực chính của hệ thống: Frontend khởi tạo OIDC Authorization Code + PKCE, backend callback đổi code lấy token, token được lưu trong HttpOnly cookie, tài khoản admin/staff demo được Keycloak yêu cầu cấu hình TOTP.

## 2. Thành phần liên quan

| Thành phần | Vai trò |
|---|---|
| `frontend/src/auth/` | Keycloak client, PKCE, auth provider |
| `backend/app/api/v1/auth.py` | `/callback`, `/session`, `/logout`, `/totp/*` |
| `backend/app/security/jwt_verify.py` | Verify access token bằng JWKS |
| `idp/keycloak/realm-export.json` | Realm `cloudapi`, client `spa-client`, user demo, TOTP required action |

## 3. Lệnh/ thao tác kiểm thử

Kiểm tra OIDC discovery:

```bash
curl -k https://localhost:8082/realms/cloudapi/.well-known/openid-configuration | python -m json.tool
```

Production:

```bash
curl https://auth.fmsec.shop/realms/cloudapi/.well-known/openid-configuration | python3 -m json.tool
```

Kiểm tra session API sau khi đăng nhập từ browser:

```bash
curl -k -i https://localhost:9444/api/v1/auth/session
```

Nếu gọi trực tiếp qua API edge, dùng:

```bash
curl -k -i https://localhost:9443/api/v1/auth/session
```

Tài khoản demo:

| Username | Password | Role | TOTP |
|---|---|---|---|
| `phuc@company.com` | `demo1234` | `admin` | Required action |
| `hung@company.com` | `demo1234` | `admin` | Required action |
| `kiet@company.com` | `demo1234` | `staff` | Required action |
| `an@gmail.com` | `demo1234` | `customer` | Không bắt buộc |
| `bich@gmail.com` | `demo1234` | `customer` | Không bắt buộc |

## 4. Evidence cần lưu

| Evidence | Nội dung |
|---|---|
| `EVIDENCE/auth/oidc-discovery.json` | Output discovery endpoint |
| `EVIDENCE/auth/login-totp.png` | Ảnh màn hình yêu cầu TOTP hoặc QR setup |
| `EVIDENCE/auth/session-cookie.png` | Ảnh DevTools cho thấy cookie HttpOnly/Secure/SameSite |

## 5. Tiêu chí đạt

- Discovery endpoint trả issuer đúng môi trường.
- Login bằng user demo thành công.
- Admin/staff được yêu cầu cấu hình TOTP lần đầu.
- Backend callback set HttpOnly cookies (`cloudapi_access`, `cloudapi_refresh`, `cloudapi_id` nếu có).

## 6. Lưu ý

Project hiện có module `check_totp_required()`; nếu yêu cầu đánh giá “mỗi request admin/staff bắt buộc TOTP” thì cần kiểm tra endpoint/middleware đã gọi hàm này chưa.
