# Hướng dẫn triển khai Cloud API Security trên Ubuntu VM

Ngày cập nhật: 03/06/2026

Mục tiêu của tài liệu này là hướng dẫn triển khai project Cloud API Security từ `localhost` sang Ubuntu VM theo 2 mức:

```text
Mức 1: Ubuntu VM + IP private + self-signed/internal CA
Mức 2: Ubuntu VM + Tailscale + domain thật + ZeroSSL
```

Tài liệu cũng trả lời các câu hỏi chính:

- Project hiện tại có đáp ứng đề tài đã gửi không?
- Một Ubuntu VM có chạy được nhiều server không?
- Một Ubuntu VM có phân vùng được không?
- Vì sao cần làm mức 1 trước mức 2?
- Nếu dùng domain + Tailscale thì bạn của bạn cần gì?
- Cách này đã đủ bảo mật chưa?

## 1. Kết luận nhanh

Project của bạn **đã đáp ứng phần lớn yêu cầu cốt lõi của đề tài ở mức prototype/lab**:

- Có API Gateway: Kong.
- Có Identity Provider: Keycloak.
- Có OAuth2/OIDC + Authorization Code + PKCE.
- Có JWT ký bằng ES256.
- Có DPoP để client ký proof cho request.
- Có backend verify JWT + DPoP.
- Có Redis replay cache.
- Có OPA làm policy engine.
- Có Vault Transit cho key/secret operation.
- Có PostgreSQL.
- Có rate limiting.
- Có mTLS tại Kong.
- Có script/test cho replay, BOLA, SSRF, token hardening.
- Có observability profile với Loki/Grafana/Prometheus.

Nhưng project **chưa phải production đầy đủ** vì:

- Chưa có Firewall HA thật.
- Chưa có Load Balancer thật.
- Chưa có WAF Cluster thật.
- Kong hiện là một node, chưa phải cluster.
- Keycloak/Vault đang ở hướng dev/lab.
- Network segmentation là Docker network, chưa phải subnet vật lý/cloud VPC.
- Kong chưa verify JWT đầy đủ trước khi gọi OPA.
- Kong upstream backend còn `tls_verify: false`.

Cách viết đúng trong báo cáo:

```text
Hệ thống là prototype/lab deployment cho SME API security. Project đã triển khai các cơ chế lõi như API Gateway, IdP/OIDC, PKCE, JWT ES256, DPoP, OPA, mTLS, Vault Transit, Redis replay protection và attack simulation. Các thành phần production như Firewall HA, WAF Cluster, Load Balancer, API Gateway Cluster và phân vùng mạng vật lý được mô phỏng hoặc đưa vào hướng hoàn thiện.
```

Không nên viết:

```text
Hệ thống đã triển khai production đầy đủ.
```

## 2. Kiến trúc bạn đang hướng tới có khớp project không?

Hình kiến trúc bạn đưa ra khớp với hướng project hiện tại ở mức logic:

```text
External/User
  -> DMZ/Edge: Keycloak, Kong
  -> Application/Private: FastAPI, OPA, Redis
  -> Data/Security: Vault, PostgreSQL
```

Mapping với project:

| Vùng trong hình | Thành phần | Project hiện tại |
| --- | --- | --- |
| External/Untrusted | User/browser | Có |
| DMZ/Edge | Keycloak | Có |
| DMZ/Edge | Kong Gateway | Có |
| Application/Private | FastAPI Backend | Có |
| Application/Private | OPA | Có |
| Application/Private | Redis Replay Cache | Có |
| Data/Security | Vault/KMS | Có Vault Transit |
| Data/Security | PostgreSQL | Có |

Nếu chạy tất cả trên một Ubuntu VM, các vùng này là **phân vùng logic**, không phải phân vùng vật lý. Cách mô tả đúng:

```text
Trong môi trường demo một Ubuntu VM, các vùng DMZ/Edge, Application/Private và Data/Security được mô phỏng bằng Docker networks, firewall rules và nguyên tắc không expose service nội bộ.
```

## 3. Một Ubuntu VM có chạy được nhiều server không?

Có. Trong project của bạn, “server” chủ yếu là các container Docker.

Một Ubuntu VM có thể chạy:

```text
Frontend/Nginx
Kong Gateway
Keycloak
FastAPI Backend
OPA
Redis
Vault
PostgreSQL
Grafana/Loki/Prometheus nếu bật observability
```

Cấu hình VM khuyến nghị:

```text
OS: Ubuntu Server 24.04 LTS amd64
CPU: 2-4 cores
RAM: tối thiểu 6 GB, nên 8 GB
Disk: 40-60 GB
Network: Bridged Adapter nếu demo LAN
```

Nếu bật thêm Grafana, Loki, Prometheus, nên dùng 8 GB RAM trở lên.

## 4. Một Ubuntu VM có phân vùng được không?

Có, nhưng là **phân vùng logic**.

Bạn có thể tách bằng:

- Docker networks.
- UFW/iptables.
- Không publish port nội bộ.
- Kong/reverse proxy làm cửa vào.

Mô hình nên dùng:

```text
edge-net:
  frontend
  kong
  keycloak

app-net:
  backend
  opa
  redis

data-net:
  postgres
  vault
```

Quy tắc truy cập:

```text
User -> Frontend/Kong/Keycloak: được
User -> Backend/OPA/Redis/Vault/PostgreSQL: không được

Kong -> Backend: được
Kong -> OPA: được
Backend -> Redis: được
Backend -> Vault: được
Backend -> PostgreSQL: được
```

Ví dụ Docker Compose network:

```yaml
networks:
  edge-net:
  app-net:
  data-net:
```

Gán service:

```yaml
frontend:
  networks:
    - edge-net

kong:
  networks:
    - edge-net
    - app-net

keycloak:
  networks:
    - edge-net
    - app-net

backend:
  networks:
    - app-net
    - data-net

opa:
  networks:
    - app-net

redis:
  networks:
    - app-net

postgres:
  networks:
    - data-net

vault:
  networks:
    - data-net
```

Chỉ expose public:

```yaml
frontend:
  ports:
    - "80:80"
    - "443:443"

kong:
  ports:
    - "8443:8443"
```

Không expose:

```text
9000  backend
8181  OPA
6380  Redis
8200  Vault
5434  PostgreSQL
8001  Kong Admin API
```

## 5. Lộ trình làm đúng thứ tự

Không nên bắt đầu ngay bằng domain + ZeroSSL. Nên làm theo thứ tự:

```text
1. Chuẩn bị Ubuntu VM.
2. Chạy project bằng IP private.
3. Tạo self-signed/internal CA certificate cho IP VM.
4. Kiểm chứng HTTPS/TLS/mTLS/JWT/DPoP/OPA/Redis/Vault.
5. Đảm bảo service nội bộ không truy cập được từ client.
6. Sau khi mức 1 ổn, mới nâng lên Tailscale + domain thật + ZeroSSL.
```

Lý do:

- Mức 1 giúp tách lỗi ứng dụng và lỗi hạ tầng.
- Nếu mức 1 chưa ổn mà làm ngay ZeroSSL/Tailscale, lỗi sẽ bị lẫn giữa Docker, DNS, certificate, Keycloak issuer, CORS và routing.
- Mức 2 chỉ nên là bước nâng cấp để demo đẹp hơn.

## 6. Chuẩn bị Ubuntu VM

Tải Ubuntu Server:

```text
https://ubuntu.com/download/server
```

Khuyến nghị:

```text
Ubuntu Server 24.04 LTS amd64
```

Cấu hình VMware:

```text
Network Adapter: Bridged
CPU: 2-4 cores
RAM: 8 GB nếu có thể
Disk: 40-60 GB
```

Sau khi cài Ubuntu, kiểm tra IP:

```bash
hostname -I
```

Ví dụ:

```text
192.168.1.50
```

Cài gói cần thiết:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg git openssl ufw
```

Cài Docker:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Đăng xuất/đăng nhập lại, rồi kiểm tra:

```bash
docker version
docker compose version
```

Mở firewall mức tối thiểu:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8443/tcp
sudo ufw enable
sudo ufw status
```

## 7. Mức 1: IP private + self-signed/internal CA

### 7.1. Mục tiêu

Mức 1 dùng IP private của Ubuntu VM:

```text
https://192.168.1.50
https://192.168.1.50:8443
```

Ở mức này:

- Không cần domain.
- Không cần ZeroSSL.
- Không cần Tailscale.
- Client cùng LAN hoặc host máy bạn có thể truy cập VM.
- Certificate do CA nội bộ của bạn ký.
- Certificate phải có SAN chứa IP VM.

Mức 1 chứng minh được:

- Server không còn chỉ là `localhost`.
- Client và server tách biệt qua network.
- HTTPS/TLS hoạt động.
- Có thể ép TLS 1.3.
- Có thể chứng minh mTLS.
- Có phân vùng logic bằng Docker networks.
- Backend/OPA/Redis/Vault/PostgreSQL không expose trực tiếp.

### 7.2. Tạo CA nội bộ và certificate cho IP VM

Trên Ubuntu VM:

```bash
mkdir -p ~/cloudapi-local-ca
cd ~/cloudapi-local-ca
```

Tạo CA:

```bash
openssl genrsa -out cloudapi-ca.key 4096

openssl req -x509 -new -nodes \
  -key cloudapi-ca.key \
  -sha256 \
  -days 3650 \
  -out cloudapi-ca.crt \
  -subj "/CN=CloudAPI Local Root CA"
```

Tạo file SAN:

```bash
nano server-san.cnf
```

Ví dụ với IP VM là `192.168.1.50`:

```ini
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = req_ext

[dn]
CN = 192.168.1.50

[req_ext]
subjectAltName = @alt_names

[alt_names]
IP.1 = 192.168.1.50
IP.2 = 127.0.0.1
DNS.1 = localhost
DNS.2 = api-gateway
DNS.3 = frontend
DNS.4 = backend
DNS.5 = kong
```

Tạo server key và CSR:

```bash
openssl genrsa -out cloudapi-server.key 2048

openssl req -new \
  -key cloudapi-server.key \
  -out cloudapi-server.csr \
  -config server-san.cnf
```

Ký certificate:

```bash
openssl x509 -req \
  -in cloudapi-server.csr \
  -CA cloudapi-ca.crt \
  -CAkey cloudapi-ca.key \
  -CAcreateserial \
  -out cloudapi-server.crt \
  -days 825 \
  -sha256 \
  -extensions req_ext \
  -extfile server-san.cnf
```

Copy vào project:

```bash
mkdir -p ~/Cloud_Api_Security/certs-local

cp cloudapi-ca.crt ~/Cloud_Api_Security/certs-local/ca.crt
cp cloudapi-server.crt ~/Cloud_Api_Security/certs-local/server.crt
cp cloudapi-server.key ~/Cloud_Api_Security/certs-local/server.key
```

### 7.3. Import CA vào client

Nếu không import CA, HTTPS vẫn được mã hóa nhưng browser sẽ cảnh báo certificate không tin cậy.

Trên Windows client:

1. Copy `cloudapi-ca.crt` sang máy client.
2. Double click file.
3. Chọn Install Certificate.
4. Chọn Current User hoặc Local Machine.
5. Chọn Trusted Root Certification Authorities.
6. Finish.
7. Mở lại browser.

### 7.4. Chỉnh project cho mức 1

Các URL frontend nên chuyển từ `localhost` sang IP VM.

Ví dụ `.env`:

```env
VITE_KEYCLOAK_URL=https://192.168.1.50:8444
VITE_KONG_URL=https://192.168.1.50:8443
VITE_REALM=cloudapi
VITE_CLIENT_ID=spa-client
```

Nếu Keycloak vẫn chạy HTTP nội bộ sau Kong/reverse proxy, cần cấu hình cẩn thận issuer. Với demo mức 1, bạn có thể giữ Keycloak local/internal nếu chỉ kiểm chứng API trước, nhưng khi login qua browser thì redirect URI phải dùng IP VM:

```text
https://192.168.1.50/*
https://192.168.1.50/callback
```

Trong Keycloak client `spa-client`, thêm redirect URI/web origin tương ứng IP VM.

### 7.5. Chạy project

Trong thư mục project trên Ubuntu VM:

```bash
docker compose up -d --build
docker compose ps
```

Xem log:

```bash
docker compose logs -f frontend
docker compose logs -f kong
docker compose logs -f keycloak
docker compose logs -f backend
```

### 7.6. Kiểm chứng mức 1

Kiểm tra TLS 1.3:

```bash
openssl s_client -connect 192.168.1.50:443 -tls1_3
```

Kiểm tra HTTPS frontend:

```bash
curl -vk https://192.168.1.50
```

Kiểm tra API qua Kong:

```bash
curl -vk https://192.168.1.50:8443/health
```

Nếu Kong bật mTLS, thiếu client cert phải bị chặn:

```bash
curl -vk https://192.168.1.50:8443/health
```

Gửi đúng client cert:

```bash
curl -vk \
  --cacert certs/ca.crt \
  --cert certs/client.crt \
  --key certs/client.key \
  https://192.168.1.50:8443/health
```

Kiểm tra service nội bộ không truy cập được từ client:

```bash
curl http://192.168.1.50:9000/health
curl http://192.168.1.50:8181
curl http://192.168.1.50:8200
curl http://192.168.1.50:6380
curl http://192.168.1.50:5434
```

Kỳ vọng:

```text
Connection refused hoặc timeout
```

Kiểm tra JWT/DPoP:

- Request thiếu JWT bị chặn.
- Token `alg=none` bị chặn.
- Token sai chữ ký bị chặn.
- Request thiếu DPoP bị chặn.
- Replay cùng DPoP proof bị chặn.

Project của bạn đã có script security testing. Khi chạy trên VM, đổi API URL sang IP VM.

## 8. Mức 2: Tailscale + domain thật + ZeroSSL

### 8.1. Khi nào làm mức 2?

Chỉ làm mức 2 sau khi mức 1 đã ổn:

- Docker Compose chạy ổn.
- Frontend/API/Keycloak login được.
- TLS/mTLS test được.
- JWT/DPoP test được.
- Service nội bộ không expose trực tiếp.

### 8.2. Mục tiêu mức 2

Mức 2 giúp bạn của bạn truy cập bằng domain thật mà không cần cùng mạng LAN:

```text
https://app.apisec.shop
https://api.apisec.shop
https://auth.apisec.shop
```

Nhưng server vẫn nằm trên Ubuntu VM của bạn. Tailscale tạo mạng riêng để bạn của bạn route tới VM.

### 8.3. Nên mua domain ở đâu?

Vì chỉ demo, nên ưu tiên domain rẻ:

| Nhà cung cấp | Có nên dùng không? | Ghi chú |
| --- | --- | --- |
| Hostinger | Có | Dễ mua ở Việt Nam, phù hợp nếu bạn đang xem Hostinger |
| Porkbun | Có | Dev-friendly, giá minh bạch |
| Namecheap | Có | Dễ mua, nhiều khuyến mãi |
| Cloudflare Registrar | Có, nhưng không cần thiết | Hợp nếu mua `.com` lâu dài |
| GoDaddy | Không ưu tiên | Hay upsell |

Nếu chỉ demo, có thể mua:

```text
apisec.shop
apisec.store
apisec.xyz
cloudapisec.xyz
```

Không cần mua hosting. Chỉ mua domain.

### 8.4. Cần bao nhiêu domain?

Chỉ cần 1 domain chính và 3 subdomain:

```text
app.apisec.shop   -> Frontend
api.apisec.shop   -> Kong API
auth.apisec.shop  -> Keycloak
```

Không cần mua 3 domain khác nhau.

### 8.5. Xin ZeroSSL certificate

ZeroSSL không phù hợp để ký trực tiếp cho IP private như:

```text
192.168.x.x
10.x.x.x
172.16.x.x
```

Cách đúng:

```text
ZeroSSL ký cho domain thật.
Tailscale/hosts giúp domain trỏ về IP Tailscale của VM.
Client truy cập bằng domain.
```

Tạo certificate cho 3 subdomain:

```text
app.apisec.shop
api.apisec.shop
auth.apisec.shop
```

Nên chọn:

```text
DNS CNAME validation
```

Vì server VM không public ra Internet, HTTP validation có thể không hoạt động.

Quy trình:

1. Vào ZeroSSL.
2. Tạo certificate mới.
3. Nhập 3 subdomain.
4. Chọn DNS CNAME validation.
5. ZeroSSL đưa CNAME record.
6. Vào DNS zone của domain, tạo CNAME theo ZeroSSL.
7. Chờ DNS propagate.
8. Bấm Verify.
9. Tải certificate.

Nếu tải về có:

```text
certificate.crt
ca_bundle.crt
private.key
```

Tạo fullchain:

```bash
cat certificate.crt ca_bundle.crt > fullchain.crt
```

Copy vào project:

```bash
mkdir -p ~/Cloud_Api_Security/certs-prod
cp fullchain.crt ~/Cloud_Api_Security/certs-prod/apisec.fullchain.crt
cp private.key ~/Cloud_Api_Security/certs-prod/apisec.key
chmod 600 ~/Cloud_Api_Security/certs-prod/apisec.key
```

### 8.6. Cài Tailscale trên Ubuntu VM

Trong Ubuntu VM:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
tailscale ip -4
```

Ví dụ Tailscale IP:

```text
100.72.10.25
```

### 8.7. Máy bạn của bạn cần gì?

Bạn của bạn **không cần repo**, không cần source code, không cần Docker.

Bạn của bạn cần:

| Thành phần | Có cần không? | Mục đích |
| --- | --- | --- |
| Tailscale client | Cần | Kết nối private network |
| hosts mapping | Cần nếu không dùng DNS nội bộ | Trỏ domain về IP Tailscale |
| Browser | Cần | Truy cập website |
| `client.p12` | Cần nếu browser/API bị Kong yêu cầu mTLS |
| Repo project | Không cần | Repo chỉ nằm trên server |

Trên máy bạn của bạn, thêm vào file hosts:

```text
100.72.10.25 app.apisec.shop
100.72.10.25 api.apisec.shop
100.72.10.25 auth.apisec.shop
```

Sau đó mở:

```text
https://app.apisec.shop
```

### 8.8. mTLS trong browser

Project hiện tại Kong yêu cầu client certificate. Nếu browser của bạn của bạn gọi API:

```text
https://api.apisec.shop:8443
```

thì browser có thể cần client certificate.

Khi đó bạn của bạn cần import:

```text
certs/client.p12
```

Nếu không muốn người xem phải import cert, có thể tách demo:

```text
Frontend web: HTTPS thường
API mTLS: demo bằng curl/Postman với client cert
```

Nếu giữ mTLS cho toàn bộ API, hãy ghi rõ:

```text
Client truy cập API phải có client certificate hợp lệ. Với browser, certificate được import dạng PKCS#12; với curl/Postman, dùng client.crt/client.key.
```

### 8.9. Chỉnh project cho mức 2

Frontend env:

```env
VITE_KEYCLOAK_URL=https://auth.apisec.shop
VITE_KONG_URL=https://api.apisec.shop
VITE_REALM=cloudapi
VITE_CLIENT_ID=spa-client
```

Keycloak redirect URI:

```text
https://app.apisec.shop/*
```

Keycloak web origin:

```text
https://app.apisec.shop
```

Kong CORS:

```yaml
origins:
  - "https://app.apisec.shop"
```

Backend issuer phải khớp issuer trong token:

```text
https://auth.apisec.shop/realms/cloudapi
```

### 8.10. Đổi IP domain có cần xin lại cert không?

Không, nếu certificate cấp cho domain.

Ví dụ cert cấp cho:

```text
app.apisec.shop
api.apisec.shop
auth.apisec.shop
```

Bạn đổi IP từ:

```text
100.72.10.25
```

sang:

```text
100.80.33.44
```

thì chỉ cần sửa hosts hoặc DNS mapping. Không cần xin lại cert.

Chỉ cần xin lại cert khi:

- Đổi domain.
- Thêm subdomain mới.
- Cert hết hạn.
- Private key bị lộ.

## 9. Kiểm chứng bảo mật sau triển khai

### 9.1. Kiểm chứng HTTPS/TLS 1.3

Mức 1:

```bash
openssl s_client -connect 192.168.1.50:443 -tls1_3
```

Mức 2:

```bash
openssl s_client -connect app.apisec.shop:443 -servername app.apisec.shop -tls1_3
```

Kỳ vọng:

```text
TLSv1.3
```

### 9.2. Kiểm chứng HTTP redirect sang HTTPS

```bash
curl -I http://app.apisec.shop
```

Kỳ vọng:

```text
301 hoặc 308
Location: https://app.apisec.shop/...
```

### 9.3. Kiểm chứng mTLS

Không gửi client cert:

```bash
curl -vk https://api.apisec.shop:8443/health
```

Kỳ vọng bị chặn.

Gửi đúng client cert:

```bash
curl -vk \
  --cacert certs/ca.crt \
  --cert certs/client.crt \
  --key certs/client.key \
  https://api.apisec.shop:8443/health
```

Kỳ vọng:

```text
HTTP 200
{"status":"ok"}
```

### 9.4. Kiểm chứng service nội bộ không public

Từ client:

```bash
curl http://192.168.1.50:9000/health
curl http://192.168.1.50:8181
curl http://192.168.1.50:8200
curl http://192.168.1.50:6380
curl http://192.168.1.50:5434
```

Kỳ vọng:

```text
Connection refused hoặc timeout
```

### 9.5. Kiểm chứng JWT/DPoP

Cần chứng minh:

- Thiếu Authorization bị chặn.
- Token `alg=none` bị chặn.
- Token sai chữ ký bị chặn.
- Token hết hạn bị chặn.
- Thiếu DPoP bị chặn.
- DPoP sai `htu`, `htm`, `ath` bị chặn.
- Replay cùng DPoP proof bị chặn.

Project của bạn đã có script cho một số kịch bản này. Khi chạy trên VM, đổi biến môi trường:

```bash
export API_URL=https://api.apisec.shop:8443/api/v1/products
export KEYCLOAK_AUTH_URL=https://auth.apisec.shop/realms/cloudapi/protocol/openid-connect/auth
export KEYCLOAK_TOKEN_URL=https://auth.apisec.shop/realms/cloudapi/protocol/openid-connect/token
```

## 10. Cách này đã đáp ứng bảo mật chưa?

### 10.1. Mức 1 đáp ứng gì?

Mức 1 đáp ứng tốt cho demo nội bộ:

- Không còn chỉ là `localhost`.
- Có client/server tách biệt trong LAN.
- Có HTTPS/TLS.
- Có thể ép TLS 1.3.
- Có mTLS.
- Có JWT/DPoP/OPA/Redis/Vault.
- Có phân vùng logic.
- Có thể chứng minh service nội bộ không public.

Mức 1 chưa có:

- Domain thật.
- Public CA certificate.
- Client ngoài LAN truy cập.

### 10.2. Mức 2 đáp ứng gì?

Mức 2 đáp ứng tốt hơn cho demo:

- Có domain thật.
- Có ZeroSSL certificate.
- Có Tailscale để bạn của bạn truy cập ngoài LAN.
- Có HTTPS/TLS 1.3.
- Có thể giữ mTLS.
- Có JWT ES256.
- Có DPoP.
- Có replay protection.
- Không cần VPS/public IP.

### 10.3. Vẫn chưa phải production vì sao?

Vì:

- Server vẫn ở Ubuntu VM cá nhân.
- Tailscale là private overlay network, không phải public Internet deployment.
- Chưa có Firewall HA thật.
- Chưa có Load Balancer thật.
- Chưa có WAF Cluster thật.
- Keycloak/Vault nếu vẫn dev mode thì chưa production-ready.
- Kong upstream `tls_verify: false` vẫn cần sửa.
- Nếu client phải sửa hosts thủ công thì đây là demo/lab.

Cách viết trong báo cáo:

```text
Mô hình mức 2 đáp ứng mục tiêu chứng minh giao thức an toàn trong lab/demo: HTTPS/TLS 1.3, mTLS, OIDC/PKCE, JWT ES256, DPoP, Redis replay protection, OPA authorization và Vault Transit. Tuy nhiên, mô hình này chưa phải production public deployment vì hạ tầng HA, WAF, LB, subnet vật lý và hardening production vẫn là hướng hoàn thiện.
```

## 11. Hoàn thiện bảo mật: cần sửa chỗ nào trong project?

Phần này liệt kê các điểm nên sửa để giảm rủi ro khi triển khai theo hướng dẫn. Chia thành 3 nhóm:

```text
Nhóm A: Nên sửa ngay khi deploy lên Ubuntu VM
Nhóm B: Nên sửa sau khi mức 1 chạy ổn
Nhóm C: Hướng hoàn thiện gần production
```

## 11A. Nhóm A: Nên sửa ngay khi deploy lên Ubuntu VM

### 11A.1. Không expose service nội bộ ra ngoài

File cần sửa:

```text
docker-compose.yml
```

Hiện tại một số service nội bộ vẫn publish port ra host để tiện dev:

```text
PostgreSQL: 5434
Redis:      6380
Vault:      8200
OPA:        8181
Backend:    9000
Kong Admin: 8001
```

Khi deploy demo trên Ubuntu VM, nên bỏ hoặc comment các `ports` này.

Sửa phần PostgreSQL:

```yaml
postgres:
  image: postgres:16
  container_name: api-postgres
  restart: unless-stopped
  env_file: .env
  # ports:
  #   - "${POSTGRES_PORT:-5434}:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
  networks:
    - data-net
```

Sửa phần Redis:

```yaml
redis:
  image: redis:7
  container_name: api-redis
  restart: unless-stopped
  # ports:
  #   - "${REDIS_PORT:-6380}:6379"
  networks:
    - app-net
```

Sửa phần Vault:

```yaml
vault:
  image: hashicorp/vault:1.15
  container_name: vault
  restart: unless-stopped
  cap_add:
    - IPC_LOCK
  # ports:
  #   - "8200:8200"
  environment:
    VAULT_DEV_ROOT_TOKEN_ID: ${VAULT_TOKEN}
    VAULT_DEV_LISTEN_ADDRESS: "0.0.0.0:8200"
  networks:
    - data-net
```

Sửa phần OPA:

```yaml
opa:
  image: openpolicyagent/opa:0.65.0
  container_name: opa
  restart: unless-stopped
  # ports:
  #   - "8181:8181"
  networks:
    - app-net
```

Sửa phần Backend:

```yaml
backend:
  build:
    context: ./backend
  container_name: api-backend
  restart: unless-stopped
  # ports:
  #   - "9000:9000"
  networks:
    - app-net
    - data-net
```

Sửa phần Kong, chỉ giữ proxy public, bỏ Admin API public:

```yaml
kong:
  ports:
    - "8443:8443"
    # - "8001:8001"
```

Rủi ro được giảm:

- Client không thể gọi thẳng backend để bypass Kong.
- Client không thể truy cập trực tiếp DB/Redis/Vault/OPA.
- Kong Admin API không bị lộ.

Kiểm chứng:

```bash
curl http://<IP-VM>:9000/health
curl http://<IP-VM>:8181
curl http://<IP-VM>:8200
curl http://<IP-VM>:6380
curl http://<IP-VM>:5434
curl http://<IP-VM>:8001
```

Kỳ vọng:

```text
Connection refused hoặc timeout
```

### 11A.2. Tách Docker network thành Edge/App/Data

File cần sửa:

```text
docker-compose.yml
```

Thay network hiện tại:

```yaml
networks:
  edge-net:
  internal-net:
  obs-net:
```

bằng:

```yaml
networks:
  edge-net:
  app-net:
  data-net:
  obs-net:
```

Gán service theo vùng:

```yaml
frontend:
  networks:
    - edge-net

kong:
  networks:
    - edge-net
    - app-net

keycloak:
  networks:
    - edge-net
    - app-net

backend:
  networks:
    - app-net
    - data-net

opa:
  networks:
    - app-net

redis:
  networks:
    - app-net

postgres:
  networks:
    - data-net

vault:
  networks:
    - data-net

vault-init:
  networks:
    - data-net
```

Lưu ý: nếu backend cần gọi Redis bằng hostname `redis`, Redis và backend phải cùng network. Nếu backend cần gọi Vault/PostgreSQL, backend phải nằm trong `data-net`.

Rủi ro được giảm:

- Mô phỏng rõ hơn vùng DMZ/Edge, Application/Private, Data/Security.
- Service ở edge không tự nhiên truy cập được data service nếu không được nối network.

### 11A.3. Giới hạn CORS ở backend

File cần sửa:

```text
backend/app/main.py
```

Hiện tại:

```python
allow_origins=["*"]
```

Không nên dùng wildcard khi demo bảo mật. Sửa theo mức triển khai.

Mức 1, dùng IP private:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://192.168.1.50",
        "https://192.168.1.50:5174",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "DPoP", "Content-Type", "X-TOTP-Code"],
)
```

Mức 2, dùng domain:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://app.apisec.shop",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "DPoP", "Content-Type", "X-TOTP-Code"],
)
```

Tốt hơn là dùng biến môi trường:

```python
allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "https://app.apisec.shop").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "DPoP", "Content-Type", "X-TOTP-Code"],
)
```

Trong `.env`:

```env
CORS_ORIGINS=https://app.apisec.shop
```

Rủi ro được giảm:

- Website lạ không dễ gọi API bằng browser context.
- CORS không còn quá rộng.

### 11A.4. Giới hạn CORS ở Kong

File cần sửa:

```text
gateway/kong.yml
```

Hiện tại:

```yaml
origins:
  - "https://localhost:5174"
  - "http://localhost:5173"
```

Mức 1:

```yaml
origins:
  - "https://192.168.1.50"
  - "https://192.168.1.50:5174"
```

Mức 2:

```yaml
origins:
  - "https://app.apisec.shop"
```

Nên giữ headers rõ ràng:

```yaml
headers:
  - Authorization
  - DPoP
  - Content-Type
  - X-TOTP-Code
```

Rủi ro được giảm:

- Gateway không chấp nhận browser origin không mong muốn.

### 11A.5. Tắt hoặc bảo vệ docs/openapi public

File cần sửa:

```text
backend/app/main.py
backend/app/middleware/auth_middleware.py
```

Hiện `AuthMiddleware` đang public:

```python
'/docs',
'/openapi.json',
```

Nếu không cần demo Swagger UI, nên tắt docs ở FastAPI:

```python
app = FastAPI(
    title="Cloud API Security Backend",
    version="1.0.0",
    redirect_slashes=False,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
```

Và bỏ `/docs`, `/openapi.json` khỏi `public_paths`.

Nếu vẫn cần docs khi dev, dùng env:

```python
ENABLE_DOCS = os.getenv("ENABLE_DOCS", "false").lower() == "true"

app = FastAPI(
    title="Cloud API Security Backend",
    version="1.0.0",
    redirect_slashes=False,
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url="/redoc" if ENABLE_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_DOCS else None,
)
```

Rủi ro được giảm:

- Giảm lộ surface API cho người không có quyền.

## 11B. Nhóm B: Nên sửa sau khi mức 1 chạy ổn

### 11B.1. Bật verify TLS từ Kong đến backend

File cần sửa:

```text
gateway/kong.yml
docker-compose.yml
certs
```

Hiện tại:

```yaml
services:
  - name: backend-service
    url: https://api-backend:9000
    tls_verify: false
```

Hướng hoàn thiện:

```yaml
services:
  - name: backend-service
    url: https://api-backend:9000
    tls_verify: true
    ca_certificates:
      - backend-ca

ca_certificates:
  - id: backend-ca
    cert: |
      -----BEGIN CERTIFICATE-----
      ...
      -----END CERTIFICATE-----
```

Lưu ý quan trọng:

- Cert backend phải có SAN khớp hostname Kong gọi: `api-backend`.
- CA ký backend cert phải được Kong tin.
- Nếu cert hiện tại không có SAN `api-backend`, cần tạo lại cert.

Kiểm tra cert:

```bash
openssl x509 -in certs/backend.crt -text -noout
```

Tìm:

```text
X509v3 Subject Alternative Name
DNS:api-backend
```

Rủi ro được giảm:

- Kong không chỉ mã hóa tới backend mà còn xác thực đúng backend.
- Giảm rủi ro MITM nội bộ.

Nếu chưa kịp làm, ghi trong báo cáo:

```text
Ở bản lab, upstream TLS đã mã hóa nhưng chưa bật certificate verification tại Kong. Hướng hoàn thiện là import CA backend vào Kong và bật tls_verify=true.
```

### 11B.2. Thêm JWT/OIDC verification ở Kong trước OPA

File liên quan:

```text
gateway/kong.yml
gateway/plugins/opa-authz/handler.lua
```

Hiện tại:

- Kong plugin `jwt-hardening` chỉ kiểm tra `alg`, `kid`, JWKS kid.
- `opa-authz` tự decode payload JWT để lấy role.
- Backend mới verify JWT đầy đủ.

Rủi ro:

```text
OPA tại gateway có thể nhận role từ payload chưa verify.
```

Có 3 hướng:

### Hướng 1: Chấp nhận ở lab, backend là chốt verify thật

Cách này ít sửa nhất. Trong báo cáo ghi:

```text
Gateway thực hiện JWT hardening và policy check sơ bộ; backend là điểm verify JWT/DPoP bắt buộc trước khi xử lý nghiệp vụ. Hướng hoàn thiện là bổ sung JWT/OIDC verification đầy đủ tại Kong trước OPA.
```

### Hướng 2: Thêm OIDC/JWT verify plugin ở Kong

Kong OSS không có sẵn đầy đủ OIDC plugin như Kong Enterprise, nhưng có thể dùng plugin cộng đồng hoặc tự viết plugin verify JWT. Nếu dùng plugin cộng đồng, cần kiểm tra tương thích Kong 3.6.

Luồng mong muốn:

```text
Kong verify JWT signature/issuer/audience
-> Kong lấy claims đã verify
-> Kong gọi OPA
-> Backend verify lại JWT/DPoP
```

### Hướng 3: Sửa `opa-authz` để không tin role nếu token chưa verify

Nếu chưa có plugin verify JWT tại Kong, `opa-authz` không nên là chốt bảo vệ cuối cùng. Có thể giảm rủi ro bằng cách:

- Cho OPA chỉ làm coarse-grained policy.
- Backend vẫn enforce fine-grained policy.
- Không đưa endpoint nhạy cảm chỉ dựa vào OPA.

Rủi ro được giảm khi hoàn thiện:

- Tránh authorization decision dựa trên token payload giả.

### 11B.3. Chuyển token frontend từ localStorage sang sessionStorage

File cần sửa:

```text
frontend/src/auth/AuthProvider.jsx
```

Hiện token được lưu vào `localStorage`, tồn tại lâu sau khi tắt tab/browser. DPoP giảm replay nhưng không loại bỏ XSS.

Mức sửa nhẹ cho demo:

- Không dùng `localStorage`.
- Chỉ dùng `sessionStorage`.

Ý tưởng:

```javascript
sessionStorage.setItem(
  AUTH_STORAGE_KEY,
  JSON.stringify({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
  })
)
```

Và khi clear:

```javascript
sessionStorage.removeItem(AUTH_STORAGE_KEY)
localStorage.removeItem(AUTH_STORAGE_KEY)
```

Khi đọc:

```javascript
const raw = sessionStorage.getItem(AUTH_STORAGE_KEY)
```

Rủi ro được giảm:

- Token không còn tồn tại dai dẳng trong `localStorage`.
- Giảm tác động sau khi đóng phiên browser.

Hướng tốt hơn nhưng thay đổi lớn:

```text
BFF pattern hoặc httpOnly Secure SameSite cookie.
```

### 11B.4. Backend tự enforce authorization ở endpoint nhạy cảm

File nên rà:

```text
backend/app/api/v1/users.py
backend/app/api/v1/orders.py
backend/app/api/v1/products.py
```

Ví dụ `orders.py` có BOLA guard cho đọc order, nhưng delete order hiện dựa nhiều vào gateway/OPA. Nếu backend bị gọi thẳng trong dev hoặc cấu hình sai, rủi ro tăng.

Nguyên tắc:

```text
Gateway/OPA là lớp chặn ngoài.
Backend vẫn phải tự kiểm tra quyền ở endpoint nhạy cảm.
```

Ví dụ delete order nên nhận `Request` và kiểm tra role:

```python
@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, request: Request, db: Session = Depends(get_db)):
    token_payload = getattr(request.state, "user", None)
    roles = roles_from_payload(token_payload)
    if "admin" not in roles:
        raise HTTPException(status_code=403, detail="Admin only")

    db_order = db.query(Order).filter(Order.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(db_order)
    db.commit()
    return None
```

Rủi ro được giảm:

- Nếu gateway cấu hình sai, backend vẫn có lớp bảo vệ.

## 11C. Nhóm C: Hướng hoàn thiện gần production

### 11C.1. Keycloak không dùng `start-dev`

File liên quan:

```text
docker-compose.yml
idp/keycloak/realm-export.json
.env
```

Hiện tại:

```yaml
command: start-dev --features=dpop --import-realm
```

Mức lab: chấp nhận nếu ghi rõ.

Hướng production:

```text
kc.sh start
hostname đúng: auth.<domain>
proxy headers đúng
TLS/HTTPS đúng
database riêng cho Keycloak nếu cần
không dùng demo password
```

Nếu chưa làm, báo cáo nên ghi:

```text
Keycloak trong demo dùng start-dev để giảm chi phí vận hành; hướng production là chuyển sang start mode với hostname, TLS và secret management đầy đủ.
```

### 11C.2. Vault không dùng dev mode/root token

File liên quan:

```text
docker-compose.yml
vault/init/*
vault/policies/*
```

Hiện tại Vault dev mode:

```yaml
VAULT_DEV_ROOT_TOKEN_ID: ${VAULT_TOKEN}
```

Mức lab: chấp nhận nếu ghi rõ.

Hướng production:

- Vault server mode.
- Storage persist.
- Unseal/auto-unseal.
- Backend không dùng root token.
- Dùng AppRole/JWT/Kubernetes auth.
- Policy tối thiểu quyền.
- Audit log.
- Key rotation.

Rủi ro được giảm:

- Root token không nằm trong app env.
- Vault data không mất khi restart.
- Có audit và least privilege.

### 11C.3. Thêm WAF lớp trước Kong

Hiện project chưa có WAF thật. Có thể thêm một trong các hướng:

```text
Nginx + ModSecurity + OWASP CRS
Cloudflare WAF nếu public/tunnel phù hợp
Traefik/Nginx rule cơ bản
```

Mô hình:

```text
User
-> WAF/Nginx
-> Kong
-> Backend
```

Với một Ubuntu VM, WAF vẫn là một node, không phải WAF Cluster thật.

Rủi ro được giảm:

- Một phần request injection/scanning phổ biến.
- Bổ sung đúng yêu cầu đề tài về WAF.

### 11C.4. CI/CD, SCA, SBOM, artifact signing

Đề tài có nhắc supply chain. Nếu có thời gian, bổ sung:

```text
SAST: Bandit/ESLint
SCA: npm audit/pip-audit/Trivy
Container scan: Trivy
SBOM: Syft
Artifact signing: cosign
```

Mức tối thiểu cho báo cáo:

- Chạy SAST/DAST đã có.
- Ghi rõ SCA/SBOM/artifact signing là hướng mở rộng.

### 11C.5. Logging/alerting rõ hơn

Project có Loki/Grafana/Prometheus. Nên thêm rule/metric cho:

- Nhiều 401/403 trong thời gian ngắn.
- DPoP replay bị chặn.
- Token invalid nhiều lần.
- OPA deny spike.
- SSRF blocked.
- Vault decrypt failures.

Rủi ro được giảm:

- Tăng khả năng phát hiện tấn công.

## 11D. Thứ tự sửa khuyến nghị

Thứ tự thực tế nên làm:

```text
1. Bỏ expose port nội bộ trong docker-compose.yml
2. Bỏ Kong Admin API public
3. Tách Docker networks thành edge/app/data
4. Giới hạn CORS backend
5. Giới hạn CORS Kong
6. Tắt docs/openapi public hoặc dùng env
7. Chuyển token frontend từ localStorage sang sessionStorage
8. Backend tự enforce role ở endpoint nhạy cảm
9. Bật TLS verify Kong -> Backend
10. Bổ sung JWT/OIDC verification đầy đủ tại Kong trước OPA
11. Hardening Keycloak/Vault production mode
12. Thêm WAF, SCA/SBOM, alerting nâng cao
```

Trong demo đồ án, chỉ cần hoàn thành bước 1 đến 8 là project đã mạnh hơn rõ rệt và dễ chứng minh.

## 11E. Câu mô tả sau khi đã sửa nhóm A/B

Có thể viết trong báo cáo:

```text
Sau khi hardening, hệ thống chỉ expose các thành phần edge cần thiết, bao gồm Frontend và Kong Gateway. Các service nội bộ như Backend, OPA, Redis, Vault và PostgreSQL không publish port ra client mà chỉ giao tiếp qua Docker networks tách lớp. CORS được giới hạn theo frontend origin, Kong Admin API không public, backend docs có thể tắt trong demo bảo mật, frontend giảm lưu token dài hạn, và backend tự kiểm tra quyền ở các endpoint nhạy cảm. Hệ thống tiếp tục sử dụng HTTPS/TLS 1.3, mTLS tại Kong, JWT ES256 do Keycloak ký, DPoP proof do client ký, Redis replay protection, OPA policy và Vault Transit.
```

## 12. Các phần còn thiếu có thể triển khai thêm miễn phí

Nếu muốn project khớp đề tài hơn nhưng vẫn không mất phí, bạn có thể bổ sung các hạng mục sau. Tất cả đều làm được trên một Ubuntu VM hoặc trong repo hiện tại.

## 12A. Thêm WAF miễn phí bằng Nginx + ModSecurity + OWASP CRS

Mục tiêu:

```text
User -> Nginx/ModSecurity WAF -> Kong -> Backend
```

Lợi ích:

- Bổ sung đúng yêu cầu WAF trong đề tài.
- Chặn một phần request injection/scanning phổ biến.
- Có bằng chứng WAF log khi request bị block.

Cách làm miễn phí:

- Dùng container Nginx có ModSecurity.
- Gắn OWASP Core Rule Set.
- Reverse proxy từ WAF sang Kong.

Docker Compose có thể thêm service:

```yaml
waf:
  image: owasp/modsecurity-crs:nginx
  container_name: api-waf
  restart: unless-stopped
  ports:
    - "443:443"
  volumes:
    - ./waf/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - ./certs-prod:/certs-prod:ro
  networks:
    - edge-net
  depends_on:
    - kong
```

Ví dụ Nginx WAF reverse proxy tới Kong:

```nginx
server {
    listen 443 ssl http2;
    server_name api.apisec.shop;

    ssl_certificate     /certs-prod/apisec.fullchain.crt;
    ssl_certificate_key /certs-prod/apisec.key;
    ssl_protocols TLSv1.3;

    location / {
        proxy_pass https://api-gateway:8443;
        proxy_ssl_verify off;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Lưu ý:

- Nếu Kong vẫn yêu cầu mTLS trực tiếp từ client, WAF đứng trước Kong sẽ làm luồng phức tạp hơn.
- Để demo dễ hơn, có thể giữ Kong public `8443` cho mTLS test riêng, còn WAF public `443` cho test WAF.

Kiểm chứng:

```bash
curl -vk "https://api.apisec.shop/?q=<script>alert(1)</script>"
```

Kỳ vọng:

```text
403 hoặc log WAF ghi nhận request bị rule CRS chặn
```

Trong báo cáo:

```text
WAF được triển khai một node bằng Nginx + ModSecurity + OWASP CRS trên Ubuntu VM. Đây là mô phỏng WAF Cluster trong kiến trúc mục tiêu.
```

## 12B. Thêm Edge Load Balancer một node bằng Nginx hoặc HAProxy

Nếu chưa muốn triển khai WAF phức tạp, bạn có thể thêm Nginx/HAProxy làm reverse proxy một node:

```text
User -> Nginx/HAProxy -> Frontend/Kong/Keycloak
```

Lợi ích:

- Mô phỏng Edge Load Balancer.
- Gom port về 443.
- Route theo hostname:

```text
app.apisec.shop  -> frontend
api.apisec.shop  -> kong
auth.apisec.shop -> keycloak
```

Trong báo cáo nên ghi:

```text
Edge Load Balancer được mô phỏng bằng Nginx một node. Bản production cần nhiều node/managed LB để đạt HA.
```

## 12C. Thêm SCA/SBOM miễn phí

Đề tài có nhắc supply chain. Bạn có thể bổ sung bằng công cụ miễn phí:

| Mục tiêu | Công cụ miễn phí |
| --- | --- |
| Quét Python dependency | `pip-audit` |
| Quét npm dependency | `npm audit` |
| Quét container/dependency | `trivy` |
| Tạo SBOM | `syft` |

Chạy scan cơ bản:

```bash
trivy fs .

cd backend
pip install pip-audit
pip-audit -r requirements.txt

cd ../frontend
npm audit
```

Tạo SBOM bằng Syft:

```bash
syft . -o cyclonedx-json > sbom.cyclonedx.json
```

Bằng chứng nộp:

```text
EVIDENCE/security_scans/trivy_report.txt
EVIDENCE/security_scans/pip_audit_report.txt
EVIDENCE/security_scans/npm_audit_report.txt
EVIDENCE/security_scans/sbom.cyclonedx.json
```

## 12D. Thêm CI/CD security check miễn phí bằng GitHub Actions

Nếu repo dùng GitHub, bạn có thể thêm pipeline miễn phí.

File:

```text
.github/workflows/security.yml
```

Ví dụ:

```yaml
name: security-checks

on:
  push:
  pull_request:

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Python setup
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Backend dependencies
        run: |
          pip install -r backend/requirements.txt
          pip install bandit pip-audit

      - name: Bandit SAST
        run: bandit -r backend/app -f json -o bandit_report.json || true

      - name: pip-audit
        run: pip-audit -r backend/requirements.txt || true

      - name: Frontend audit
        working-directory: frontend
        run: npm ci && npm audit || true
```

Trong báo cáo:

```text
CI/CD security checks được mô phỏng bằng GitHub Actions gồm SAST, dependency audit và frontend npm audit.
```

## 12E. Thêm alert rules miễn phí cho logging/detection

Project đã có Loki/Grafana/Prometheus. Có thể thêm rule phát hiện:

- Nhiều `401` trong 5 phút.
- Nhiều `403` từ OPA.
- DPoP replay.
- SSRF blocked.
- Vault decrypt failure.

Ví dụ rule ý tưởng cho Loki:

```yaml
groups:
  - name: api-security-alerts
    rules:
      - alert: ManyAuthFailures
        expr: sum(count_over_time({container="api-gateway"} |= "401" [5m])) > 20
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Many authentication failures detected"

      - alert: DPoPReplayDetected
        expr: sum(count_over_time({container="api-backend"} |= "DPoP proof replayed" [5m])) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "DPoP replay attempt detected"
```

Bằng chứng:

```text
Screenshot Grafana alert/rule
Log có replay/401/403
```

## 12F. Thêm correlation ID miễn phí

Mục tiêu:

```text
Mỗi request có X-Request-ID để trace từ Kong -> Backend -> log.
```

Ở Kong có thể dùng plugin `correlation-id`:

```yaml
- name: correlation-id
  config:
    header_name: X-Request-ID
    generator: uuid
    echo_downstream: true
```

Trong backend logging middleware, log `X-Request-ID`.

Lợi ích:

- Đáp ứng phần logging/tracing nhẹ.
- Dễ chứng minh request đi qua gateway/backend.

## 12G. Thêm runbook miễn phí

Đề tài yêu cầu runbook. Bạn có thể tạo:

```text
RUNBOOK_INCIDENT_RESPONSE.md
RUNBOOK_KEY_ROTATION.md
RUNBOOK_TOKEN_LEAK.md
RUNBOOK_DPOP_REPLAY.md
```

Nội dung tối thiểu mỗi runbook:

```text
1. Dấu hiệu phát hiện
2. Cách xác minh
3. Cách cô lập
4. Cách khắc phục
5. Cách phục hồi
6. Bằng chứng/log cần lưu
7. Phòng ngừa tái diễn
```

## 12H. Thêm key rotation drill miễn phí

Project đã có Vault Transit. Có thể demo drill:

```text
1. Tạo DEK mới.
2. Wrap DEK mới bằng Vault Transit.
3. Cập nhật VAULT_WRAPPED_DEK.
4. Restart backend.
5. Chạy encrypt/decrypt test.
6. Ghi evidence.
```

Bằng chứng:

```text
EVIDENCE/key_rotation/rotation_log.txt
EVIDENCE/key_rotation/before_after_test.txt
```

Nếu chưa re-encrypt toàn bộ data, ghi rõ:

```text
Demo thực hiện rotation ở mức key wrapping/configuration. Re-encryption toàn bộ dữ liệu là hướng hoàn thiện.
```

## 12I. Thêm test Excessive Data Exposure miễn phí

Đề tài nhắc Excessive Data Exposure. Bạn có thể bổ sung test kiểm tra API không trả field nhạy cảm.

Ví dụ:

```text
GET /api/v1/users không được trả:
- password
- totp_secret
- raw token
- phone plaintext nếu đã encrypted
```

Tạo test:

```text
backend/tests/test_excessive_data_exposure.py
```

Ý tưởng:

```python
def test_users_response_does_not_expose_sensitive_fields(client, auth_headers):
    res = client.get("/api/v1/users", headers=auth_headers)
    assert res.status_code == 200
    raw = str(res.json()).lower()
    assert "password" not in raw
    assert "totp_secret" not in raw
    assert "secret" not in raw
```

## 12J. Các hạng mục miễn phí nên ưu tiên

Nếu thời gian ít, ưu tiên:

```text
1. Không expose service nội bộ
2. Tách Docker networks edge/app/data
3. Giới hạn CORS
4. Tắt docs public
5. Chuyển token localStorage -> sessionStorage
6. Backend enforce role ở endpoint nhạy cảm
7. Thêm correlation-id
8. Thêm Trivy/pip-audit/npm audit/SBOM
9. Thêm Loki/Grafana alert rules
10. Thêm runbook
11. Thêm ModSecurity WAF nếu còn thời gian
```

Những phần trên đều có thể làm không mất phí. Nếu hoàn thành, project sẽ khớp đề tài hơn nhiều dù vẫn là lab/demo.

## 13. Hướng dẫn chi tiết hardening API Gateway và thêm WAF

Phần này hướng dẫn cụ thể cách chỉnh Kong API Gateway và thêm WAF miễn phí. Nên làm phần này sau khi mức 1 đã chạy ổn.

## 13A. Hardening Kong API Gateway

Các file chính:

```text
docker-compose.yml
gateway/kong.yml
gateway/plugins/jwt-hardening/handler.lua
gateway/plugins/opa-authz/handler.lua
gateway/plugins/hsts-header/handler.lua
```

### 13A.1. Bỏ public Kong Admin API

File:

```text
docker-compose.yml
```

Hiện tại:

```yaml
kong:
  ports:
    - "8443:8443"
    - "8001:8001"
```

Sửa thành:

```yaml
kong:
  ports:
    - "8443:8443"
    # Admin API chỉ dùng nội bộ khi dev, không expose trên VM demo
    # - "8001:8001"
```

Kiểm chứng từ client:

```bash
curl http://<IP-VM>:8001
```

Kỳ vọng:

```text
Connection refused hoặc timeout
```

Rủi ro giảm:

- Người ngoài không thể gọi Kong Admin API để đọc/sửa cấu hình gateway.

### 13A.2. Giới hạn CORS ở Kong

File:

```text
gateway/kong.yml
```

Mức 1, dùng IP private:

```yaml
- name: cors
  config:
    origins:
      - "https://192.168.1.50"
      - "https://192.168.1.50:5174"
    methods:
      - GET
      - POST
      - PUT
      - DELETE
      - OPTIONS
    headers:
      - Authorization
      - DPoP
      - Content-Type
      - X-TOTP-Code
    credentials: true
```

Mức 2, dùng domain:

```yaml
- name: cors
  config:
    origins:
      - "https://app.apisec.shop"
    methods:
      - GET
      - POST
      - PUT
      - DELETE
      - OPTIONS
    headers:
      - Authorization
      - DPoP
      - Content-Type
      - X-TOTP-Code
    credentials: true
```

Kiểm chứng:

```bash
curl -k -I \
  -H "Origin: https://evil.example" \
  https://api.apisec.shop:8443/health
```

Kỳ vọng:

```text
Không có Access-Control-Allow-Origin: https://evil.example
```

Rủi ro giảm:

- Gateway không chấp nhận browser origin không mong muốn.

### 13A.3. Tăng security headers ở Kong

File:

```text
gateway/kong.yml
```

Hiện có:

```yaml
- name: response-transformer
  config:
    add:
      headers:
        - "X-Content-Type-Options:nosniff"
        - "X-Frame-Options:DENY"
```

Có thể bổ sung:

```yaml
- name: response-transformer
  config:
    add:
      headers:
        - "X-Content-Type-Options:nosniff"
        - "X-Frame-Options:DENY"
        - "Referrer-Policy:no-referrer"
        - "Permissions-Policy:geolocation=(), microphone=(), camera=()"
```

HSTS đã có plugin `hsts-header`.

Kiểm chứng:

```bash
curl -k -I https://api.apisec.shop:8443/health
```

Kỳ vọng thấy:

```text
Strict-Transport-Security
X-Content-Type-Options
X-Frame-Options
Referrer-Policy
Permissions-Policy
```

### 13A.4. Giữ hoặc chỉnh rate limit

File:

```text
gateway/kong.yml
```

Hiện:

```yaml
- name: rate-limiting
  config:
    minute: 100
    policy: local
```

Nếu demo abuse/rate limit, có thể giảm tạm:

```yaml
- name: rate-limiting
  config:
    minute: 20
    policy: local
```

Kiểm chứng nhanh:

```bash
for i in {1..30}; do curl -k -s -o /dev/null -w "%{http_code}\n" https://api.apisec.shop:8443/health; done
```

Kỳ vọng sau ngưỡng sẽ có:

```text
429
```

Lưu ý:

- `policy: local` phù hợp demo một node.
- Production nhiều Kong node cần policy dùng shared storage.

### 13A.5. Bật mTLS ở Kong

File:

```text
docker-compose.yml
```

Project hiện đã có:

```yaml
KONG_NGINX_PROXY_SSL_CLIENT_CERTIFICATE: /certs/ca.crt
KONG_NGINX_PROXY_SSL_VERIFY_CLIENT: "on"
KONG_NGINX_PROXY_SSL_VERIFY_DEPTH: "2"
```

Kiểm chứng thiếu cert:

```bash
curl -vk https://api.apisec.shop:8443/health
```

Kỳ vọng bị chặn.

Kiểm chứng có cert:

```bash
curl -vk \
  --cacert certs/ca.crt \
  --cert certs/client.crt \
  --key certs/client.key \
  https://api.apisec.shop:8443/health
```

Kỳ vọng:

```text
HTTP 200
```

### 13A.6. Bật TLS verify từ Kong đến backend

File:

```text
gateway/kong.yml
```

Hiện:

```yaml
tls_verify: false
```

Hướng hoàn thiện:

```yaml
tls_verify: true
```

Trước khi bật, cần đảm bảo:

- Backend cert được ký bởi CA mà Kong tin.
- Backend cert có SAN khớp hostname Kong gọi, ví dụ `api-backend`.
- CA cert được khai báo cho Kong.

Kiểm tra backend cert:

```bash
openssl x509 -in certs/backend.crt -text -noout
```

Cần thấy:

```text
DNS:api-backend
```

Mẫu ý tưởng trong Kong declarative config:

```yaml
ca_certificates:
  - id: backend-ca
    cert: |
      -----BEGIN CERTIFICATE-----
      ...
      -----END CERTIFICATE-----

services:
  - name: backend-service
    url: https://api-backend:9000
    tls_verify: true
    ca_certificates:
      - backend-ca
```

Nếu bật lên bị lỗi 502/SSL verify failed, quay lại `tls_verify: false` để demo, và ghi trong báo cáo:

```text
Upstream TLS hiện đã mã hóa nhưng certificate verification tại Kong là hướng hoàn thiện. Để bật verify cần import CA backend vào Kong và đảm bảo SAN của backend certificate khớp hostname nội bộ.
```

### 13A.7. Vấn đề JWT verify trước OPA

Hiện tại:

- `jwt-hardening` chặn `alg=none`, thiếu `kid`, unknown `kid`.
- `opa-authz` decode payload JWT để lấy role.
- Backend mới verify JWT đầy đủ.

Rủi ro:

```text
OPA ở gateway có thể nhận role từ payload chưa verify.
```

Mức làm được miễn phí trong demo:

1. Giữ backend verify JWT/DPoP là chốt bắt buộc.
2. Backend tự kiểm tra quyền ở endpoint nhạy cảm.
3. Ghi rõ hướng hoàn thiện là thêm JWT/OIDC verification đầy đủ tại Kong trước OPA.

Câu đưa vào báo cáo:

```text
Ở bản demo, Kong thực hiện JWT hardening và OPA policy check sơ bộ; backend vẫn verify JWT/DPoP bắt buộc trước khi xử lý nghiệp vụ. Do đó gateway không phải điểm tin cậy duy nhất. Hướng hoàn thiện là bổ sung JWT/OIDC verification đầy đủ tại Kong để OPA nhận claims đã được xác minh.
```

## 13B. Thêm WAF bằng Nginx + ModSecurity

Có 2 cách triển khai WAF trong demo.

### 13B.1. Cách dễ nhất: WAF demo riêng, Kong mTLS demo riêng

Mô hình:

```text
https://api.apisec.shop       -> WAF -> Kong
https://api.apisec.shop:8443  -> Kong mTLS trực tiếp
```

Ưu điểm:

- Dễ chứng minh WAF.
- Không làm hỏng luồng mTLS hiện tại.
- Không cần xử lý client cert qua WAF.

Nhược điểm:

- WAF và mTLS chưa nằm chung một endpoint duy nhất.
- Cần giải thích đây là demo tách lớp.

### 13B.2. Tạo thư mục WAF

Tạo:

```text
waf/
  nginx.conf
```

File `waf/nginx.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name api.apisec.shop;

    ssl_certificate     /certs-prod/apisec.fullchain.crt;
    ssl_certificate_key /certs-prod/apisec.key;
    ssl_protocols TLSv1.3;

    location / {
        proxy_pass https://api-gateway:8443;
        proxy_ssl_verify off;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Thêm service vào `docker-compose.yml`:

```yaml
waf:
  image: owasp/modsecurity-crs:nginx
  container_name: api-waf
  restart: unless-stopped
  ports:
    - "9443:443"
  volumes:
    - ./waf/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - ./certs-prod:/certs-prod:ro
  environment:
    PARANOIA: 1
    ANOMALY_INBOUND: 5
    ANOMALY_OUTBOUND: 4
  networks:
    - edge-net
  depends_on:
    - kong
```

Lưu ý:

- Nếu frontend đã dùng port 443, WAF demo có thể dùng `9443:443`.
- Nếu muốn WAF là cổng chính, cần thiết kế lại reverse proxy tổng cho `app/api/auth`.

### 13B.3. Kiểm chứng WAF

Test request bình thường:

```bash
curl -vk https://api.apisec.shop:9443/health
```

Test request đáng ngờ:

```bash
curl -vk "https://api.apisec.shop:9443/?q=<script>alert(1)</script>"
```

Xem log:

```bash
docker logs api-waf
```

Bằng chứng cần lưu:

```text
EVIDENCE/waf/waf_block_xss.txt
EVIDENCE/waf/waf_logs.txt
```

Câu đưa vào báo cáo:

```text
WAF được bổ sung bằng Nginx + ModSecurity + OWASP CRS ở mức một node để mô phỏng WAF Cluster. WAF phát hiện/chặn request có payload bất thường, trong khi Kong tiếp tục đảm nhiệm API Gateway, rate limiting, mTLS, JWT hardening và OPA authorization.
```

## 13C. Thứ tự làm API Gateway/WAF khuyến nghị

Nên làm theo thứ tự:

```text
1. Bỏ Kong Admin API public
2. Giới hạn CORS ở Kong
3. Bổ sung security headers
4. Giữ rate limiting và test 429
5. Test mTLS thiếu/có client cert
6. Sau đó mới thử bật tls_verify Kong -> Backend
7. Cuối cùng thêm WAF Nginx + ModSecurity một node
```

Nếu ít thời gian, chỉ cần làm bước 1 đến 5 là đã cải thiện API Gateway rõ rệt.

## 14. Quy trình thao tác chi tiết từng lệnh

Phần này là checklist thực hành theo thứ tự nên làm. Bạn có thể thay các giá trị mẫu sau theo môi trường thật:

```text
IP Ubuntu VM mức 1: 192.168.1.50
Domain mức 2: apisec.shop
Frontend domain: app.apisec.shop
API domain: api.apisec.shop
Auth domain: auth.apisec.shop
Tailscale IP ví dụ: 100.72.10.25
Project path trên Ubuntu: /home/<user>/Cloud_Api_Security
```

Ví dụ hiện tại của bạn:

```text
User Ubuntu: cloudapi
Hostname: cloudapi-server
IP Ubuntu VM: 192.168.1.27
Project path trên Ubuntu: /home/cloudapi/Cloud_Api_Security
```

## 14.0. Thứ tự thao tác đúng: sửa ở Windows trước, copy lên VM sau

Không nên copy nguyên project lên Ubuntu rồi chạy ngay bằng cấu hình `localhost`. Cách đó dễ làm sai vì:

- Frontend vẫn gọi `localhost`, khi máy khác truy cập thì `localhost` là máy của họ, không phải Ubuntu VM.
- CORS ở backend/Kong có thể sai origin.
- Các service nội bộ như PostgreSQL, Redis, OPA, Vault, backend có thể bị expose ra LAN.
- Cert TLS chưa khớp IP/domain.
- Keycloak redirect URI vẫn là localhost nên đăng nhập có thể lỗi.

Luồng nên làm:

```text
1. Cài xong Ubuntu VM và lấy IP.
2. Snapshot VM để có điểm quay lại.
3. Sửa/cấu hình project ở Windows trước.
4. Tạo file .env cho môi trường VM.
5. Tạo cert mức 1 cho IP private 192.168.1.27.
6. Tạo docker compose override để chỉ mở port cần thiết.
7. Copy project đã chuẩn bị lên Ubuntu VM.
8. Cài Docker trên Ubuntu VM.
9. Chạy docker compose trên Ubuntu VM.
10. Test từ Windows bằng IP VM.
11. Sau khi mức 1 ổn mới nâng lên Tailscale + domain + ZeroSSL.
```

### 14.0.1. Việc cần làm ngay sau khi Ubuntu cài xong

Trên Ubuntu VM, bạn đã bật SSH/UFW là đúng. Vì màn hình có báo:

```text
*** System restart required ***
```

nên nên reboot một lần trước khi cài Docker:

```bash
sudo reboot
```

Sau khi VM lên lại, từ Windows PowerShell SSH vào:

```powershell
ssh cloudapi@192.168.1.27
```

Nếu vào được thì kiểm tra IP:

```bash
hostname -I
```

Sau đó trong VMware nên tạo snapshot:

```text
VM > Snapshot > Take Snapshot
Name: Fresh Ubuntu 24.04 - SSH UFW OK
```

Snapshot giúp bạn quay lại trạng thái sạch nếu cấu hình Docker/cert bị lỗi.

### 14.0.2. Sửa project ở Windows hay trên Ubuntu?

Khuyến nghị:

```text
Sửa source/config ở Windows bằng VS Code/Codex -> copy sang Ubuntu -> chạy trên Ubuntu.
```

Lý do:

- Dễ chỉnh file.
- Dễ dùng Codex để sửa.
- Không bị gõ lệnh dài trong màn VMware.
- Ubuntu VM chỉ đóng vai trò server triển khai.

Chỉ nên sửa trực tiếp trên Ubuntu những file runtime như `.env`, cert, hoặc lệnh Docker nếu cần debug nhanh.

### 14.0.3. Các file cần chuẩn bị trước khi copy sang Ubuntu

Tối thiểu cần chuẩn bị/chỉnh các nhóm sau:

```text
.env
docker-compose.yml hoặc docker-compose.vm.yml
gateway/kong.yml
backend/app/main.py
frontend/.env hoặc biến build Vite trong .env
idp/keycloak/realm-export.json nếu redirect URI đang cố định localhost
certs/
```

Nếu muốn an toàn và dễ rollback, không sửa mạnh `docker-compose.yml` gốc. Tạo thêm file:

```text
docker-compose.vm.yml
```

Khi chạy trên Ubuntu dùng:

```bash
docker compose -f docker-compose.yml -f docker-compose.vm.yml up -d --build
```

File override này sẽ dùng để:

- Tắt expose port nội bộ.
- Chỉ public frontend/Kong.
- Đổi port public nếu cần.
- Gắn cert VM.

### 14.0.4. Tạo `.env` cho mức 1 IP private

Trong thư mục project trên Windows, tạo hoặc chỉnh `.env` theo IP VM. Với IP hiện tại của bạn là `192.168.1.27`, ví dụ:

```env
POSTGRES_USER=apiuser
POSTGRES_PASSWORD=change-me-strong-postgres
POSTGRES_DB=apidb
POSTGRES_PORT=5434

REDIS_PORT=6380

VAULT_TOKEN=change-me-vault-root-token-for-lab
VAULT_KEY_NAME=orders-dek
VAULT_WRAPPED_DEK=

KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=change-me-keycloak-admin

VITE_REALM=cloud-api-security
VITE_CLIENT_ID=cloud-api-frontend
VITE_KEYCLOAK_URL=https://192.168.1.27/auth
VITE_KONG_URL=https://192.168.1.27:8443

BACKEND_CORS_ORIGINS=https://192.168.1.27
KC_HOSTNAME=192.168.1.27
PUBLIC_BASE_URL=https://192.168.1.27
```

Ghi chú:

- Mức 1 dùng IP private nên cert là self-signed/internal CA.
- ZeroSSL không ký trực tiếp cho IP private.
- Khi lên mức 2, các giá trị `192.168.1.27` sẽ đổi thành `app.<domain>`, `api.<domain>`, `auth.<domain>`.

### 14.0.5. Tạo `docker-compose.vm.yml` để không expose service nội bộ

Tạo file mới `docker-compose.vm.yml` ở thư mục gốc project:

```yaml
services:
  postgres:
    ports: []

  redis:
    ports: []

  vault:
    ports: []

  opa:
    ports: []

  backend:
    ports: []

  kong:
    ports:
      - "8443:8443"
    environment:
      KONG_ADMIN_LISTEN: "off"

  keycloak:
    ports:
      - "8082:8080"

  frontend:
    ports:
      - "443:443"
      - "80:80"
```

Ý nghĩa:

- User chỉ vào được frontend `443/80`, Kong `8443`, và tạm thời Keycloak `8082` nếu project của bạn chưa reverse proxy Keycloak qua frontend/domain.
- User không vào thẳng được backend, OPA, Redis, Vault, PostgreSQL.
- Kong Admin API `8001` không public.

Nếu sau này bạn reverse proxy Keycloak qua domain `auth.<domain>` thì có thể bỏ public `8082`.

### 14.0.6. Chỉnh CORS backend để không dùng wildcard

Trong `backend/app/main.py`, hiện logic đang cho:

```python
allow_origins=["*"]
```

Khi demo bảo mật, nên đổi theo biến môi trường:

```python
cors_origins = os.getenv("BACKEND_CORS_ORIGINS", "https://localhost:5174")
allowed_origins = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "DPoP", "Content-Type"],
)
```

Với mức 1, `.env` đặt:

```env
BACKEND_CORS_ORIGINS=https://192.168.1.27
```

Với mức 2:

```env
BACKEND_CORS_ORIGINS=https://app.apisec.shop
```

### 14.0.7. Chỉnh CORS Kong theo IP/domain

Trong `gateway/kong.yml`, phần CORS hiện còn localhost:

```yaml
origins:
  - "https://localhost:5174"
  - "http://localhost:5173"
```

Mức 1 đổi thành:

```yaml
origins:
  - "https://192.168.1.27"
```

Mức 2 đổi thành:

```yaml
origins:
  - "https://app.apisec.shop"
```

Không dùng wildcard `*` khi `credentials: true`.

### 14.0.8. Chỉnh Keycloak redirect URI

Nếu realm import đang có redirect URI localhost, cần thêm URI cho IP VM.

Mức 1 nên có:

```text
https://192.168.1.27/*
https://192.168.1.27/callback
```

Mức 2 nên có:

```text
https://app.apisec.shop/*
https://app.apisec.shop/callback
```

Cách làm nhanh:

- Cách 1: sửa file `idp/keycloak/realm-export.json` trước khi chạy lần đầu.
- Cách 2: chạy Keycloak, vào Admin Console, chỉnh client redirect URI, sau đó export lại realm làm evidence.

Với demo, cách 2 dễ hơn nếu bạn chưa chắc cấu trúc JSON.

### 14.0.9. Sau khi sửa xong mới copy project lên Ubuntu

Từ Windows PowerShell, đứng tại thư mục cha chứa project:

```powershell
cd "D:\UIT\NAM2\HK2\MATMAHOC\PROJECT"
scp -r ".\Cloud_Api_Security" cloudapi@192.168.1.27:/home/cloudapi/
```

Nếu đã copy trước đó và muốn copy lại bản mới, trên Ubuntu nên đổi tên bản cũ thay vì xóa ngay:

```bash
mv ~/Cloud_Api_Security ~/Cloud_Api_Security_backup_$(date +%Y%m%d_%H%M%S)
```

Rồi copy lại từ Windows.

Sau khi copy xong, SSH vào Ubuntu và kiểm tra:

```bash
cd ~/Cloud_Api_Security
ls
test -f docker-compose.yml && echo "compose ok"
test -f docker-compose.vm.yml && echo "vm override ok"
test -f .env && echo "env ok"
```

### 14.0.10. Chạy project trên Ubuntu bằng file override

Trên Ubuntu:

```bash
cd ~/Cloud_Api_Security
docker compose -f docker-compose.yml -f docker-compose.vm.yml config
docker compose -f docker-compose.yml -f docker-compose.vm.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.vm.yml ps
```

Nếu muốn xem log:

```bash
docker compose -f docker-compose.yml -f docker-compose.vm.yml logs -f kong
docker compose -f docker-compose.yml -f docker-compose.vm.yml logs -f backend
docker compose -f docker-compose.yml -f docker-compose.vm.yml logs -f keycloak
```

Test port đang mở:

```bash
sudo ss -tulpn | grep -E ':80|:443|:8443|:8082|:9000|:8181|:8200|:5432|:6379'
```

Kỳ vọng:

```text
Được mở: 80, 443, 8443, có thể 8082 nếu Keycloak chưa đi qua reverse proxy
Không nên mở ra host: 9000, 8181, 8200, 5432, 6379, 8001
```

## 14A. Chuẩn bị Ubuntu VM

### 14A.1. Kiểm tra IP của VM

Trên Ubuntu VM:

```bash
hostname -I
ip addr
```

Ghi lại IP LAN, ví dụ:

```text
192.168.1.50
```

Từ máy client cùng LAN kiểm tra:

```bash
ping 192.168.1.50
```

Nếu ping bị chặn nhưng vẫn truy cập được port thì không sao. Quan trọng là sau khi mở firewall, client gọi được `443` hoặc `8443`.

### 14A.2. Cập nhật hệ thống và cài gói cần thiết

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg git openssl ufw nano
```

### 14A.3. Cài Docker và Docker Compose plugin

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Đăng xuất rồi đăng nhập lại, hoặc reboot:

```bash
sudo reboot
```

Kiểm tra:

```bash
docker version
docker compose version
```

### 14A.4. Mở firewall tối thiểu

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8443/tcp
sudo ufw enable
sudo ufw status numbered
```

Không mở các port nội bộ:

```text
9000 backend
8181 OPA
8200 Vault
6380 Redis
5434 PostgreSQL
8001 Kong Admin API
```

## 14B. Đưa project lên Ubuntu VM

### 14B.1. Nếu dùng Git

```bash
cd ~
git clone <repo-url> Cloud_Api_Security
cd Cloud_Api_Security
```

### 14B.2. Nếu copy từ Windows sang Ubuntu VM

Trên Windows PowerShell, từ thư mục chứa project:

```powershell
scp -r .\Cloud_Api_Security <user>@192.168.1.50:/home/<user>/
```

Trên Ubuntu:

```bash
cd ~/Cloud_Api_Security
ls
```

Phải thấy:

```text
docker-compose.yml
backend/
frontend/
gateway/
idp/
opa/
vault/
```

## 14C. Tạo file môi trường `.env`

Trong thư mục project:

```bash
cd ~/Cloud_Api_Security
nano .env
```

Ví dụ mức 1 dùng IP private:

```env
POSTGRES_USER=admin
POSTGRES_PASSWORD=change-this-db-password
POSTGRES_DB=cloudapi
POSTGRES_HOST=postgres
POSTGRES_PORT=5434

REDIS_PORT=6380

VAULT_TOKEN=change-this-vault-token
VAULT_KEY_NAME=dek
VAULT_WRAPPED_DEK=CHANGE_ME_AFTER_WRAP_DEK

KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=change-this-keycloak-password

KEYCLOAK_URL=http://keycloak:8080
KEYCLOAK_REALM=cloudapi
JWT_ISSUER=http://keycloak:8080/realms/cloudapi
JWT_AUDIENCE=spa-client

VITE_KEYCLOAK_URL=http://192.168.1.50:8082
VITE_KONG_URL=https://192.168.1.50:8443
VITE_REALM=cloudapi
VITE_CLIENT_ID=spa-client

GRAFANA_USER=admin
GRAFANA_PASSWORD=change-this-grafana-password
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=change-this-pgadmin-password
WEBHOOK_SECRET=change-this-webhook-secret
CORS_ORIGINS=https://192.168.1.50,https://192.168.1.50:5174
```

Lưu ý:

- Mức 1 có thể dùng Keycloak qua `http://192.168.1.50:8082` để đơn giản lab.
- Khi nâng lên mức 2/domain, cần đổi sang `https://auth.apisec.shop`.
- `VAULT_WRAPPED_DEK` cần tạo ở bước Vault/DEK. Nếu chưa có, backend phần mã hóa có thể lỗi khi gọi chức năng cần DEK.

## 14D. Tạo certificate mức 1: IP private + CA nội bộ

### 14D.1. Tạo CA và server certificate

Thay `192.168.1.50` bằng IP VM của bạn.

```bash
mkdir -p ~/cloudapi-local-ca
cd ~/cloudapi-local-ca

openssl genrsa -out cloudapi-ca.key 4096

openssl req -x509 -new -nodes \
  -key cloudapi-ca.key \
  -sha256 \
  -days 3650 \
  -out cloudapi-ca.crt \
  -subj "/CN=CloudAPI Local Root CA"

cat > server-san.cnf <<'EOF'
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = req_ext

[dn]
CN = 192.168.1.50

[req_ext]
subjectAltName = @alt_names

[alt_names]
IP.1 = 192.168.1.50
IP.2 = 127.0.0.1
DNS.1 = localhost
DNS.2 = api-gateway
DNS.3 = kong
DNS.4 = frontend
DNS.5 = backend
DNS.6 = api-backend
EOF

openssl genrsa -out cloudapi-server.key 2048

openssl req -new \
  -key cloudapi-server.key \
  -out cloudapi-server.csr \
  -config server-san.cnf

openssl x509 -req \
  -in cloudapi-server.csr \
  -CA cloudapi-ca.crt \
  -CAkey cloudapi-ca.key \
  -CAcreateserial \
  -out cloudapi-server.crt \
  -days 825 \
  -sha256 \
  -extensions req_ext \
  -extfile server-san.cnf
```

### 14D.2. Copy cert vào project

```bash
cd ~/Cloud_Api_Security
mkdir -p certs-local

cp ~/cloudapi-local-ca/cloudapi-ca.crt certs-local/ca.crt
cp ~/cloudapi-local-ca/cloudapi-server.crt certs-local/server.crt
cp ~/cloudapi-local-ca/cloudapi-server.key certs-local/server.key
```

Nếu muốn dùng cert này thay cho cert hiện tại trong `certs/`, có thể copy ra các tên mà compose đang mount:

```bash
cp certs-local/ca.crt certs/ca.crt
cp certs-local/server.crt certs/frontend.crt
cp certs-local/server.key certs/frontend.key
cp certs-local/server.crt certs/kong.crt
cp certs-local/server.key certs/kong.key
cp certs-local/server.crt certs/backend.crt
cp certs-local/server.key certs/backend.key
```

Lưu ý:

- Cách copy cùng một server cert cho frontend/kong/backend phù hợp demo nhanh.
- Cách tốt hơn là tạo riêng cert cho từng service, nhưng mất nhiều bước hơn.

### 14D.3. Import CA vào máy client

Copy file này sang máy client:

```text
certs-local/ca.crt
```

Windows:

```text
Double click ca.crt
Install Certificate
Current User hoặc Local Machine
Trusted Root Certification Authorities
Finish
```

Sau đó đóng mở lại browser.

## 14E. Hardening `docker-compose.yml` trước khi chạy trên VM

### 14E.1. Comment các port nội bộ

Trong `docker-compose.yml`, comment:

```yaml
postgres:
  # ports:
  #   - "${POSTGRES_PORT:-5434}:5432"

redis:
  # ports:
  #   - "${REDIS_PORT:-6380}:6379"

vault:
  # ports:
  #   - "8200:8200"

opa:
  # ports:
  #   - "8181:8181"

backend:
  # ports:
  #   - "9000:9000"

kong:
  ports:
    - "8443:8443"
    # - "8001:8001"
```

### 14E.2. Chỉ expose frontend và gateway

Nếu dùng frontend hiện tại:

```yaml
frontend:
  ports:
    - "80:80"
    - "443:443"
```

Nếu chưa đổi frontend port trong compose, hiện project dùng:

```yaml
frontend:
  ports:
    - "5173:80"
    - "5174:443"
```

Mức demo nhanh có thể giữ `5174`, nhưng đẹp hơn là đổi về `443`.

## 14F. Chạy project mức 1

```bash
cd ~/Cloud_Api_Security
docker compose up -d --build
docker compose ps
```

Xem log nếu lỗi:

```bash
docker compose logs -f frontend
docker compose logs -f kong
docker compose logs -f keycloak
docker compose logs -f backend
docker compose logs -f opa
docker compose logs -f vault
```

Kiểm tra từ Ubuntu VM:

```bash
curl -k https://localhost:8443/health
curl -k https://localhost:5174
```

Kiểm tra từ client:

```bash
curl -vk https://192.168.1.50:8443/health
curl -vk https://192.168.1.50:5174
```

Nếu đã đổi frontend sang port 443:

```bash
curl -vk https://192.168.1.50
```

## 14G. Kiểm chứng bảo mật mức 1

### 14G.1. TLS 1.3

```bash
openssl s_client -connect 192.168.1.50:8443 -tls1_3
```

Nếu frontend dùng 443:

```bash
openssl s_client -connect 192.168.1.50:443 -tls1_3
```

### 14G.2. mTLS tại Kong

Thiếu client cert:

```bash
curl -vk https://192.168.1.50:8443/health
```

Có client cert:

```bash
curl -vk \
  --cacert certs/ca.crt \
  --cert certs/client.crt \
  --key certs/client.key \
  https://192.168.1.50:8443/health
```

### 14G.3. Service nội bộ không public

Từ client:

```bash
curl http://192.168.1.50:9000/health
curl http://192.168.1.50:8181
curl http://192.168.1.50:8200
curl http://192.168.1.50:6380
curl http://192.168.1.50:5434
curl http://192.168.1.50:8001
```

Kỳ vọng:

```text
Connection refused hoặc timeout
```

## 14H. Nâng lên mức 2: Tailscale + domain + ZeroSSL

### 14H.1. Cài Tailscale trên Ubuntu VM

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
tailscale ip -4
```

Ví dụ nhận:

```text
100.72.10.25
```

### 14H.2. Cài Tailscale trên máy bạn của bạn

Bạn của bạn:

```text
1. Cài Tailscale.
2. Đăng nhập.
3. Được bạn share machine hoặc join tailnet.
4. Ping thử IP Tailscale của VM.
```

Kiểm tra:

```bash
ping 100.72.10.25
```

### 14H.3. Mua domain và tạo subdomain

Ví dụ mua:

```text
apisec.shop
```

Dùng 3 subdomain:

```text
app.apisec.shop
api.apisec.shop
auth.apisec.shop
```

### 14H.4. Xin ZeroSSL bằng DNS CNAME validation

Trên ZeroSSL:

```text
Create certificate
Add domains:
  app.apisec.shop
  api.apisec.shop
  auth.apisec.shop
Choose DNS CNAME validation
```

ZeroSSL sẽ đưa CNAME. Vào DNS zone của nhà cung cấp domain và tạo record theo đúng yêu cầu.

Sau khi verify, tải cert về:

```text
certificate.crt
ca_bundle.crt
private.key
```

Trên Ubuntu VM:

```bash
cd ~/Cloud_Api_Security
mkdir -p certs-prod
cat certificate.crt ca_bundle.crt > certs-prod/apisec.fullchain.crt
cp private.key certs-prod/apisec.key
chmod 600 certs-prod/apisec.key
```

### 14H.5. Cấu hình hosts trên máy client

Trên máy bạn của bạn, thêm:

```text
100.72.10.25 app.apisec.shop
100.72.10.25 api.apisec.shop
100.72.10.25 auth.apisec.shop
```

Windows:

```text
C:\Windows\System32\drivers\etc\hosts
```

Flush DNS:

```cmd
ipconfig /flushdns
```

Kiểm tra:

```bash
ping app.apisec.shop
ping api.apisec.shop
ping auth.apisec.shop
```

Kỳ vọng trỏ về:

```text
100.72.10.25
```

### 14H.6. Chỉnh `.env` sang domain

```env
VITE_KEYCLOAK_URL=https://auth.apisec.shop
VITE_KONG_URL=https://api.apisec.shop
VITE_REALM=cloudapi
VITE_CLIENT_ID=spa-client

JWT_ISSUER=https://auth.apisec.shop/realms/cloudapi
CORS_ORIGINS=https://app.apisec.shop
```

Cần sửa Keycloak redirect URI:

```text
https://app.apisec.shop/*
```

Cần sửa Kong CORS:

```yaml
origins:
  - "https://app.apisec.shop"
```

Rebuild frontend vì Vite dùng build-time env:

```bash
docker compose up -d --build frontend
docker compose up -d
```

### 14H.7. Kiểm tra mức 2

```bash
openssl s_client -connect app.apisec.shop:443 -servername app.apisec.shop -tls1_3
curl -vk https://app.apisec.shop
curl -vk https://api.apisec.shop:8443/health
```

Nếu API yêu cầu mTLS:

```bash
curl -vk \
  --cacert certs/ca.crt \
  --cert certs/client.crt \
  --key certs/client.key \
  https://api.apisec.shop:8443/health
```

## 14I. Thêm WAF demo từng lệnh

### 14I.1. Tạo file WAF

```bash
cd ~/Cloud_Api_Security
mkdir -p waf
nano waf/nginx.conf
```

Nội dung:

```nginx
server {
    listen 443 ssl http2;
    server_name api.apisec.shop;

    ssl_certificate     /certs-prod/apisec.fullchain.crt;
    ssl_certificate_key /certs-prod/apisec.key;
    ssl_protocols TLSv1.3;

    location / {
        proxy_pass https://api-gateway:8443;
        proxy_ssl_verify off;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 14I.2. Thêm service WAF vào Compose

Thêm vào `docker-compose.yml`:

```yaml
waf:
  image: owasp/modsecurity-crs:nginx
  container_name: api-waf
  restart: unless-stopped
  ports:
    - "9443:443"
  volumes:
    - ./waf/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - ./certs-prod:/certs-prod:ro
  environment:
    PARANOIA: 1
    ANOMALY_INBOUND: 5
    ANOMALY_OUTBOUND: 4
  networks:
    - edge-net
  depends_on:
    - kong
```

Chạy:

```bash
docker compose up -d waf
docker logs -f api-waf
```

### 14I.3. Test WAF

Request bình thường:

```bash
curl -vk https://api.apisec.shop:9443/health
```

Request đáng ngờ:

```bash
curl -vk "https://api.apisec.shop:9443/?q=<script>alert(1)</script>"
```

Xem log:

```bash
docker logs api-waf
```

Lưu evidence:

```bash
mkdir -p EVIDENCE/waf
docker logs api-waf > EVIDENCE/waf/waf_logs.txt
```

## 14J. Thêm security scan miễn phí từng lệnh

### 14J.1. Trivy

```bash
sudo apt install -y wget apt-transport-https gnupg lsb-release
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo gpg --dearmor -o /usr/share/keyrings/trivy.gpg
echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee /etc/apt/sources.list.d/trivy.list
sudo apt update
sudo apt install -y trivy

mkdir -p EVIDENCE/security_scans
trivy fs . > EVIDENCE/security_scans/trivy_fs_report.txt
```

### 14J.2. pip-audit

```bash
cd ~/Cloud_Api_Security
python3 -m pip install --user pip-audit
python3 -m pip_audit -r backend/requirements.txt > EVIDENCE/security_scans/pip_audit_report.txt
```

### 14J.3. npm audit

```bash
cd ~/Cloud_Api_Security/frontend
npm audit > ../EVIDENCE/security_scans/npm_audit_report.txt
```

### 14J.4. SBOM bằng Syft

```bash
cd ~/Cloud_Api_Security
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b ./
./syft . -o cyclonedx-json > EVIDENCE/security_scans/sbom.cyclonedx.json
```

## 14K. Thêm correlation ID ở Kong

File:

```text
gateway/kong.yml
```

Thêm plugin:

```yaml
- name: correlation-id
  config:
    header_name: X-Request-ID
    generator: uuid
    echo_downstream: true
```

Chạy lại Kong:

```bash
docker compose restart kong
```

Kiểm tra:

```bash
curl -k -I https://api.apisec.shop:8443/health
```

Kỳ vọng có:

```text
X-Request-ID
```

## 15. Câu hỏi thường gặp

### 15.1. Dùng một Ubuntu VM có sai không?

Không sai. Với đồ án/demo, một Ubuntu VM là đủ nếu bạn ghi rõ đây là phân vùng logic bằng Docker networks.

### 15.2. Nếu không triển khai đúng hình DMZ đầy đủ thì có sao không?

Không sao nếu bạn trình bày đúng:

```text
Hình là kiến trúc mục tiêu. Bản demo triển khai rút gọn trên một Ubuntu VM, mô phỏng phân vùng bằng Docker networks và firewall rules.
```

### 15.3. Bạn của tôi có cần repo không?

Không. Bạn của bạn chỉ cần:

- Tailscale.
- hosts mapping hoặc DNS nội bộ.
- Browser.
- Client certificate nếu API mTLS yêu cầu.

### 15.4. Domain có đổi IP nhiều lần được không?

Có. Đổi IP trong DNS hoặc hosts bao nhiêu lần cũng được trong nhu cầu bình thường. Nếu certificate cấp cho domain thì đổi IP không cần xin lại certificate.

### 15.5. HTTPS và TLS 1.3 khác nhau thế nào?

TLS 1.3 là giao thức mã hóa tầng transport. HTTPS là HTTP chạy trên TLS.

Cách nói đúng:

```text
Hệ thống sử dụng HTTPS với TLS 1.3.
```

Không nên chỉ nói:

```text
Chỉ dùng TLS 1.3.
```

### 15.6. Client có phải là bên ký không?

Có, trong DPoP:

```text
Client ký DPoP proof.
Keycloak ký JWT access token.
Backend verify cả JWT và DPoP proof.
```

### 15.7. Server nào đang ký?

Trong project:

- Keycloak ký JWT.
- Client ký DPoP proof.
- Backend verify.
- Kong hiện hardening JWT header/kid và gọi OPA, nhưng chưa verify JWT đầy đủ.
- Response backend chưa có application-level signature riêng.

## 16. Checklist cuối cùng

### 16.1. Checklist mức 1

- [ ] Ubuntu VM chạy Bridged.
- [ ] VM có IP private ổn định.
- [ ] Docker và Docker Compose chạy được.
- [ ] Project chạy được trên VM.
- [ ] Cert self-signed/internal CA có SAN chứa IP VM.
- [ ] Client import CA nếu cần browser tin certificate.
- [ ] HTTPS/TLS 1.3 kiểm tra thành công.
- [ ] Kong mTLS kiểm tra thành công.
- [ ] Backend/OPA/Redis/Vault/PostgreSQL không truy cập trực tiếp từ client.
- [ ] JWT/DPoP test thành công.

### 16.2. Checklist mức 2

- [ ] Mức 1 đã chạy ổn.
- [ ] Đã mua domain.
- [ ] Có 3 subdomain `app`, `api`, `auth`.
- [ ] ZeroSSL certificate cấp đúng 3 subdomain.
- [ ] Ubuntu VM cài Tailscale.
- [ ] Bạn của bạn cài Tailscale.
- [ ] hosts của client trỏ domain về IP Tailscale VM.
- [ ] Frontend env dùng domain.
- [ ] Keycloak redirect URI dùng domain.
- [ ] Kong CORS dùng domain.
- [ ] TLS 1.3 kiểm tra bằng domain thành công.
- [ ] mTLS/JWT/DPoP/replay test thành công.

## 17. Nguồn tham khảo chính

- Ubuntu Server: `https://ubuntu.com/download/server`
- ZeroSSL domain validation: `https://help.zerossl.com/hc/en-us/articles/360058295354-Verify-Domains`
- ZeroSSL Nginx install: `https://help.zerossl.com/hc/en-us/articles/360058295894-Installing-SSL-Certificate-on-NGINX`
- Hostinger DNS management: `https://www.hostinger.com/support/1583249-how-can-i-manage-my-dns-records`
- Tailscale install: `https://tailscale.com/download/linux`
