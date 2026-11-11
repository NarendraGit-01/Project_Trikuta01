from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import backend.app.models  # Ensures all models are registered on Base.metadata
from backend.app.api.api_router import api_router
from backend.app.core.config import settings
from backend.app.core.database import Base, SessionLocal, engine
from backend.app.core.security import get_password_hash
from backend.app.models.user import User


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.APP_ENV != "testing":
        # Startup: ensure all tables are created safely
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as e:
            print(f"Warning: Could not auto-create database tables: {e}")

        # Ensure storage directory exists
        try:
            Path(settings.STORAGE_DIR).mkdir(parents=True, exist_ok=True)
        except Exception:
            pass

        # Seed default Admin and Staff users if missing
        try:
            db = SessionLocal()
            try:
                admin = db.query(User).filter(User.username == "admin").first()
                if not admin:
                    admin_user = User(
                        username="admin",
                        password_hash=get_password_hash("admin123"),
                        full_name="Temple Administrator",
                        role="ADMIN",
                        active=True,
                    )
                    db.add(admin_user)

                staff = db.query(User).filter(User.username == "staff").first()
                if not staff:
                    staff_user = User(
                        username="staff",
                        password_hash=get_password_hash("staff123"),
                        full_name="Temple Office Staff",
                        role="STAFF",
                        active=True,
                    )
                    db.add(staff_user)

                db.commit()
            finally:
                db.close()
        except Exception as e:
            print(f"Warning: Could not seed default users: {e}")

    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for Temple Receipt OCR, Data Extraction & Pooja Management System",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Reference Images for sample previews
samples_dir = Path("Reference Images")
if samples_dir.exists():
    app.mount("/static/samples", StaticFiles(directory=str(samples_dir)), name="samples")

# Mount Storage directory for receipt images
storage_dir = Path(settings.STORAGE_DIR)
try:
    storage_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/static/storage", StaticFiles(directory=str(storage_dir)), name="storage")
except Exception:
    pass

# Mount all API v1 routes
app.include_router(api_router)


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "temple": settings.TEMPLE_NAME_TE,
        "version": "1.0.0",
        "docs_url": "/docs",
        "api_v1": "/api/v1",
    }
