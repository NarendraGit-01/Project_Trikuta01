from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from backend.app.schemas.person import ReceiptPersonCreate, ReceiptPersonOut
from backend.app.schemas.phone import ReceiptPhoneCreate, ReceiptPhoneOut
from backend.app.schemas.dispatch import PrasadamDispatchOut


class ReceiptBase(BaseModel):
    receipt_no: str = Field(..., max_length=100)
    receipt_year: Optional[int] = None
    receipt_date: Optional[str] = None
    abhishekam_from: Optional[str] = None
    abhishekam_to: Optional[str] = None
    amount: Optional[str] = None

    # Gothram
    gothram_en: Optional[str] = None
    gothram_te: Optional[str] = None
    gothram_master_id: Optional[int] = None
    gothram_as_written: Optional[str] = None

    # Contact
    address_en: Optional[str] = None
    address_te: Optional[str] = None
    pincode: Optional[str] = None

    # Status
    status: str = Field(default="PENDING_VERIFICATION")  # PENDING_VERIFICATION, CONFIRMED, INCOMPLETE
    book_number: Optional[str] = None
    image_hash: Optional[str] = None



class ReceiptCreate(ReceiptBase):
    original_image_path: str
    corrected_image_path: Optional[str] = None
    handwriting_crop_path: Optional[str] = None
    ocr_raw: Optional[Dict[str, Any]] = None
    confidence_data: Optional[Dict[str, Any]] = None
    model_name: Optional[str] = None
    processing_cost: float = 0.0
    processing_duration: float = 0.0
    persons: List[ReceiptPersonCreate] = Field(default_factory=list)
    phones: List[ReceiptPhoneCreate] = Field(default_factory=list)


class ReceiptUpdate(BaseModel):
    receipt_no: Optional[str] = None
    receipt_year: Optional[int] = None
    receipt_date: Optional[str] = None
    abhishekam_from: Optional[str] = None
    abhishekam_to: Optional[str] = None
    amount: Optional[str] = None

    gothram_en: Optional[str] = None
    gothram_te: Optional[str] = None
    gothram_master_id: Optional[int] = None
    gothram_as_written: Optional[str] = None

    address_en: Optional[str] = None
    address_te: Optional[str] = None
    pincode: Optional[str] = None
    status: Optional[str] = None
    book_number: Optional[str] = None

    persons: Optional[List[ReceiptPersonCreate]] = None
    phones: Optional[List[ReceiptPhoneCreate]] = None


class ReceiptOut(ReceiptBase):
    id: int
    original_image_path: str
    corrected_image_path: Optional[str] = None
    handwriting_crop_path: Optional[str] = None
    ocr_raw: Optional[Dict[str, Any]] = None
    confidence_data: Optional[Dict[str, Any]] = None
    model_name: Optional[str] = None
    processing_cost: float
    processing_duration: float
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    persons: List[ReceiptPersonOut] = Field(default_factory=list)
    phones: List[ReceiptPhoneOut] = Field(default_factory=list)
    dispatch: Optional[PrasadamDispatchOut] = None

    model_config = ConfigDict(from_attributes=True)


class ReceiptListItem(BaseModel):
    id: int
    receipt_no: str
    receipt_year: Optional[int] = None
    receipt_date: Optional[str] = None
    gothram_en: Optional[str] = None
    gothram_te: Optional[str] = None
    primary_devotee: Optional[str] = None
    abhishekam_from: Optional[str] = None
    abhishekam_to: Optional[str] = None
    status: str
    book_number: Optional[str] = None
    original_image_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
