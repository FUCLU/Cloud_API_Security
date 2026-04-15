  package authz

  # Mặc định các quyền truy cập bị từ chối nếu k có rule nào khớp thì auto false
  default allow = false
  default reason := "no_matching_rule"

  # Admin có toàn quyền
  allow {
    input.role == "admin"
  }

  # Admin path được phép nếu role là admin
  allow {
    input.role == "admin"
    startswith(input.path, "/admin/")
  }

  # Webhook hợp lệ nếu có HMAC verified
  allow {
    startswith(input.path, "/webhooks/")
    input.hmac_verified == true
  }

  # User được dùng giới hạn 
  allow {
    input.role == "user"
    input.subject != ""
    input.resource_owner != ""
    input.subject == input.resource_owner
  }
  reason := "access_granted" {
    input.role == "admin"
  }

  reason := "access_granted" {
    input.role == "user"
    input.subject != ""
    input.resource_owner != ""
    input.subject == input.resource_owner
  }

  reason := "admin_path_restricted" {
    input.role == "user"
    startswith(input.path, "/admin/")
  }

  reason := "invalid_hmac" {
    startswith(input.path, "/webhooks/")
    not input.hmac_verified
  }

  # 
  reason := "not_owner" {
    input.role == "user"
    input.subject != input.resource_owner
  }

  # Không truyền role vào header
  reason := "missing_role" {
    not input.role
    not startswith(input.path, "/webhooks/")
  }

  reason := "forbidden_role" {
    input.role != "admin"
    input.role != "user"
    input.role
  }