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
  input.path == "/health"
}

allow {
  input.path == "/"
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
  input.role == "customer"
  input.method == "GET"
  startswith(input.path, "/api/v1/orders")
}

allow {
  input.role == "customer"
  input.method == "POST"
  startswith(input.path, "/api/v1/orders")
}

allow {
  startswith(input.path, "/webhooks/")
  input.hmac_verified == true
}

reason = "access_granted" {
  allow
}

reason = "invalid_hmac" {
  not allow
  startswith(input.path, "/webhooks/")
  not input.hmac_verified
}

reason = "missing_role" {
  not allow
  not input.role
  not startswith(input.path, "/webhooks/")
}

reason = "forbidden_role" {
  not allow
  input.role
  not allowed_role
}

reason = "method_not_allowed" {
  allowed_role
  not allow
}
