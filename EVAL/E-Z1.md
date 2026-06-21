# E-Z1 — Đánh giá OPA Policy Authorization

## 1. Mục tiêu

Kiểm tra tính đúng đắn của policy authorization tại gateway: OPA quyết định allow/deny theo tổ hợp role × method × path, deny-by-default cho request không khớp rule.

## 2. Thành phần liên quan

| Thành phần | Vai trò |
|---|---|
| `opa/policies/authz.rego` | Policy chính cho authorization |
| `opa/tests/` | Unit test Rego |
| `gateway/plugins/opa-authz/` | Kong plugin gọi OPA |
| `gateway/kong.yml` | Cấu hình OPA URL production |
| `gateway/kong.local.yml` | Cấu hình OPA URL local |

## 3. Lệnh kiểm thử

```bash
docker compose exec -T opa opa test /tests/ -v
```

Nếu muốn test cả policies và tests:

```bash
docker compose exec -T opa opa test /policies /tests -v
```

## 4. Các nhóm case cần có

| Nhóm | Kỳ vọng |
|---|---|
| Public path | `/`, `/health`, `/api/v1/auth/*` được allow |
| Admin | Được allow mọi API nghiệp vụ |
| Staff | GET `/api/v1/*`, POST/PUT products/orders |
| Customer | GET products, GET/POST orders |
| Role sai/thiếu | Deny |
| Method sai | Deny |
| Webhook HMAC | Allow nếu `hmac_verified == true`, deny nếu sai |

## 5. Evidence cần lưu

| Evidence | Nội dung |
|---|---|
| `EVIDENCE/policy/opa-test.txt` | Output `opa test` |
| `EVIDENCE/policy/opa-decision-log.txt` | Log OPA nếu bật decision logs |

## 6. Tiêu chí đạt

- Tất cả Rego tests pass.
- Policy deny-by-default.
- OPA trả reason rõ ràng như `access_granted`, `missing_role`, `forbidden_role`, `method_not_allowed`, `invalid_hmac`.

## 7. Kết luận

ĐẠT nếu OPA test pass và request thực tế qua Kong/OPA bị chặn đúng theo role/method/path.

