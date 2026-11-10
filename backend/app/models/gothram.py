from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String
from backend.app.core.database import Base


class GothramMaster(Base):
    __tablename__ = "gothram_master"

    id = Column(Integer, primary_key=True, index=True)
    gothram_en = Column(String(100), index=True, nullable=False)
    gothram_te = Column(String(150), nullable=True)
    normalized_name = Column(String(100), index=True, nullable=False)
    variants = Column(JSON, default=list, nullable=False)
    approval_status = Column(String(50), default="APPROVED", nullable=False)  # "APPROVED", "PENDING"
    te_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
