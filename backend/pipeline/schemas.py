from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class Person(BaseModel):
    given_name: str = Field(default="", description="First/given name exactly as written, e.g. Mahalakshmi")
    surname: str = Field(default="", description="Surname/intiperu exactly as written, letter by letter. Do not correct it.")
    given_name_en: Optional[str] = Field(None, description="Devotee given name in clean Indian English (e.g. Pattabhi Ramayya, Venkata Rao).")
    given_name_te: Optional[str] = Field(None, description="Devotee given name in Telugu script (e.g. పట్టాభి రామయ్య, వెంకట రావు).")
    surname_en: Optional[str] = Field(None, description="Devotee family surname/intiperu in clean English (e.g. Yadla, Ravuri).")
    surname_te: Optional[str] = Field(None, description="Devotee family surname/intiperu in Telugu script (e.g. యడ్ల, రావురి).")


class FieldBoundingBoxes(BaseModel):
    handwriting_box_2d: List[int] = Field(
        default_factory=list,
        description="Bounding box [ymin, xmin, ymax, xmax], normalized 0-1000, around all handwritten lines."
    )
    gothram_box_2d: Optional[List[int]] = Field(
        None,
        description="Bounding box [ymin, xmin, ymax, xmax], normalized 0-1000, around the gothram handwriting."
    )
    names_box_2d: Optional[List[int]] = Field(
        None,
        description="Bounding box [ymin, xmin, ymax, xmax], normalized 0-1000, around the devotee names handwriting."
    )
    address_box_2d: Optional[List[int]] = Field(
        None,
        description="Bounding box [ymin, xmin, ymax, xmax], normalized 0-1000, around the address handwriting."
    )
    phone_box_2d: Optional[List[int]] = Field(
        None,
        description="Bounding box [ymin, xmin, ymax, xmax], normalized 0-1000, around the handwritten phone numbers."
    )


class HW(BaseModel):
    gothram_readings: List[str] = Field(
        default_factory=list,
        description="1-3 plausible spellings of the handwritten GOTHRAM, best first."
    )
    gothram_te: Optional[str] = Field(None, description="Handwritten gothram in Telugu script (e.g. కాశ్యప, పైడిపల్లి).")
    gothram_en: Optional[str] = Field(None, description="Handwritten gothram in English letters (e.g. KASHYAPA, PAIDIPALLI).")
    family_surname_te: Optional[str] = Field(
        None,
        description="Shared family surname (ఇంటిపేరు / intiperu) in Telugu script written once before the first devotee's name. Never put Rao/Sarma/Devi/Kumar/Lakshmi here."
    )
    family_surname_en: Optional[str] = Field(
        None,
        description="Shared family surname (intiperu) in natural Indian English (e.g. Yadla, Ravuri, Kotinandini)."
    )
    people: List[Person] = Field(
        default_factory=list,
        description="Every devotee person listed, preserving given name and surname separately in both Telugu and English."
    )
    address: Optional[str] = Field(None, description="Handwritten address exactly as written.")
    address_te: Optional[str] = Field(
        None,
        description="Complete postal address in Telugu script retaining every door number, street, hamlet, landmark, village, mandal, and district written on the slip."
    )
    address_en: Optional[str] = Field(
        None,
        description="Complete postal address faithfully translated/transliterated into clean Indian English (e.g. D.No, Main Road, hamlet in parentheses, Village, Mandal, Dist), preserving ALL handwritten details."
    )
    pincode: Optional[str] = Field(None, description="6-digit PIN code if present.")
    phones: List[str] = Field(
        default_factory=list,
        description="All handwritten phone numbers (10 digits). Do NOT read the printed temple header phone."
    )
    uncertain_fields: List[str] = Field(default_factory=list, description="Fields that are partially unclear.")


class ReceiptExtraction(HW):
    receipt_no: Optional[str] = Field(None, description="Receipt number written/stamped next to రశీదు నెం.")
    date: Optional[str] = Field(None, description="Handwritten date next to తేది, e.g. 10/10/2025.")
    abhishekam_from: Optional[str] = Field(None, description="Starting date of abhishekam, e.g. 22/10/25.")
    abhishekam_to: Optional[str] = Field(None, description="Ending date of abhishekam, e.g. 20/11/25.")
    amount_rupees: Optional[str] = Field(None, description="Rupees amount written, e.g. 1000-00.")
    temple_name: Optional[str] = Field(None, description="Printed temple header name.")
    handwriting_box_2d: List[int] = Field(
        default_factory=list,
        description="[ymin, xmin, ymax, xmax], normalized 0-1000, tightly around all handwritten lines."
    )
    gothram_box_2d: Optional[List[int]] = None
    names_box_2d: Optional[List[int]] = None
    phone_box_2d: Optional[List[int]] = None


class GothramPick(BaseModel):
    as_written: str = Field(description="Gothram as it appears in the handwriting.")
    final: str = Field(description="Final spelling. Use list spelling ONLY if handwriting supports it.")
    matched_in_list: bool
    list_match: Optional[str] = Field(None, description="Exact list entry chosen, if any.")
    other_possible_list_matches: List[str] = Field(default_factory=list, description="Up to 3 other plausible matches.")
    confidence: str = Field(description="high, medium or low")
    reason: str = Field(description="Brief reason for this choice.")


class RotationAssessment(BaseModel):
    is_receipt: bool = Field(description="True if the image contains an Indian temple receipt slip.")
    is_right_side_up: bool = Field(description="True if text reads right-side up from left to right, top to bottom.")
    rotation_needed_degrees: int = Field(
        default=0,
        description="Degrees clockwise to rotate to make it right-side up: 0, 90, 180, or 270."
    )
    confidence: str = Field(default="high", description="high, medium or low")


class QualityAssessment(BaseModel):
    laplacian_variance: float
    mean_luminance: float
    std_luminance: float
    resolution: tuple[int, int]
    verdict: str  # "GOOD", "ACCEPTABLE", "POOR", "UNUSABLE"
    issues_en: List[str]
    issues_te: List[str]
    can_proceed: bool


class FieldConfidence(BaseModel):
    field_name: str
    status: str  # "GREEN", "AMBER", "RED"
    score: float  # 0.0 to 1.0
    reason: str


class PipelineResult(BaseModel):
    receipt_no: Optional[str] = None
    receipt_year: Optional[int] = None
    date: Optional[str] = None
    abhishekam_from: Optional[str] = None
    abhishekam_to: Optional[str] = None
    amount_rupees: Optional[str] = None

    gothram_final: Optional[str] = None
    gothram_te: Optional[str] = None
    gothram_as_written: Optional[str] = None
    gothram_in_reference: bool = False
    gothram_alternatives: List[str] = Field(default_factory=list)

    family_surname_en: Optional[str] = None
    family_surname_te: Optional[str] = None
    people: List[Person] = Field(default_factory=list)
    address: Optional[str] = None
    address_en: Optional[str] = None
    address_te: Optional[str] = None
    pincode: Optional[str] = None
    geo_metadata: Optional[Dict[str, Any]] = None
    phones: List[str] = Field(default_factory=list)

    needs_human_check: List[str] = Field(default_factory=list)
    field_confidences: Dict[str, FieldConfidence] = Field(default_factory=dict)
    overall_confidence: str = "AMBER"

    is_duplicate: bool = False
    duplicate_receipt_id: Optional[int] = None
    duplicate_warning: Optional[str] = None
    duplicate_status: Optional[str] = None

    rotation_applied: int = 0
    intermediate_passes: Dict[str, Any] = Field(default_factory=dict)
    token_usage: Dict[str, Any] = Field(default_factory=dict)
    total_cost_usd: float = 0.0
    total_cost_inr: float = 0.0
    duration_seconds: float = 0.0
