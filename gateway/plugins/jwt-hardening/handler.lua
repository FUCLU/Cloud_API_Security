local http = require "resty.http"
local cjson = require "cjson.safe"

local JWT_HARDENING = {
  PRIORITY = 1200,
  VERSION = "1.0.0",
}

local JWKS_URL_PRIMARY = "http://keycloak:8080/realms/cloudapi/protocol/openid-connect/certs"
local JWKS_URL_FALLBACK = "http://keycloak:8082/realms/cloudapi/protocol/openid-connect/certs"

local jwks_cache = {
  expires_at = 0,
  kids = {},
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

local function parse_jwt_header(token)
  local header_b64 = token:match("^([^.]+)%.[^.]+%.[^.]+$")
  if not header_b64 then
    return nil, "invalid_jwt_format"
  end

  local header_json = b64url_decode(header_b64)
  if not header_json then
    return nil, "invalid_jwt_header_base64"
  end

  local header = cjson.decode(header_json)
  if not header then
    return nil, "invalid_jwt_header_json"
  end

  return header, nil
end

local function fetch_jwks_kids(url)
  local httpc = http.new()
  httpc:set_timeout(3000)

  local res, err = httpc:request_uri(url, {
    method = "GET",
    headers = { ["Accept"] = "application/json" },
  })

  if not res then
    return nil, err
  end

  if res.status ~= 200 then
    return nil, "jwks_status_" .. tostring(res.status)
  end

  local body = cjson.decode(res.body)
  if not body or type(body.keys) ~= "table" then
    return nil, "jwks_invalid_payload"
  end

  local kids = {}
  for _, k in ipairs(body.keys) do
    if k and k.kid then
      kids[k.kid] = true
    end
  end

  return kids, nil
end

local function get_kid_set()
  local now = ngx.now()
  if jwks_cache.expires_at > now and next(jwks_cache.kids) ~= nil then
    return jwks_cache.kids, nil
  end

  local kids, err = fetch_jwks_kids(JWKS_URL_PRIMARY)
  if not kids then
    kids, err = fetch_jwks_kids(JWKS_URL_FALLBACK)
  end
  if not kids then
    return nil, err
  end

  jwks_cache.kids = kids
  jwks_cache.expires_at = now + 60
  return kids, nil
end

function JWT_HARDENING:access(conf)
  local auth = kong.request.get_header("authorization")
  if not auth then
    return
  end

  local token = auth:match("^[Bb]earer%s+(.+)$")
  if not token then
    return
  end

  local header, parse_err = parse_jwt_header(token)
  if not header then
    kong.log.err("jwt_header_parse_failed: ", parse_err)
    return kong.response.exit(401, { message = "Invalid token header" })
  end

  local alg = (header.alg or ""):lower()
  if alg == "none" then
    kong.log.err("alg_none_rejected")
    return kong.response.exit(401, { message = "Token algorithm not allowed" })
  end

  local kid = header.kid
  if not kid then
    kong.log.err("missing_kid")
    return kong.response.exit(401, { message = "Missing token kid" })
  end

  local kids, jwks_err = get_kid_set()
  if not kids then
    kong.log.err("jwks_fetch_failed: ", jwks_err)
    return kong.response.exit(503, { message = "JWKS unavailable" })
  end

  if not kids[kid] then
    kong.log.err("kid_not_whitelisted")
    return kong.response.exit(401, { message = "Unknown token kid" })
  end
end

return JWT_HARDENING
