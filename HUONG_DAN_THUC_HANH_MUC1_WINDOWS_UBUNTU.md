# Hướng dẫn thực hành mức 1: Windows -> Ubuntu VM -> chạy server -> test web và giao thức

File này là runbook tuyến tính. Nếu bạn đang demo lần đầu, chỉ cần làm theo file này từ trên xuống dưới.

Mục tiêu mức 1:

```text
Chưa dùng domain.
Chưa dùng ZeroSSL.
Dùng IP private của Ubuntu VM.
Dùng internal CA/self-signed CA do mình tự tạo.
Chạy toàn bộ server bằng Docker Compose trên Ubuntu.
Máy Windows mở web và test các giao thức.
```

Ví dụ trong hướng dẫn:

```text
Ubuntu user: cloudapi
Ubuntu IP: 192.168.1.27
Project trên Windows: D:\UIT\NAM2\HK2\MATMAHOC\PROJECT\Cloud_Api_Security
Project trên Ubuntu: /home/cloudapi/Cloud_Api_Security
```

Nếu IP Ubuntu của bạn khác `192.168.1.27`, thay IP đó vào tất cả lệnh và file cấu hình.

## 0. Quy ước nơi chạy lệnh

Đọc kỹ bảng này trước khi làm:

| Nhãn | Chạy ở đâu | Dấu hiệu thường thấy |
|---|---|---|
| `[Windows PowerShell]` | PowerShell trên máy Windows | `PS D:\...>` |
| `[Windows editor]` | VS Code/Notepad trên Windows | mở file trong project |
| `[Ubuntu SSH]` | Terminal SSH vào Ubuntu VM | `cloudapi@cloudapi-server:~$` |
| `[Browser Windows]` | Chrome/Edge/Firefox trên Windows | thanh địa chỉ browser |

Không nhầm lẫn:

```text
cd ~/Cloud_Api_Security     -> chỉ chạy trên Ubuntu
D:\UIT\...                  -> đường dẫn Windows
docker compose ...          -> chạy trên Ubuntu trong thư mục project
scp ...                     -> thường chạy từ Windows để copy file qua Ubuntu
```

## 1. Kiểm tra Ubuntu VM đã sẵn sàng

Chạy trên Ubuntu.

`[Ubuntu SSH]`

```bash
hostname -I
docker version
docker compose version
sudo ufw status numbered
```

Ghi lại IP hiện tại. Ví dụ:

```text
192.168.1.27
```

Nếu thiếu firewall rule, chạy:

`[Ubuntu SSH]`

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8443/tcp
sudo ufw enable
sudo ufw status numbered
```

Từ Windows kiểm tra SSH vào Ubuntu:

`[Windows PowerShell]`

```powershell
ssh cloudapi@192.168.1.27
```

Nếu SSH vào được, tiếp tục.

## 2. Sửa cấu hình project trên Windows theo IP Ubuntu

Làm trên Windows trước khi copy project lên Ubuntu.

### 2.1. Sửa file `.env`

Mở file:

`[Windows editor]`

```text
D:\UIT\NAM2\HK2\MATMAHOC\PROJECT\Cloud_Api_Security\.env
```

Đảm bảo các dòng public URL đúng IP Ubuntu:

```env
VITE_KEYCLOAK_URL=https://192.168.1.27
VITE_KONG_URL=https://192.168.1.27:8443
BACKEND_CORS_ORIGINS=https://192.168.1.27
KC_HOSTNAME=192.168.1.27
PUBLIC_BASE_URL=https://192.168.1.27
JWT_ISSUER=https://192.168.1.27/realms/cloudapi
```

Đảm bảo realm/client đúng:

```env
VITE_REALM=cloudapi
VITE_CLIENT_ID=spa-client
KEYCLOAK_REALM=cloudapi
KEYCLOAK_URL=http://keycloak:8080
```

Nếu dùng database như ví dụ:

```env
POSTGRES_USER=apiuser
POSTGRES_PASSWORD=ChangeThis_Postgres_2026
POSTGRES_DB=apidb
DATABASE_URL=postgresql://apiuser:ChangeThis_Postgres_2026@postgres:5432/apidb
```

Lưu ý:

```text
KEYCLOAK_URL=http://keycloak:8080 là URL nội bộ Docker, không đổi thành IP Ubuntu.
VITE_KEYCLOAK_URL là URL browser dùng, nên phải là https://IP_UBUNTU.
```

### 2.2. Sửa Kong CORS

Mở file:

`[Windows editor]`

```text
D:\UIT\NAM2\HK2\MATMAHOC\PROJECT\Cloud_Api_Security\gateway\kong.yml
```

Trong plugin CORS, đảm bảo có:

```yaml
origins:
  - "https://192.168.1.27"
```

Nếu IP là `192.168.1.35`, sửa thành:

```yaml
origins:
  - "https://192.168.1.35"
```

### 2.3. Sửa Keycloak redirect/webOrigins

Mở file:

`[Windows editor]`

```text
D:\UIT\NAM2\HK2\MATMAHOC\PROJECT\Cloud_Api_Security\idp\keycloak\realm-export.json
```

Trong client `spa-client`, đảm bảo có:

```json
"redirectUris": [
  "https://192.168.1.27/*"
],
"webOrigins": [
  "https://192.168.1.27"
]
```

Có thể giữ thêm localhost để dev, nhưng IP Ubuntu bắt buộc phải có.

## 3. Copy project lên Ubuntu, không copy file `.md`

Máy Windows của bạn hiện chưa có `rsync`, nên dùng PowerShell staging + zip + scp.

Chạy trên Windows PowerShell:

`[Windows PowerShell]`

```powershell
$src = "D:\UIT\NAM2\HK2\MATMAHOC\PROJECT\Cloud_Api_Security"
$stage = "D:\UIT\NAM2\HK2\MATMAHOC\PROJECT\Cloud_Api_Security_deploy"
$zip = "D:\UIT\NAM2\HK2\MATMAHOC\PROJECT\Cloud_Api_Security_deploy.zip"

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
if (Test-Path $zip) { Remove-Item $zip -Force }

New-Item -ItemType Directory -Path $stage | Out-Null

robocopy $src $stage /E /XD .git .venv node_modules frontend\node_modules /XF *.md

Compress-Archive -Path "$stage\*" -DestinationPath $zip -Force

scp $zip cloudapi@192.168.1.27:/home/cloudapi/
```

Sau đó giải nén trên Ubuntu:

`[Ubuntu SSH]`

```bash
mkdir -p ~/Cloud_Api_Security
cd ~/Cloud_Api_Security
unzip -o ~/Cloud_Api_Security_deploy.zip
```

Sửa quyền file sau khi giải nén:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
sudo chown -R cloudapi:cloudapi .
find . -type d -exec chmod 755 {} \;
find . -type f -exec chmod 644 {} \;
find . -name "*.sh" -exec chmod +x {} \;
```

Kiểm tra project đã đúng:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
test -f docker-compose.yml && echo "compose ok"
test -f .env && echo "env ok"
test -d frontend && echo "frontend ok"
test -d backend && echo "backend ok"
test -d gateway && echo "gateway ok"
test -d idp && echo "idp ok"
find . -name "*.md"
```

Nếu `find . -name "*.md"` không in ra gì thì đúng.

Nếu bị `Permission denied`, chạy lại:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
sudo chown -R cloudapi:cloudapi .
find . -type d -exec chmod 755 {} \;
find . -type f -exec chmod 644 {} \;
```

## 4. Tạo cert/key mức 1 trên Ubuntu

Làm bước này sau khi project đã nằm trong:

```text
/home/cloudapi/Cloud_Api_Security
```

Chạy trên Ubuntu:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
mkdir -p certs
cd certs
export SERVER_IP=192.168.1.27
echo "$SERVER_IP"
```

Nếu IP của bạn khác, thay `192.168.1.27` bằng IP thật.

### 4.1. Tạo CA nội bộ

`[Ubuntu SSH]`

```bash
openssl ecparam -name prime256v1 -genkey -noout -out ca.key
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -out ca.crt \
  -subj "/CN=Cloud API Security Local CA"
```

### 4.2. Tạo file SAN cho server cert

`[Ubuntu SSH]`

```bash
cat > server-san.cnf <<EOF
[req]
distinguished_name=req_distinguished_name
req_extensions=v3_req
prompt=no

[req_distinguished_name]
CN=${SERVER_IP}

[v3_req]
keyUsage=keyEncipherment,digitalSignature
extendedKeyUsage=serverAuth
subjectAltName=@alt_names

[alt_names]
IP.1=${SERVER_IP}
DNS.1=localhost
DNS.2=frontend
DNS.3=kong
DNS.4=backend
DNS.5=api-backend
EOF
```

Kiểm tra:

`[Ubuntu SSH]`

```bash
cat server-san.cnf
```

Phải thấy:

```text
IP.1=192.168.1.27
```

### 4.3. Tạo cert cho frontend

`[Ubuntu SSH]`

```bash
openssl ecparam -name prime256v1 -genkey -noout -out frontend.key
openssl req -new -key frontend.key -out frontend.csr -config server-san.cnf
openssl x509 -req -in frontend.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out frontend.crt -days 825 -sha256 -extensions v3_req -extfile server-san.cnf
```

### 4.4. Tạo cert cho Kong

`[Ubuntu SSH]`

```bash
openssl ecparam -name prime256v1 -genkey -noout -out kong.key
openssl req -new -key kong.key -out kong.csr -config server-san.cnf
openssl x509 -req -in kong.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out kong.crt -days 825 -sha256 -extensions v3_req -extfile server-san.cnf
```

### 4.5. Tạo cert cho backend

`[Ubuntu SSH]`

```bash
openssl ecparam -name prime256v1 -genkey -noout -out backend.key
openssl req -new -key backend.key -out backend.csr -config server-san.cnf
openssl x509 -req -in backend.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out backend.crt -days 825 -sha256 -extensions v3_req -extfile server-san.cnf
```

### 4.6. Tạo client cert cho mTLS

`[Ubuntu SSH]`

```bash
cat > client-san.cnf <<EOF
[req]
distinguished_name=req_distinguished_name
req_extensions=v3_req
prompt=no

[req_distinguished_name]
CN=demo-client

[v3_req]
keyUsage=digitalSignature
extendedKeyUsage=clientAuth
EOF

openssl ecparam -name prime256v1 -genkey -noout -out client.key
openssl req -new -key client.key -out client.csr -config client-san.cnf
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out client.crt -days 825 -sha256 -extensions v3_req -extfile client-san.cnf
openssl pkcs12 -export -out client.p12 -inkey client.key -in client.crt -certfile ca.crt
```

Lệnh `openssl pkcs12` sẽ hỏi password. Hãy nhập một mật khẩu dễ nhớ cho demo, ví dụ:

```text
cloudapi-demo
```

### 4.7. Khóa private key và kiểm tra cert

`[Ubuntu SSH]`

```bash
chmod 600 ca.key frontend.key kong.key backend.key client.key

ls -l ca.crt ca.key frontend.crt frontend.key kong.crt kong.key backend.crt backend.key client.crt client.key client.p12

openssl x509 -in frontend.crt -noout -text | grep -A2 "Subject Alternative Name"
openssl x509 -in kong.crt -noout -text | grep -A2 "Subject Alternative Name"
openssl x509 -in client.crt -noout -text | grep -A2 "Extended Key Usage"
```

Kết quả cần thấy:

```text
IP Address:192.168.1.27
TLS Web Client Authentication
```

Nếu tạo sai IP, xóa server cert và tạo lại:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security/certs
rm -f frontend.crt frontend.key frontend.csr
rm -f kong.crt kong.key kong.csr
rm -f backend.crt backend.key backend.csr
rm -f server-san.cnf
```

Sau đó quay lại từ mục `4.2`.

## 5. Chạy toàn bộ server bằng Docker Compose

Chạy trên Ubuntu:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
docker compose config
```

Nếu lệnh trên không báo lỗi, chạy server:

`[Ubuntu SSH]`

```bash
docker compose up -d --build
docker compose ps
```

Container/server cần thấy:

```text
api-frontend   web frontend/Nginx HTTPS
api-gateway    Kong API Gateway HTTPS/mTLS
keycloak       Identity Provider
api-backend    FastAPI backend
api-postgres   Database
api-redis      Replay cache
vault          Vault/KMS lab
vault-init     Init Vault Transit
opa            Policy engine
```

Nếu container nào `exited`, xem log:

`[Ubuntu SSH]`

```bash
docker compose logs --tail=120 frontend
docker compose logs --tail=120 kong
docker compose logs --tail=120 keycloak
docker compose logs --tail=120 backend
docker compose logs --tail=120 postgres
docker compose logs --tail=120 vault
docker compose logs --tail=120 opa
```

## 6. Kiểm tra server nào public, server nào private

Chạy trên Ubuntu:

`[Ubuntu SSH]`

```bash
sudo ss -tulpn
```

Nên thấy public:

```text
0.0.0.0:80
0.0.0.0:443
0.0.0.0:8443
```

Có thể thấy SSH:

```text
0.0.0.0:22
```

Không nên thấy public:

```text
0.0.0.0:9000   backend
0.0.0.0:5432   postgres
0.0.0.0:6379   redis
0.0.0.0:8200   vault
0.0.0.0:8181   opa
0.0.0.0:8001   Kong Admin
```

Nếu thấy các port private public ra `0.0.0.0`, cần xem lại `docker-compose.yml`.

## 7. Test ngay trên Ubuntu

Mục tiêu: xác nhận server chạy trước khi test từ Windows.

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
curl -k -I https://127.0.0.1
curl -k https://127.0.0.1/realms/cloudapi/.well-known/openid-configuration
curl -k -i https://127.0.0.1:8443/health
curl -k -i --cert certs/client.crt --key certs/client.key https://127.0.0.1:8443/health
```

Cách đọc kết quả:

```text
curl https://127.0.0.1              -> frontend HTTPS có trả lời
curl /realms/...                    -> Keycloak discovery có trả JSON
curl :8443/health không cert        -> có thể bị chặn nếu mTLS bật
curl :8443/health có client cert    -> qua được mTLS, có thể trả 200 hoặc 401 tùy route
```

Nếu Keycloak discovery trả issuer sai, ví dụ `localhost` hoặc IP cũ, cần xem lại:

```text
.env: KC_HOSTNAME, JWT_ISSUER, VITE_KEYCLOAK_URL
Keycloak volume có thể đã import realm cũ
```

## 8. Test từ Windows: mở web và test giao thức

### 8.1. Mở web

`[Browser Windows]`

```text
https://192.168.1.27
```

Nếu browser báo cert không tin cậy, đó là bình thường ở mức 1. Vì cert do CA nội bộ mình tạo ký, Windows chưa tin CA này.

Có 2 cách:

```text
Cách nhanh: Advanced -> Proceed nếu browser cho phép.
Cách đúng: import ca.crt vào Windows Trusted Root.
```

### 8.2. Copy CA/client cert về Windows

Chạy trên Windows PowerShell, tại thư mục bạn muốn lưu cert:

`[Windows PowerShell]`

```powershell
scp cloudapi@192.168.1.27:/home/cloudapi/Cloud_Api_Security/certs/ca.crt .
scp cloudapi@192.168.1.27:/home/cloudapi/Cloud_Api_Security/certs/client.crt .
scp cloudapi@192.168.1.27:/home/cloudapi/Cloud_Api_Security/certs/client.key .
scp cloudapi@192.168.1.27:/home/cloudapi/Cloud_Api_Security/certs/client.p12 .
```

Import `ca.crt` vào Windows:

```text
Win + R
certmgr.msc
Trusted Root Certification Authorities
Certificates
Right click -> All Tasks -> Import
Chọn ca.crt
Finish
Đóng và mở lại browser
```

Sau đó mở lại:

`[Browser Windows]`

```text
https://192.168.1.27
```

### 8.3. Test HTTPS/TLS frontend từ Windows

`[Windows PowerShell]`

```powershell
curl.exe -k -I https://192.168.1.27
curl.exe -k -v https://192.168.1.27
```

Cần thấy các dấu hiệu:

```text
HTTP status trả về
TLS handshake
subject/issuer của cert
```

Nếu đã import `ca.crt`, thử bỏ `-k`:

`[Windows PowerShell]`

```powershell
curl.exe -I https://192.168.1.27
```

Nếu pass thì Windows đã tin CA nội bộ.

### 8.4. Test Keycloak/OIDC discovery từ Windows

`[Windows PowerShell]`

```powershell
curl.exe -k https://192.168.1.27/realms/cloudapi/.well-known/openid-configuration
```

Cần thấy JSON có:

```text
"issuer":"https://192.168.1.27/realms/cloudapi"
```

Đây là bằng chứng luồng người dùng đến Identity Provider đang đi qua HTTPS endpoint.

### 8.5. Test Kong HTTPS/mTLS từ Windows

Không có client cert:

`[Windows PowerShell]`

```powershell
curl.exe -k -i https://192.168.1.27:8443/health
```

Nếu bị chặn thì đúng kỳ vọng mTLS.

Có client cert:

`[Windows PowerShell]`

```powershell
curl.exe -k -i --cert .\client.crt --key .\client.key https://192.168.1.27:8443/health
```

Cách đọc kết quả:

```text
Nếu không cert bị chặn, có cert đi tiếp: mTLS đang hoạt động.
Nếu có cert nhưng trả 401: mTLS đã qua, nhưng route cần JWT/token.
Nếu TLS handshake fail: cert/key client sai hoặc Kong không tin ca.crt.
```

### 8.6. Test backend/db/redis/vault/opa không public

`[Windows PowerShell]`

```powershell
curl.exe -k https://192.168.1.27:9000/health
curl.exe http://192.168.1.27:5432
curl.exe http://192.168.1.27:6379
curl.exe http://192.168.1.27:8200
curl.exe http://192.168.1.27:8181
```

Các lệnh này nên fail/timeout/refused. Nếu truy cập được từ Windows thì service nội bộ đang bị expose sai.

## 9. Test đăng nhập web

`[Browser Windows]`

Mở:

```text
https://192.168.1.27
```

Luồng đúng:

```text
1. Browser vào frontend qua HTTPS.
2. Frontend gọi Keycloak qua https://192.168.1.27/realms/cloudapi.
3. Keycloak login và trả token.
4. Frontend gọi API qua https://192.168.1.27:8443.
5. Kong xử lý gateway/mTLS/policy.
6. Backend verify JWT/DPoP và trả response.
```

Nếu lỗi `Invalid parameter: redirect_uri`:

```text
Sửa idp/keycloak/realm-export.json hoặc Keycloak Admin:
Valid redirect URIs: https://192.168.1.27/*
Web origins: https://192.168.1.27
```

Nếu đã sửa file nhưng Keycloak vẫn lỗi, có thể Keycloak đang dùng volume cũ. Chưa xóa volume nếu chưa chắc. Trước tiên chỉ xem:

`[Ubuntu SSH]`

```bash
docker volume ls | grep keycloak
```

### 9.1. Vì sao đăng nhập Google chưa chạy ở mức 1?

Nếu bấm `Google` và Google báo:

```text
Access blocked: Authorization Error
device_id and device_name are required for private IP:
https://192.168.1.28/realms/cloudapi/broker/google/endpoint
Error 400: invalid_request
```

thì đây là giới hạn của Google OAuth với redirect URI dùng private IP. Ở mức 1, hệ thống đang chạy bằng IP LAN/private như:

```text
https://192.168.1.28
```

Google không xem đây là redirect URI web public hợp lệ cho OAuth web application. Vì vậy:

```text
Mức 1: test login bằng username/password trong Keycloak.
Mức 2: sau khi có domain thật, mới test Google login.
```

Ở mức 1, lỗi Google login này không làm hỏng bằng chứng bảo mật chính. Bạn vẫn test được:

```text
HTTPS/TLS bằng IP private.
Keycloak username/password login.
JWT/OIDC issuer.
Kong HTTPS/mTLS.
Backend không public trực tiếp.
```

Muốn Google login chạy đúng, redirect URI cần chuyển sang domain thật ở mức 2, ví dụ:

```text
https://auth.apisec.shop/realms/cloudapi/broker/google/endpoint
```

và URI này phải được khai báo chính xác trong Google Cloud Console.

## 10. Bằng chứng cần chụp/lưu vào báo cáo

Lưu các bằng chứng sau:

```text
1. docker compose ps: các container running.
2. sudo ss -tulpn: chỉ public 80/443/8443, không public backend/db/redis/vault/opa.
3. Browser mở được https://192.168.1.27.
4. Certificate viewer cho thấy cert có SAN IP 192.168.1.27.
5. curl -v hoặc curl -I cho thấy HTTPS/TLS handshake.
6. Keycloak discovery có issuer https://192.168.1.27/realms/cloudapi.
7. Request Kong không client cert bị chặn.
8. Request Kong có client cert đi tiếp.
9. Backend/db/redis/vault/opa không truy cập trực tiếp từ Windows.
```

## 11. Khi nào mới chuyển sang domain/ZeroSSL?

Chỉ chuyển sang mức 2 sau khi mức 1 đã pass:

```text
Web mở được bằng https://IP.
Keycloak discovery đúng issuer.
Kong mTLS test được.
Docker containers running.
Port nội bộ không public.
Đăng nhập web hoặc luồng API có thể test được.
```

Nếu mức 1 chưa pass mà đã chuyển domain/ZeroSSL, lỗi sẽ khó debug hơn vì lúc đó thêm DNS, cert public và hostname.

Mức 2 sẽ thay:

```text
https://192.168.1.27        -> https://app.<domain>
https://192.168.1.27:8443   -> https://api.<domain>:8443
issuer IP                  -> issuer auth.<domain>
self-signed/internal CA web cert -> ZeroSSL domain cert
```

Nhưng internal CA cho mTLS client vẫn nên giữ riêng, không thay bằng ZeroSSL.
