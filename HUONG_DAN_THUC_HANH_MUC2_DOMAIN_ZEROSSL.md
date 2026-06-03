# Hướng dẫn thực hành mức 2: domain thật + ZeroSSL sau khi mức 1 đã chạy ổn

File này là runbook tuyến tính cho mức 2. Chỉ làm mức 2 sau khi mức 1 đã pass:

```text
Web mở được bằng https://IP_UBUNTU.
Keycloak discovery trả issuer đúng.
Kong mTLS test được.
Docker containers running.
Backend/db/redis/vault/opa không public trực tiếp.
```

## Luồng chính bạn đang làm: Ubuntu VM + Tailscale IP + domain `fmsec.shop`

Phần này là luồng chính cho đúng hướng hiện tại của bạn. Hãy làm theo từ trên xuống dưới. Các phần phía sau dùng để giải thích thêm hoặc xử lý lỗi.

Mô hình sẽ chạy như sau:

```text
Windows hoặc máy bạn bè
  -> mở https://app.fmsec.shop
  -> hosts file trỏ app.fmsec.shop về IP Tailscale của Ubuntu
  -> Tailscale đưa traffic tới Ubuntu VM
  -> Nginx frontend nhận HTTPS bằng cert ZeroSSL
  -> Keycloak qua https://auth.fmsec.shop
  -> Kong/API Gateway qua https://api.fmsec.shop:8443
```

Ý nghĩa từng phần:

- `fmsec.shop` là domain thật dùng để xin cert và để browser kiểm tra hostname.
- IP Tailscale là đường đi mạng thật tới Ubuntu VM.
- ZeroSSL xác minh quyền sở hữu domain bằng DNS validation, nên không cần public IP.
- Bạn bè không cần repo. Bạn bè chỉ cần Tailscale, hosts mapping và browser. Nếu test mTLS API thì cần thêm client cert.

### Bước 1. Xác định các giá trị dùng trong mức 2

Trong hướng dẫn này dùng:

```text
Domain chính: fmsec.shop
Frontend: app.fmsec.shop
Keycloak/OIDC: auth.fmsec.shop
Kong/API Gateway: api.fmsec.shop
Ubuntu user: cloudapi
Project trên Ubuntu: /home/cloudapi/Cloud_Api_Security
```

Bạn phải lấy IP Tailscale thật của Ubuntu, không dùng nguyên IP ví dụ trong tài liệu.

### Bước 2. Sau khi mua domain trên Hostinger

Làm trên browser:

`[Hostinger browser]`

1. Vào Hostinger.
2. Mở `Tên miền`.
3. Vào `Danh mục tên miền`.
4. Bấm `Thiết lập` ở dòng `fmsec.shop`.
5. Nếu Hostinger hỏi tạo website/hosting, có thể bỏ qua. Project chạy trên Ubuntu VM, không cần mua hosting web.
6. Tìm mục `DNS Zone`, `DNS`, `Manage DNS records` hoặc `Quản lý DNS`.
7. Giữ nameserver mặc định của Hostinger nếu bạn chưa chuyển sang Cloudflare.
8. Nếu Hostinger/ICANN yêu cầu xác minh email chủ sở hữu domain, hãy xác minh trước.

Với cách dùng Tailscale, chưa cần tạo A record public cho `app`, `auth`, `api`. Public DNS không thể tự đưa người ngoài Internet vào IP Tailscale nếu người đó không nằm trong Tailscale network. Ta dùng DNS Zone chủ yếu để thêm record xác minh của ZeroSSL.

#### Bước 2.1. Hiểu đúng màn hình `Quản lý bản ghi DNS` của Hostinger

Ở màn hình bạn đang thấy, phần quan trọng là `Quản lý bản ghi DNS`.

Các cột có ý nghĩa như sau:

| Cột trên Hostinger | Ý nghĩa | Điền gì trong case của bạn |
|---|---|---|
| `Loại` | Kiểu DNS record | Chọn `CNAME` hoặc `TXT` theo đúng ZeroSSL đưa |
| `Tên` | Host/name của record | Copy từ ZeroSSL, ví dụ `_abc123.app` hoặc `_abc123.app.fmsec.shop` |
| `Giá trị` | Nội dung record | Copy nguyên giá trị ZeroSSL đưa |
| `TTL` | Thời gian cache DNS | Để mặc định `14400`, hoặc chọn thấp hơn nếu Hostinger cho phép |
| `Thêm bản ghi` | Nút lưu record | Bấm sau khi điền đủ |

Không bấm `Đặt lại bản ghi DNS`, vì nút đó sẽ reset DNS về mặc định.

Không cần bấm `Thay đổi máy chủ tên miền` nếu bạn đang dùng DNS mặc định của Hostinger. Hai nameserver kiểu:

```text
atlas.dns-parking.com
hyperion.dns-parking.com
```

là bình thường.

#### Bước 2.2. Hai record mặc định `www` và `@` có cần sửa không?

Bạn đang thấy các record mặc định kiểu:

```text
CNAME  www  fmsec.shop
A      @    2.57.91.91
```

Ý nghĩa:

- `www`: nếu ai vào `www.fmsec.shop` thì trỏ về `fmsec.shop`.
- `@`: đại diện cho domain gốc `fmsec.shop`.
- `2.57.91.91`: thường là IP parking/default của Hostinger.

Với hướng demo của bạn là `app.fmsec.shop`, `auth.fmsec.shop`, `api.fmsec.shop` qua Tailscale:

- Có thể tạm giữ hai record mặc định này.
- Không ảnh hưởng tới việc xin ZeroSSL bằng DNS validation.
- Không dùng `fmsec.shop` hoặc `www.fmsec.shop` làm URL chính của project ở hướng dẫn này.
- Không cần sửa A record `@` thành IP Tailscale, vì DNS public trỏ IP Tailscale không giúp người ngoài truy cập nếu họ không có Tailscale.

Khi nào mới cần sửa/xóa record mặc định?

- Nếu sau này bạn dùng VPS public IP và muốn `fmsec.shop` mở web chính, sửa `A @` về public IP VPS.
- Nếu muốn `www.fmsec.shop` cũng mở web, giữ `CNAME www -> fmsec.shop` hoặc trỏ `www` về host phù hợp.
- Nếu chỉ demo bằng `app/auth/api`, cứ để nguyên cũng được.

#### Bước 2.3. Nếu ZeroSSL đưa record `CNAME` thì điền thế nào?

Ví dụ ZeroSSL đưa:

```text
Type: CNAME
Name: _abc123.app.fmsec.shop
Value: _xyz987.acm-validations.aws
```

Trên Hostinger điền:

```text
Loại: CNAME
Tên: _abc123.app
Giá trị: _xyz987.acm-validations.aws
TTL: 14400
```

Sau đó bấm `Thêm bản ghi`.

Nếu Hostinger cho phép nhập đầy đủ domain ở ô `Tên`, bạn cũng có thể nhập:

```text
_abc123.app.fmsec.shop
```

Nhưng phải để ý giao diện. Nếu Hostinger tự thêm `.fmsec.shop` phía sau, thì chỉ nhập phần trước:

```text
_abc123.app
```

Không được để thành:

```text
_abc123.app.fmsec.shop.fmsec.shop
```

#### Bước 2.4. Nếu ZeroSSL đưa record `TXT` thì điền thế nào?

Ví dụ ZeroSSL đưa:

```text
Type: TXT
Name: _zerossl.fmsec.shop
Value: abcdef1234567890
```

Trên Hostinger điền:

```text
Loại: TXT
Tên: _zerossl
Giá trị: abcdef1234567890
TTL: 14400
```

Sau đó bấm `Thêm bản ghi`.

Nếu ZeroSSL đưa name có subdomain, ví dụ:

```text
_zerossl.app.fmsec.shop
```

thì ô `Tên` thường điền:

```text
_zerossl.app
```

#### Bước 2.5. Nếu ZeroSSL đưa nhiều record thì làm sao?

Nếu bạn xin cert cho 3 hostname:

```text
app.fmsec.shop
auth.fmsec.shop
api.fmsec.shop
```

ZeroSSL có thể đưa 1 record hoặc nhiều record. Nếu ZeroSSL đưa nhiều dòng, bạn phải thêm đủ tất cả các dòng vào Hostinger.

Ví dụ:

```text
CNAME _abc.app.fmsec.shop   -> _abc.acm-validations.aws
CNAME _def.auth.fmsec.shop  -> _def.acm-validations.aws
CNAME _ghi.api.fmsec.shop   -> _ghi.acm-validations.aws
```

Thì trên Hostinger thêm 3 record:

```text
Loại: CNAME
Tên: _abc.app
Giá trị: _abc.acm-validations.aws
TTL: 14400

Loại: CNAME
Tên: _def.auth
Giá trị: _def.acm-validations.aws
TTL: 14400

Loại: CNAME
Tên: _ghi.api
Giá trị: _ghi.acm-validations.aws
TTL: 14400
```

Sau khi thêm xong, quay lại ZeroSSL bấm `Verify`.

#### Bước 2.6. Kiểm tra record đã lên DNS chưa

Chạy trên Windows PowerShell:

`[Windows PowerShell]`

```powershell
nslookup -type=CNAME _abc123.app.fmsec.shop
nslookup -type=TXT _zerossl.fmsec.shop
```

Thay `_abc123.app.fmsec.shop` hoặc `_zerossl.fmsec.shop` bằng name thật mà ZeroSSL đưa.

Nếu dùng CNAME mà `nslookup` trả về đúng target ZeroSSL, ví dụ:

```text
_abc123.app.fmsec.shop canonical name = _xyz987.acm-validations.aws
```

thì record đã lên.

Nếu dùng TXT mà `nslookup` trả đúng chuỗi token ZeroSSL, thì record đã lên.

Nếu chưa thấy ngay:

- Đợi 5 đến 15 phút rồi thử lại.
- Kiểm tra có nhập sai `Tên` bị lặp `.fmsec.shop.fmsec.shop` không.
- Kiểm tra có chọn sai `Loại` không.
- Kiểm tra có copy thiếu dấu gạch dưới `_` không.
- Kiểm tra có copy thừa dấu cách ở `Giá trị` không.

#### Bước 2.7. Chưa cần tạo A record `app/auth/api` ở Hostinger nếu dùng Tailscale

Ở cách bạn đang làm, sau khi ZeroSSL issued cert, việc truy cập domain sẽ nhờ hosts file trên từng máy client:

```text
<TAILSCALE_IP_UBUNTU> app.fmsec.shop
<TAILSCALE_IP_UBUNTU> auth.fmsec.shop
<TAILSCALE_IP_UBUNTU> api.fmsec.shop
```

Vì vậy trong Hostinger DNS:

- Không cần tạo `A app -> <TAILSCALE_IP_UBUNTU>`.
- Không cần tạo `A auth -> <TAILSCALE_IP_UBUNTU>`.
- Không cần tạo `A api -> <TAILSCALE_IP_UBUNTU>`.

Lý do: Tailscale IP là IP private trong tailnet. Public DNS có thể lưu record đó, nhưng người ngoài không có Tailscale vẫn không route được tới server. Dùng hosts file rõ ràng hơn cho demo và dễ giải thích trong báo cáo.

### Bước 2.8. Thứ tự thao tác giữa Hostinger và ZeroSSL

Đây là phần dễ rối nhất, nên làm đúng theo thứ tự dưới đây. Bạn nên mở 2 tab browser:

```text
Tab 1: Hostinger DNS của fmsec.shop
Tab 2: ZeroSSL Dashboard
```

Không đóng hai tab này trong lúc làm.

#### 2.8.1. Mở sẵn Hostinger DNS

Làm ở tab Hostinger:

`[Hostinger browser]`

1. Vào Hostinger.
2. Chọn `Tên miền`.
3. Chọn `fmsec.shop`.
4. Vào `DNS / Máy chủ tên miền`.
5. Chọn tab `Bản ghi DNS`.
6. Cuộn tới phần `Quản lý bản ghi DNS`.

Bạn sẽ thấy các ô:

```text
Loại
Tên
Giá trị
TTL
Thêm bản ghi
```

Tạm thời để nguyên tab này. Chưa cần nhập gì nếu ZeroSSL chưa đưa record.

#### 2.8.2. Sang ZeroSSL tạo certificate mới

Làm ở tab ZeroSSL:

`[ZeroSSL browser]`

1. Vào ZeroSSL Dashboard.
2. Chọn `Certificates`.
3. Bấm `New Certificate`.
4. Ở ô nhập domain, nhập 3 dòng hoặc 3 hostname:

```text
app.fmsec.shop
auth.fmsec.shop
api.fmsec.shop
```

5. Tiếp tục sang bước chọn loại cert.
6. Nếu ZeroSSL hỏi thời hạn, chọn cert 90 ngày nếu dùng gói miễn phí.
7. Nếu ZeroSSL hỏi CSR:
   - Vì bạn muốn dùng curve/ECC, không dùng Auto-Generate CSR.
   - Tạo ECC private key + CSR trên Ubuntu theo mục `2.8.2.2`.
   - Paste CSR ECC đó vào ZeroSSL.
8. Đến bước validation, chọn:

```text
DNS validation
```

Không chọn HTTP file upload trong hướng Tailscale/private IP, vì server của bạn không có public route từ Internet để ZeroSSL truy cập file HTTP.

#### 2.8.2.1. Các màn hình ZeroSSL trong ảnh của bạn nên chọn gì nếu muốn dùng curve/ECC?

Ở các màn hình bạn gửi, chọn như sau để tránh phát sinh phí và đủ tốt cho demo.

Màn hình `Add-Ons`:

```text
ZeroSSL Protect: tắt nếu không cần
Unlimited 90-Day Certificates: tắt
REST API Access: tắt
Technical Support: tắt
```

Sau đó bấm:

```text
Next Step
```

Lý do: các mục add-on thường là tính năng bổ sung hoặc upsell. Với demo môn học, bạn chỉ cần certificate 90 ngày miễn phí, không cần bật add-on.

Màn hình `CSR & Contact`:

Vì bạn muốn public certificate cũng dùng curve/ECC, chọn như sau:

```text
Auto-Generate CSR: tắt
Paste Existing CSR: bật
```

Sau đó tạo ECC CSR theo mục ngay bên dưới rồi paste vào ô CSR của ZeroSSL.

Không dùng `Auto-Generate CSR` trong trường hợp này, vì ZeroSSL thường sẽ tự tạo RSA key và đưa bạn sang lựa chọn RSA 2048/3072/4096.

Màn hình `Encryption Algorithm`:

Nếu bạn đã paste CSR ECC hợp lệ, ZeroSSL sẽ dùng thuật toán/key từ CSR đó. Khi đó màn hình chọn RSA có thể:

- Không xuất hiện, hoặc
- Không còn quan trọng như lúc để ZeroSSL tự tạo CSR, hoặc
- Chỉ hiển thị thông tin tương thích.

Nếu ZeroSSL vẫn bắt chọn RSA thì nghĩa là bạn chưa paste CSR ECC đúng cách, hoặc giao diện/gói hiện tại không nhận ECC CSR ở bước đó. Khi đó quay lại `CSR & Contact`, kiểm tra đã bật `Paste Existing CSR` và paste đủ nội dung CSR chưa.

#### 2.8.2.2. Tạo ECC private key và CSR cho ZeroSSL

Bạn tạo key trên Ubuntu để private key nằm sẵn trên server, không phải tải private key từ ZeroSSL.

Curve dùng:

```text
prime256v1 / secp256r1 / P-256
```

Đây là curve phổ biến, tương thích tốt với TLS và browser.

Chạy trên Ubuntu:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
mkdir -p zerossl-csr
cd zerossl-csr

openssl ecparam -name prime256v1 -genkey -noout -out fmsec-zerossl.key

cat > fmsec-zerossl.cnf <<'EOF'
[req]
default_md = sha256
prompt = no
distinguished_name = dn
req_extensions = req_ext

[dn]
CN = app.fmsec.shop

[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = app.fmsec.shop
DNS.2 = auth.fmsec.shop
DNS.3 = api.fmsec.shop
EOF

openssl req -new \
  -key fmsec-zerossl.key \
  -out fmsec-zerossl.csr \
  -config fmsec-zerossl.cnf

openssl req -in fmsec-zerossl.csr -noout -text | grep -A4 "Subject Alternative Name"
```

Sau đó in CSR để copy vào ZeroSSL:

`[Ubuntu SSH]`

```bash
cat fmsec-zerossl.csr
```

Trong ZeroSSL:

`[ZeroSSL browser]`

1. Quay lại mục `CSR & Contact`.
2. Tắt `Auto-Generate CSR`.
3. Paste toàn bộ CSR, bao gồm:

```text
-----BEGIN CERTIFICATE REQUEST-----
...
-----END CERTIFICATE REQUEST-----
```

4. Nếu ZeroSSL vẫn hiện các ô contact, điền:

```text
Email Address: email của bạn
Organization: FMSEC Lab
Department: Security
City: Ho Chi Minh City
State: Ho Chi Minh
Country: Viet Nam
```

5. Tiếp tục các bước DNS validation.

Sau khi ZeroSSL issued cert, bạn chỉ cần tải `certificate.crt` và `ca_bundle.crt`. Private key sẽ là file bạn đã tự tạo trên Ubuntu:

```text
~/Cloud_Api_Security/zerossl-csr/fmsec-zerossl.key
```

Khi copy cert vào project, dùng key này thay cho `private.key` do ZeroSSL tạo:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
cat ~/certificate.crt ~/ca_bundle.crt > /tmp/fmsec-fullchain.crt

cp /tmp/fmsec-fullchain.crt certs/frontend.crt
cp zerossl-csr/fmsec-zerossl.key certs/frontend.key

cp /tmp/fmsec-fullchain.crt certs/kong.crt
cp zerossl-csr/fmsec-zerossl.key certs/kong.key

chmod 600 certs/frontend.key certs/kong.key
```

Kiểm tra private key thật sự là ECC:

`[Ubuntu SSH]`

```bash
openssl ec -in zerossl-csr/fmsec-zerossl.key -noout -text | head -n 5
```

Kỳ vọng thấy key dạng `ASN1 OID: prime256v1` hoặc thông tin EC private key.

Tóm lại hướng bạn chọn:

```text
ZeroSSL public cert: dùng ECC CSR tự tạo
Internal CA/client/backend cert: tiếp tục dùng ECC/curve như mức 1
```

#### 2.8.3. ZeroSSL đưa record xác minh

Vẫn ở tab ZeroSSL:

`[ZeroSSL browser]`

ZeroSSL sẽ hiện một hoặc nhiều record kiểu `CNAME` hoặc `TXT`.

Ví dụ CNAME:

```text
Type: CNAME
Name: _abc123.app.fmsec.shop
Value: _xyz987.acm-validations.aws
```

Hoặc TXT:

```text
Type: TXT
Name: _zerossl.app.fmsec.shop
Value: abcdef1234567890
```

Việc cần làm lúc này:

1. Không bấm verify ngay.
2. Copy từng dòng record ZeroSSL đưa.
3. Quay lại tab Hostinger để thêm record đó.

#### 2.8.4. Quay lại Hostinger để thêm record ZeroSSL

Làm ở tab Hostinger:

`[Hostinger browser]`

Nếu ZeroSSL đưa `CNAME`, điền:

```text
Loại: CNAME
Tên: phần Name của ZeroSSL
Giá trị: phần Value của ZeroSSL
TTL: 14400
```

Ví dụ ZeroSSL đưa:

```text
Name: _abc123.app.fmsec.shop
Value: _xyz987.acm-validations.aws
```

Trên Hostinger thường điền:

```text
Loại: CNAME
Tên: _abc123.app
Giá trị: _xyz987.acm-validations.aws
TTL: 14400
```

Sau đó bấm:

```text
Thêm bản ghi
```

Nếu ZeroSSL đưa `TXT`, điền:

```text
Loại: TXT
Tên: phần Name của ZeroSSL
Giá trị: phần Value/token của ZeroSSL
TTL: 14400
```

Ví dụ:

```text
Loại: TXT
Tên: _zerossl.app
Giá trị: abcdef1234567890
TTL: 14400
```

Sau đó bấm `Thêm bản ghi`.

Nếu ZeroSSL đưa 3 record, phải thêm đủ 3 record. Thêm xong record thứ nhất thì bấm `Thêm bản ghi`, rồi nhập record thứ hai, rồi record thứ ba.

#### 2.8.5. Kiểm tra lại record trên Hostinger

Vẫn ở tab Hostinger:

`[Hostinger browser]`

Sau khi bấm `Thêm bản ghi`, kéo xuống danh sách record bên dưới và kiểm tra:

- Có record vừa thêm chưa.
- `Loại` đúng là `CNAME` hoặc `TXT`.
- `Tên` không bị lặp domain.
- `Nội dung/Giá trị` đúng với ZeroSSL.

Lỗi thường gặp:

```text
Sai: _abc123.app.fmsec.shop.fmsec.shop
Đúng: _abc123.app.fmsec.shop
```

Nếu thấy bị lặp domain, bấm `Sửa` hoặc `Xóa` record sai rồi thêm lại.

#### 2.8.6. Đợi DNS cập nhật

Sau khi thêm record ở Hostinger, chờ khoảng:

```text
5 đến 15 phút
```

Đôi khi có thể lâu hơn, nhưng demo thường vài phút là thấy.

Có thể kiểm tra từ Windows:

`[Windows PowerShell]`

```powershell
nslookup -type=CNAME _abc123.app.fmsec.shop
nslookup -type=TXT _zerossl.app.fmsec.shop
```

Bạn phải thay `_abc123.app.fmsec.shop` hoặc `_zerossl.app.fmsec.shop` bằng name thật từ ZeroSSL.

Nếu record là CNAME, dùng:

```powershell
nslookup -type=CNAME <NAME_ZERO_SSL>
```

Nếu record là TXT, dùng:

```powershell
nslookup -type=TXT <NAME_ZERO_SSL>
```

#### 2.8.7. Quay lại ZeroSSL bấm verify

Làm ở tab ZeroSSL:

`[ZeroSSL browser]`

1. Quay lại trang validation của certificate.
2. Bấm `Verify DNS Records`, `Verify`, hoặc nút tương tự.
3. Nếu ZeroSSL báo chưa thấy record:
   - Đợi thêm 5 đến 15 phút.
   - Kiểm tra record trong Hostinger có sai `Name` không.
   - Kiểm tra có chọn sai `CNAME/TXT` không.
   - Kiểm tra có copy thiếu dấu `_` không.
4. Nếu ZeroSSL báo verified, tiếp tục sang bước issue certificate.

#### 2.8.8. Tải cert từ ZeroSSL

Làm ở tab ZeroSSL:

`[ZeroSSL browser]`

Khi certificate đã issued, tải file cert về máy Windows. Thường ZeroSSL cho tải dạng `.zip`.

Vì bạn dùng ECC CSR tự tạo, sau khi giải nén bạn chỉ cần 2 file certificate:

```text
certificate.crt
ca_bundle.crt
```

Nếu ZeroSSL vẫn kèm `private.key` trong file tải về thì không dùng file đó cho hướng ECC này. Private key đúng là file đã tạo trên Ubuntu:

```text
~/Cloud_Api_Security/zerossl-csr/fmsec-zerossl.key
```

Ý nghĩa file:

```text
certificate.crt  -> server certificate
ca_bundle.crt    -> intermediate/root CA bundle
fmsec-zerossl.key -> ECC private key tự tạo trên Ubuntu
```

Giữ kỹ `fmsec-zerossl.key`. File này là bí mật của server HTTPS.

#### 2.8.8.1. Xử lý lỗi `certificate premium not allowed`

Nếu ở bước `Finalize Your Order` ZeroSSL báo:

```text
An error occurred. Please try again, check for maintenance downtimes in https://status.zerossl.com
or contact our support team in case you have troubles
(Error Reference: "certificate premium not allowed").
```

thì không có nghĩa là CSR ECC của bạn sai. Nếu màn `Encryption Algorithm` đã hiện:

```text
ECC (prime256v1 / secp256r1)
Signature Algorithm: ecdsa-with-SHA256
```

thì ZeroSSL đã nhận đúng CSR curve/ECC.

Lỗi `certificate premium not allowed` thường do ZeroSSL xem cấu hình certificate hiện tại là tính năng trả phí. Các nguyên nhân hay gặp:

```text
Multi-domain certificate có 3 hostname: app + auth + api.
Custom ECC CSR đi cùng multi-domain bị free plan giới hạn.
Một add-on/protection/premium option còn bị bật hoặc bị kẹt trong phiên tạo cert.
ZeroSSL thay đổi giới hạn free plan theo thời điểm.
```

Làm theo thứ tự xử lý dưới đây.

##### Cách 1: Kiểm tra lại không còn option trả phí

Quay lại các mục trước trong ZeroSSL và kiểm tra:

```text
Wildcard: OFF
Validity: 90-Day Certificate
Annual Certificate: OFF
ZeroSSL Protect: OFF
Unlimited 90-Day Certificates: OFF
REST API Access: OFF
Technical Support: OFF
Pay Yearly: OFF
Enable Protection: OFF
```

Sau đó bấm `Next Step` lại.

Nếu vẫn lỗi, chuyển sang Cách 2.

##### Cách 2: Tạo cert ECC cho 1 domain trước để kiểm tra free plan

Tạo certificate mới trên ZeroSSL chỉ với:

```text
app.fmsec.shop
```

Không nhập `auth.fmsec.shop` và `api.fmsec.shop` ở lần thử này.

Tạo ECC CSR mới trên Ubuntu cho 1 domain:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
mkdir -p zerossl-csr/app
cd zerossl-csr/app

openssl ecparam -name prime256v1 -genkey -noout -out app-fmsec.key

cat > app-fmsec.cnf <<'EOF'
[req]
default_md = sha256
prompt = no
distinguished_name = dn
req_extensions = req_ext

[dn]
CN = app.fmsec.shop

[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = app.fmsec.shop
EOF

openssl req -new \
  -key app-fmsec.key \
  -out app-fmsec.csr \
  -config app-fmsec.cnf

openssl req -in app-fmsec.csr -noout -text | grep -A4 "Subject Alternative Name"
cat app-fmsec.csr
```

Trong ZeroSSL:

`[ZeroSSL browser]`

1. Tạo certificate mới.
2. Domain chỉ nhập:

```text
app.fmsec.shop
```

3. Chọn `90-Day Certificate`.
4. Tắt toàn bộ add-ons.
5. `Auto-Generate CSR`: OFF.
6. `Paste Existing CSR`: ON.
7. Paste nội dung `app-fmsec.csr`.
8. Tiếp tục DNS validation.

Nếu cert 1 domain tạo được, nghĩa là lỗi trước đó do multi-domain hoặc chính sách free plan. Khi đó dùng Cách 3 hoặc Cách 4.

Nếu cert 1 domain vẫn lỗi, dùng Cách 5.

##### Cách 3: Dùng 1 hostname `app.fmsec.shop` cho toàn bộ demo

Đây là cách bạn vừa thử và tạo được trên ZeroSSL. Đây cũng là hướng khuyến nghị hiện tại nếu ZeroSSL free chặn cert 3 domain.

Khi đó toàn bộ hệ thống public sẽ dùng một hostname:

```text
Frontend: https://app.fmsec.shop
Keycloak proxy: https://app.fmsec.shop/realms/cloudapi
Keycloak admin: https://app.fmsec.shop/admin
Kong API Gateway: https://app.fmsec.shop:8443
```

Ý nghĩa:

```text
Vẫn có domain thật.
Vẫn có ZeroSSL public certificate.
Vẫn dùng ECC/curve.
Vẫn đi qua Tailscale IP của Ubuntu.
Vẫn test được HTTPS/TLS, OIDC, Kong/mTLS.
Chỉ khác là không tách hostname auth/api riêng.
```

###### Cách 3.1. Tạo certificate mới trên ZeroSSL

Làm ở ZeroSSL:

`[ZeroSSL browser]`

1. Vào `Certificates`.
2. Chọn `New Certificate`.
3. Ở `Enter Domains`, chỉ nhập:

```text
app.fmsec.shop
```

4. Không bật wildcard:

```text
I need a wildcard certificate: OFF
```

5. Bấm `Next Step`.
6. Ở `Validity`, chọn:

```text
90-Day Certificate
```

7. Không chọn `Annual Certificate`.
8. Bấm `Next Step`.
9. Ở `Add-Ons`, tắt hết:

```text
ZeroSSL Protect: OFF
Unlimited 90-Day Certificates: OFF
REST API Access: OFF
Technical Support: OFF
```

10. Bấm `Next Step`.

###### Cách 3.2. Tạo ECC CSR cho `app.fmsec.shop`

Chạy trên Ubuntu:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
mkdir -p zerossl-csr/app
cd zerossl-csr/app

openssl ecparam -name prime256v1 -genkey -noout -out app-fmsec.key

cat > app-fmsec.cnf <<'EOF'
[req]
default_md = sha256
prompt = no
distinguished_name = dn
req_extensions = req_ext

[dn]
CN = app.fmsec.shop

[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = app.fmsec.shop
EOF

openssl req -new \
  -key app-fmsec.key \
  -out app-fmsec.csr \
  -config app-fmsec.cnf

openssl req -in app-fmsec.csr -noout -text | grep -A4 "Subject Alternative Name"
openssl req -in app-fmsec.csr -noout -text | grep -A6 "Subject Public Key Info"
cat app-fmsec.csr
```

Kỳ vọng:

```text
DNS:app.fmsec.shop
Public Key Algorithm: id-ecPublicKey
ASN1 OID: prime256v1
```

Copy toàn bộ CSR từ:

```text
-----BEGIN CERTIFICATE REQUEST-----
...
-----END CERTIFICATE REQUEST-----
```

###### Cách 3.3. Paste CSR vào ZeroSSL

Làm ở ZeroSSL:

`[ZeroSSL browser]`

1. Ở mục `CSR & Contact`, chọn:

```text
Auto-Generate CSR: OFF
Paste Existing CSR: ON
```

2. Paste CSR vừa copy vào ô `Paste CSR here`.
3. Nếu ZeroSSL hỏi contact, điền:

```text
Email Address: email của bạn
Organization: FMSEC Lab
Department: Security
City: Ho Chi Minh City
State: Ho Chi Minh
Country: Viet Nam
```

4. Bấm `Next Step`.

Ở `Encryption Algorithm`, ZeroSSL phải hiện:

```text
ECC (prime256v1 / secp256r1)
Signature Algorithm: ecdsa-with-SHA256
```

Nếu thấy như vậy là đúng. Bấm `Next Step`.

###### Cách 3.4. Chọn DNS CNAME verification

Ở màn `Verification Method for app.fmsec.shop`, chọn:

```text
DNS (CNAME)
```

Không chọn:

```text
Email Verification
File Upload
```

Lý do:

```text
Email Verification cần mailbox kiểu admin@app.fmsec.shop.
File Upload cần server public Internet để ZeroSSL truy cập file.
DNS (CNAME) dùng được với Ubuntu VM + Tailscale vì chỉ cần chứng minh quyền sở hữu domain ở Hostinger.
```

Bấm `Next Step`.

###### Cách 3.5. Copy CNAME từ ZeroSSL sang Hostinger

ZeroSSL sẽ đưa record CNAME, ví dụ:

```text
Type: CNAME
Name: _abc123.app.fmsec.shop
Value: _xyz987.acm-validations.aws
```

Mở Hostinger:

`[Hostinger browser]`

1. Vào `Tên miền`.
2. Chọn `fmsec.shop`.
3. Vào `DNS / Máy chủ tên miền`.
4. Chọn tab `Bản ghi DNS`.
5. Cuộn tới `Quản lý bản ghi DNS`.
6. Điền:

```text
Loại: CNAME
Tên: _abc123.app
Giá trị: _xyz987.acm-validations.aws
TTL: 14400
```

7. Bấm `Thêm bản ghi`.

Lưu ý:

```text
Nếu ZeroSSL đưa Name là _abc123.app.fmsec.shop,
trên Hostinger thường chỉ nhập _abc123.app.
Không nhập thành _abc123.app.fmsec.shop.fmsec.shop.
```

###### Cách 3.6. Kiểm tra CNAME đã lên DNS

Chạy trên Windows:

`[Windows PowerShell]`

```powershell
nslookup -type=CNAME _abc123.app.fmsec.shop
```

Thay `_abc123.app.fmsec.shop` bằng `Name` thật ZeroSSL đưa.

Nếu thấy trả về đúng `Value` của ZeroSSL thì DNS đã lên. Nếu chưa thấy:

```text
Đợi 5 đến 15 phút.
Kiểm tra có nhập sai Name không.
Kiểm tra có thiếu dấu _ không.
Kiểm tra có chọn đúng CNAME không.
```

###### Cách 3.7. Quay lại ZeroSSL verify và tải cert

Làm ở ZeroSSL:

`[ZeroSSL browser]`

1. Quay lại màn verify.
2. Bấm `Verify DNS Records` hoặc `Verify`.
3. Nếu pass, ZeroSSL sẽ issue certificate.
4. Tải certificate về Windows.
5. Giải nén, lấy 2 file:

```text
certificate.crt
ca_bundle.crt
```

Không dùng `private.key` của ZeroSSL nếu có. Với hướng ECC, private key đúng là:

```text
~/Cloud_Api_Security/zerossl-csr/app/app-fmsec.key
```

###### Cách 3.8. Copy cert lên Ubuntu và đặt vào project

Giả sử file ZeroSSL nằm ở Windows:

```text
D:\Downloads\fmsec-zerossl\app\
```

Chạy trên Windows:

`[Windows PowerShell]`

```powershell
scp D:\Downloads\fmsec-zerossl\app\certificate.crt cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/app-certificate.crt
scp D:\Downloads\fmsec-zerossl\app\ca_bundle.crt cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/app-ca_bundle.crt
```

Chạy trên Ubuntu:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
mkdir -p certs

cat ~/app-certificate.crt ~/app-ca_bundle.crt > /tmp/app-fullchain.crt

cp /tmp/app-fullchain.crt certs/frontend.crt
cp zerossl-csr/app/app-fmsec.key certs/frontend.key

cp /tmp/app-fullchain.crt certs/kong.crt
cp zerossl-csr/app/app-fmsec.key certs/kong.key

chmod 644 certs/frontend.crt certs/kong.crt
chmod 600 certs/frontend.key certs/kong.key
```

Kiểm tra cert:

`[Ubuntu SSH]`

```bash
openssl x509 -in certs/frontend.crt -noout -text | grep -A2 "Subject Alternative Name"
openssl ec -in certs/frontend.key -noout -text | head -n 5
```

Cần thấy:

```text
DNS:app.fmsec.shop
ASN1 OID: prime256v1
```

###### Cách 3.9. Sửa project về 1 hostname `app.fmsec.shop`

Mở `.env`:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
nano .env
```

Sửa các dòng public URL:

```env
VITE_KEYCLOAK_URL=https://app.fmsec.shop
VITE_KONG_URL=https://app.fmsec.shop:8443
BACKEND_CORS_ORIGINS=https://app.fmsec.shop
KC_HOSTNAME=app.fmsec.shop
PUBLIC_BASE_URL=https://app.fmsec.shop
JWT_ISSUER=https://app.fmsec.shop/realms/cloudapi
```

Sửa `gateway/kong.yml`, đảm bảo CORS có:

`[Ubuntu SSH]`

```bash
nano gateway/kong.yml
```

```yaml
- "https://app.fmsec.shop"
```

Sửa Keycloak client redirect:

`[Ubuntu SSH]`

```bash
nano idp/keycloak/realm-export.json
```

Đảm bảo client frontend có:

```json
"redirectUris": [
  "https://app.fmsec.shop/*"
],
"webOrigins": [
  "https://app.fmsec.shop"
]
```

Nếu Keycloak đã có volume cũ, sửa trực tiếp trong Keycloak Admin Console:

```text
https://app.fmsec.shop/admin
```

Client frontend:

```text
Valid redirect URIs: https://app.fmsec.shop/*
Web origins: https://app.fmsec.shop
```

Google login nếu dùng:

```text
https://app.fmsec.shop/realms/cloudapi/broker/google/endpoint
```

###### Cách 3.10. Hosts file khi chỉ dùng 1 hostname

Trên Windows và máy bạn bè, hosts file chỉ cần:

```text
<TAILSCALE_IP_UBUNTU> app.fmsec.shop
```

Không cần:

```text
auth.fmsec.shop
api.fmsec.shop
```

Flush DNS:

`[Windows PowerShell]`

```powershell
ipconfig /flushdns
ping app.fmsec.shop
```

###### Cách 3.11. Chạy lại Docker Compose và test

Chạy trên Ubuntu:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
docker compose down
docker compose up -d --build
docker compose ps
```

Test trên Ubuntu:

`[Ubuntu SSH]`

```bash
curl -I https://app.fmsec.shop
curl https://app.fmsec.shop/realms/cloudapi/.well-known/openid-configuration
curl -i https://app.fmsec.shop:8443/health
curl -i --cert certs/client.crt --key certs/client.key https://app.fmsec.shop:8443/health
```

Test trên Windows:

`[Windows PowerShell]`

```powershell
curl.exe -I https://app.fmsec.shop
curl.exe https://app.fmsec.shop/realms/cloudapi/.well-known/openid-configuration
curl.exe -i https://app.fmsec.shop:8443/health
```

Browser mở:

```text
https://app.fmsec.shop
```

Kỳ vọng:

```text
Browser không báo cert warning.
OIDC issuer là https://app.fmsec.shop/realms/cloudapi.
Không client cert gọi API bị chặn hoặc không qua mTLS.
Có client cert thì đi tiếp.
```

##### Cách 3B: Thử tạo 3 cert ECC riêng cho `app`, `auth`, `api`

Nếu bạn muốn thử đúng kiến trúc 3 hostname, làm theo mục này. Ý tưởng là không xin 1 cert multi-domain nữa, mà tạo 3 certificate single-domain riêng:

```text
Cert app:  app.fmsec.shop
Cert auth: auth.fmsec.shop
Cert api:  api.fmsec.shop
```

Mỗi cert đều:

```text
90-Day Certificate
Add-ons: OFF
Auto-Generate CSR: OFF
Paste Existing CSR: ON
Encryption: ECC prime256v1 / secp256r1
Validation: DNS (CNAME)
```

Lưu ý quan trọng:

```text
Tạo 3 cert riêng có thể vẫn free nếu tài khoản ZeroSSL còn quota.
Nếu ZeroSSL báo hết quota hoặc premium, quay lại Cách 3 dùng 1 hostname app.fmsec.shop.
```

###### Cách 3B.0. Nếu 3 cert đã `Issued` thì làm tiếp từ đây

Nếu trên ZeroSSL bạn đã thấy:

```text
app.fmsec.shop   Issued
auth.fmsec.shop  Issued
api.fmsec.shop   Issued
```

thì bạn không cần tạo CSR hay verify DNS nữa. Phần khó nhất đã xong.

Bây giờ làm tiếp theo thứ tự:

```text
1. Lấy IP Tailscale của Ubuntu server.
2. Tải 3 certificate zip từ ZeroSSL về Windows.
3. Giải nén vào thư mục riêng trong project Windows.
4. Copy certificate từ Windows lên Ubuntu bằng scp qua IP Tailscale.
5. Gắn certificate với ECC private key đã tạo trên Ubuntu.
6. Sửa .env sang domain.
7. Sửa hosts file Windows.
8. Restart Docker Compose.
9. Test HTTPS/OIDC/Kong/mTLS.
```

**Bước 3B.0.1. Lấy IP Tailscale của Ubuntu**

Cách chắc nhất là lấy trực tiếp trên Ubuntu:

`[Ubuntu SSH]`

```bash
tailscale ip -4
```

Kết quả sẽ là IP dạng:

```text
100.x.x.x
```

Ví dụ:

```text
100.90.80.70
```

Đây là IP Tailscale của Ubuntu. Trong các lệnh bên dưới, thay:

```text
<TAILSCALE_IP_UBUNTU>
```

bằng IP này.

Nếu `tailscale ip -4` không ra IP, chạy:

`[Ubuntu SSH]`

```bash
sudo tailscale up
tailscale status
tailscale ip -4
```

Nếu `sudo tailscale up` hiện URL đăng nhập, mở URL đó trên browser Windows, đăng nhập Tailscale và approve máy Ubuntu.

Cũng có thể lấy trên web:

`[Tailscale browser]`

```text
https://login.tailscale.com/admin/machines
```

Tìm máy Ubuntu, ví dụ `cloudapi-server`, hệ điều hành `Linux`, rồi copy IP ở cột `Addresses`.

Không lấy IP của máy Windows. Ví dụ:

```text
desktop-a0qmt6b   Windows   100.119.63.41  -> không dùng
cloudapi-server   Linux     100.90.80.70   -> dùng IP này
```

Kiểm tra từ Windows:

`[Windows PowerShell]`

```powershell
ping <TAILSCALE_IP_UBUNTU>
ssh cloudapi@<TAILSCALE_IP_UBUNTU>
```

Nếu SSH được vào Ubuntu thì dùng IP này cho `scp`.

**Bước 3B.0.2. Tải 3 certificate zip từ ZeroSSL về Windows**

Trên ZeroSSL, với từng cert:

```text
app.fmsec.shop
auth.fmsec.shop
api.fmsec.shop
```

làm:

```text
Install -> Server Type: Default Format -> Download Certificate (.zip)
```

Không cần bấm `Check Installation` lúc này.

**Bước 3B.0.3. Tạo thư mục chứa cert trên Windows**

Chạy trên Windows PowerShell:

`[Windows PowerShell]`

```powershell
cd D:\UIT\NAM2\HK2\MATMAHOC\PROJECT\Cloud_Api_Security

New-Item -ItemType Directory -Force .\zerossl-downloads\app
New-Item -ItemType Directory -Force .\zerossl-downloads\auth
New-Item -ItemType Directory -Force .\zerossl-downloads\api
```

Giải nén:

```text
app.fmsec.shop  -> zerossl-downloads\app\
auth.fmsec.shop -> zerossl-downloads\auth\
api.fmsec.shop  -> zerossl-downloads\api\
```

Kiểm tra:

`[Windows PowerShell]`

```powershell
Get-ChildItem .\zerossl-downloads\app
Get-ChildItem .\zerossl-downloads\auth
Get-ChildItem .\zerossl-downloads\api
```

Mỗi thư mục cần có:

```text
certificate.crt
ca_bundle.crt
```

Nếu có `private.key` trong zip, không dùng file đó. Bạn dùng ECC key tự tạo trên Ubuntu:

```text
~/Cloud_Api_Security/zerossl-csr/app/app-fmsec.key
~/Cloud_Api_Security/zerossl-csr/auth/auth-fmsec.key
~/Cloud_Api_Security/zerossl-csr/api/api-fmsec.key
```

**Bước 3B.0.4. Copy certificate từ Windows lên Ubuntu qua Tailscale**

Chạy trên Windows PowerShell:

`[Windows PowerShell]`

```powershell
cd D:\UIT\NAM2\HK2\MATMAHOC\PROJECT\Cloud_Api_Security

scp .\zerossl-downloads\app\certificate.crt cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/app-certificate.crt
scp .\zerossl-downloads\app\ca_bundle.crt cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/app-ca_bundle.crt

scp .\zerossl-downloads\auth\certificate.crt cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/auth-certificate.crt
scp .\zerossl-downloads\auth\ca_bundle.crt cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/auth-ca_bundle.crt

scp .\zerossl-downloads\api\certificate.crt cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/api-certificate.crt
scp .\zerossl-downloads\api\ca_bundle.crt cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/api-ca_bundle.crt
```

Ví dụ nếu IP Tailscale Ubuntu là `100.90.80.70`:

```powershell
scp .\zerossl-downloads\app\certificate.crt cloudapi@100.90.80.70:/home/cloudapi/app-certificate.crt
```

Kiểm tra trên Ubuntu:

`[Ubuntu SSH]`

```bash
ls -l /home/cloudapi/*certificate.crt /home/cloudapi/*ca_bundle.crt
```

**Bước 3B.0.5. Gắn certificate với ECC private key trên Ubuntu**

Chạy trên Ubuntu:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
mkdir -p certs

cat ~/app-certificate.crt ~/app-ca_bundle.crt > certs/app.crt
cat ~/auth-certificate.crt ~/auth-ca_bundle.crt > certs/auth.crt
cat ~/api-certificate.crt ~/api-ca_bundle.crt > certs/api.crt

cp zerossl-csr/app/app-fmsec.key certs/app.key
cp zerossl-csr/auth/auth-fmsec.key certs/auth.key
cp zerossl-csr/api/api-fmsec.key certs/api.key

chmod 644 certs/app.crt certs/auth.crt certs/api.crt
chmod 600 certs/app.key certs/auth.key certs/api.key
```

Kiểm tra:

`[Ubuntu SSH]`

```bash
openssl x509 -in certs/app.crt -noout -subject -issuer -dates
openssl x509 -in certs/auth.crt -noout -subject -issuer -dates
openssl x509 -in certs/api.crt -noout -subject -issuer -dates

openssl ec -in certs/app.key -noout -text | head -n 5
openssl ec -in certs/auth.key -noout -text | head -n 5
openssl ec -in certs/api.key -noout -text | head -n 5
```

**Bước 3B.0.6. Gắn vào cấu hình hiện tại để chạy được trước**

Project hiện tại đang dùng:

```text
certs/frontend.crt
certs/frontend.key
certs/kong.crt
certs/kong.key
```

Gắn:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security

cp certs/app.crt certs/frontend.crt
cp certs/app.key certs/frontend.key

cp certs/api.crt certs/kong.crt
cp certs/api.key certs/kong.key

chmod 644 certs/frontend.crt certs/kong.crt
chmod 600 certs/frontend.key certs/kong.key
```

Lúc này chạy theo mô hình:

```text
Frontend: https://app.fmsec.shop
Keycloak: https://app.fmsec.shop/realms/cloudapi
Kong: https://api.fmsec.shop:8443
```

Cert `auth.fmsec.shop` đã có, nhưng muốn dùng riêng cho `auth` thì cần sửa Nginx server block sau. Chạy ổn `app + api` trước.

**Bước 3B.0.7. Sửa `.env` trên Ubuntu**

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
nano .env
```

Sửa:

```env
VITE_KEYCLOAK_URL=https://app.fmsec.shop
VITE_KONG_URL=https://api.fmsec.shop:8443
BACKEND_CORS_ORIGINS=https://app.fmsec.shop
KC_HOSTNAME=app.fmsec.shop
PUBLIC_BASE_URL=https://app.fmsec.shop
JWT_ISSUER=https://app.fmsec.shop/realms/cloudapi
```

**Bước 3B.0.8. Sửa hosts file trên Windows**

Mở Notepad bằng quyền Administrator, mở:

```text
C:\Windows\System32\drivers\etc\hosts
```

Thêm:

```text
<TAILSCALE_IP_UBUNTU> app.fmsec.shop
<TAILSCALE_IP_UBUNTU> api.fmsec.shop
```

Tạm thời chưa cần `auth.fmsec.shop` nếu Keycloak đi qua `app.fmsec.shop/realms`.

Flush DNS:

`[Windows PowerShell]`

```powershell
ipconfig /flushdns
ping app.fmsec.shop
ping api.fmsec.shop
```

**Bước 3B.0.9. Restart Docker Compose**

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
docker compose down
docker compose up -d --build
docker compose ps
```

Nếu lỗi, xem log:

```bash
docker compose logs --tail=100 frontend
docker compose logs --tail=100 keycloak
docker compose logs --tail=100 kong
docker compose logs --tail=100 backend
```

**Bước 3B.0.10. Test trên Ubuntu**

`[Ubuntu SSH]`

```bash
curl -I https://app.fmsec.shop
curl https://app.fmsec.shop/realms/cloudapi/.well-known/openid-configuration
curl -i https://api.fmsec.shop:8443/health
curl -i --cert certs/client.crt --key certs/client.key https://api.fmsec.shop:8443/health
```

Nếu Ubuntu chưa resolve được domain về chính nó:

```bash
sudo nano /etc/hosts
```

Thêm:

```text
127.0.0.1 app.fmsec.shop
127.0.0.1 api.fmsec.shop
```

**Bước 3B.0.11. Test trên Windows**

`[Windows PowerShell]`

```powershell
curl.exe -I https://app.fmsec.shop
curl.exe https://app.fmsec.shop/realms/cloudapi/.well-known/openid-configuration
curl.exe -i https://api.fmsec.shop:8443/health
```

Mở browser:

```text
https://app.fmsec.shop
```

Kỳ vọng:

```text
Browser không báo certificate warning.
OIDC issuer là https://app.fmsec.shop/realms/cloudapi.
Kong dùng https://api.fmsec.shop:8443.
```

###### Cách 3B.1. Tạo CSR ECC cho cả 3 hostname trên Ubuntu

Chạy trên Ubuntu:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
mkdir -p zerossl-csr/app zerossl-csr/auth zerossl-csr/api
```

Tạo CSR cho `app.fmsec.shop`:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security/zerossl-csr/app

openssl ecparam -name prime256v1 -genkey -noout -out app-fmsec.key

cat > app-fmsec.cnf <<'EOF'
[req]
default_md = sha256
prompt = no
distinguished_name = dn
req_extensions = req_ext

[dn]
CN = app.fmsec.shop

[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = app.fmsec.shop
EOF

openssl req -new \
  -key app-fmsec.key \
  -out app-fmsec.csr \
  -config app-fmsec.cnf

openssl req -in app-fmsec.csr -noout -text | grep -A4 "Subject Alternative Name"
openssl req -in app-fmsec.csr -noout -text | grep -A6 "Subject Public Key Info"
```

Tạo CSR cho `auth.fmsec.shop`:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security/zerossl-csr/auth

openssl ecparam -name prime256v1 -genkey -noout -out auth-fmsec.key

cat > auth-fmsec.cnf <<'EOF'
[req]
default_md = sha256
prompt = no
distinguished_name = dn
req_extensions = req_ext

[dn]
CN = auth.fmsec.shop

[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = auth.fmsec.shop
EOF

openssl req -new \
  -key auth-fmsec.key \
  -out auth-fmsec.csr \
  -config auth-fmsec.cnf

openssl req -in auth-fmsec.csr -noout -text | grep -A4 "Subject Alternative Name"
openssl req -in auth-fmsec.csr -noout -text | grep -A6 "Subject Public Key Info"
```

Tạo CSR cho `api.fmsec.shop`:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security/zerossl-csr/api

openssl ecparam -name prime256v1 -genkey -noout -out api-fmsec.key

cat > api-fmsec.cnf <<'EOF'
[req]
default_md = sha256
prompt = no
distinguished_name = dn
req_extensions = req_ext

[dn]
CN = api.fmsec.shop

[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = api.fmsec.shop
EOF

openssl req -new \
  -key api-fmsec.key \
  -out api-fmsec.csr \
  -config api-fmsec.cnf

openssl req -in api-fmsec.csr -noout -text | grep -A4 "Subject Alternative Name"
openssl req -in api-fmsec.csr -noout -text | grep -A6 "Subject Public Key Info"
```

Kỳ vọng mỗi CSR có:

```text
Public Key Algorithm: id-ecPublicKey
ASN1 OID: prime256v1
```

Và SAN đúng domain tương ứng.

###### Cách 3B.2. Tạo cert `app.fmsec.shop` trên ZeroSSL

In CSR app:

`[Ubuntu SSH]`

```bash
cat ~/Cloud_Api_Security/zerossl-csr/app/app-fmsec.csr
```

Làm trên ZeroSSL:

`[ZeroSSL browser]`

1. `Certificates` -> `New Certificate`.
2. `Enter Domains`: chỉ nhập:

```text
app.fmsec.shop
```

3. `Wildcard`: OFF.
4. `Validity`: `90-Day Certificate`.
5. `Add-ons`: tắt hết.
6. `CSR & Contact`:

```text
Auto-Generate CSR: OFF
Paste Existing CSR: ON
```

7. Paste CSR `app-fmsec.csr`.
8. `Encryption Algorithm` phải hiện ECC.
9. `Verification Method`: chọn `DNS (CNAME)`.
10. Bấm `Next Step`.

ZeroSSL sẽ đưa CNAME cho `app.fmsec.shop`. Ví dụ:

```text
Name: _abc123.app.fmsec.shop
Value: _abc123.validation.zerossl.com
```

Thêm CNAME này ở Hostinger:

`[Hostinger browser]`

```text
Loại: CNAME
Tên: _abc123.app
Giá trị: _abc123.validation.zerossl.com
TTL: 14400
```

Kiểm tra:

`[Windows PowerShell]`

```powershell
nslookup -type=CNAME _abc123.app.fmsec.shop
```

Sau khi DNS lên, quay lại ZeroSSL bấm verify. Nếu issued, tải về và lưu vào:

```text
D:\Downloads\fmsec-zerossl\app\
```

Trong thư mục đó cần có:

```text
certificate.crt
ca_bundle.crt
```

###### Cách 3B.3. Tạo cert `auth.fmsec.shop` trên ZeroSSL

In CSR auth:

`[Ubuntu SSH]`

```bash
cat ~/Cloud_Api_Security/zerossl-csr/auth/auth-fmsec.csr
```

Lặp lại trên ZeroSSL:

`[ZeroSSL browser]`

1. `Certificates` -> `New Certificate`.
2. `Enter Domains`: chỉ nhập:

```text
auth.fmsec.shop
```

3. `Wildcard`: OFF.
4. `Validity`: `90-Day Certificate`.
5. `Add-ons`: tắt hết.
6. `Auto-Generate CSR`: OFF.
7. `Paste Existing CSR`: ON.
8. Paste CSR `auth-fmsec.csr`.
9. Kiểm tra `Encryption Algorithm` hiện ECC.
10. Chọn `DNS (CNAME)`.

ZeroSSL sẽ đưa CNAME cho `auth.fmsec.shop`. Thêm vào Hostinger:

```text
Loại: CNAME
Tên: <phần host mà ZeroSSL đưa, thường là _xxxxx.auth>
Giá trị: <value ZeroSSL đưa>
TTL: 14400
```

Kiểm tra:

`[Windows PowerShell]`

```powershell
nslookup -type=CNAME <NAME_CNAME_AUTH_DAY_DU>
```

Verify trên ZeroSSL. Nếu issued, tải về và lưu vào:

```text
D:\Downloads\fmsec-zerossl\auth\
```

###### Cách 3B.4. Tạo cert `api.fmsec.shop` trên ZeroSSL

In CSR api:

`[Ubuntu SSH]`

```bash
cat ~/Cloud_Api_Security/zerossl-csr/api/api-fmsec.csr
```

Lặp lại trên ZeroSSL:

`[ZeroSSL browser]`

1. `Certificates` -> `New Certificate`.
2. `Enter Domains`: chỉ nhập:

```text
api.fmsec.shop
```

3. `Wildcard`: OFF.
4. `Validity`: `90-Day Certificate`.
5. `Add-ons`: tắt hết.
6. `Auto-Generate CSR`: OFF.
7. `Paste Existing CSR`: ON.
8. Paste CSR `api-fmsec.csr`.
9. Kiểm tra `Encryption Algorithm` hiện ECC.
10. Chọn `DNS (CNAME)`.

Thêm CNAME ZeroSSL đưa vào Hostinger:

```text
Loại: CNAME
Tên: <phần host mà ZeroSSL đưa, thường là _xxxxx.api>
Giá trị: <value ZeroSSL đưa>
TTL: 14400
```

Kiểm tra:

`[Windows PowerShell]`

```powershell
nslookup -type=CNAME <NAME_CNAME_API_DAY_DU>
```

Verify trên ZeroSSL. Nếu issued, tải về và lưu vào:

```text
D:\Downloads\fmsec-zerossl\api\
```

###### Cách 3B.5. Copy 3 cert lên Ubuntu

Chạy trên Windows:

`[Windows PowerShell]`

```powershell
scp D:\Downloads\fmsec-zerossl\app\certificate.crt cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/app-certificate.crt
scp D:\Downloads\fmsec-zerossl\app\ca_bundle.crt cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/app-ca_bundle.crt

scp D:\Downloads\fmsec-zerossl\auth\certificate.crt cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/auth-certificate.crt
scp D:\Downloads\fmsec-zerossl\auth\ca_bundle.crt cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/auth-ca_bundle.crt

scp D:\Downloads\fmsec-zerossl\api\certificate.crt cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/api-certificate.crt
scp D:\Downloads\fmsec-zerossl\api\ca_bundle.crt cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/api-ca_bundle.crt
```

###### Cách 3B.6. Gắn cert vào project hiện tại

Project hiện tại có 2 điểm TLS public chính:

```text
frontend Nginx: đang phục vụ frontend và proxy Keycloak resources/realms
Kong Gateway: phục vụ API ở port 8443
```

Với cấu hình hiện tại, `frontend/nginx.conf` thường chỉ dùng một cặp cert:

```text
certs/frontend.crt
certs/frontend.key
```

Vì vậy có 2 hướng:

```text
Hướng 3B-A đơn giản: dùng cert app cho frontend, cấu hình Keycloak cũng đi qua app hoặc chấp nhận auth cần sửa Nginx thêm.
Hướng 3B-B đầy đủ 3 hostname: sửa Nginx để có server block riêng cho app và auth, Kong dùng cert api.
```

Nếu bạn muốn làm nhanh sau khi có 3 cert, làm Hướng 3B-A trước:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
mkdir -p certs

cat ~/app-certificate.crt ~/app-ca_bundle.crt > /tmp/app-fullchain.crt
cat ~/api-certificate.crt ~/api-ca_bundle.crt > /tmp/api-fullchain.crt

cp /tmp/app-fullchain.crt certs/frontend.crt
cp zerossl-csr/app/app-fmsec.key certs/frontend.key

cp /tmp/api-fullchain.crt certs/kong.crt
cp zerossl-csr/api/api-fmsec.key certs/kong.key

chmod 644 certs/frontend.crt certs/kong.crt
chmod 600 certs/frontend.key certs/kong.key
```

Sau đó dùng cấu hình 1 hostname hoặc 2 hostname tùy Nginx hiện tại. Nếu chưa sửa Nginx tách `auth.fmsec.shop`, dùng 1 hostname `app.fmsec.shop` là ổn nhất.

Nếu muốn Hướng 3B-B đầy đủ 3 hostname, cần sửa `frontend/nginx.conf` để có 2 server block:

```text
server_name app.fmsec.shop;
ssl_certificate     /etc/nginx/certs/app.crt;
ssl_certificate_key /etc/nginx/certs/app.key;

server_name auth.fmsec.shop;
ssl_certificate     /etc/nginx/certs/auth.crt;
ssl_certificate_key /etc/nginx/certs/auth.key;
```

và sửa Docker mount cert tương ứng. Phần này nhiều thay đổi hơn, nên chỉ làm sau khi bạn đã có đủ 3 cert issued thành công.

###### Cách 3B.7. Kết luận chọn hướng nào sau khi thử 3 cert

Nếu cả 3 cert đều issued free:

```text
Bạn có thể giữ 3 cert để chứng minh đã xin được cert riêng cho từng node public.
Triển khai thực tế trước mắt vẫn nên dùng app cert + api cert nếu chưa sửa Nginx auth riêng.
```

Nếu chỉ `app.fmsec.shop` issued free:

```text
Dùng Cách 3 một hostname app.fmsec.shop cho toàn bộ demo.
```

Nếu `app` và `api` issued free, nhưng `auth` không:

```text
Frontend/Keycloak dùng app.fmsec.shop.
Kong dùng api.fmsec.shop.
```

Nếu ZeroSSL báo hết quota:

```text
Không tạo thêm cert mới nữa.
Dùng cert app.fmsec.shop đã tạo được để hoàn thiện demo.
```

##### Cách 4: Đơn giản hóa về 1 hostname `app.fmsec.shop`

Nếu ZeroSSL free chặn multi-domain, hướng dễ nhất là dùng một hostname:

```text
app.fmsec.shop
```

Khi đó:

```text
Frontend: https://app.fmsec.shop
Keycloak proxy: https://app.fmsec.shop/realms/cloudapi
Keycloak admin: https://app.fmsec.shop/admin
Kong API: https://app.fmsec.shop:8443
```

File `.env` đổi thành:

```env
VITE_KEYCLOAK_URL=https://app.fmsec.shop
VITE_KONG_URL=https://app.fmsec.shop:8443
BACKEND_CORS_ORIGINS=https://app.fmsec.shop
KC_HOSTNAME=app.fmsec.shop
PUBLIC_BASE_URL=https://app.fmsec.shop
JWT_ISSUER=https://app.fmsec.shop/realms/cloudapi
```

Hosts file trên Windows/bạn bè chỉ cần:

```text
<TAILSCALE_IP_UBUNTU> app.fmsec.shop
```

Nhược điểm: sơ đồ domain không tách đẹp thành `app/auth/api`.

Ưu điểm:

```text
Dễ xin cert free.
Dễ debug.
Vẫn chứng minh được HTTPS public CA + Tailscale + OIDC + mTLS.
```

##### Cách 5: Nếu ZeroSSL vẫn chặn ECC CSR

Nếu ngay cả cert 1 domain ECC cũng bị chặn, có 3 hướng:

```text
Hướng 1: Dùng ZeroSSL RSA 2048 cho public cert, giữ ECC cho cert nội bộ/mTLS.
Hướng 2: Dùng CA khác hỗ trợ ECC miễn phí tốt hơn, ví dụ Let's Encrypt nếu bạn dùng DNS challenge qua nhà cung cấp DNS/API phù hợp.
Hướng 3: Dùng self-signed/internal CA cho mức demo Tailscale, nhưng browser sẽ không tin public CA.
```

Với mục tiêu của bạn là chứng minh public HTTPS bằng domain thật, ưu tiên:

```text
Thử cert ECC 1 domain app.fmsec.shop trước.
Nếu pass, chọn hướng 1 domain hoặc 3 cert riêng.
Nếu không pass, cân nhắc dùng RSA public cert và ghi rõ ECC được dùng ở mTLS/internal cert.
```

#### 2.8.9. Sau khi tải cert thì quay về terminal, không chỉnh DNS nữa

Sau khi đã tải được cert:

```text
certificate.crt
ca_bundle.crt
```

thì phần qua lại giữa Hostinger và ZeroSSL tạm xong.

Tiếp theo chuyển sang:

```text
Bước 7. Copy cert ZeroSSL lên Ubuntu
```

Từ đây trở đi làm bằng:

- Windows PowerShell để `scp` file lên Ubuntu.
- Ubuntu SSH để copy cert vào `certs/`, sửa `.env`, chạy Docker Compose.

### Bước 3. Cài Tailscale trên Ubuntu và lấy IP server

Chạy trên Ubuntu:

`[Ubuntu SSH]`

```bash
cd ~
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Lệnh `sudo tailscale up` sẽ in ra một URL đăng nhập. Mở URL đó trên Windows browser, đăng nhập Tailscale và approve máy Ubuntu.

Kiểm tra:

`[Ubuntu SSH]`

```bash
tailscale status
tailscale ip -4
```

Ghi lại IP trả về, ví dụ:

```text
100.90.80.70
```

Từ đây gọi là:

```text
<TAILSCALE_IP_UBUNTU>
```

#### Bước 3.1. Phân biệt IP Tailscale của Windows và IP Tailscale của Ubuntu

Trong Tailscale Admin Console, nếu bạn thấy dòng như:

```text
Machine: desktop-a0qmt6b
Addresses: 100.119.63.41
Version: Windows 11 25H2
Last seen: Connected
```

thì `100.119.63.41` là IP Tailscale của máy Windows, không phải IP server Ubuntu.

Không dùng IP này để map domain:

```text
Sai nếu đây là IP Windows:
100.119.63.41 app.fmsec.shop
100.119.63.41 auth.fmsec.shop
100.119.63.41 api.fmsec.shop
```

Lý do: project Docker Compose đang chạy trên Ubuntu VM, không chạy trên Windows. Nếu map domain về IP Windows thì browser sẽ đi nhầm sang máy Windows, không tới server.

Bạn cần thấy thêm một machine khác trong Tailscale, ví dụ:

```text
Machine: cloudapi-server
Addresses: 100.x.x.x
Version: Linux
Last seen: Connected
```

IP `100.x.x.x` của machine Linux/Ubuntu đó mới là IP cần dùng:

```text
Đúng:
<TAILSCALE_IP_UBUNTU> app.fmsec.shop
<TAILSCALE_IP_UBUNTU> auth.fmsec.shop
<TAILSCALE_IP_UBUNTU> api.fmsec.shop
```

Nếu trang Tailscale chỉ hiện `1 machine` và machine đó là Windows, nghĩa là Ubuntu chưa được thêm vào tailnet. Khi đó quay lại Ubuntu và chạy:

`[Ubuntu SSH]`

```bash
sudo tailscale up
tailscale status
tailscale ip -4
```

Nếu `sudo tailscale up` in ra URL đăng nhập, mở URL đó trên Windows browser và approve Ubuntu. Sau khi approve xong, quay lại Tailscale Admin Console, bạn phải thấy ít nhất 2 machines:

```text
desktop-...       Windows      100.119.63.41
cloudapi-server   Linux        100.x.x.x
```

#### Bước 3.2. Lấy IP Ubuntu bằng Tailscale Admin Console

Làm trên browser:

`[Tailscale browser]`

1. Vào `https://login.tailscale.com/admin/machines`.
2. Chọn tab `Machines`.
3. Tìm machine có tên Ubuntu, ví dụ `cloudapi-server`.
4. Kiểm tra cột version/hệ điều hành là `Linux`.
5. Copy IP trong cột `Addresses`, dạng `100.x.x.x`.
6. Dùng IP đó thay cho `<TAILSCALE_IP_UBUNTU>` trong toàn bộ hướng dẫn.

Nếu chưa thấy Ubuntu trong danh sách:

1. Ubuntu chưa cài Tailscale, hoặc
2. Ubuntu đã cài nhưng chưa `sudo tailscale up`, hoặc
3. Ubuntu đăng nhập bằng tài khoản/tailnet khác, hoặc
4. Ubuntu không có Internet tại lúc đăng nhập Tailscale.

Kiểm tra trên Ubuntu:

`[Ubuntu SSH]`

```bash
systemctl status tailscaled --no-pager
tailscale status
tailscale ip -4
```

Nếu `tailscale ip -4` trả về IP `100.x.x.x`, nghĩa là Ubuntu đã có IP Tailscale.

#### Bước 3.3. Kiểm tra Windows đi tới Ubuntu bằng IP Tailscale

Sau khi có IP Ubuntu, chạy trên Windows:

`[Windows PowerShell]`

```powershell
ping <TAILSCALE_IP_UBUNTU>
ssh cloudapi@<TAILSCALE_IP_UBUNTU>
```

Ví dụ:

```powershell
ping 100.90.80.70
ssh cloudapi@100.90.80.70
```

Nếu SSH được vào Ubuntu qua IP Tailscale thì mới tiếp tục map domain trong hosts file.

Nếu lệnh cài nhanh lỗi, dùng cách cài bằng apt cho Ubuntu 24.04:

`[Ubuntu SSH]`

```bash
sudo apt update
sudo apt install -y curl gnupg
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.tailscale-keyring.list | sudo tee /etc/apt/sources.list.d/tailscale.list
sudo apt update
sudo apt install -y tailscale
sudo tailscale up
tailscale ip -4
```

### Bước 4. Cài Tailscale trên Windows và kiểm tra SSH

Làm trên Windows:

`[Windows browser]`

1. Cài Tailscale cho Windows.
2. Đăng nhập cùng tài khoản Tailscale với Ubuntu.
3. Kiểm tra Windows thấy máy Ubuntu trong danh sách device.

Chạy trên PowerShell:

`[Windows PowerShell]`

```powershell
tailscale status
ping <TAILSCALE_IP_UBUNTU>
ssh cloudapi@<TAILSCALE_IP_UBUNTU>
```

Nếu SSH vào được bằng IP Tailscale thì đường mạng đã ổn.

### Bước 5. Map domain về IP Tailscale bằng hosts file

Mở Notepad bằng quyền Administrator trên Windows:

`[Windows]`

1. Start -> gõ `Notepad`.
2. Chuột phải -> `Run as administrator`.
3. Mở file:

```text
C:\Windows\System32\drivers\etc\hosts
```

Thêm 3 dòng, thay IP bằng IP Tailscale thật:

```text
<TAILSCALE_IP_UBUNTU> app.fmsec.shop
<TAILSCALE_IP_UBUNTU> auth.fmsec.shop
<TAILSCALE_IP_UBUNTU> api.fmsec.shop
```

Ví dụ:

```text
100.90.80.70 app.fmsec.shop
100.90.80.70 auth.fmsec.shop
100.90.80.70 api.fmsec.shop
```

Flush DNS cache và kiểm tra:

`[Windows PowerShell]`

```powershell
ipconfig /flushdns
ping app.fmsec.shop
ping auth.fmsec.shop
ping api.fmsec.shop
```

Kỳ vọng `ping` hiện IP Tailscale của Ubuntu. Nếu `nslookup` không hiện giống hosts file thì chưa chắc lỗi, vì `nslookup` thường hỏi DNS server trực tiếp.

Máy bạn bè cũng làm tương tự. Bạn bè không cần repo.

### Bước 6. Xin cert ZeroSSL bằng DNS validation

Làm trên ZeroSSL:

`[ZeroSSL browser]`

1. Vào `Certificates`.
2. Chọn `New Certificate`.
3. Nhập 3 hostname:

```text
app.fmsec.shop
auth.fmsec.shop
api.fmsec.shop
```

4. Chọn certificate 90 ngày nếu dùng gói miễn phí.
5. Chọn `DNS validation`.
6. ZeroSSL sẽ đưa record `CNAME` hoặc `TXT`.

Làm trên Hostinger:

`[Hostinger browser]`

1. Vào `Tên miền` -> `fmsec.shop`.
2. Mở `DNS Zone`.
3. Thêm đúng record ZeroSSL yêu cầu.

Ví dụ nếu ZeroSSL đưa:

```text
Type: CNAME
Name: _abc123.app.fmsec.shop
Value: _xyz987.acm-validations.aws
```

thì thêm đúng `CNAME`, đúng `Name`, đúng `Value`.

Lưu ý: nếu Hostinger tự thêm `.fmsec.shop` phía sau, không nhập lặp thành `_abc123.app.fmsec.shop.fmsec.shop`.

Đợi vài phút, quay lại ZeroSSL bấm verify. Khi issued, tải về 2 file certificate:

```text
certificate.crt
ca_bundle.crt
```

Với hướng ECC, không dùng `private.key` do ZeroSSL tự sinh. Khóa bí mật đúng là file đã tạo trước đó trên Ubuntu:

```text
~/Cloud_Api_Security/zerossl-csr/fmsec-zerossl.key
```

Không commit file `.key` lên GitHub, không gửi cho người khác.

### Bước 7. Copy cert ZeroSSL lên Ubuntu

Giả sử cert nằm trên Windows ở:

```text
D:\Downloads\fmsec-shop-zerossl
```

Vì bạn dùng ECC CSR tự tạo trên Ubuntu, chỉ copy 2 file certificate lên Ubuntu.

Chạy trên Windows:

`[Windows PowerShell]`

```powershell
cd D:\Downloads\fmsec-shop-zerossl
scp .\certificate.crt cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/
scp .\ca_bundle.crt cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/
```

Chạy trên Ubuntu:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
mkdir -p certs

cat ~/certificate.crt ~/ca_bundle.crt > /tmp/fmsec-fullchain.crt

cp /tmp/fmsec-fullchain.crt certs/frontend.crt
cp zerossl-csr/fmsec-zerossl.key certs/frontend.key

cp /tmp/fmsec-fullchain.crt certs/kong.crt
cp zerossl-csr/fmsec-zerossl.key certs/kong.key

chmod 644 certs/frontend.crt certs/kong.crt
chmod 600 certs/frontend.key certs/kong.key
```

Không thay các cert nội bộ này bằng ZeroSSL:

```text
certs/ca.crt
certs/ca.key
certs/client.crt
certs/client.key
certs/client.p12
certs/backend.crt
certs/backend.key
```

Giải thích nhanh:

- `frontend.crt/key`: cert ZeroSSL cho `app.fmsec.shop` và `auth.fmsec.shop`.
- `kong.crt/key`: cert ZeroSSL cho `api.fmsec.shop`.
- `ca.crt/key`: CA nội bộ để verify client cert mTLS.
- `client.crt/key`: cert client dùng để test mTLS.
- `backend.crt/key`: cert nội bộ cho backend nếu backend chạy TLS nội bộ.

Kiểm tra SAN của cert:

`[Ubuntu SSH]`

```bash
openssl x509 -in certs/frontend.crt -noout -text | grep -A2 "Subject Alternative Name"
openssl x509 -in certs/kong.crt -noout -text | grep -A2 "Subject Alternative Name"
```

Cần thấy:

```text
DNS:app.fmsec.shop
DNS:auth.fmsec.shop
DNS:api.fmsec.shop
```

### Bước 8. Sửa `.env` trên Ubuntu sang domain

Chạy trên Ubuntu:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
nano .env
```

Sửa các dòng public URL:

```env
VITE_REALM=cloudapi
VITE_CLIENT_ID=spa-client
VITE_KEYCLOAK_URL=https://auth.fmsec.shop
VITE_KONG_URL=https://api.fmsec.shop:8443

BACKEND_CORS_ORIGINS=https://app.fmsec.shop
KC_HOSTNAME=auth.fmsec.shop
PUBLIC_BASE_URL=https://app.fmsec.shop
JWT_ISSUER=https://auth.fmsec.shop/realms/cloudapi
```

Nếu project của bạn đang dùng client id khác, giữ đúng client id đang có trong Keycloak. Có thể kiểm tra bằng:

`[Ubuntu SSH]`

```bash
grep -R "\"clientId\"" -n idp/keycloak/realm-export.json
```

Tìm IP cũ còn sót:

`[Ubuntu SSH]`

```bash
grep -R "192.168.1.28\|192.168.1.27" -n . --exclude-dir=.git --exclude-dir=node_modules
```

Nếu thấy IP cũ trong `.env`, `gateway/kong.yml`, `idp/keycloak/realm-export.json`, hãy thay sang domain.

### Bước 9. Sửa Kong CORS và Keycloak redirect

Sửa Kong:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
nano gateway/kong.yml
```

Trong phần CORS/origins, đảm bảo có:

```yaml
- "https://app.fmsec.shop"
```

Sửa Keycloak realm export:

`[Ubuntu SSH]`

```bash
nano idp/keycloak/realm-export.json
```

Với client frontend, cần có:

```json
"redirectUris": [
  "https://app.fmsec.shop/*"
],
"webOrigins": [
  "https://app.fmsec.shop"
]
```

Nếu Keycloak đã chạy trước đó, realm có thể đã được import vào database. Khi đó sửa `realm-export.json` chưa chắc áp dụng ngay.

Cách nhanh cho demo nếu chấp nhận mất dữ liệu demo cũ:

`[Ubuntu SSH]`

```bash
docker compose down -v
docker compose up -d --build
```

Cách giữ dữ liệu:

`[Browser]`

```text
https://auth.fmsec.shop/admin
```

Vào client frontend và sửa:

```text
Valid redirect URIs: https://app.fmsec.shop/*
Web origins: https://app.fmsec.shop
```

### Bước 10. Nếu sửa file ở Windows thì đồng bộ lên Ubuntu

Nếu bạn chỉnh file trên Windows, copy các file quan trọng lên Ubuntu:

`[Windows PowerShell]`

```powershell
cd D:\UIT\NAM2\HK2\MATMAHOC\PROJECT\Cloud_Api_Security
scp .\.env cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/Cloud_Api_Security/.env
scp .\frontend\nginx.conf cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/Cloud_Api_Security/frontend/nginx.conf
scp .\gateway\kong.yml cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/Cloud_Api_Security/gateway/kong.yml
scp .\idp\keycloak\realm-export.json cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/Cloud_Api_Security/idp/keycloak/realm-export.json
```

Nếu dùng `rsync`, chạy ở Git Bash trên Windows, tại thư mục project:

`[Windows Git Bash]`

```bash
cd /d/UIT/NAM2/HK2/MATMAHOC/PROJECT/Cloud_Api_Security
rsync -av --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.venv/' \
  --exclude='*.md' \
  ./ cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/Cloud_Api_Security/
```

Nếu Windows chưa có `rsync`, dùng `scp` từng file như trên là đủ.

### Bước 11. Chạy lại server trên Ubuntu

Chạy trên Ubuntu:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
docker compose down
docker compose up -d --build
docker compose ps
```

Xem log khi cần:

`[Ubuntu SSH]`

```bash
docker compose logs --tail=100 frontend
docker compose logs --tail=100 keycloak
docker compose logs --tail=100 kong
docker compose logs --tail=100 backend
```

### Bước 12. Test ngay trên Ubuntu

Nếu Ubuntu chưa resolve được domain về chính server, thêm vào `/etc/hosts`:

`[Ubuntu SSH]`

```bash
sudo nano /etc/hosts
```

Thêm:

```text
127.0.0.1 app.fmsec.shop
127.0.0.1 auth.fmsec.shop
127.0.0.1 api.fmsec.shop
```

Test:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
curl -I https://app.fmsec.shop
curl https://auth.fmsec.shop/realms/cloudapi/.well-known/openid-configuration
curl -i https://api.fmsec.shop:8443/health
curl -i --cert certs/client.crt --key certs/client.key https://api.fmsec.shop:8443/health
```

Kỳ vọng:

- `https://app.fmsec.shop` trả `200` hoặc `30x`, không cần `-k`.
- OIDC discovery có issuer `https://auth.fmsec.shop/realms/cloudapi`.
- API không client cert bị chặn hoặc không qua được mTLS.
- API có client cert đi tiếp. Nếu sau đó `401`, nghĩa là mTLS đã qua nhưng thiếu JWT/token.

### Bước 13. Test từ Windows

Chạy trên Windows:

`[Windows PowerShell]`

```powershell
ping app.fmsec.shop
curl.exe -I https://app.fmsec.shop
curl.exe https://auth.fmsec.shop/realms/cloudapi/.well-known/openid-configuration
curl.exe -i https://api.fmsec.shop:8443/health
```

Test mTLS từ Windows:

`[Windows PowerShell]`

```powershell
cd D:\UIT\NAM2\HK2\MATMAHOC\PROJECT\Cloud_Api_Security
curl.exe -i --cert .\certs\client.crt --key .\certs\client.key https://api.fmsec.shop:8443/health
```

Mở browser:

```text
https://app.fmsec.shop
```

Nếu browser không báo certificate warning thì ZeroSSL đã hoạt động đúng.

### Bước 14. Sửa lỗi Keycloak login bị HTML thô, mất CSS

Kiểm tra Nginx trong container:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
docker compose exec frontend sh -lc 'grep -n "location .*realms" -A12 /etc/nginx/conf.d/default.conf'
docker compose exec frontend sh -lc 'grep -n "location .*resources" -A12 /etc/nginx/conf.d/default.conf'
```

Cần thấy:

```nginx
location ^~ /realms/ {
    proxy_pass http://keycloak:8080/realms/;
}

location ^~ /resources/ {
    proxy_pass http://keycloak:8080/resources/;
}
```

Nếu Ubuntu vẫn chưa có `^~`, copy file từ Windows:

`[Windows PowerShell]`

```powershell
cd D:\UIT\NAM2\HK2\MATMAHOC\PROJECT\Cloud_Api_Security
scp .\frontend\nginx.conf cloudapi@<TAILSCALE_IP_UBUNTU>:/home/cloudapi/Cloud_Api_Security/frontend/nginx.conf
```

Rebuild:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
docker compose up -d --build frontend
docker compose exec frontend nginx -t
```

### Bước 15. Cấu hình Google login sau khi có domain

Google login không chạy với private IP như `https://192.168.1.28/...`. Lỗi:

```text
device_id and device_name are required for private IP
Error 400: invalid_request
```

là do Google OAuth không chấp nhận redirect URI web app dùng private IP.

Ở mức 2, redirect URI đúng là:

```text
https://auth.fmsec.shop/realms/cloudapi/broker/google/endpoint
```

Làm trên Google Cloud Console:

`[Google Cloud Console browser]`

1. Vào `APIs & Services`.
2. Vào `Credentials`.
3. Mở OAuth Client ID.
4. Thêm vào `Authorized redirect URIs`:

```text
https://auth.fmsec.shop/realms/cloudapi/broker/google/endpoint
```

5. Lưu.

Làm trên Keycloak:

`[Browser]`

```text
https://auth.fmsec.shop/admin
```

1. Chọn realm `cloudapi`.
2. Vào `Identity providers`.
3. Mở Google provider.
4. Kiểm tra Client ID/Client Secret đúng với Google Cloud Console.
5. Redirect URI Keycloak hiển thị phải là:

```text
https://auth.fmsec.shop/realms/cloudapi/broker/google/endpoint
```

### Bước 16. Bạn bè vào domain của bạn như thế nào

Bạn bè cần:

1. Cài Tailscale.
2. Được bạn invite vào tailnet hoặc share device Ubuntu.
3. Sửa hosts file:

```text
<TAILSCALE_IP_UBUNTU> app.fmsec.shop
<TAILSCALE_IP_UBUNTU> auth.fmsec.shop
<TAILSCALE_IP_UBUNTU> api.fmsec.shop
```

4. Mở:

```text
https://app.fmsec.shop
```

Bạn bè không cần repo. Nếu chỉ xem web UI thì không cần client cert. Nếu test mTLS API trực tiếp thì cần client cert.

### Bước 17. Bằng chứng cần lưu cho báo cáo

Nên chụp/lưu:

1. Hostinger có domain `fmsec.shop`.
2. ZeroSSL certificate issued cho `app.fmsec.shop`, `auth.fmsec.shop`, `api.fmsec.shop`.
3. `openssl x509` cho thấy SAN đúng 3 hostname.
4. Windows hosts file map domain về IP Tailscale Ubuntu.
5. Tailscale status thấy Ubuntu online.
6. Browser mở `https://app.fmsec.shop` không báo cert warning.
7. Keycloak discovery issuer là `https://auth.fmsec.shop/realms/cloudapi`.
8. API không client cert bị chặn.
9. API có client cert đi tiếp.
10. Google login dùng domain redirect, không còn private IP redirect.

### Bước 18. Kết luận bảo mật của cách này

Cách Ubuntu VM + Tailscale + ZeroSSL đáp ứng tốt cho demo vì:

- Có domain thật.
- Có certificate public CA từ ZeroSSL.
- Browser kiểm tra được HTTPS theo domain thật.
- Traffic đi qua Tailscale tới Ubuntu thay vì expose server trực tiếp ra Internet.
- API Gateway có thể yêu cầu mTLS bằng client certificate.
- Keycloak/OIDC issuer dùng domain thay vì localhost/private IP.
- Backend, database, Redis, Vault, OPA vẫn nằm trong Docker network, không public trực tiếp.

Giới hạn cần ghi rõ:

- Đây là demo an toàn trong phạm vi Tailscale, chưa phải production public Internet đầy đủ.
- Firewall HA, WAF cluster, Load Balancer HA trong sơ đồ lớn chưa triển khai đầy đủ nếu chỉ dùng một Ubuntu VM.
- Nếu muốn giống production hơn, cần VPS/public IP, reverse proxy/load balancer thật, WAF thật, monitoring và hardening đầy đủ hơn.

## Trước khi làm mức 2: xử lý 2 vấn đề vừa gặp ở mức 1

Nếu mức 1 đang gặp 2 vấn đề dưới đây, xử lý xong rồi mới chuyển sang domain/ZeroSSL.

### Câu hỏi 1: Vì sao giao diện Keycloak login nhìn như HTML thô, không có CSS?

Hiện tượng:

```text
Trang Keycloak vẫn hiện form login.
Nhưng giao diện rất xấu, chữ đen trắng thô, không có theme đẹp.
URL đang là https://192.168.1.28/realms/cloudapi/protocol/openid-connect/auth...
```

Nguyên nhân thường gặp trong project này:

```text
Keycloak trả HTML login được, nhưng CSS/JS/theme resource ở /resources/... không load đúng.
Nginx frontend có proxy /resources/ sang Keycloak, nhưng rule static file .css/.js phía dưới có thể bắt nhầm request.
```

Cách khắc phục trong source code:

Mở file:

```text
frontend/nginx.conf
```

Đảm bảo 2 location Keycloak dùng `^~`:

```nginx
location ^~ /realms/ {
    proxy_pass http://keycloak:8080/realms/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port 443;
}

location ^~ /resources/ {
    proxy_pass http://keycloak:8080/resources/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port 443;
}
```

Sau khi sửa trên Windows, copy file lên Ubuntu:

`[Windows PowerShell]`

```powershell
scp .\frontend\nginx.conf cloudapi@192.168.1.28:/home/cloudapi/Cloud_Api_Security/frontend/nginx.conf
```

Nếu IP Ubuntu khác, thay `192.168.1.28` bằng IP thật.

Rebuild/restart frontend trên Ubuntu:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
docker compose up -d --build frontend
docker compose restart frontend
```

Test lại:

`[Browser Windows]`

```text
https://192.168.1.28
```

Nếu browser vẫn hiển thị giao diện cũ, nhấn:

```text
Ctrl + F5
```

hoặc mở tab ẩn danh.

Cách kiểm tra nhanh resource:

`[Ubuntu SSH]`

```bash
curl -k -I https://127.0.0.1/resources/
```

Nếu resource không còn bị Nginx static rule bắt nhầm, giao diện Keycloak sẽ có CSS/theme bình thường.

### Câu hỏi 2: Vì sao đăng nhập Google không chạy khi dùng IP private?

Hiện tượng Google báo:

```text
Access blocked: Authorization Error
device_id and device_name are required for private IP:
https://192.168.1.28/realms/cloudapi/broker/google/endpoint
Error 400: invalid_request
```

Nguyên nhân:

```text
Google OAuth không chấp nhận redirect URI web dùng private IP như https://192.168.1.28/...
Đây không phải lỗi chính của Keycloak hay Docker.
Đây là giới hạn/chính sách của Google OAuth với private IP.
```

Kết luận cho mức 1:

```text
Không dùng Google login để đánh giá mức 1.
Mức 1 chỉ cần test username/password Keycloak, HTTPS/TLS, mTLS Kong, JWT/OIDC issuer và phân vùng port.
Google login để sang mức 2 khi đã có domain thật.
```

Cách khắc phục ở mức 2:

Khi có domain, redirect URI đúng sẽ là:

```text
https://auth.fmsec.shop/realms/cloudapi/broker/google/endpoint
```

hoặc nếu bạn dùng một hostname duy nhất:

```text
https://app.fmsec.shop/realms/cloudapi/broker/google/endpoint
```

Vào Google Cloud Console:

`[Browser Windows]`

```text
APIs & Services
Credentials
OAuth 2.0 Client IDs
Authorized redirect URIs
```

Thêm chính xác redirect URI domain:

```text
https://auth.fmsec.shop/realms/cloudapi/broker/google/endpoint
```

Trong Keycloak Admin Console, vào:

```text
Identity providers
Google
```

Kiểm tra:

```text
Client ID đúng với Google Cloud Console.
Client Secret đúng với Google Cloud Console.
Redirect URI hiển thị domain, không còn private IP.
```

Nếu Google vẫn lỗi:

```text
redirect_uri_mismatch -> URI trong Google Cloud Console chưa khớp tuyệt đối.
invalid_request private IP -> Keycloak vẫn sinh redirect URI bằng IP private.
issuer/token lỗi -> KC_HOSTNAME hoặc JWT_ISSUER chưa đổi sang domain.
```

Mục tiêu mức 2:

```text
Chuyển từ IP private sang domain thật.
Dùng chứng chỉ ZeroSSL cho HTTPS domain.
Vẫn giữ internal CA riêng cho mTLS client.
Browser Windows mở web bằng domain.
Test được HTTPS/TLS, Keycloak/OIDC, Kong HTTPS/mTLS bằng domain.
```

Ví dụ trong file:

```text
Domain chính: fmsec.shop
Frontend: app.fmsec.shop
Keycloak public issuer: auth.fmsec.shop
Kong API Gateway: api.fmsec.shop
Ubuntu user: cloudapi
Project trên Ubuntu: /home/cloudapi/Cloud_Api_Security
```

Nếu domain của bạn khác, thay `fmsec.shop` bằng domain thật của bạn.

## 0. Quy ước nơi chạy lệnh

| Nhãn | Chạy ở đâu | Dấu hiệu thường thấy |
|---|---|---|
| `[Windows PowerShell]` | PowerShell trên máy Windows | `PS C:\...>` |
| `[Windows editor]` | VS Code/Notepad trên Windows | mở file trong project |
| `[Ubuntu SSH]` | Terminal SSH vào Ubuntu VM/VPS | `cloudapi@cloudapi-server:~$` |
| `[DNS provider]` | Trang quản lý domain | Hostinger/Cloudflare/Namecheap... |
| `[ZeroSSL]` | Website ZeroSSL | trang tạo certificate |
| `[Browser Windows]` | Chrome/Edge/Firefox trên Windows | thanh địa chỉ browser |

Không nhầm:

```text
docker compose ...   -> chạy trên Ubuntu
nano .env            -> chạy trên Ubuntu nếu sửa trực tiếp trên server
DNS record           -> sửa ở trang quản lý domain
hosts file           -> sửa trên máy client nếu dùng IP private/Tailscale
```

## 1. Chọn kiểu triển khai mức 2

Có 2 kiểu demo.

### Kiểu A: VPS/public IP

Dùng khi Ubuntu server có public IP thật.

DNS trỏ thẳng về public IP:

```text
app.fmsec.shop    A    <PUBLIC_IP_SERVER>
auth.fmsec.shop   A    <PUBLIC_IP_SERVER>
api.fmsec.shop    A    <PUBLIC_IP_SERVER>
```

Ưu điểm:

```text
Bạn bè vào domain trực tiếp qua Internet.
ZeroSSL HTTP validation hoặc DNS validation đều có thể dùng.
Không cần hosts file trên máy bạn bè.
```

### Kiểu B: Ubuntu VM private IP + Tailscale/hosts file

Dùng khi Ubuntu đang ở VMware/LAN, chưa có public IP.

Bạn vẫn có domain thật và vẫn xin ZeroSSL bằng DNS validation. Nhưng để bạn bè truy cập domain về máy Ubuntu private, máy client cần map domain về IP private/Tailscale.

Ví dụ nếu Ubuntu có Tailscale IP:

```text
100.x.x.x
```

Máy Windows của bạn và máy bạn bè thêm hosts:

```text
100.x.x.x app.fmsec.shop
100.x.x.x auth.fmsec.shop
100.x.x.x api.fmsec.shop
```

Ưu điểm:

```text
Không cần VPS.
Vẫn demo được domain + ZeroSSL.
Traffic đi qua mạng private/Tailscale.
```

Nhược điểm:

```text
Bạn bè cần vào cùng Tailscale network hoặc có đường mạng tới IP đó.
Máy bạn bè cần hosts file hoặc DNS nội bộ.
DNS public không tự trỏ được vào IP private nếu người ngoài Internet không có route tới IP đó.
```

Khuyến nghị cho bạn hiện tại: nếu chỉ demo môn học và mức 1 đang ở VMware, dùng **Kiểu B** trước. Sau này nếu muốn public thật thì chuyển sang VPS.

## 2. Kiểm tra mức 1 trước khi đổi sang domain

Chạy trên Ubuntu:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
docker compose ps
sudo ss -tulpn
```

Test lại mức 1:

`[Ubuntu SSH]`

```bash
curl -k -I https://127.0.0.1
curl -k https://127.0.0.1/realms/cloudapi/.well-known/openid-configuration
curl -k -i --cert certs/client.crt --key certs/client.key https://127.0.0.1:8443/health
```

Nếu các lệnh này còn lỗi, chưa nên chuyển sang domain.

Backup cấu hình và cert mức 1:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
mkdir -p backup-muc1
cp .env backup-muc1/.env.muc1
cp gateway/kong.yml backup-muc1/kong.yml.muc1
cp idp/keycloak/realm-export.json backup-muc1/realm-export.json.muc1
cp -r certs backup-muc1/certs-muc1
```

## 3. Chuẩn bị DNS

## 3.0. Sau khi mua tên miền trên Hostinger thì làm gì?

Ví dụ bạn mua domain:

```text
fmsec.shop
```

Sau khi thanh toán xong trên Hostinger, không cần mua hosting web nếu bạn chỉ deploy project trên Ubuntu VM/VPS của mình. Việc cần làm là quản lý DNS của domain.

### 3.0.1. Kiểm tra domain đã nằm trong tài khoản

Trong Hostinger:

`[DNS provider]`

```text
Tên miền
Danh mục tên miền
Chọn domain vừa mua
```

Kiểm tra domain đang ở trạng thái active/đã đăng ký. Nếu Hostinger yêu cầu xác minh email chủ sở hữu domain, hãy xác minh trước.

### 3.0.2. Mở trang quản lý DNS Zone

Trong Hostinger, vào domain vừa mua rồi tìm một trong các mục sau:

```text
DNS / Nameservers
DNS Zone
Manage DNS records
Quản lý DNS
```

Bạn cần nơi thêm các record như:

```text
A
CNAME
TXT
```

Nếu Hostinger hỏi dùng nameserver nào, để mặc định Hostinger nameserver là dễ nhất cho demo. Nếu bạn chuyển DNS sang Cloudflare thì các record DNS phải tạo trong Cloudflare, không tạo trong Hostinger nữa.

### 3.0.3. Quyết định dùng VPS public IP hay Ubuntu VM private IP

Trước khi tạo A record, phải quyết định server của bạn đang ở kiểu nào.

Trường hợp A, bạn có VPS/public IP:

```text
Bạn có public IP thật, ví dụ 103.x.x.x.
Bạn bè có thể vào domain trực tiếp qua Internet.
Tạo A record app/auth/api trỏ về public IP đó.
```

Trường hợp B, bạn đang dùng Ubuntu VM trong VMware/LAN/Tailscale:

```text
Ubuntu chỉ có IP private như 192.168.1.28 hoặc Tailscale IP 100.x.x.x.
Người ngoài Internet không tự vào được bằng DNS public nếu không có route tới IP đó.
Bạn vẫn có thể xin ZeroSSL bằng DNS validation.
Để demo cho bạn bè, dùng Tailscale/hosts file để map domain về IP private/Tailscale.
```

### 3.0.4. Nếu dùng VPS/public IP: tạo A record trong Hostinger

Ví dụ domain là `fmsec.shop`, public IP server là `103.10.20.30`.

Trong DNS Zone của Hostinger, tạo:

```text
Type: A
Name: app
Value: 103.10.20.30
TTL: default

Type: A
Name: auth
Value: 103.10.20.30
TTL: default

Type: A
Name: api
Value: 103.10.20.30
TTL: default
```

Kết quả mong muốn:

```text
app.fmsec.shop  -> frontend
auth.fmsec.shop -> Keycloak public issuer
api.fmsec.shop  -> Kong API Gateway
```

Kiểm tra từ Windows:

`[Windows PowerShell]`

```powershell
nslookup app.fmsec.shop
nslookup auth.fmsec.shop
nslookup api.fmsec.shop
```

Kết quả phải ra public IP server.

### 3.0.5. Nếu dùng Ubuntu VM private IP/Tailscale: chưa cần A record public

Nếu server của bạn là VMware Ubuntu có IP LAN:

```text
192.168.1.28
```

hoặc Tailscale IP:

```text
100.x.x.x
```

thì public DNS A record trỏ về IP private không giúp người ngoài Internet truy cập được. Với kiểu demo này, làm như sau:

1. Vẫn giữ domain trong Hostinger.
2. Xin ZeroSSL bằng DNS validation ở mục 4.
3. Sau khi có cert, trên máy client demo thêm hosts file để domain trỏ về IP private/Tailscale.

Ví dụ sửa hosts file trên Windows:

`[Windows editor]`

```text
C:\Windows\System32\drivers\etc\hosts
```

Thêm:

```text
192.168.1.28 app.fmsec.shop
192.168.1.28 auth.fmsec.shop
192.168.1.28 api.fmsec.shop
```

Hoặc nếu dùng Tailscale:

```text
100.x.x.x app.fmsec.shop
100.x.x.x auth.fmsec.shop
100.x.x.x api.fmsec.shop
```

Kiểm tra:

`[Windows PowerShell]`

```powershell
ping app.fmsec.shop
ping auth.fmsec.shop
ping api.fmsec.shop
```

Nếu ping ra đúng IP LAN/Tailscale là được. Ping có thể bị firewall chặn, nhưng phần resolve domain ra đúng IP là điểm quan trọng.

### 3.0.6. Record DNS dùng để xác minh ZeroSSL

Khi xin cert, ZeroSSL sẽ yêu cầu thêm record xác minh. Record này khác với A record app/auth/api.

Ví dụ ZeroSSL có thể yêu cầu:

```text
Type: CNAME
Name: _xxxx.fmsec.shop
Value: xxxxx.zerossl.com
```

hoặc:

```text
Type: TXT
Name: _xxxx.fmsec.shop
Value: xxxxx
```

Bạn phải thêm record này trong DNS Zone của Hostinger. Sau khi ZeroSSL verify xong thì mới tải được certificate.

Tóm lại sau khi mua domain:

```text
1. Vào Hostinger -> Tên miền -> domain vừa mua.
2. Mở DNS Zone.
3. Nếu dùng VPS: tạo A record app/auth/api trỏ public IP.
4. Nếu dùng VMware/Tailscale: dùng hosts file trên máy client để map app/auth/api về IP private/Tailscale.
5. Dùng DNS validation của ZeroSSL, thêm record CNAME/TXT mà ZeroSSL yêu cầu.
6. Tải cert rồi làm tiếp các bước bên dưới.
```

### 3.1. Nếu dùng VPS/public IP

Vào nơi quản lý domain.

`[DNS provider]`

Tạo 3 record:

```text
Type: A
Name: app
Value: <PUBLIC_IP_SERVER>

Type: A
Name: auth
Value: <PUBLIC_IP_SERVER>

Type: A
Name: api
Value: <PUBLIC_IP_SERVER>
```

Kiểm tra từ Windows:

`[Windows PowerShell]`

```powershell
nslookup app.fmsec.shop
nslookup auth.fmsec.shop
nslookup api.fmsec.shop
```

Kết quả phải ra public IP server.

### 3.2. Nếu dùng Ubuntu VM private IP + Tailscale/hosts

DNS public không nhất thiết phải trỏ A record về private IP. Nhưng bạn vẫn cần domain thật để xin ZeroSSL bằng DNS validation.

Mục tiêu của cách này:

```text
Ubuntu VM không cần public IP.
Máy Windows của bạn và máy bạn bè vào được domain thông qua Tailscale.
Domain fmsec.shop vẫn có cert ZeroSSL hợp lệ.
Mỗi máy client dùng hosts file để map app/auth/api.fmsec.shop về Tailscale IP của Ubuntu.
```

#### 3.2.1. Cài Tailscale trên Ubuntu VM

Chạy trên Ubuntu:

`[Ubuntu SSH]`

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Lệnh `sudo tailscale up` sẽ in ra một URL đăng nhập. Mở URL đó trên browser, đăng nhập tài khoản Tailscale của bạn và approve thiết bị Ubuntu.

Sau khi đăng nhập xong, kiểm tra:

`[Ubuntu SSH]`

```bash
tailscale ip -4
tailscale status
```

Ví dụ:

```text
100.90.80.70
```

Đây là Tailscale IP của Ubuntu. Ghi lại IP này.

Nếu lệnh `curl -fsSL https://tailscale.com/install.sh | sh` không chạy được do mạng, có thể cài theo cách apt:

`[Ubuntu SSH]`

```bash
sudo apt update
sudo apt install -y curl gnupg
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.tailscale-keyring.list | sudo tee /etc/apt/sources.list.d/tailscale.list
sudo apt update
sudo apt install -y tailscale
sudo tailscale up
```

Với Ubuntu 24.04, codename là `noble`. Nếu bản Ubuntu khác, kiểm tra:

`[Ubuntu SSH]`

```bash
. /etc/os-release
echo "$VERSION_CODENAME"
```

#### 3.2.2. Cài Tailscale trên Windows của bạn

Trên Windows:

`[Browser Windows]`

```text
https://tailscale.com/download/windows
```

Cài Tailscale, đăng nhập cùng tài khoản với Ubuntu.

Kiểm tra Windows thấy Ubuntu:

`[Windows PowerShell]`

```powershell
tailscale status
```

Nếu command `tailscale` không có trong PowerShell, mở ứng dụng Tailscale GUI và kiểm tra danh sách devices. Bạn cần thấy máy Ubuntu trong cùng tailnet.

Test SSH qua Tailscale IP:

`[Windows PowerShell]`

```powershell
ssh cloudapi@100.90.80.70
```

Nếu SSH được qua Tailscale IP, đường mạng private đã ổn.

#### 3.2.3. Cho bạn bè truy cập bằng Tailscale

Bạn bè không cần repo project. Bạn bè chỉ cần:

```text
1. Cài Tailscale.
2. Được mời vào tailnet của bạn hoặc được share device Ubuntu.
3. Có hosts file map domain về Tailscale IP của Ubuntu.
4. Mở domain trên browser.
```

Các cách cho bạn bè vào:

```text
Cách 1: Invite bạn bè vào tailnet.
Cách 2: Share riêng thiết bị Ubuntu qua Tailscale device sharing.
```

Trong Tailscale Admin Console:

`[Browser Windows]`

```text
https://login.tailscale.com/admin/machines
```

Chọn máy Ubuntu rồi dùng tính năng share/invite nếu tài khoản của bạn hỗ trợ.

Sau khi bạn bè vào được mạng Tailscale, bảo bạn bè kiểm tra:

`[Windows PowerShell]`

```powershell
tailscale status
ping 100.90.80.70
```

Ping có thể bị chặn, nhưng `tailscale status` phải thấy thiết bị Ubuntu hoặc thiết bị được share.

#### 3.2.4. Sửa hosts file trên Windows để domain trỏ về Tailscale IP

Trên Windows, mở Notepad bằng quyền Administrator:

```text
Start Menu
Gõ Notepad
Right click -> Run as administrator
```

Trong Notepad, mở file:

`[Windows editor]`

```text
C:\Windows\System32\drivers\etc\hosts
```

Thêm:

```text
100.90.80.70 app.fmsec.shop
100.90.80.70 auth.fmsec.shop
100.90.80.70 api.fmsec.shop
```

Lưu ý:

```text
100.90.80.70 là ví dụ. Phải thay bằng Tailscale IP thật của Ubuntu.
Mỗi máy client muốn vào domain qua Tailscale đều cần hosts mapping này.
```

Flush DNS cache trên Windows:

`[Windows PowerShell]`

```powershell
ipconfig /flushdns
```

Kiểm tra domain đã trỏ đúng Tailscale IP:

`[Windows PowerShell]`

```powershell
nslookup app.fmsec.shop
ping app.fmsec.shop
ping auth.fmsec.shop
ping api.fmsec.shop
```

Nếu `nslookup` vẫn ra DNS public chứ không ra hosts file, dùng PowerShell kiểm tra qua `ping` hoặc mở lại terminal mới. Trên Windows, `ping` thường đọc hosts file rõ hơn `nslookup` vì `nslookup` hỏi DNS server trực tiếp và có thể bỏ qua hosts file.

Kiểm tra bằng curl:

`[Windows PowerShell]`

```powershell
curl.exe -k -I https://app.fmsec.shop
```

Sau khi bạn đã dùng ZeroSSL cert đúng domain ở các bước sau, có thể bỏ `-k`:

`[Windows PowerShell]`

```powershell
curl.exe -I https://app.fmsec.shop
```

#### 3.2.5. Có cần mở port router không?

Nếu dùng Tailscale:

```text
Không cần port forwarding trên router.
Không cần public IP.
Không cần mở 443 ra Internet.
```

Nhưng trên Ubuntu UFW vẫn cần cho phép port mà Tailscale/client truy cập:

`[Ubuntu SSH]`

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8443/tcp
sudo ufw status numbered
```

Nếu muốn chặt hơn, sau này có thể giới hạn rule theo interface/IP Tailscale, nhưng với demo môn học thì để các rule hiện tại là đủ dễ làm.

#### 3.2.6. Tóm tắt luồng domain + Tailscale

```text
1. Domain fmsec.shop mua ở Hostinger.
2. Xin ZeroSSL bằng DNS validation trong Hostinger DNS Zone.
3. Ubuntu VM chạy server Docker Compose.
4. Ubuntu có Tailscale IP, ví dụ 100.90.80.70.
5. Windows/bạn bè cài Tailscale và vào cùng tailnet/share device.
6. Windows/bạn bè sửa hosts:
   100.90.80.70 app.fmsec.shop
   100.90.80.70 auth.fmsec.shop
   100.90.80.70 api.fmsec.shop
7. Browser mở https://app.fmsec.shop.
8. Traffic đi qua Tailscale tới Ubuntu, nhưng HTTPS cert vẫn hợp lệ vì cert ký cho domain fmsec.shop.
```

## 4. Xin certificate ZeroSSL

Khuyến nghị dùng **DNS validation** vì dùng được cả VPS lẫn Ubuntu VM private/Tailscale.

Vào ZeroSSL:

`[ZeroSSL]`

Tạo certificate mới cho 3 hostname:

```text
app.fmsec.shop
auth.fmsec.shop
api.fmsec.shop
```

Chọn:

```text
Validation method: DNS validation
```

ZeroSSL sẽ đưa record xác minh, thường là CNAME hoặc TXT. Vào nơi quản lý DNS domain và thêm record đó.

`[DNS provider]`

Ví dụ record ZeroSSL yêu cầu:

```text
Type: CNAME
Name: _xxxx.app
Value: xxxxx.zerossl.com
```

Hoặc:

```text
Type: TXT
Name: _xxxx
Value: xxxxx
```

Sau khi thêm record, đợi DNS propagate rồi bấm verify trên ZeroSSL.

Kiểm tra DNS record từ Windows nếu cần:

`[Windows PowerShell]`

```powershell
nslookup -type=TXT fmsec.shop
nslookup -type=CNAME _ten_record_zero_ssl.fmsec.shop
```

Khi ZeroSSL verify thành công, tải certificate về. Với hướng ECC CSR tự tạo, bạn cần:

```text
certificate.crt
ca_bundle.crt
```

Private key đúng là file ECC đã tự tạo trên Ubuntu:

```text
~/Cloud_Api_Security/zerossl-csr/fmsec-zerossl.key
```

## 5. Đưa cert ZeroSSL lên Ubuntu

Giả sử bạn đã tải cert về Windows trong thư mục:

```text
C:\Users\X\Downloads\zerossl
```

Copy 2 file certificate lên Ubuntu:

`[Windows PowerShell]`

```powershell
cd C:\Users\X\Downloads\zerossl
scp .\certificate.crt cloudapi@192.168.1.27:/home/cloudapi/
scp .\ca_bundle.crt cloudapi@192.168.1.27:/home/cloudapi/
```

Nếu đang dùng Tailscale IP thay vì LAN IP, thay `192.168.1.27` bằng IP Tailscale của Ubuntu.

Trên Ubuntu, tạo fullchain và đặt vào đúng tên file mà Docker Compose đang dùng:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
mkdir -p certs
cat ~/certificate.crt ~/ca_bundle.crt > /tmp/fullchain.crt

cp /tmp/fullchain.crt certs/frontend.crt
cp zerossl-csr/fmsec-zerossl.key certs/frontend.key

cp /tmp/fullchain.crt certs/kong.crt
cp zerossl-csr/fmsec-zerossl.key certs/kong.key

chmod 600 certs/frontend.key certs/kong.key
```

Không xóa các file mTLS nội bộ:

```text
certs/ca.crt
certs/ca.key
certs/client.crt
certs/client.key
certs/client.p12
```

Lý do:

```text
ZeroSSL cert dùng cho HTTPS domain public.
Internal CA cert dùng cho mTLS client.
Hai loại cert này có vai trò khác nhau.
```

## 5.1. Một domain thì cấp cert cho những gì? Các cert còn lại xử lý ra sao?

Ví dụ bạn mua một domain gốc:

```text
fmsec.shop
```

Từ một domain gốc này, bạn có thể tạo nhiều hostname/subdomain:

```text
app.fmsec.shop
auth.fmsec.shop
api.fmsec.shop
```

Khi xin cert ZeroSSL, cert không chỉ hiểu chung chung là `fmsec.shop`. Cert phải có đúng hostname mà browser/client sẽ truy cập. Các hostname đó nằm trong trường SAN của certificate.

### Cách 1: dùng 1 cert ZeroSSL cho nhiều hostname

Đây là cách dễ nhất cho demo.

Khi tạo certificate trên ZeroSSL, nhập cả 3 hostname:

```text
app.fmsec.shop
auth.fmsec.shop
api.fmsec.shop
```

Sau khi tải về, một cert này dùng được cho cả frontend và Kong:

```text
frontend Nginx: app.fmsec.shop và auth.fmsec.shop
Kong Gateway: api.fmsec.shop
```

Đặt file như sau:

```bash
cd ~/Cloud_Api_Security
cat ~/certificate.crt ~/ca_bundle.crt > /tmp/fullchain.crt

cp /tmp/fullchain.crt certs/frontend.crt
cp zerossl-csr/fmsec-zerossl.key certs/frontend.key

cp /tmp/fullchain.crt certs/kong.crt
cp zerossl-csr/fmsec-zerossl.key certs/kong.key

chmod 600 certs/frontend.key certs/kong.key
```

Nghĩa là:

```text
frontend.crt/frontend.key -> dùng ZeroSSL cert cho web app và Keycloak proxy
kong.crt/kong.key         -> dùng ZeroSSL cert cho API Gateway
```

Ưu điểm:

```text
Dễ làm.
Dễ demo.
Chỉ cần xin và gia hạn một certificate.
```

Nhược điểm:

```text
frontend và Kong dùng chung private key.
Không tối ưu nếu production thật cần tách quyền chặt hơn.
```

Với đồ án/demo, cách này chấp nhận được nếu bạn giữ `private.key` cẩn thận và không commit lên GitHub.

### Cách 2: dùng nhiều cert ZeroSSL riêng

Cách này sạch hơn nếu muốn tách rõ từng node.

Ví dụ:

```text
Cert 1: app.fmsec.shop, auth.fmsec.shop
Cert 2: api.fmsec.shop
```

Đặt file:

```text
Cert app/auth -> certs/frontend.crt, certs/frontend.key
Cert api      -> certs/kong.crt, certs/kong.key
```

Ưu điểm:

```text
Frontend/Keycloak proxy và Kong không dùng chung private key.
Gần production hơn.
```

Nhược điểm:

```text
Phải quản lý nhiều cert hơn.
Gia hạn nhiều cert hơn.
```

### Có cần cert riêng cho Keycloak không?

Trong kiến trúc project hiện tại, browser truy cập Keycloak qua frontend Nginx proxy:

```text
https://auth.fmsec.shop/realms/cloudapi
```

hoặc nếu dùng một hostname:

```text
https://app.fmsec.shop/realms/cloudapi
```

Keycloak container bên trong vẫn chạy HTTP nội bộ:

```text
http://keycloak:8080
```

Vì vậy Keycloak không cần mount riêng cert ZeroSSL nếu bạn để Nginx terminate TLS ở frontend. Cert public cho `auth.fmsec.shop` nằm ở:

```text
certs/frontend.crt
certs/frontend.key
```

### Có cần cert ZeroSSL cho backend không?

Không bắt buộc trong demo hiện tại.

Backend FastAPI đang dùng cert nội bộ:

```text
certs/backend.crt
certs/backend.key
```

Luồng là:

```text
User -> HTTPS/mTLS Kong -> HTTPS nội bộ Backend
```

Backend không public trực tiếp ra Internet, nên không cần ZeroSSL public cert. Có thể tiếp tục dùng internal CA cho backend.

Nếu production thật muốn chặt hơn, có thể làm mTLS nội bộ Kong -> Backend bằng internal CA riêng, nhưng không cần dùng ZeroSSL cho backend private service.

### Các cert nào được ZeroSSL thay thế?

Khi chuyển sang mức 2, ZeroSSL thay thế các cert public-facing:

```text
certs/frontend.crt
certs/frontend.key
certs/kong.crt
certs/kong.key
```

Vì các endpoint này được client/browser gọi:

```text
https://app.fmsec.shop
https://auth.fmsec.shop
https://api.fmsec.shop:8443
```

### Các cert nào không được thay bằng ZeroSSL?

Không thay các file sau bằng ZeroSSL:

```text
certs/ca.crt
certs/ca.key
certs/client.crt
certs/client.key
certs/client.p12
certs/backend.crt
certs/backend.key
```

Vai trò của chúng:

| File | Giữ hay thay? | Lý do |
|---|---|---|
| `ca.crt` | Giữ internal CA | Kong dùng để verify client cert mTLS |
| `ca.key` | Giữ bí mật, không public | Dùng để ký client cert/internal cert |
| `client.crt` | Giữ | Client cert để test mTLS |
| `client.key` | Giữ bí mật | Private key của client cert |
| `client.p12` | Giữ | Import vào browser/Postman nếu cần mTLS |
| `backend.crt` | Có thể giữ internal cert | Backend là service private |
| `backend.key` | Giữ bí mật | Private key của backend cert |

Tóm tắt dễ nhớ:

```text
ZeroSSL -> cert cho domain mà browser/client nhìn thấy.
Internal CA -> cert cho mTLS và service nội bộ.
```

### Nếu chỉ mua 1 domain thì có đủ không?

Có. Một domain gốc như:

```text
fmsec.shop
```

là đủ để tạo các subdomain:

```text
app.fmsec.shop
auth.fmsec.shop
api.fmsec.shop
```

Bạn không cần mua 3 domain khác nhau.

Chỉ cần DNS của domain cho phép tạo record `app`, `auth`, `api`, điều này Hostinger có hỗ trợ.

### Nếu ZeroSSL giới hạn số hostname thì sao?

Nếu tài khoản/cert ZeroSSL của bạn bị giới hạn số hostname, dùng phương án đơn giản:

```text
Chỉ dùng một hostname: app.fmsec.shop
```

Khi đó cấu hình:

```env
VITE_KEYCLOAK_URL=https://app.fmsec.shop
VITE_KONG_URL=https://app.fmsec.shop:8443
BACKEND_CORS_ORIGINS=https://app.fmsec.shop
KC_HOSTNAME=app.fmsec.shop
PUBLIC_BASE_URL=https://app.fmsec.shop
JWT_ISSUER=https://app.fmsec.shop/realms/cloudapi
```

Cert ZeroSSL chỉ cần có:

```text
app.fmsec.shop
```

Nhưng về mặt kiến trúc/báo cáo, dùng 3 hostname `app/auth/api` vẫn rõ ràng hơn.

Kiểm tra cert ZeroSSL có đúng domain:

`[Ubuntu SSH]`

```bash
openssl x509 -in certs/frontend.crt -noout -text | grep -A2 "Subject Alternative Name"
openssl x509 -in certs/kong.crt -noout -text | grep -A2 "Subject Alternative Name"
```

Cần thấy:

```text
DNS:app.fmsec.shop
DNS:auth.fmsec.shop
DNS:api.fmsec.shop
```

Nếu cert chỉ có `app.fmsec.shop` mà không có `api.fmsec.shop`, Kong domain sẽ bị lỗi hostname mismatch.

## 6. Sửa `.env` trên Ubuntu sang domain

Mở `.env` trên Ubuntu:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
nano .env
```

Sửa các dòng domain:

```env
VITE_KEYCLOAK_URL=https://auth.fmsec.shop
VITE_KONG_URL=https://api.fmsec.shop:8443

BACKEND_CORS_ORIGINS=https://app.fmsec.shop
KC_HOSTNAME=auth.fmsec.shop
PUBLIC_BASE_URL=https://app.fmsec.shop

KEYCLOAK_URL=http://keycloak:8080
KEYCLOAK_REALM=cloudapi
JWT_ISSUER=https://auth.fmsec.shop/realms/cloudapi
JWT_AUDIENCE=account
```

Giữ nguyên:

```env
KEYCLOAK_URL=http://keycloak:8080
```

Không đổi dòng này thành domain vì đây là URL nội bộ Docker để backend gọi Keycloak.

Kiểm tra nhanh:

`[Ubuntu SSH]`

```bash
grep -n "VITE_KEYCLOAK_URL\|VITE_KONG_URL\|BACKEND_CORS_ORIGINS\|KC_HOSTNAME\|PUBLIC_BASE_URL\|JWT_ISSUER\|KEYCLOAK_URL" .env
```

## 7. Sửa Kong CORS sang domain

Mở file:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
nano gateway/kong.yml
```

Trong plugin CORS, bảo đảm có:

```yaml
origins:
  - "https://app.fmsec.shop"
```

Trong giai đoạn chuyển đổi, bạn có thể giữ cả IP và domain:

```yaml
origins:
  - "https://192.168.1.27"
  - "https://app.fmsec.shop"
```

Khi demo chính thức bằng domain, nên dùng domain là chính.

## 8. Sửa Keycloak redirect/webOrigins sang domain

Mở file:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
nano idp/keycloak/realm-export.json
```

Client `spa-client` cần có:

```json
"redirectUris": [
  "https://app.fmsec.shop/*"
],
"webOrigins": [
  "https://app.fmsec.shop"
]
```

Nếu đang chuyển đổi từ mức 1, có thể giữ cả IP và domain:

```json
"redirectUris": [
  "https://192.168.1.27/*",
  "https://app.fmsec.shop/*"
],
"webOrigins": [
  "https://192.168.1.27",
  "https://app.fmsec.shop"
]
```

Lưu ý quan trọng: nếu Keycloak đã từng chạy và đã có volume cũ, sửa `realm-export.json` có thể không tự import lại. Cách ít rủi ro là vào Keycloak Admin Console sửa client trực tiếp.

Mở Keycloak Admin bằng SSH tunnel nếu port admin chỉ bind localhost:

`[Windows PowerShell]`

```powershell
ssh -L 8082:127.0.0.1:8082 cloudapi@192.168.1.27
```

Sau đó mở:

`[Browser Windows]`

```text
http://127.0.0.1:8082
```

Vào client `spa-client`, sửa:

```text
Valid redirect URIs: https://app.fmsec.shop/*
Web origins: https://app.fmsec.shop
```

Nếu dùng cả IP và domain trong giai đoạn test, thêm cả:

```text
https://192.168.1.27/*
https://192.168.1.27
```

## 9. Chạy lại Docker Compose

Vì biến `VITE_*` được đóng vào frontend lúc build, sau khi sửa `.env` phải build lại frontend.

Chạy trên Ubuntu:

`[Ubuntu SSH]`

```bash
cd ~/Cloud_Api_Security
docker compose config
docker compose down
docker compose up -d --build
docker compose ps
```

Nếu có container `exited`, xem log:

`[Ubuntu SSH]`

```bash
docker compose logs --tail=120 frontend
docker compose logs --tail=120 kong
docker compose logs --tail=120 keycloak
docker compose logs --tail=120 backend
```

## 10. Test domain ngay trên Ubuntu

Nếu DNS/hosts đã trỏ đúng về server, test:

`[Ubuntu SSH]`

```bash
curl -k -I https://app.fmsec.shop
curl -k https://auth.fmsec.shop/realms/cloudapi/.well-known/openid-configuration
curl -k -i https://api.fmsec.shop:8443/health
curl -k -i --cert certs/client.crt --key certs/client.key https://api.fmsec.shop:8443/health
```

Nếu cert ZeroSSL hợp lệ và hostname đúng, thử bỏ `-k`:

`[Ubuntu SSH]`

```bash
curl -I https://app.fmsec.shop
curl https://auth.fmsec.shop/realms/cloudapi/.well-known/openid-configuration
```

Keycloak discovery phải có:

```text
"issuer":"https://auth.fmsec.shop/realms/cloudapi"
```

Nếu issuer vẫn là IP hoặc localhost:

```text
.env đang sai KC_HOSTNAME/JWT_ISSUER
hoặc Keycloak đang dùng cấu hình cũ trong volume
```

## 11. Test domain từ Windows

### 11.1. Mở web

`[Browser Windows]`

```text
https://app.fmsec.shop
```

Nếu dùng ZeroSSL đúng, browser không cần import CA để tin HTTPS frontend.

Nếu browser vẫn báo cert không tin cậy:

```text
Cert chưa phải ZeroSSL fullchain.
Domain đang trỏ nhầm IP/server.
Cert không có SAN app.fmsec.shop.
Browser đang cache cert cũ.
```

### 11.2. Test HTTPS/TLS frontend

`[Windows PowerShell]`

```powershell
curl.exe -I https://app.fmsec.shop
curl.exe -v https://app.fmsec.shop
```

Không nên cần `-k` ở mức 2 nếu dùng ZeroSSL đúng.

### 11.3. Test Keycloak/OIDC discovery

`[Windows PowerShell]`

```powershell
curl.exe https://auth.fmsec.shop/realms/cloudapi/.well-known/openid-configuration
```

Cần thấy:

```text
"issuer":"https://auth.fmsec.shop/realms/cloudapi"
```

### 11.4. Test Kong HTTPS/mTLS

Không có client cert:

`[Windows PowerShell]`

```powershell
curl.exe -i https://api.fmsec.shop:8443/health
```

Nếu bị chặn vì thiếu client cert thì đúng kỳ vọng mTLS.

Có client cert:

`[Windows PowerShell]`

```powershell
curl.exe -i --cert .\client.crt --key .\client.key https://api.fmsec.shop:8443/health
```

Cách đọc:

```text
Không cert bị chặn, có cert đi tiếp: mTLS hoạt động.
Có cert nhưng 401: mTLS qua rồi, route cần JWT/token.
TLS hostname mismatch: cert ZeroSSL không có api.fmsec.shop.
```

### 11.5. Test service nội bộ không public

Các URL này không nên truy cập được từ Windows:

`[Windows PowerShell]`

```powershell
curl.exe https://app.fmsec.shop:9000/health
curl.exe http://app.fmsec.shop:5432
curl.exe http://app.fmsec.shop:6379
curl.exe http://app.fmsec.shop:8200
curl.exe http://app.fmsec.shop:8181
```

Nếu truy cập được, nghĩa là service nội bộ đang bị expose sai.

## 12. Test đăng nhập web bằng domain

Mở:

`[Browser Windows]`

```text
https://app.fmsec.shop
```

Luồng đúng:

```text
1. Browser vào frontend bằng https://app.fmsec.shop.
2. Frontend gọi Keycloak qua https://auth.fmsec.shop/realms/cloudapi.
3. Keycloak login và trả token.
4. Frontend gọi API qua https://api.fmsec.shop:8443.
5. Kong xử lý gateway/mTLS/policy.
6. Backend verify JWT/DPoP và trả response.
```

Nếu lỗi `Invalid parameter: redirect_uri`:

```text
Keycloak client chưa có https://app.fmsec.shop/*
```

Nếu lỗi CORS:

```text
Kong CORS hoặc BACKEND_CORS_ORIGINS chưa có https://app.fmsec.shop
```

Nếu lỗi token issuer:

```text
JWT_ISSUER phải là https://auth.fmsec.shop/realms/cloudapi
Keycloak discovery issuer cũng phải y chang
```

### 12.1. Cấu hình Google login sau khi đã có domain

Google login chỉ nên test ở mức 2 với domain thật. Không dùng private IP như:

```text
https://192.168.1.28/realms/cloudapi/broker/google/endpoint
```

vì Google OAuth có thể chặn private IP và báo:

```text
Access blocked: Authorization Error
device_id and device_name are required for private IP
Error 400: invalid_request
```

Khi dùng domain, redirect URI của Keycloak Google broker sẽ là:

```text
https://auth.fmsec.shop/realms/cloudapi/broker/google/endpoint
```

Vào Google Cloud Console:

`[Browser Windows]`

```text
APIs & Services
Credentials
OAuth 2.0 Client IDs
Chọn OAuth client của project
Authorized redirect URIs
```

Thêm chính xác URI:

```text
https://auth.fmsec.shop/realms/cloudapi/broker/google/endpoint
```

Nếu bạn dùng một domain duy nhất, ví dụ `app.fmsec.shop` cho cả frontend và Keycloak, thì URI là:

```text
https://app.fmsec.shop/realms/cloudapi/broker/google/endpoint
```

Trong Keycloak Admin Console, vào:

```text
Identity providers
Google
```

Kiểm tra:

```text
Client ID: lấy từ Google Cloud Console
Client Secret: lấy từ Google Cloud Console
Redirect URI: phải hiện đúng domain auth/app ở trên
```

Sau khi sửa Google Cloud Console và Keycloak, test lại:

`[Browser Windows]`

```text
https://app.fmsec.shop
Click Google
```

Nếu vẫn lỗi:

```text
redirect_uri_mismatch -> URI trong Google Cloud Console chưa khớp tuyệt đối.
invalid_request private IP -> vẫn còn dùng IP private trong redirect URI.
issuer/token lỗi -> KC_HOSTNAME hoặc JWT_ISSUER chưa đổi sang domain.
```

## 13. Bằng chứng cần lưu cho báo cáo mức 2

Chụp/lưu các bằng chứng:

```text
1. DNS app/auth/api trỏ đúng server hoặc hosts file trỏ đúng Tailscale IP.
2. ZeroSSL certificate có SAN app.fmsec.shop, auth.fmsec.shop, api.fmsec.shop.
3. Browser mở https://app.fmsec.shop không cần import CA.
4. curl -v https://app.fmsec.shop cho thấy TLS handshake hợp lệ.
5. Keycloak discovery issuer là https://auth.fmsec.shop/realms/cloudapi.
6. Request Kong không client cert bị chặn.
7. Request Kong có client cert đi tiếp.
8. docker compose ps các container running.
9. sudo ss -tulpn chỉ public 80/443/8443, không public backend/db/redis/vault/opa.
10. Nếu dùng Tailscale/hosts, chụp hosts mapping hoặc Tailscale IP để giải thích phạm vi demo.
```

## 14. Khi nào mức 2 được xem là pass?

Mức 2 pass khi:

```text
https://app.fmsec.shop mở được frontend.
https://auth.fmsec.shop/realms/cloudapi/.well-known/openid-configuration trả issuer đúng.
https://api.fmsec.shop:8443 yêu cầu mTLS.
Client cert hợp lệ đi qua được mTLS.
Browser tin cert ZeroSSL.
Service nội bộ không public trực tiếp.
```

Nếu tất cả đều pass, bạn đã có thể nói:

```text
Hệ thống demo đã có HTTPS/TLS bằng domain thật, certificate public CA, OIDC issuer đúng domain, API gateway có mTLS, và các service nội bộ không expose trực tiếp ra untrusted network.
```

## 15. Ghi nhớ quan trọng

```text
ZeroSSL dùng cho HTTPS domain public.
Internal CA vẫn dùng cho mTLS client.
Không thay certs/ca.crt bằng ZeroSSL.
Không đưa private.key, *.key, .env lên GitHub.
Khi đổi VITE_* phải docker compose up -d --build để frontend build lại.
Khi Keycloak issuer sai, kiểm tra KC_HOSTNAME, JWT_ISSUER và Keycloak volume/client config.
```
