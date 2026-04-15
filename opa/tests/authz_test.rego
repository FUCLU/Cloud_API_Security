package authz

# ==========================================
# NHÓM 1: USER (10 Test Cases)
# ==========================================

# 1. Trùng khớp chủ sở hữu -> Cho phép
test_user_read_own_order {
    allow with input as {"role": "user", "subject": "kiet123", "resource_owner": "kiet123"}
}

# 2. Khác chủ sở hữu -> Chặn
test_user_read_other_order {
    not allow with input as {"role": "user", "subject": "hacker_001", "resource_owner": "victim_999"}
}

# 3. Kiểm tra lý do chặn (reason = not_owner)
test_user_reason_not_owner {
    reason == "not_owner" with input as {"role": "user", "subject": "hacker_001", "resource_owner": "victim_999"}
}

# 4. Ghi đè file của mình -> Cho phép
test_user_write_own {
    allow with input as {"role": "user", "subject": "alice", "method": "POST", "resource_owner": "alice"}
}

# 5. Ghi đè file người khác -> Chặn
test_user_write_other {
    not allow with input as {"role": "user", "subject": "alice", "method": "POST", "resource_owner": "bob"}
}

# 6. Xoá dữ liệu của mình -> Cho phép
test_user_delete_own {
    allow with input as {"role": "user", "subject": "bob", "method": "DELETE", "resource_owner": "bob"}
}

# 7. Xoá dữ liệu người khác -> Chặn
test_user_delete_other {
    not allow with input as {"role": "user", "subject": "bob", "method": "DELETE", "resource_owner": "alice"}
}

# 8. User nhưng không truyền subject -> Chặn (Sẽ rớt vào reason not_owner hoặc bị deny do null)
test_user_missing_subject {
    not allow with input as {"role": "user", "resource_owner": "victim"}
}

# 9. User nhưng không có resource owner -> Chặn
test_user_missing_owner {
    not allow with input as {"role": "user", "subject": "kiet"}
}

# 10. Phân biệt hoa thường (Case-sensitive) -> Chặn
test_user_case_sensitive_mismatch {
    not allow with input as {"role": "user", "subject": "Kiet123", "resource_owner": "kiet123"}
}

# ==========================================
# NHÓM 2: ADMIN (8 Test Cases)
# ==========================================

# 11. Admin xem bất kỳ ai -> Cho phép
test_admin_read_any {
    allow with input as {"role": "admin", "subject": "admin_01", "method": "GET", "resource_owner": "victim_999"}
}

# 12. Admin ghi đè bất kỳ ai -> Cho phép
test_admin_write_any {
    allow with input as {"role": "admin", "subject": "admin_01", "method": "POST", "resource_owner": "victim_999"}
}

# 13. Admin xoá dữ liệu bất kỳ ai -> Cho phép
test_admin_delete_any {
    allow with input as {"role": "admin", "subject": "admin_01", "method": "DELETE", "resource_owner": "victim_999"}
}

# 14. Kiểm tra lý do của admin (Đã fix thành access_granted)
test_admin_reason_is_access_granted {
    reason == "access_granted" with input as {"role": "admin"}
}

# 15. Admin nhưng quên truyền subject -> Vẫn cho phép
test_admin_missing_subject {
    allow with input as {"role": "admin", "resource_owner": "victim_999"}
}

# 16. Admin nhưng quên truyền resource_owner -> Vẫn cho phép
test_admin_missing_owner {
    allow with input as {"role": "admin", "subject": "admin_01"}
}

# 17. Admin truyền role in hoa "ADMIN" -> Chặn
test_admin_uppercase_role_deny {
    not allow with input as {"role": "ADMIN", "subject": "admin_01"}
}

# 18. Admin không cần truyền method -> Cho phép
test_admin_no_method_needed {
    allow with input as {"role": "admin"}
}

# ==========================================
# NHÓM 3: EDGE / ERROR CASES (7 Test Cases)
# ==========================================

# 19. Không có role -> Chặn
test_missing_role {
    not allow with input as {"subject": "kiet", "resource_owner": "kiet"}
}

# 20. Role rỗng ("") -> Chặn
test_empty_role {
    not allow with input as {"role": "", "subject": "kiet", "resource_owner": "kiet"}
}

# 21. Role không hợp lệ (hacker) -> Chặn
test_invalid_role_hacker {
    not allow with input as {"role": "hacker", "subject": "hacker", "resource_owner": "hacker"}
}

# 22. Role mặc định khi thiếu header (guest) -> Chặn
test_invalid_role_guest {
    not allow with input as {"role": "guest", "subject": "guest"}
}

# 23. Payload rỗng hoàn toàn -> Chặn
test_empty_input {
    not allow with input as {}
}

# 24. Truyền role dạng số nguyên thay vì chuỗi -> Chặn
test_role_as_integer {
    not allow with input as {"role": 123, "subject": "123", "resource_owner": "123"}
}

# 25. Cả subject và owner đều rỗng -> CHẶN KÍN CỬA (Lỗi bảo mật đã được vá)
test_empty_subject_and_owner {
    not allow with input as {"role": "user", "subject": "", "resource_owner": ""}
}