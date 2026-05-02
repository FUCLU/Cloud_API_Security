package authz

# ==========================================
# NHÓM 4: ADVANCED POLICIES (7 Test Cases)
# ==========================================

# 34. Admin truy cập /admin/dashboard -> Cho phép
test_admin_path_with_admin_role {
    allow with input as {"role": "admin", "path": "/admin/dashboard"}
}

# 35. User truy cập /admin/dashboard -> Chặn
test_admin_path_with_user_role {
    not allow with input as {"role": "user", "path": "/admin/dashboard", "subject": "kiet123"}
}

# 36. Kiểm tra lý do khi User truy cập /admin/* (reason = admin_path_restricted)
test_reason_admin_path_restricted {
    reason == "admin_path_restricted" with input as {"role": "user", "path": "/admin/settings"}
}

# 37. Webhook có chữ ký HMAC hợp lệ -> Cho phép
test_webhook_with_valid_hmac {
    allow with input as {"path": "/webhooks/github", "hmac_verified": true}
}

# 38. Webhook có chữ ký HMAC sai (false) -> Chặn
test_webhook_with_invalid_hmac {
    not allow with input as {"path": "/webhooks/github", "hmac_verified": false}
}

# 39. Webhook không có trường hmac_verified -> Chặn
test_webhook_missing_hmac {
    not allow with input as {"path": "/webhooks/github"}
}

# 40. Kiểm tra lý do khi Webhook sai HMAC (reason = invalid_hmac)
test_reason_webhook_invalid_hmac {
    reason == "invalid_hmac" with input as {"path": "/webhooks/github", "hmac_verified": false}
}