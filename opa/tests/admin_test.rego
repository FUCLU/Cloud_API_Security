package authz

# Kiểm tra quyền tối cao: Admin truy cập tài nguyên của bất kỳ ai
test_admin_super_access {
    allow with input as {"role": "admin", "subject": "super_boss", "resource_owner": "any_user"}
}

# Kiểm tra lỗ hổng: Hacker giả danh Admin nhưng cố tình để trống tên
test_admin_bypass_empty_headers {
    allow with input as {"role": "admin", "subject": "", "resource_owner": ""}
}

# Kiểm tra method lạ: Admin dùng method không tồn tại vẫn phải được cấp quyền
test_admin_invalid_method_still_allow {
    allow with input as {"role": "admin", "method": "UNKNOWN_METHOD"}
}

# Đảm bảo lý do cấp quyền phải chuẩn xác là dành cho admin
test_admin_exact_reason {
    reason == "access_granted" with input as {"role": "admin"}
}