from fastapi import FastAPI
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