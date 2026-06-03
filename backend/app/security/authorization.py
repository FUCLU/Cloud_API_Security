from fastapi import HTTPException, Request, status


def current_payload(request: Request) -> dict:
    payload = getattr(request.state, "user", None)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return payload


def current_roles(request: Request) -> set[str]:
    payload = current_payload(request)
    realm_access = payload.get("realm_access", {})
    roles = realm_access.get("roles", [])
    return set(roles if isinstance(roles, list) else [])


def require_roles(request: Request, allowed_roles: set[str]) -> dict:
    payload = current_payload(request)
    roles = current_roles(request)
    if roles.isdisjoint(allowed_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient role",
        )
    return payload
