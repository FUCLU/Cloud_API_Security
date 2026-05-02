# Báo cáo E-Z1: Đánh giá Policy OPA

## 1. Mục tiêu
Kiểm tra tính đúng đắn của các luật phân quyền (Authorization) và giới hạn request (Rate limiting) bằng OPA. Yêu cầu tỷ lệ test thành công phải > 95%.

## 2. Cách thực hiện
Chạy tập lệnh OPA Test trong Docker:
`docker compose exec opa opa test /policies /tests -v`

## 3. Bằng chứng (Evidence)
- Tổng số bài test đã chạy: 40 cases
- Số bài test thành công (Pass): 40 cases
- Tỷ lệ đạt: **100%** (Vượt mức 95% yêu cầu)

**=> Kết luận:** ĐẠT chỉ tiêu E-Z1.