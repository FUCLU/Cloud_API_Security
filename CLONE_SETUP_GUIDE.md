# Hướng dẫn clone và chạy project

File này dành cho người mới clone project về máy và muốn chạy được hệ thống D1 bằng Docker Compose.

Hỗ trợ hai môi trường:

- Windows 10/11 dùng Docker Desktop.
- Ubuntu/Linux dùng Docker Engine.

## 1. Yêu cầu trước khi chạy

Cần có:

```bash
docker --version
docker compose version
git --version
python3 --version
```

Khuyến nghị chung:

- Còn trống ít nhất 8-10 GB dung lượng.
- Docker daemon đang chạy.

### Nếu dùng Windows 10/11

Cài các phần mềm sau:

- Git for Windows: https://git-scm.com/download/win
- Docker Desktop: https://www.docker.com/products/docker-desktop/
- Python 3: https://www.python.org/downloads/windows/
- OpenSSL cho Windows, hoặc dùng Git Bash có sẵn `openssl`.

Trong Docker Desktop:

```text
Settings -> General -> Use the WSL 2 based engine
Settings -> Resources -> Memory: nên để 4GB trở lên
Settings -> Resources -> Disk image size: nên để 20GB trở lên
```

Sau khi mở Docker Desktop, kiểm tra bằng PowerShell:

```powershell
docker --version
docker compose version
docker info
python --version
git --version
```

Nếu `docker info` lỗi, thường là Docker Desktop chưa mở xong hoặc WSL2 chưa bật.

### Nếu dùng Ubuntu/Linux

Kiểm tra Docker:

```bash
sudo systemctl status docker
docker info
```

Nếu `docker info` báo permission denied:

```bash
sudo usermod -aG docker $USER
newgrp docker
docker info
```

## 2. Clone repo

### Windows PowerShell

Nên clone vào thư mục không có dấu tiếng Việt và tránh path quá dài:

```powershell
cd D:\
git clone https://github.com/FUCLU/Cloud_API_Security.git
cd Cloud_API_Security
```

Nếu dùng ổ C:

```powershell
cd C:\Users\<TEN_USER>\Documents
git clone https://github.com/FUCLU/Cloud_API_Security.git
cd Cloud_API_Security
```

### Ubuntu/Linux

```bash
git clone https://github.com/FUCLU/Cloud_API_Security.git
cd Cloud_API_Security
```

Nếu Git báo `dubious ownership` khi repo nằm trên ổ mount:

```bash
git config --global --add safe.directory "$(pwd)"
```

## 3. Tạo file môi trường

Copy file mẫu:

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Ubuntu/Linux:

```bash
cp .env.example .env
```

Mở `.env` và kiểm tra các giá trị chính:

```env
POSTGRES_PORT=5434
REDIS_PORT=6380
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin
VITE_KEYCLOAK_URL=http://localhost:8082
VITE_KONG_URL=https://localhost:8443
VITE_REALM=cloudapi
VITE_CLIENT_ID=spa-client
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin
```

### 3.1. Cách điền từng biến trong `.env`

Với người chỉ muốn chạy project local để demo D1, có thể giữ gần như toàn bộ giá trị mặc định trong `.env.example`.

| Biến | Nên điền gì khi chạy local | Khi nào cần đổi |
|---|---|---|
| `POSTGRES_DB` | `cloudapi` | Đổi nếu muốn tên database khác |
| `POSTGRES_USER` | `admin` | Đổi nếu muốn user DB khác |
| `POSTGRES_PASSWORD` | `admin123` hoặc mật khẩu tự đặt | Nên đổi nếu chia sẻ máy |
| `POSTGRES_PORT` | `5434` | Đổi nếu máy đã có Postgres dùng port này |
| `DATABASE_URL` | `postgresql://admin:admin123@postgres:5432/cloudapi` | Phải khớp `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`; host trong Docker là `postgres`, không phải `localhost` |
| `KEYCLOAK_ADMIN` | `admin` | User đăng nhập Keycloak Admin |
| `KEYCLOAK_ADMIN_PASSWORD` | `admin` | Nên đổi nếu chia sẻ máy |
| `KEYCLOAK_URL` | `http://keycloak:8080` | Backend gọi Keycloak bên trong Docker, giữ nguyên |
| `KEYCLOAK_REALM` | `cloudapi` | Phải khớp realm trong `idp/keycloak/realm-export.json` |
| `JWT_AUDIENCE` | `cloud-api` | Chỉ đổi nếu đổi audience trong Keycloak/client |
| `JWT_ISSUER` | `http://localhost:8082/realms/cloudapi` | URL issuer nhìn từ máy host/browser |
| `VAULT_WRAPPED_DEK` | Có thể để trống lúc đầu | Điền nếu muốn test mã hóa AEAD/Vault Transit đầy đủ |
| `REDIS_PORT` | `6380` | Đổi nếu máy đã có Redis dùng port này |
| `VAULT_TOKEN` | `root` | Dùng cho Vault dev mode |
| `VAULT_KEY_NAME` | `dek` | Tên key trong Vault Transit |
| `LOG_LEVEL` | `INFO` | Đổi `DEBUG` khi cần log chi tiết |
| `GRAFANA_USER` | `admin` | Chỉ dùng khi bật profile `obs` |
| `GRAFANA_PASSWORD` | `admin` | Chỉ dùng khi bật profile `obs` |
| `PROMTAIL_LOG_LEVEL` | `info` | Chỉ dùng khi bật profile `obs` |
| `PGADMIN_EMAIL` | `admin@admin.com` | Chỉ dùng khi bật profile `tools` |
| `PGADMIN_PASSWORD` | `admin` | Chỉ dùng khi bật profile `tools` |
| `VITE_KEYCLOAK_URL` | `http://localhost:8082` | Frontend gọi Keycloak từ browser |
| `VITE_KONG_URL` | `https://localhost:8443` | Frontend gọi API qua Kong HTTPS |
| `VITE_REALM` | `cloudapi` | Phải khớp `KEYCLOAK_REALM` |
| `VITE_CLIENT_ID` | `spa-client` | Phải khớp client trong realm export |

Mẫu `.env` tối thiểu để chạy local:

```env
POSTGRES_DB=cloudapi
POSTGRES_USER=admin
POSTGRES_PASSWORD=admin123
POSTGRES_PORT=5434
DATABASE_URL=postgresql://admin:admin123@postgres:5432/cloudapi

KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin
KEYCLOAK_URL=http://keycloak:8080
KEYCLOAK_REALM=cloudapi

JWT_AUDIENCE=cloud-api
JWT_ISSUER=http://localhost:8082/realms/cloudapi

VAULT_WRAPPED_DEK=
REDIS_PORT=6380
VAULT_TOKEN=root
VAULT_KEY_NAME=dek
LOG_LEVEL=INFO

GRAFANA_USER=admin
GRAFANA_PASSWORD=admin
PROMTAIL_LOG_LEVEL=info

PGADMIN_EMAIL=admin@admin.com
PGADMIN_PASSWORD=admin

VITE_KEYCLOAK_URL=http://localhost:8082
VITE_KONG_URL=https://localhost:8443
VITE_REALM=cloudapi
VITE_CLIENT_ID=spa-client
```

Nếu đổi `POSTGRES_PASSWORD`, nhớ đổi cả `DATABASE_URL`. Ví dụ:

```env
POSTGRES_PASSWORD=my-password
DATABASE_URL=postgresql://admin:my-password@postgres:5432/cloudapi
```

Nếu đổi port Keycloak trong `docker-compose.yml`, ví dụ `8085:8080`, phải đổi:

```env
JWT_ISSUER=http://localhost:8085/realms/cloudapi
VITE_KEYCLOAK_URL=http://localhost:8085
```

Nếu đổi port Kong HTTPS, ví dụ `9443:8443`, phải đổi:

```env
VITE_KONG_URL=https://localhost:9443
```

### 3.2. `VAULT_WRAPPED_DEK` có cần điền không?

Để chạy UI/API cơ bản, có thể để trống:

```env
VAULT_WRAPPED_DEK=
```

Nếu muốn chứng minh phần mã hóa AEAD/Vault Transit đầy đủ, cần tạo giá trị wrapped DEK sau khi Vault chạy.

Windows PowerShell:

```powershell
docker compose up -d vault vault-init
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$dek = [Convert]::ToBase64String($bytes)
$wrapped = docker exec -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN=root -e DEK_BASE64=$dek vault sh -lc 'vault write -field=ciphertext transit/encrypt/dek plaintext=$DEK_BASE64'
"VAULT_WRAPPED_DEK=$wrapped"
```

Copy dòng `VAULT_WRAPPED_DEK=...` vào `.env`.

Ubuntu/Linux:

```bash
docker compose up -d vault vault-init
DEK_BASE64="$(openssl rand -base64 32)"
WRAPPED="$(docker exec -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN=root -e DEK_BASE64="$DEK_BASE64" vault sh -lc 'vault write -field=ciphertext transit/encrypt/dek plaintext=$DEK_BASE64')"
printf 'VAULT_WRAPPED_DEK=%s\n' "$WRAPPED"
```

Copy kết quả vào `.env`.

### 3.3. Google login cần điền gì?

Repo không lưu Google client secret thật. Nếu chỉ dùng tài khoản demo Keycloak thì bỏ qua phần này.

Trong `.env` hiện tại không có biến `GOOGLE_CLIENT_ID` hoặc `GOOGLE_CLIENT_SECRET`, vì Google login được cấu hình trong Keycloak, không cấu hình trực tiếp trong frontend/backend.

Nếu muốn dùng Google login:

1. Vào Google Cloud Console tạo OAuth Client loại `Web application`.
2. Trong Google Cloud, mục `Authorized redirect URIs`, điền endpoint broker của Keycloak:

```text
http://localhost:8082/realms/cloudapi/broker/google/endpoint
```

Nếu sau này đổi domain/port Keycloak, URI này cũng phải đổi theo.

3. Vào Keycloak Admin:

```text
http://localhost:8082/admin
```

4. Realm `cloudapi` -> `Identity providers` -> `Google`.
5. Điền giá trị lấy từ Google Cloud:

```text
Client ID
Client Secret
```

6. Save.
7. Kiểm tra client frontend trong Keycloak:

```text
Realm cloudapi -> Clients -> spa-client -> Valid redirect URIs
```

Các redirect URI của frontend nên có:

```text
https://localhost:5174/callback
http://localhost:5173/callback
```

Nếu đổi `VITE_KEYCLOAK_URL`, `VITE_KONG_URL`, port frontend hoặc domain thật, phải cập nhật lại cả `.env`, Keycloak client redirect URI và Google Cloud redirect URI cho khớp.

Không ghi Google client secret thật vào GitHub.

Lưu ý:

- Không commit `.env` lên GitHub.
- `.env.example` chỉ là template.
- Nếu muốn dùng Google login, cần cấu hình lại Google `clientSecret` trong Keycloak Admin Console hoặc trong `idp/keycloak/realm-export.json` trước khi import. Repo không lưu secret thật.

## 4. Tạo certificate nội bộ

Project dùng PKI nội bộ để chạy TLS local.

Chạy:

Windows PowerShell:

```powershell
python scripts/gen_certs.py
```

Ubuntu/Linux:

```bash
python3 scripts/gen_certs.py
```

Các file sẽ được tạo trong `certs/`:

```text
ca.crt / ca.key
kong.crt / kong.key
frontend.crt / frontend.key
backend.crt / backend.key
client.crt / client.key
```

Kiểm tra thuật toán cert:

Windows PowerShell:

```powershell
openssl x509 -in certs/kong.crt -noout -issuer -subject
openssl x509 -in certs/kong.crt -noout -text | Select-String "Public Key Algorithm|Signature Algorithm|ASN1 OID"
```

Ubuntu/Linux:

```bash
openssl x509 -in certs/kong.crt -noout -issuer -subject
openssl x509 -in certs/kong.crt -noout -text | grep -E "Public Key Algorithm|Signature Algorithm|ASN1 OID"
```

Kỳ vọng:

```text
Issuer: CloudAPI Root CA
Public Key Algorithm: id-ecPublicKey
ASN1 OID: prime256v1
Signature Algorithm: ecdsa-with-SHA256
```

## 5. Chạy hệ thống D1

Chạy toàn bộ stack chính:

Windows PowerShell và Ubuntu/Linux đều dùng:

```bash
docker compose up -d --build
```

Xem trạng thái:

```bash
docker compose ps
```

Các service chính cần `Up` hoặc `healthy`:

```text
api-frontend
api-gateway
api-backend
api-postgres
api-redis
keycloak
opa
vault
```

## 6. Port cần mở

| Thành phần | URL/Port | Công dụng |
|---|---:|---|
| Frontend HTTPS | `https://localhost:5174` | Giao diện chính |
| Frontend HTTP | `http://localhost:5173` | Giao diện qua HTTP |
| Kong HTTPS | `https://localhost:8443` | API gateway TLS |
| Kong HTTP | `http://localhost:8000` | API gateway HTTP |
| Kong Admin | `http://localhost:8001` | Kiểm tra Kong admin API |
| Backend direct | `https://localhost:9000` | Test backend trực tiếp |
| Keycloak | `http://localhost:8082` | IdP/OIDC |
| OPA | `http://localhost:8181` | Policy engine |
| Vault | `http://localhost:8200` | Vault dev mode |
| Postgres | `localhost:5434` | Database |
| Redis | `localhost:6380` | Cache/replay store |

## 7. Kiểm tra nhanh sau khi chạy

Health qua Kong:

Windows PowerShell:

```powershell
curl.exe --cacert certs/ca.crt -i https://localhost:8443/health
```

Ubuntu/Linux:

```bash
curl --cacert certs/ca.crt -i https://localhost:8443/health
```

Backend trực tiếp:

Windows PowerShell:

```powershell
curl.exe -k -i https://localhost:9000/health
```

Ubuntu/Linux:

```bash
curl -k -i https://localhost:9000/health
```

Keycloak:

Windows PowerShell:

```powershell
curl.exe -i http://localhost:8082/realms/cloudapi/.well-known/openid-configuration
```

Ubuntu/Linux:

```bash
curl -i http://localhost:8082/realms/cloudapi/.well-known/openid-configuration
```

OPA:

Windows PowerShell:

```powershell
curl.exe -i http://localhost:8181/health
```

Ubuntu/Linux:

```bash
curl -i http://localhost:8181/health
```

Vault:

Windows PowerShell:

```powershell
curl.exe -i http://localhost:8200/v1/sys/health
```

Ubuntu/Linux:

```bash
curl -i http://localhost:8200/v1/sys/health
```

Redis:

```bash
docker compose exec redis redis-cli ping
```

Postgres:

```bash
docker compose exec postgres pg_isready -U admin -d cloudapi
```

## 8. Tài khoản demo

Các tài khoản trong Keycloak realm `cloudapi`:

| Email | Mật khẩu | Role |
|---|---|---|
| `phuc@company.com` | `demo1234` | Admin |
| `hung@company.com` | `demo1234` | Admin |
| `kiet@company.com` | `demo1234` | Staff |
| `an@gmail.com` | `demo1234` | Customer |
| `bich@gmail.com` | `demo1234` | Customer |

Nếu admin/staff bị yêu cầu TOTP lần đầu, làm theo màn hình Keycloak để setup OTP. Trong môi trường demo, nếu project đã cấu hình bypass/mô phỏng thì có thể nhập mã 6 chữ số theo hướng dẫn UI.

## 9. Test bằng browser

Mở:

```text
https://localhost:5174
```

Do dùng CA nội bộ, browser sẽ báo certificate không tin cậy.

Cách nhanh:

```text
Advanced -> Proceed
```

Cách đúng hơn: import `certs/ca.crt` vào trust store của browser/OS.

### Import CA trên Windows

Nếu muốn browser không báo `Not secure`, import CA nội bộ:

1. Nhấn `Win + R`.
2. Gõ `mmc`.
3. `File -> Add/Remove Snap-in`.
4. Chọn `Certificates`.
5. Chọn `Computer account`.
6. `Local computer`.
7. Vào:

```text
Trusted Root Certification Authorities -> Certificates
```

8. Chuột phải `Certificates -> All Tasks -> Import`.
9. Chọn file:

```text
certs\ca.crt
```

10. Restart browser.

Kiểm tra role:

- Admin vào `/admin/dashboard`.
- Staff vào `/staff/dashboard`.
- Customer vào `/customer/productcatalog`.
- Admin không được vào `/staff/dashboard`.
- Customer không được vào `/admin/dashboard`.

## 10. Test security evidence

BOLA/IDOR:

Windows PowerShell:

```powershell
python scripts/attacks/bola_attack.py
Get-Content EVIDENCE/attack_results/bola/bola_result.txt
```

Ubuntu/Linux:

```bash
python3 scripts/attacks/bola_attack.py
cat EVIDENCE/attack_results/bola/bola_result.txt
```

SSRF:

Windows PowerShell:

```powershell
python scripts/attacks/ssrf_attack.py
Get-Content EVIDENCE/attack_results/ssrf/ssrf_result.txt
```

Ubuntu/Linux:

```bash
python3 scripts/attacks/ssrf_attack.py
cat EVIDENCE/attack_results/ssrf/ssrf_result.txt
```

Role escalation:

Windows PowerShell:

```powershell
python scripts/attacks/role_escalation_test.py
Get-Content EVIDENCE/attack_results/role-escalation/role_escalation_result.json
```

Ubuntu/Linux:

```bash
python3 scripts/attacks/role_escalation_test.py
cat EVIDENCE/attack_results/role-escalation/role_escalation_result.json
```

OPA tests:

```bash
docker compose exec opa opa test /policies /tests -v
```

## 11. Bật observability nếu cần

Mặc định D1 không cần bật Loki/Grafana/Prometheus.

Nếu muốn test observability:

```bash
docker compose --profile obs up -d
docker compose --profile obs ps
```

Kiểm tra:

Windows PowerShell:

```powershell
curl.exe -i http://localhost:3100/ready
curl.exe -i http://localhost:3000/api/health
curl.exe -i http://localhost:9091/-/ready
```

Ubuntu/Linux:

```bash
curl -i http://localhost:3100/ready
curl -i http://localhost:3000/api/health
curl -i http://localhost:9091/-/ready
```

Grafana:

```text
http://localhost:3000
user: admin
password: admin
```

Nếu máy ít dung lượng, không nên bật profile `obs`.

Tắt observability:

```bash
docker compose --profile obs down
```

## 12. Lỗi thường gặp

### Port 8443 bị chiếm

Kiểm tra:

Windows PowerShell:

```powershell
netstat -ano | findstr :8443
```

Nếu thấy PID đang dùng port, xem process:

```powershell
tasklist /FI "PID eq <PID>"
```

Ubuntu/Linux:

```bash
sudo ss -ltnp | grep ':8443'
```

Nếu bị nginx/apache local chiếm, dừng service đó hoặc đổi port trong `docker-compose.yml`.

### Docker báo no space left on device

Windows Docker Desktop:

```powershell
docker system df
docker builder prune -af
docker image prune -af
docker container prune -f
```

Nếu vẫn thiếu dung lượng:

```text
Docker Desktop -> Settings -> Resources -> Disk image size
```

Tăng disk image size rồi restart Docker Desktop.

Ubuntu/Linux:

Kiểm tra:

```bash
df -h /
docker system df
```

Dọn Docker cache:

```bash
docker builder prune -af
docker image prune -af
docker container prune -f
```

Nếu vẫn thiếu dung lượng, cần tăng dung lượng phân vùng Ubuntu hoặc chuyển Docker data-root sang ổ khác.

### Keycloak không lên

Xem log:

```bash
docker compose logs keycloak --tail 120
```

Kiểm tra realm:

```bash
curl -i http://localhost:8082/realms/cloudapi/.well-known/openid-configuration
```

Nếu vừa sửa `realm-export.json`, recreate Keycloak:

```bash
docker compose rm -sf keycloak
docker compose up -d keycloak
```

Trên Windows PowerShell dùng cùng lệnh trên.

### Frontend chưa nhận code mới

Rebuild:

```bash
docker compose up -d --build frontend
```

Sau đó hard reload browser hoặc mở tab ẩn danh.

### Google login không chạy

Repo không lưu Google client secret thật.

Cần vào Keycloak Admin:

```text
http://localhost:8082/admin
```

Realm:

```text
cloudapi
```

Vào:

```text
Identity providers -> Google
```

Điền lại:

```text
Client ID
Client Secret
```

Nếu không cần Google login, dùng tài khoản demo Keycloak.

## 13. Dừng hệ thống

Dừng container nhưng giữ volume:

```bash
docker compose down
```

Dừng và xóa volume dữ liệu:

```bash
docker compose down -v
```

Chỉ dùng `down -v` nếu muốn reset database/Keycloak/Vault.
