import sys

# 1. BẮT BUỘC: Cấu hình đường dẫn hệ thống TRƯỚC KHI import các module nội bộ
sys.path.insert(0, "/app")
sys.path.insert(0, "/app/app")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 2. Bây giờ mới import các module của dự án
from app.api.v1 import users, orders, products
from app.middleware.auth_middleware import AuthMiddleware

# (Tạm comment products để tránh lỗi nếu bạn chưa code file products.py)
# from app.api.v1 import products

app = FastAPI(
    title="Cloud API Security Backend",
    version="1.0.0",
    redirect_slashes=False,
)

# 3. Thêm CORS Middleware (phải ưu tiên lên trước)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Thêm Auth Middleware (chạy sau CORS)
app.add_middleware(AuthMiddleware)

# 5. Include routers
app.include_router(users.router)
app.include_router(orders.router)
app.include_router(products.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Backend is running"}
