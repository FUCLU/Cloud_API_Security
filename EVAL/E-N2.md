# E-N2 — Đánh giá Session, Refresh Token và Replay Boundary

## 1. Mục tiêu

Đánh giá cách hệ thống xử lý session sau đăng nhập: access token/refresh token được lưu bằng HttpOnly cookie, backend `/session` tự refresh token khi access token hết hạn, Keycloak realm bật `revokeRefreshToken` và `refreshTokenMaxReuse=0` để giảm rủi ro replay refresh token.

## 2. Thành phần liên quan

| Thành phần | Vai trò |
|---|---|
| `backend/app/api/v1/auth.py` | Set/clear cookie, `/session`, refresh token flow |
| `idp/keycloak/realm-export.json` | `revokeRefreshToken`, `refreshTokenMaxReuse`, token lifespan |
| `frontend/src/auth/AuthProvider.jsx` | Gọi session, duy trì trạng thái đăng nhập |
| `backend/app/middleware/auth_middleware.py` | Đọc access token từ cookie hoặc Authorization header |

## 3. Lệnh/ thao tác kiểm thử

Sau khi đăng nhập trên browser, kiểm tra cookie:

```text
Application/Storage -> Cookies -> cloudapi_access, cloudapi_refresh, cloudapi_id
```

Kiểm tra session:

```bash
curl -k -i https://localhost:9444/api/v1/auth/session
```

Kiểm tra logout:

```bash
curl -k -i -X POST https://localhost:9444/api/v1/auth/logout
```

Kiểm tra cấu hình realm:

```bash
grep -n "revokeRefreshToken\\|refreshTokenMaxReuse\\|accessTokenLifespan\\|ssoSessionMaxLifespan" idp/keycloak/realm-export.json
```

## 4. Evidence cần lưu

| Evidence | Nội dung |
|---|---|
| `EVIDENCE/auth/session-refresh.txt` | Output `/session` trước/sau access token hết hạn |
| `EVIDENCE/auth/logout.txt` | Output logout và cookie bị clear |
| `EVIDENCE/auth/keycloak-token-settings.txt` | Cấu hình token lifespan/reuse trong realm |

## 5. Tiêu chí đạt

- Cookie được set với `HttpOnly`, `Secure`, `SameSite=Lax`.
- `/session` trả authenticated user khi cookie hợp lệ.
- Logout xoá cookie.
- Realm có refresh token rotation/reuse setting phù hợp với lab.

## 6. Giới hạn

File này không đánh giá DPoP vì runtime hiện tại của project không triển khai DPoP verifier. Replay boundary tập trung vào cookie/session và refresh token lifecycle qua Keycloak.
