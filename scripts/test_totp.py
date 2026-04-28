import pyotp

# Secret key lấy từ Keycloak (khi quét QR sẽ thấy)
secret = "YOUR_SECRET_BASE32_HERE"   # Thay bằng secret thật từ Keycloak

totp = pyotp.TOTP(secret)

print("Mã TOTP hiện tại:", totp.now())
print("Kiểm tra mã sai:", totp.verify("000000"))   # Phải là False
print("Kiểm tra mã đúng:", totp.verify(totp.now())) # Phải là True