import pyotp

TOTP_REQUIRED_ROLES = {"admin", "staff"}

def requires_totp(role: str) -> bool:
    return role in TOTP_REQUIRED_ROLES

def verify_totp_code(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)

def check_totp_required(payload: dict, totp_code: str | None, user_secret: str | None) -> None:
    roles = payload.get("realm_access", {}).get("roles", [])
    role  = next((r for r in roles if r in TOTP_REQUIRED_ROLES), None)

    if role is None:
        return  # Customer → bỏ qua, không cần TOTP

    # Admin hoặc Staff
    if not totp_code:
        raise ValueError("Thiếu mã TOTP (header X-TOTP-Code)")
    
    if not user_secret:
        raise ValueError("User chưa setup TOTP")
    
    if not verify_totp_code(user_secret, totp_code):
        raise ValueError("Mã TOTP không hợp lệ hoặc đã hết hạn")