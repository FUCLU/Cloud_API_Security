from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import jwt
from jwt import PyJWTError, ExpiredSignatureError


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Public paths không cần auth
        public_paths = [
            "/health",
            "/docs",
            "/openapi.json",
            "/",
            "/api/v1/orders/webhooks/orders",
        ]

        if request.url.path in public_paths or request.url.path.startswith(
            "/api/v1/webhooks"
        ):
            return await call_next(request)

        # Kiểm tra Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid Authorization header"},
            )

        token = auth_header.split(" ")[1]

        try:
            # Tạm thời decode không verify signature để test CRUD & BOLA
            # Sau này sẽ thay bằng verify đúng với Keycloak JWKS
            decoded = jwt.decode(
                token, options={"verify_signature": False, "verify_exp": True}
            )

            request.state.token = decoded
            print(
                f"[Auth Middleware] Token decoded successfully - sub: {decoded.get('sub')}"
            )

        except ExpiredSignatureError:
            return JSONResponse(
                status_code=401, content={"detail": "Token has expired"}
            )
        except PyJWTError as e:
            print(f"[Auth Middleware] JWT Error: {e}")
            return JSONResponse(
                status_code=401, content={"detail": "Invalid or tampered token"}
            )
        except Exception as e:
            print(f"[Auth Middleware] Unexpected error: {e}")
            return JSONResponse(
                status_code=500, content={"detail": "Internal authentication error"}
            )

        return await call_next(request)
