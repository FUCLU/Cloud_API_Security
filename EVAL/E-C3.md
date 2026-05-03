# Báo cáo Đánh giá E-C3: Tính toàn vẹn của dữ liệu (Integrity)

## 1. Mục tiêu
Xác minh khả năng phòng thủ của hệ thống trước các hành vi giả mạo, chỉnh sửa dữ liệu trái phép ở hai khía cạnh:
- **Tầng lưu trữ:** Đảm bảo toàn vẹn Ciphertext bằng AEAD (AES-GCM).
- **Tầng truy cập:** Đảm bảo toàn vẹn Phiên (Session) bằng chữ ký số JWT qua API Gateway.

## 2. Kết quả kiểm thử
*(Log chi tiết được lưu tại: `EVIDENCE/logs/e_c3_aead.log`)*

### 2.1. Kiểm thử AEAD Flip-Tag (Tầng dữ liệu)
- **Kịch bản:** Sửa đổi 1 byte cuối cùng (phần Authentication Tag) của Ciphertext sinh ra từ thuật toán AES-GCM và thực hiện giải mã.
- **Kết quả:** `PASS`. Thư viện mã hóa bắn ra Exception `InvalidTag` đúng như kỳ vọng.
- **Diễn giải:** Giao thức AEAD hoạt động chính xác. Bất kỳ sự thay đổi nhỏ nào trên Ciphertext đều khiến phần Tag không khớp, chặn đứng nguy cơ Hacker thao túng dữ liệu trong Database.

### 2.2. Kiểm thử giả mạo JWT Signature (Tầng Gateway)
- **Kịch bản:** Lấy một JWT Token hợp lệ, chỉnh sửa 2 ký tự cuối của phần Signature và gửi request tới Kong API Gateway.
- **Kết quả:** `PASS`. Kong Gateway từ chối request với mã lỗi `401 Unauthorized`.
- **Diễn giải:** Plugin xác thực trên Kong đã thực hiện verify chữ ký số (RSA) thành công. Khi phần Signature bị thay đổi, chữ ký không còn khớp với Payload, ngăn chặn hoàn toàn việc Hacker tự ý nâng quyền trong Token.

## 3. Kết luận
Hệ thống Cloud API tuân thủ nghiêm ngặt nguyên tắc **Toàn vẹn (Integrity)**. Mọi nỗ lực can thiệp vào Token hay Ciphertext đều bị phát hiện và ngăn chặn tức thời.