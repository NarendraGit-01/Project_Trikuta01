from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ReceiptPhoneBase(BaseModel):
    number: str = Field(..., description="Phone number string")
    is_primary: bool = Field(default=True)
    verification_status: str = Field(default="UNVERIFIED")


class ReceiptPhoneCreate(ReceiptPhoneBase):
    pass


class ReceiptPhoneOut(ReceiptPhoneBase):
    id: int
    receipt_id: int

    model_config = ConfigDict(from_attributes=True)
