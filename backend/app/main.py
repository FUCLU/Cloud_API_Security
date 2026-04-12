from fastapi import FastAPI
from app.routers import users, products, orders

app = FastAPI()


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(users.router, prefix="/api/v1")
app.include_router(products.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")
