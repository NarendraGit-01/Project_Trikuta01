from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import backend.app.models  # Ensures all models are registered on Base.metadata
from backend.app.api.api_router import api_router
from backend.app.core.config import settings
from sqlalchemy import text
from backend.app.core.database import Base, SessionLocal, engine
from backend.app.core.security import get_password_hash
from backend.app.models.user import User

# Ensure database tables exist upon module load (skip slow 10+ table reflection on Postgres if already initialized)
try:
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(bind=engine)
    else:
        with engine.connect() as _conn:
            _has_receipts = _conn.execute(text("SELECT to_regclass('public.receipts')")).scalar()
        if not _has_receipts:
            Base.metadata.create_all(bind=engine)
except Exception as _db_init_err:
    print(f"Notice: Initial table check deferred: {_db_init_err}")


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
    redirect_slashes=False,
)

# CORS Middleware — explicit origins required when allow_credentials=True
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,   # No cookie auth used; set False so wildcard origins work
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
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


# Mount built React frontend assets if present
frontend_dist = Path("public")
if not (frontend_dist / "index.html").exists():
    frontend_dist = Path("frontend/dist")
if not (frontend_dist / "index.html").exists():
    frontend_dist = Path(__file__).resolve().parent.parent.parent / "public"

assets_dir = frontend_dist / "assets"
if assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")


@app.get("/")
def serve_root():
    index_file = frontend_dist / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    return {
        "app": settings.APP_NAME,
        "temple": settings.TEMPLE_NAME_TE,
        "version": "1.0.0",
        "docs_url": "/docs",
        "api_v1": "/api/v1",
    }


@app.get("/index.html")
def serve_index_html():
    index_file = frontend_dist / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="index.html not found")


@app.get("/{full_path:path}")
def serve_spa_fallback(full_path: str):
    # Do not intercept API, docs, or static endpoints
    if (
        full_path.startswith("api")
        or full_path.startswith("static")
        or full_path.startswith("docs")
        or full_path.startswith("openapi")
    ):
        raise HTTPException(status_code=404, detail="Not Found")

    target = frontend_dist / full_path
    if target.is_file():
        return FileResponse(target)

    index_file = frontend_dist / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)

    raise HTTPException(status_code=404, detail="Not Found")
