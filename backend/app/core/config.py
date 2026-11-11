import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Trikuta Temple Receipt OCR & Management System"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # Security
    SECRET_KEY: str = "trikuta-secret-key-default-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Database
    DATABASE_URL: str = "sqlite:////tmp/temple_receipts.db" if os.getenv("VERCEL") and not os.getenv("DATABASE_URL") else "sqlite:///./temple_receipts.db"

    # Storage
    STORAGE_DIR: str = "/tmp/storage" if os.getenv("VERCEL") else "./data/storage"

    # Supabase (Storage & Postgres)
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_BUCKET: str = "receipts"

    # AI Configuration (Gemini)
    GOOGLE_API_KEY: str = ""
    GEMINI_PRIMARY_MODEL: str = "gemini-2.5-flash"
    GEMINI_FALLBACK_MODEL: str = "gemini-2.0-flash"
    GEMINI_ROUTING_MODEL: str = "gemini-2.5-flash-lite"

    # Temple Config
    TEMPLE_NAME_TE: str = "శ్రీ త్రికోటేశ్వర స్వామి వారి దేవస్థానము"
    TEMPLE_NAME_EN: str = "Sri Trikoteswara Swamy Vari Devasthanam"
    TEMPLE_LOCATION: str = "Kotappakonda"

    # Uniqueness: "global" | "yearly" | "none"
    RECEIPT_UNIQUENESS_POLICY: str = "yearly"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173", "*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
