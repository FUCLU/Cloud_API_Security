from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.security.jwt_verify import verify_token

ACCESS_COOKIE = "cloudapi_access"

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        public_paths = [
            '/',
            '/health',
            '/docs',
            '/openapi.json',
            '/api/v1/orders/webhooks/orders',
            '/api/v1/auth/callback',
            '/api/v1/auth/session',
            '/api/v1/auth/logout',
        ]
        if request.url.path in public_paths or request.url.path.startswith('/api/v1/webhooks'):
            return await call_next(request)

        auth_header = request.headers.get('Authorization')
        cookie_token = request.cookies.get(ACCESS_COOKIE)

        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        elif cookie_token:
            token = cookie_token
        else:
            return JSONResponse(
                status_code=401,
                content={'detail': 'Missing authenticated session'},
            )

        try:
            payload = await verify_token(token)
            request.state.user = payload
        except ValueError as e:
            return JSONResponse(
                status_code=401,
                content={'detail': str(e)},
            )
        except Exception:
            return JSONResponse(
                status_code=500,
                content={'detail': 'Internal authentication error'},
            )

        return await call_next(request)
