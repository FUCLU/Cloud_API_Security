package authz.admin

import future.keywords.if
import future.keywords.in

# Chỉ admin mới được truy cập /admin/*
default admin_allowed := false

admin_allowed if {
    "admin" in input.user.roles
    startswith(input.path, "/api/v1/admin/")
}

deny_reason := "admin_only" if {
    startswith(input.path, "/api/v1/admin/")
    not "admin" in input.user.roles
}
