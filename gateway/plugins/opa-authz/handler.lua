local http = require "resty.http"
local cjson = require "cjson.safe"

local OPAAuthz = {
    PRIORITY = 900,
    VERSION = "1.1.0",
}

local function b64url_decode(input)
    if not input then
        return nil
    end
    local s = input:gsub("-", "+"):gsub("_", "/")
    local pad = #s % 4
    if pad == 2 then
        s = s .. "=="
    elseif pad == 3 then
        s = s .. "="
    elseif pad == 1 then
        return nil
    end
    return ngx.decode_base64(s)
end

local function extract_claims_from_bearer()
    local auth = kong.request.get_header("authorization")
    if not auth then
        return {}
    end

    local token = auth:match("^[Bb]earer%s+(.+)$")
    if not token then
        return {}
    end

    local payload_b64 = token:match("^[^.]+%.([^.]+)%.[^.]+$")
    if not payload_b64 then
        return {}
    end

    local payload_json = b64url_decode(payload_b64)
    if not payload_json then
        return {}
    end

    local payload = cjson.decode(payload_json)
    if type(payload) ~= "table" then
        return {}
    end

    return payload
end

local function role_from_payload(payload)
    local realm_access = payload.realm_access
    if type(realm_access) == "table" and type(realm_access.roles) == "table" then
        -- Prefer business roles over Keycloak default roles (e.g. default-roles-*, offline_access).
        local preferred = {
            admin = true,
            staff = true,
            customer = true,
            user = true, -- backward compatibility if older tokens still use "user"
        }
        for _, role in ipairs(realm_access.roles) do
            if preferred[role] then
                return role
            end
        end
        if realm_access.roles[1] then
            return realm_access.roles[1]
        end
    end

    if payload.role then
        return payload.role
    end

    return "guest"
end

function OPAAuthz:access(config)
    local payload = extract_claims_from_bearer()

    local input_payload = {
        input = {
            method = kong.request.get_method(),
            path = kong.request.get_path(),
            subject = payload.sub or "",
            role = role_from_payload(payload),
        },
    }

    local httpc = http.new()
    httpc:set_timeout(3000)

    local res, err = httpc:request_uri(config.opa_url, {
        method = "POST",
        body = cjson.encode(input_payload),
        headers = { ["Content-Type"] = "application/json" },
    })

    if not res then
        kong.log.err("opa_request_failed: ", err)
        return kong.response.exit(500, { message = "Cannot evaluate authorization" })
    end

    if res.status ~= 200 then
        kong.log.err("opa_non_200_status: ", res.status)
        return kong.response.exit(500, { message = "OPA returned error" })
    end

    local body = cjson.decode(res.body)
    if not body or not body.result then
        kong.log.err("opa_invalid_response")
        return kong.response.exit(500, { message = "Invalid OPA response" })
    end

    if body.result.allow == true then
        return
    end

    local deny_reason = body.result.reason or "no_reason_provided"
    kong.log.warn("opa_deny: ", deny_reason)
    return kong.response.exit(403, {
        error = "Access Denied",
        reason = deny_reason,
    })
end

return OPAAuthz
