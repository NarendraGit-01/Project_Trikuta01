from fastapi import APIRouter
from backend.app.api.routes import auth, gothrams, health, ocr, receipts, storage, users

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(ocr.router)
api_router.include_router(receipts.router)
api_router.include_router(gothrams.router)
api_router.include_router(users.router)
api_router.include_router(storage.router)
