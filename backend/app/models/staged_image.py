from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, String
from backend.app.core.database import Base


class StagedImage(Base):
    __tablename__ = "staged_images"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    preview_url = Column(String(500), nullable=False)
    file_size = Column(Integer, default=0)
    image_hash = Column(String(64), index=True, nullable=True)
    book_number = Column(String(50), nullable=True)
    device_label = Column(String(100), default="Mobile Device", nullable=True)
    status = Column(String(50), default="PENDING", index=True)  # PENDING, PROCESSED, FAILED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
