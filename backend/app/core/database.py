import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.core.config import settings

db_url = settings.DATABASE_URL
# Supabase / cloud providers output postgres:// or postgresql://
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

try:
    import psycopg2
    has_psycopg2 = True
except ImportError:
    has_psycopg2 = False

try:
    import psycopg
    has_psycopg = True
except ImportError:
    has_psycopg = False

if db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    if has_psycopg2:
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    elif has_psycopg:
        db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

# Graceful fallback to SQLite when C database drivers are not installed locally or on serverless
if (db_url.startswith("postgresql://") or db_url.startswith("postgresql+")) and not has_psycopg2 and not has_psycopg:
    fallback_path = "/tmp/temple_receipts.db" if os.getenv("VERCEL") else "./temple_receipts.db"
    print(f"Notice: PostgreSQL driver not installed. Falling back to SQLite at {fallback_path}")
    db_url = f"sqlite:///{fallback_path}"

engine_kwargs = {"echo": False}

if db_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL / Supabase connection pooling
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300
    if ("supabase" in db_url.lower() or os.getenv("VERCEL")) and "sslmode" not in db_url:
        engine_kwargs["connect_args"] = {"sslmode": "require"}

engine = create_engine(db_url, **engine_kwargs)

# Enable foreign keys for SQLite
if db_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency that yields a database session and safely closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
