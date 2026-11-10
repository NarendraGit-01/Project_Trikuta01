from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from backend.app.core.database import Base


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, index=True)
    receipt_no = Column(String(100), index=True, nullable=False)
    receipt_year = Column(Integer, index=True, nullable=True)
    receipt_date = Column(String(50), nullable=True)
    abhishekam_from = Column(String(50), nullable=True)
    abhishekam_to = Column(String(50), nullable=True)
    amount = Column(String(50), nullable=True)

    # Gothram
    gothram_en = Column(String(100), index=True, nullable=True)
    gothram_te = Column(String(150), nullable=True)
    gothram_master_id = Column(Integer, ForeignKey("gothram_master.id", ondelete="SET NULL"), nullable=True)
    gothram_as_written = Column(String(150), nullable=True)

    # Address & Contact
    address_en = Column(Text, nullable=True)
    address_te = Column(Text, nullable=True)
    pincode = Column(String(20), index=True, nullable=True)

    # Status: PENDING_VERIFICATION, CONFIRMED, INCOMPLETE
    status = Column(String(50), default="PENDING_VERIFICATION", index=True, nullable=False)

    book_number = Column(String(50), index=True, nullable=True)
    image_hash = Column(String(64), index=True, nullable=True)

    original_image_path = Column(String(500), nullable=False)
    corrected_image_path = Column(String(500), nullable=True)
    handwriting_crop_path = Column(String(500), nullable=True)

    # Processing metadata
    ocr_raw = Column(JSON, nullable=True)
    confidence_data = Column(JSON, nullable=True)
    model_name = Column(String(100), nullable=True)
    processing_cost = Column(Float, default=0.0, nullable=False)
    processing_duration = Column(Float, default=0.0, nullable=False)

    # Audit & Tracking
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    persons = relationship("ReceiptPerson", back_populates="receipt", cascade="all, delete-orphan", order_by="ReceiptPerson.position")
    phones = relationship("ReceiptPhone", back_populates="receipt", cascade="all, delete-orphan")
    corrections = relationship("Correction", back_populates="receipt", cascade="all, delete-orphan")
    dispatch = relationship("PrasadamDispatch", back_populates="receipt", uselist=False, cascade="all, delete-orphan")
    gothram_master = relationship("GothramMaster")
    creator = relationship("User")
