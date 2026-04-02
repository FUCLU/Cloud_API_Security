package authz.rate_limit

import future.keywords.if

# Deny nếu vượt quá 100 request trong 1 phút
default rate_exceeded := false

rate_exceeded if {
    input.request_count > 100
    input.window == "1m"
}

deny_reason := "rate_limit_exceeded" if {
    rate_exceeded
}
