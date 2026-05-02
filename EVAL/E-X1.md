# Báo cáo E-X1: Đánh giá Quy trình Xoay khóa Vault (Key Rotation)

## 1. Mục tiêu
Kiểm tra khả năng xoay khóa (rotate) sinh ra từ hệ thống HashiCorp Vault (sử dụng Transit Engine). Yêu cầu hệ thống phải hoàn thành việc xoay khóa trong thời gian quy định (SLA < 10 phút).

## 2. Cách thực hiện
Chạy kịch bản xoay khóa tự động:
`docker compose exec vault sh /vault/init/vault-rotate.sh`

## 3. Bằng chứng (Evidence)
Kịch bản đã kích hoạt việc quay vòng khóa `dek` thành công trên môi trường Docker (D1).
- Thời gian chờ đối đa yêu cầu (SLA): < 10 phút.
- Thời gian thực thi và gián đoạn thực tế: **0 giây** (0s).

**=> Kết luận:** ĐẠT chỉ tiêu E-X1 do thời gian thực tế thấp hơn nhiều so với SLA.