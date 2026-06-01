from fastapi import Request
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.security.jwt_verify import verify_token
from app.security.dpop_verifier import verify_dpop

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        public_paths = [
            '/',
            '/health',
            '/docs',
            '/openapi.json',
            '/api/v1/orders/webhooks/orders',
        ]
        if request.url.path in public_paths or request.url.path.startswith('/api/v1/webhooks'):
            return await call_next(request)

        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JSONResponse(
                status_code=401,
                content={'detail': 'Missing or invalid Authorization header'},
            )

        token = auth_header.split(' ')[1]

        try:
            payload = await verify_token(token)
            verify_dpop(request, token)
            request.state.user = payload
        except HTTPException as e:
            return JSONResponse(
                status_code=e.status_code,
                content={'detail': e.detail},
            )
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
