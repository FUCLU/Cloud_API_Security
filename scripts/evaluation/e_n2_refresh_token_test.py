import requests
import pyotp
import time

# ================= CẤU HÌNH =================
KEYCLOAK_TOKEN_URL = (
    "http://localhost:8081/realms/cloudapi/protocol/openid-connect/token"
)
CLIENT_ID = "backend-client"
CLIENT_SECRET = "backend-secret"  # Điền secret của client
USERNAME = "admin"
PASSWORD = "admin"  # Điền mật khẩu user
TOTP_SECRET = "IVZUUSCVK5WFK5ZUKVJU26SHHFCVGSKG"  # Điền TOTP Secret từ Task 3
# ============================================

print("BẮT ĐẦU KỊCH BẢN TASK 4: REFRESH TOKEN ROTATION")
print("===================================================\n")

# ---------------------------------------------------------
# Bước 4.1: Đăng nhập lấy Refresh Token ban đầu
# ---------------------------------------------------------
print("[4.1] Đang lấy Refresh Token ban đầu...")
totp = pyotp.TOTP(TOTP_SECRET)
current_code = totp.now()

login_payload = {
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "grant_type": "password",
    "username": USERNAME,
    "password": PASSWORD,
    "totp": current_code,
}

response = requests.post(KEYCLOAK_TOKEN_URL, data=login_payload)
if response.status_code != 200:
    print(f"❌ Lỗi đăng nhập bước 1: {response.text}")
    exit()

tokens = response.json()
first_refresh_token = tokens.get("refresh_token")
print("✅ Lấy thành công Token ban đầu!")
print(f"   -> Refresh Token gốc: {first_refresh_token[:30]}...[ẩn]\n")

# Đợi 2 giây để giả lập thời gian trễ
time.sleep(2)

# ---------------------------------------------------------
# Bước 4.2: Dùng Refresh Token LẦN 1 -> Nhận Token mới
# ---------------------------------------------------------
print("[4.2] Dùng Refresh Token lần 1 (Đóng vai User hợp lệ đang gia hạn session)...")
refresh_payload_1 = {
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "grant_type": "refresh_token",
    "refresh_token": first_refresh_token,
}

res_2 = requests.post(KEYCLOAK_TOKEN_URL, data=refresh_payload_1)
if res_2.status_code == 200:
    new_tokens = res_2.json()
    second_refresh_token = new_tokens.get("refresh_token")
    print("✅ Đổi Token thành công! (Trạng thái: 200)")
    print(f"   -> Đã được cấp Refresh Token MỚI: {second_refresh_token[:30]}...[ẩn]\n")
else:
    print(f"❌ Lỗi ở bước 4.2: {res_2.text}")
    exit()

# Đợi 2 giây để giả lập Hacker lấy được Token cũ
time.sleep(2)

# ---------------------------------------------------------
# Bước 4.3: Dùng LẠI Refresh Token CŨ LẦN 2 -> Phải bị chặn 400
# ---------------------------------------------------------
print("[4.3] Dùng LẠI Refresh Token cũ lần 2 (Đóng vai Hacker nhặt được token cũ)...")
refresh_payload_2 = {
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "grant_type": "refresh_token",
    "refresh_token": first_refresh_token,  # Cố tình gửi lại cái cũ
}

res_3 = requests.post(KEYCLOAK_TOKEN_URL, data=refresh_payload_2)
print(f"-> Trạng thái trả về: {res_3.status_code}")
if res_3.status_code == 400:
    print(f"✅ HỆ THỐNG ĐÃ CHẶN THÀNH CÔNG! Lỗi từ Keycloak: {res_3.text}")
else:
    print(
        "❌ Lỗi cấu hình: Keycloak vẫn cho phép dùng lại Token. Vui lòng kiểm tra lại 'Revoke Refresh Token' trong tab Advanced của Client!"
    )

print("\n===================================================")
print("HOÀN TẤT ĐÁNH GIÁ TASK 4")
