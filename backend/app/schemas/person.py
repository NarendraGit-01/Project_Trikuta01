from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ReceiptPersonBase(BaseModel):
    position: int = Field(default=1)
    given_name_en: Optional[str] = None
    given_name_te: Optional[str] = None
    surname_en: Optional[str] = None
    surname_te: Optional[str] = None
    original_ocr: Optional[str] = None
    verification_status: str = Field(default="UNVERIFIED")


class ReceiptPersonCreate(ReceiptPersonBase):
    pass


class ReceiptPersonUpdate(ReceiptPersonBase):
    pass


class ReceiptPersonOut(ReceiptPersonBase):
    id: int
    receipt_id: int

    model_config = ConfigDict(from_attributes=True)
