import requests
import pyotp

# --- ĐIỀN LẠI THÔNG TIN CỦA BẠN VÀO ĐÂY ---
KEYCLOAK_TOKEN_URL = (
    "http://localhost:8081/realms/cloudapi/protocol/openid-connect/token"
)
CLIENT_ID = "backend-client"
CLIENT_SECRET = "backend-secret"  # Copy chính xác từ Keycloak > Clients > backend-client > Credentials
USERNAME = "admin"
PASSWORD = "admin"  # Mật khẩu đăng nhập của user admin
TOTP_SECRET = "IVZUUSCVK5WFK5ZUKVJU26SHHFCVGSKG"  # Mã secret lúc nãy bạn copy
# ------------------------------------------

totp = pyotp.TOTP(TOTP_SECRET)
current_code = totp.now()

print(f"[*] Đang thử gửi request với mã TOTP: {current_code}...")

payload = {
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "grant_type": "password",
    "username": USERNAME,
    "password": PASSWORD,
    "totp": current_code,
}

response = requests.post(KEYCLOAK_TOKEN_URL, data=payload)

print("=========================================")
print(f"Trạng thái (Status Code): {response.status_code}")
print(f"Nội dung lỗi chi tiết từ Keycloak: \n{response.text}")
print("=========================================")
