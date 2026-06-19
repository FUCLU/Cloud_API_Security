import os
import ssl
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import users, orders, products, auth, security
from app.db.database import init_db
from app.middleware.auth_middleware import AuthMiddleware


APP_TITLE = "Cloud API Security Backend"
APP_VERSION = "1.0.0"
DEFAULT_CORS_ORIGINS = "https://localhost:5174"
TLS_CERT_PATH = os.getenv("BACKEND_TLS_CERT_PATH", "/run/secrets/backend_tls_cert")
TLS_KEY_PATH = os.getenv("BACKEND_TLS_KEY_PATH", "/run/secrets/backend_tls_key")


def parse_cors_origins() -> list[str]:
    raw_origins = os.getenv("BACKEND_CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=APP_TITLE,
        version=APP_VERSION,
        redirect_slashes=False,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=parse_cors_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "X-TOTP-Code", "Content-Type"],
    )
    app.add_middleware(AuthMiddleware)

    for router in (users.router, products.router, orders.router, auth.router, security.router):
        app.include_router(router)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/")
    def root():
        return {"message": "Backend is running"}

    return app


def uvicorn_tls_kwargs() -> dict:
    if not (os.path.exists(TLS_CERT_PATH) and os.path.exists(TLS_KEY_PATH)):
        print("Backend running without local TLS certificate")
        return {}

    print("Backend TLS certificate loaded")
    return {
        "ssl_certfile": TLS_CERT_PATH,
        "ssl_keyfile": TLS_KEY_PATH,
        "ssl_version": ssl.PROTOCOL_TLS_SERVER,
    }


app = create_app()

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=9000,
        **uvicorn_tls_kwargs(),
    )
