def roles_from_payload(payload: dict) -> list[str]:
    return payload.get("realm_access", {}).get("roles", []) if payload else []


def can_read_order(order_owner_id, token_payload: dict) -> bool:
    roles = roles_from_payload(token_payload)
    if "admin" in roles or "staff" in roles:
        return True

    token_sub = token_payload.get("sub") if token_payload else None
    if order_owner_id is None or token_sub is None:
        return False
    return str(order_owner_id) == str(token_sub)
