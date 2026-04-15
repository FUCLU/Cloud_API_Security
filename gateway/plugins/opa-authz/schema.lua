return {
    name = "opa-authz",
    fields = {
        {
            config = {
                type = "record",
                fields = {
                    { opa_url = {type = "string", default = "http://opa:8181/v1/data/authz", required = true} },
                },
            },
        },
    },
}