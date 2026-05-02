package authz.rate_limit

import future.keywords.if

# Deny nếu vượt quá 100 request trong 1 phút
default rate_exceeded := false
default deny := false
default reason := "under_limit"

rate_exceeded if {
    input.request_count > 100
    input.window == "1m"
}

deny if {
    rate_exceeded
}

reason := "rate_exceeded" if {
    rate_exceeded
}

