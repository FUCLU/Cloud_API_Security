import sys
import os
import ssl
import uvicorn

sys.path.insert(0, "/app")
sys.path.insert(0, "/app/app")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Chọn 1 bộ router duy nhất — api/v1 vì đã có prefix /api/v1 bên trong
from app.api.v1 import users, orders, products, auth
from app.middleware.auth_middleware import AuthMiddleware
from app.db.database import init_db

# ── Khởi tạo app DUY NHẤT ────────────────────────────────────────
app = FastAPI(
    title="Cloud API Security Backend",
    version="1.0.0",
    redirect_slashes=False,
)

# ── Middleware — thứ tự quan trọng ───────────────────────────────
# CORS phải trước AuthMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # production: đổi thành domain cụ thể
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuthMiddleware) 

# ── Routers ───────────────────────────────────────────────────────
# prefix "/api/v1" đã được định nghĩa bên trong từng file api/v1/
app.include_router(users.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(auth.router)


@app.on_event("startup")
def startup_init_db():
    # Ensure tables exist so protected endpoints do not fail with UndefinedTable.
    init_db()

# ── Health check — public, không qua AuthMiddleware ──────────────
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"message": "Backend is running"}

if __name__ == "__main__":
    CERT = "/certs/backend.crt"
    KEY  = "/certs/backend.key"

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
        ssl_context=ssl_ctx,
    )
