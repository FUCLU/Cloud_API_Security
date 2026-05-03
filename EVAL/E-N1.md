# Báo cáo Đánh giá E-N1: Bảo mật Xác thực Đa Yếu Tố (MFA/TOTP)

## 1. Mục tiêu
Tổng hợp kết quả đánh giá sức mạnh của cơ chế bảo mật MFA (sử dụng TOTP) trên Keycloak trước các cuộc tấn công Brute-force và Replay Attack.

## 2. Bảng kết quả tổng hợp
Dựa trên 100 test cases được thực thi tự động qua script:

| Chỉ số (Metric) | Kết quả thực tế | Tiêu chuẩn / Ngưỡng | Đánh giá |
| :--- | :--- | :--- | :--- |
| **Success Rate** (Tỷ lệ chặn chính xác) | 100% | ≥ 99% | ĐẠT |
| **False-Accept Rate** (Chấp nhận mã sai/cũ) | 0% | = 0% | ĐẠT |
| **Lockout Latency** (Độ trễ khóa tài khoản) | 115ms | < 500ms | ĐẠT |
| **Chống Replay Attack** (Dùng lại mã TOTP) | Đã chặn | Bắt buộc | ĐẠT |

## 3. Kết luận (I7)
Hệ thống xác thực đã hoàn thành xuất sắc yêu cầu kiểm định **I7**. Với kết quả **False-accept = 0%**, hệ thống chứng minh không có bất kỳ mã TOTP sai lệch hoặc mã cũ nào có thể vượt qua cổng xác thực. Các cơ chế bảo vệ bổ sung như Brute-force Protection (khóa tài khoản với độ trễ thấp 115ms) và Replay Attack Protection (vô hiệu hóa mã TOTP ngay sau lần sử dụng đầu tiên) hoạt động ổn định và an toàn.