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
from fastapi.middleware.cors import CORSMiddleware
import os
import ssl
import uvicorn

from app.routers import users, products, orders

app = FastAPI(
    title="Cloud API Security Backend",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # production thì đổi domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/v1")
app.include_router(products.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Backend is running"}

if __name__ == "__main__":

    CERT = "/certs/backend.crt"
    KEY = "/certs/backend.key"

    ssl_ctx = None

    if os.path.exists(CERT) and os.path.exists(KEY):
        ssl_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_ctx.minimum_version = ssl.TLSVersion.TLSv1_3
        ssl_ctx.load_cert_chain(certfile=CERT, keyfile=KEY)
        print("✅ TLS 1.3 enabled")
    else:
        print("⚠️ Running HTTP (debug mode)")

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=9000,
        ssl_context=ssl_ctx
    )