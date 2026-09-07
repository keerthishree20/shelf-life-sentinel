from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import init_db
from routes.scan import router as scan_router
from routes.products import router as products_router
from routes.dashboard import router as dashboard_router
from routes.alerts import router as alerts_router
from routes.history import router as history_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="ShelfLife Sentinel API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan_router, prefix="/api")
app.include_router(products_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(alerts_router, prefix="/api")
app.include_router(history_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "ShelfLife Sentinel API is running"}
