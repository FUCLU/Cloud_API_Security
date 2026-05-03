import os
import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

# --- Cấu hình ---
LOG_FILE = "EVIDENCE/logs/e_c3_aead.log"
KONG_URL = (
    "http://localhost:8000/api/protected-route"  # Sửa lại theo route Kong của bạn
)
# Bạn có thể lấy 1 JWT thật từ Keycloak dán vào đây để test chính xác nhất
DUMMY_JWT = "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"

# Đảm bảo thư mục tồn tại
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)


def write_log(msg):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(msg + "\n")


write_log("=== BẮT ĐẦU ĐÁNH GIÁ E-C3: AEAD & JWT INTEGRITY ===")

# [2.1] Test AEAD Integrity (Flip Tag)
write_log("\n[1] Kiểm thử mã hóa AEAD AES-GCM (Flip-tag):")
key = AESGCM.generate_key(bit_length=256)
aead = AESGCM(key)
nonce = os.urandom(12)
plaintext = b"Sensitive Data"
ciphertext = aead.encrypt(nonce, plaintext, None)

# Hacker thay đổi 1 byte cuối (tag)
tampered_ciphertext = ciphertext[:-1] + bytes([ciphertext[-1] ^ 0x01])

write_log("-> Đang thử giải mã Ciphertext đã bị chỉnh sửa 1 byte cuối...")
try:
    aead.decrypt(nonce, tampered_ciphertext, None)
    write_log("❌ FAIL: Giải mã thành công dữ liệu giả mạo!")
except InvalidTag:
    write_log(
        "✅ PASS: InvalidTag raised as expected. Hệ thống từ chối dữ liệu bị can thiệp."
    )

# [2.2] Test JWT Signature Tampering
write_log("\n[2] Kiểm thử tính toàn vẹn JWT Signature qua Kong:")
jwt_parts = DUMMY_JWT.split(".")
if len(jwt_parts) == 3:
    # Đổi 2 ký tự ở phần signature
    tampered_jwt = f"{jwt_parts[0]}.{jwt_parts[1]}.{jwt_parts[2][:-2]}xx"

    headers = {"Authorization": f"Bearer {tampered_jwt}"}
    write_log("-> Gửi request với JWT đã bị sửa phần Signature đến Kong Gateway...")
    try:
        res = requests.get(KONG_URL, headers=headers)
        write_log(f"-> Status Code trả về: {res.status_code}")
        if res.status_code == 401:
            write_log("✅ PASS: Kong trả về 401 Unauthorized. Chữ ký giả mạo bị chặn!")
        else:
            write_log("❌ FAIL: Kong cho phép request lọt qua!")
    except requests.exceptions.RequestException as e:
        write_log(f"⚠️ Lỗi kết nối Kong: {e}")

write_log("===================================================")
