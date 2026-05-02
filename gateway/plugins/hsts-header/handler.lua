local HSTSHandler = {
  PRIORITY = 900,
  VERSION = "1.0.0",
}

function HSTSHandler:header_filter(conf)
  kong.response.set_header(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  )
end

return HSTSHandler
