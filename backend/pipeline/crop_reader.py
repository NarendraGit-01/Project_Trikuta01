from typing import Any, Dict, List, Optional, Tuple
from langchain_core.callbacks import UsageMetadataCallbackHandler
from langchain_core.messages import HumanMessage, SystemMessage
from PIL import Image
from backend.pipeline.image_loader import crop_from_box, to_b64
from backend.pipeline.schemas import HW, Person
from backend.pipeline.transcription import SYSTEM_PROMPT

ZOOM_PROMPT = """This is a zoomed, high-resolution crop of the handwritten filled-in portion of a temple receipt.
Read ONLY the handwritten ink markings. Do not read the printed Telugu form labels.
- GOTHRAM: 1-3 plausible spellings of the handwritten gothram.
- DEVOTEES: Each person's given name and surname. Copy letter by letter.
- ADDRESS: Door no, street, mandal, village, district.
- PINCODE: 6-digit PIN code.
- PHONES: All handwritten mobile numbers (copy digit by digit)."""

FIELD_GOTHRAM_PROMPT = """This crop shows ONLY the handwritten GOTHRAM field next to 'అభిషేకము చేయించుకొనువారి గోత్రము'.
Read the handwritten letters/characters meticulously.
Give 1-3 plausible readings, best first.
If it is in Telugu script, transcribe in Telugu script. If English, transcribe in English."""

FIELD_PHONES_PROMPT = """This crop shows ONLY the handwritten phone numbers line.
Read all 10-digit phone numbers digit by digit.
Look carefully for multiple phone numbers written side by side."""


def run_zoom_reread(
    llm: Any,
    crop_img: Image.Image,
    usage_tracker: Any
) -> Tuple[HW, Dict[str, Any]]:
    """Pass 3: Re-read the zoomed handwriting crop."""
    cb = UsageMetadataCallbackHandler()
    crop_b64 = to_b64(crop_img)

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=[
            {"type": "text", "text": ZOOM_PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{crop_b64}"}}
        ])
    ]

    structured_llm = llm.with_structured_output(HW)
    result = structured_llm.invoke(messages, config={"callbacks": [cb]})

    for model, meta in cb.usage_metadata.items():
        usage_tracker.log_call(
            label="3. Zoom Handwriting Re-read",
            model_name=model,
            input_tokens=meta.get("input_tokens", 0),
            output_tokens=meta.get("output_tokens", 0),
            reasoning_tokens=(meta.get("output_token_details") or {}).get("reasoning", 0)
        )

    return result, cb.usage_metadata


def run_field_gothram_crop(
    llm: Any,
    img: Image.Image,
    box: Optional[List[int]],
    usage_tracker: Any
) -> List[str]:
    """Pass 4a: Targeted individual crop and re-read of the gothram line."""
    if not box:
        return []
    crop = crop_from_box(img, box, pad=0.04, target_long_side=1500)
    if not crop:
        return []

    cb = UsageMetadataCallbackHandler()
    b64 = to_b64(crop)
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=[
            {"type": "text", "text": FIELD_GOTHRAM_PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}
        ])
    ]

    class GothramOnly(HW):
        pass

    try:
        structured_llm = llm.with_structured_output(GothramOnly)
        res = structured_llm.invoke(messages, config={"callbacks": [cb]})
        for model, meta in cb.usage_metadata.items():
            usage_tracker.log_call(
                label="4a. Targeted Gothram Crop",
                model_name=model,
                input_tokens=meta.get("input_tokens", 0),
                output_tokens=meta.get("output_tokens", 0)
            )
        return res.gothram_readings
    except Exception:
        return []


def run_field_phones_crop(
    llm: Any,
    img: Image.Image,
    box: Optional[List[int]],
    usage_tracker: Any
) -> List[str]:
    """Pass 4b: Targeted individual crop and re-read of the phone numbers line."""
    if not box:
        return []
    crop = crop_from_box(img, box, pad=0.04, target_long_side=1500)
    if not crop:
        return []

    cb = UsageMetadataCallbackHandler()
    b64 = to_b64(crop)
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=[
            {"type": "text", "text": FIELD_PHONES_PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}
        ])
    ]

    class PhonesOnly(HW):
        pass

    try:
        structured_llm = llm.with_structured_output(PhonesOnly)
        res = structured_llm.invoke(messages, config={"callbacks": [cb]})
        for model, meta in cb.usage_metadata.items():
            usage_tracker.log_call(
                label="4b. Targeted Phones Crop",
                model_name=model,
                input_tokens=meta.get("input_tokens", 0),
                output_tokens=meta.get("output_tokens", 0)
            )
        return res.phones
    except Exception:
        return []
