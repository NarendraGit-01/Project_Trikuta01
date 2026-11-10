from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from backend.app.core.database import Base


class PrasadamDispatch(Base):
    __tablename__ = "prasadam_dispatch"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id", ondelete="CASCADE"), unique=True, nullable=False)
    status = Column(String(50), default="PENDING", index=True, nullable=False)  # PENDING, PACKED, DISPATCHED, DELIVERED
    courier = Column(String(100), nullable=True)
    tracking_number = Column(String(100), nullable=True)
    dispatched_at = Column(DateTime, nullable=True)
    delivery_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    receipt = relationship("Receipt", back_populates="dispatch")
