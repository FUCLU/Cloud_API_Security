FROM python:3.12-slim

WORKDIR /app

# Copy requirements trước để tận dụng cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ source code của backend
COPY . .

EXPOSE 9000

# Chạy FastAPI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000"]