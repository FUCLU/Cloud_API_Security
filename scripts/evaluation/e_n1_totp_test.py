import requests
import time
import random

KEYCLOAK_URL = "http://localhost:8080/realms/cloud-api-realm/protocol/openid-connect/token"

USERNAME = "testuser"
PASSWORD = "testpassword"
CLIENT_ID = "frontend-client"

def test_totp_bruteforce():
    print("Start")
    blocked = False
    
    for i in range (1, 101):
        fake_otp = str(random.randint(100000, 999999))
        payload = {
            "client_id": CLIENT_ID,
            "grant_type": "password",
            "username": USERNAME,
            "password": PASSWORD,
            "totp": fake_otp
        }

        try:
            response = requests.post(KEYCLOAK_URL, data=payload)
            status = response.status_code

            print(f"Lần {i} - Thử : {fake_otp} - HTTP Status: {status}")

            if status == 429 or "account is temporarily disabled" in response.text.lower():
                print("Pass successlly sau {i} lấn thử sai")
                blocked = True
                break

        except Exception as e:
            print("Internet error: {e}")

        time.sleep(0.1)

    if not blocked:
        print("Fail")

if __name__ == "__main__":
    test_totp_bruteforce()