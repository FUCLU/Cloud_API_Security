from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.users import router as users_router
from app.routers.products import router as products_router
from app.routers.orders import router as orders_router

app = FastAPI(
    title="Cloud API Security Backend",
    version="1.0.0",
    description="NT219 - Cloud API Security Stack",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",  # cho Kong sau này
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký routers
app.include_router(users_router, prefix="/api/v1", tags=["users"])
app.include_router(products_router, prefix="/api/v1", tags=["products"])
app.include_router(orders_router, prefix="/api/v1", tags=["orders"])


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "service": "backend"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=9000)
