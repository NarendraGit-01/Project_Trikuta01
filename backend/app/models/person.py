from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from backend.app.core.database import Base


class ReceiptPerson(Base):
    __tablename__ = "receipt_persons"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, default=1, nullable=False)

    given_name_en = Column(String(150), nullable=True)
    given_name_te = Column(String(150), nullable=True)
    surname_en = Column(String(150), nullable=True)
    surname_te = Column(String(150), nullable=True)

    original_ocr = Column(String(300), nullable=True)
    verification_status = Column(String(50), default="UNVERIFIED", nullable=False)

    receipt = relationship("Receipt", back_populates="persons")
