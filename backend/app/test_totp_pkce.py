"""
test_totp_pkce.py — Test TOTP (task 1.3) và PKCE flow (task 2.x)

Chạy trên máy host (không cần vào container):
    pip install pyotp httpx
    python test_totp_pkce.py

Hoặc trong container:
    docker compose exec backend python /app/test_totp_pkce.py
"""

import base64
import hashlib
import os
import secrets
import urllib.parse

import pyotp

# ─────────────────────────────────────────────
# TASK 1.3 — TOTP test với pyotp
# ─────────────────────────────────────────────


def test_totp():
    print("=" * 60)
    print("TASK 1.3 — TOTP Test (pyotp)")
    print("=" * 60)

    # Trong thực tế, secret lấy từ QR code Keycloak hiển thị khi setup TOTP
    # Ở đây dùng secret giả để demo logic verify
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)

    current_code = totp.now()
    print(f"\n  secret       : {secret}")
    print(f"  totp.now()   : {current_code}   ← code đúng tại thời điểm này")
    print(
        f"  totp.verify('{current_code}') : {totp.verify(current_code)}   ← phải là True"
    )
    print(
        f"  totp.verify('000000') : {totp.verify('000000')}  ← phải là False (Invariant I7)"
    )

    assert totp.verify(current_code), "❌ FAIL: code đúng bị reject"
    assert not totp.verify(
        "000000"
    ), "❌ FAIL: code sai '000000' được accept — vi phạm I7!"
    assert not totp.verify(
        "123456"
    ), "❌ FAIL: code sai '123456' được accept — vi phạm I7!"

    print("\n  ✅ TOTP test passed — false-accept = 0 (Invariant I7 OK)")

    print(
        """
  ─── Verify thủ công với Keycloak ───
  1. Login http://localhost:8081/admin → realm 'lab' → Users → phuc
  2. Tab 'Credentials' → xem TOTP secret (hoặc scan QR khi login lần đầu)
  3. Dùng secret thật đó thay vào biến 'secret' ở trên
  4. Gọi login với sai TOTP → Keycloak trả 401:

  curl -s -X POST http://localhost:8081/realms/lab/protocol/openid-connect/token \\
    -d "client_id=spa-client&grant_type=password" \\
    -d "username=phuc&password=demo1234&totp=000000"
  # → {"error":"invalid_grant","error_description":"Invalid user credentials"}
"""
    )


# ─────────────────────────────────────────────
# TASK 2.1-2.2 — Tạo PKCE code_verifier + code_challenge
# ─────────────────────────────────────────────


def generate_pkce() -> tuple[str, str]:
    """
    Tạo code_verifier (random 43-128 ký tự) và
    code_challenge = BASE64URL(SHA256(code_verifier))
    """
    # code_verifier: 96 random bytes → base64url → 128 ký tự, chỉ [A-Za-z0-9-._~]
    code_verifier = (
        base64.urlsafe_b64encode(secrets.token_bytes(72)).rstrip(b"=").decode()
    )
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return code_verifier, code_challenge


def test_pkce_params():
    print("=" * 60)
    print("TASK 2.1-2.2 — PKCE code_verifier + code_challenge")
    print("=" * 60)

    code_verifier, code_challenge = generate_pkce()

    assert (
        43 <= len(code_verifier) <= 128
    ), f"❌ code_verifier length = {len(code_verifier)}"

    # Verify: SHA256(verifier) == challenge
    digest_check = (
        base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode()).digest())
        .rstrip(b"=")
        .decode()
    )
    assert (
        digest_check == code_challenge
    ), "❌ code_challenge không khớp SHA256(verifier)"

    print(f"\n  code_verifier  ({len(code_verifier)} chars): {code_verifier[:40]}...")
    print(f"  code_challenge ({len(code_challenge)} chars): {code_challenge[:40]}...")
    print(f"  SHA256 verify  : ✅ BASE64URL(SHA256(verifier)) == challenge")

    # Build authorization URL (task 2.2)
    KEYCLOAK_URL = "http://localhost:8081"
    REALM = "lab"
    CLIENT_ID = "spa-client"
    REDIRECT_URI = "http://localhost:5173/callback"
    STATE = secrets.token_urlsafe(16)

    auth_url = (
        f"{KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/auth"
        f"?response_type=code"
        f"&client_id={CLIENT_ID}"
        f"&redirect_uri={urllib.parse.quote(REDIRECT_URI)}"
        f"&code_challenge={code_challenge}"
        f"&code_challenge_method=S256"
        f"&state={STATE}"
        f"&scope=openid+profile+roles+email"
    )

    print(f"\n  ─── Authorization URL (task 2.2) ───")
    print(f"  {auth_url}\n")
    print(f"  → Mở URL trên trong trình duyệt, đăng nhập với phuc/demo1234")
    print(
        f"  → Keycloak redirect về: http://localhost:5173/callback?code=<auth_code>&state={STATE}"
    )

    print(
        f"""
  ─── Đổi code lấy token (task 2.4) ───
  Sau khi có <auth_code> từ bước trên, chạy:

  curl -s -X POST http://localhost:8081/realms/lab/protocol/openid-connect/token \\
    -H "Content-Type: application/x-www-form-urlencoded" \\
    -d "grant_type=authorization_code" \\
    -d "client_id=spa-client" \\
    -d "code=<auth_code>" \\
    -d "code_verifier={code_verifier}" \\
    -d "redirect_uri=http://localhost:5173/callback" \\
    | python -m json.tool

  ─── Verify JWT claims (task 2.5) ───
  TOKEN=$(curl -s ... | python -m json.tool | grep access_token | ...)
  # Decode payload (base64, không verify sig):
  echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | python -m json.tool
  # Kiểm tra claims: sub, preferred_username, roles, exp

  ─── rotating refresh token (task 2.6) ───
  realm-export.json đã có: "revokeRefreshToken": true
  → Mỗi lần dùng refresh_token sẽ được rotate (token cũ bị revoke)
  → Dùng lại refresh_token cũ → Keycloak trả 400 invalid_grant
"""
    )

    print("  ✅ PKCE params generated and verified")
    return code_verifier, code_challenge


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

if __name__ == "__main__":
    test_totp()
    print()
    test_pkce_params()
    print("\n🎉 All automated checks passed!")
    print("   Các bước còn lại cần browser/curl thủ công — xem hướng dẫn ở trên.\n")
