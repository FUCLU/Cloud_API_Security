FROM python:3.12-slim

WORKDIR /app

# Copy requirements trước để tận dụng cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ source code của backend
COPY . .

EXPOSE 9000

# Chạy qua app.main để dùng SSLContext TLS 1.3 khi /certs/backend.crt tồn tại
CMD ["python", "-m", "app.main"]
