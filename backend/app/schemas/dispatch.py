from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class PrasadamDispatchBase(BaseModel):
    status: str = Field(default="PENDING")  # PENDING, PACKED, DISPATCHED, DELIVERED
    courier: Optional[str] = None
    tracking_number: Optional[str] = None
    dispatched_at: Optional[datetime] = None
    delivery_notes: Optional[str] = None


class PrasadamDispatchUpdate(PrasadamDispatchBase):
    pass


class PrasadamDispatchOut(PrasadamDispatchBase):
    id: int
    receipt_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
