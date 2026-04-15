local http = require "resty.http"
local cjson = require "cjson.safe"

local OPAAuthz = {
    PRIORITY = 900,
    VERSION = "1.0",
}

function OPAAuthz:access(config)
    local input_payload = {
        input = {
            role = kong.request.get_header("X-User-Role") or "guest",
            subject = kong.request.get_header("X-User-Subject") or "",
            resource_owner = kong.request.get_header("X-Resource-Owner") or "",
            method = kong.request.get_method()
        }
    }

    local httpc = http.new()
    httpc:set_timeout(3000)

    local res, err = httpc:request_uri(config.opa_url, {
        method = "POST",
        body = cjson.encode(input_payload),
        headers = { ["Content-Type"] = "application/json" }
    })

    if not res then
        kong.log.err("Lỗi - Không thể kết nối tới OPA", err)
        return kong.response.exit(500, { message = "Không thể đánh giá quyền truy cập" })
    end

    local body = cjson.decode(res.body)

    if not body or not body.result then
        kong.log.err("Lỗi parse JSON hoặc OPA trả về sai format")
        return kong.response.exit(500, { message = "Dữ liệu Authz không hợp lệ" })
    end

    if body.result.allow == true then
        return
    else
        local deny_reason = body.result.reason or "no_reason_provided"
        kong.log.warn("OPA Blocked Request", deny_reason)

        return kong.response.exit(403, {
            error = "Access Denied",
            reason = deny_reason
        })
    end
end

return OPAAuthz