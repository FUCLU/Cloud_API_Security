return {
    name = "opa-authz",
    fields = {
        {
            config = {
                type = "record",
                fields = {
                    { opa_url = {type = "string", default = "https://opa:8181/v1/data/authz", required = true} },
                    { ssl_verify = {type = "boolean", default = true, required = true} },
                    { ssl_server_name = {type = "string", default = "opa", required = true} },
                    { ssl_verify_depth = {type = "integer", default = 2, required = true} },
                },
            },
        },
    },
}
