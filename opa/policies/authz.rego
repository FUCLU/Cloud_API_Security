package authz

default allow = false
default reason = "no_matching_rule"

allowed_role {
  input.role == "admin"
}

allowed_role {
  input.role == "staff"
}

allowed_role {
  input.role == "customer"
}

allow {
  input.role == "admin"
}

allow {
  input.role == "staff"
  input.method == "GET"
  startswith(input.path, "/api/v1/")
}

allow {
  input.role == "staff"
  startswith(input.path, "/api/v1/products")
  input.method == "POST"
}

allow {
  input.role == "staff"
  startswith(input.path, "/api/v1/products")
  input.method == "PUT"
}

allow {
  input.role == "staff"
  startswith(input.path, "/api/v1/orders")
  input.method == "POST"
}

allow {
  input.role == "staff"
  startswith(input.path, "/api/v1/orders")
  input.method == "PUT"
}

allow {
  input.role == "customer"
  input.method == "GET"
  startswith(input.path, "/api/v1/products")
}

allow {
  startswith(input.path, "/webhooks/")
  input.hmac_verified == true
}

reason = "access_granted" {
  allow
}

reason = "invalid_hmac" {
  startswith(input.path, "/webhooks/")
  not input.hmac_verified
}

reason = "missing_role" {
  not input.role
  not startswith(input.path, "/webhooks/")
}

reason = "forbidden_role" {
  input.role
  not allowed_role
}

reason = "method_not_allowed" {
  allowed_role
  not allow
}
