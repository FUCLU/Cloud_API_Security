package authz.rate_limit

import future.keywords.if

# Dưới hạn mức (99 req) -> Cho qua
test_request_under_limit if {
    not deny with input as {"request_count": 99, "window": "1m"}
}

# Vừa chạm trần (100 req) -> Vẫn cho qua
test_request_at_limit if {
    not deny with input as {"request_count": 100, "window": "1m"}
}

# Vượt hạn mức (101 req) -> Chặn ngay lập tức
test_request_over_limit if {
    deny with input as {"request_count": 101, "window": "1m"}
}

# Kiểm tra lý do khi bị chặn có đúng là "rate_exceeded" không
test_reason_when_over_limit if {
    reason == "rate_exceeded" with input as {"request_count": 500, "window": "1m"}
}