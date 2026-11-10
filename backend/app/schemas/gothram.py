from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class GothramMasterBase(BaseModel):
    gothram_en: str = Field(..., max_length=100)
    gothram_te: Optional[str] = Field(None, max_length=150)
    normalized_name: str = Field(..., max_length=100)
    variants: List[str] = Field(default_factory=list)
    approval_status: str = Field(default="APPROVED")
    te_verified: bool = Field(default=False)


class GothramMasterCreate(GothramMasterBase):
    pass


class GothramMasterOut(GothramMasterBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GothramSearchItem(BaseModel):
    id: int
    gothram_en: str
    gothram_te: Optional[str] = None
    similarity_score: float = 100.0
    approval_status: str = "APPROVED"
    te_verified: bool = False
