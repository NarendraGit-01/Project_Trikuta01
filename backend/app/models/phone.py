from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from backend.app.core.database import Base


class ReceiptPhone(Base):
    __tablename__ = "receipt_phones"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False)
    number = Column(String(30), index=True, nullable=False)
    is_primary = Column(Boolean, default=True, nullable=False)
    verification_status = Column(String(50), default="UNVERIFIED", nullable=False)

    receipt = relationship("Receipt", back_populates="phones")
