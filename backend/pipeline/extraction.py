from typing import Any, Dict, Tuple
from langchain_core.callbacks import UsageMetadataCallbackHandler
from langchain_core.messages import HumanMessage, SystemMessage
from backend.pipeline.schemas import ReceiptExtraction
from backend.pipeline.transcription import SYSTEM_PROMPT

EXTRACTION_PROMPT = """Extract the structured fields from this temple receipt image.

Important Instructions:
1. GOTHRAM: Look next to 'అభిషేకము చేయించుకొనువారి గోత్రము'. Provide 1-3 plausible spellings of the handwritten gothram (best first).
2. DEVOTEES & SURNAMES:
   - 'శ్రీ/శ్రీమతి' (Sri/Srimati) is a PRINTED TITLE / HONORIFIC. Never treat it as a person's name!
   - 'దంపతులు' (dampatulu = couple) and 'మరియు' (and) and 'కుమారులు' (sons) are family relation words.
   - For each devotee person, extract their given name and surname separately. Copy surnames letter by letter exactly as written.
3. RECEIPT DATE:
   - The receipt date is handwritten on the top right next to 'తేది' (e.g. 10/10/2025, 02/11/26).
   - Do NOT read the printed order date 'Dt. 05-10-2022' from the bank terms paragraph at the bottom.
4. ABHISHEKAM DATES:
   - Extract starting date (తే. ... నుండి) and ending date (తే. ... వరకు).
5. PHONE NUMBERS:
   - Handwritten next to 'ఫోన్ నెం / సెల్ నెం'. Look carefully for multiple phone numbers on that line.
   - Do NOT extract the printed temple header contact numbers (79953 18954, etc.).
6. BOUNDING BOXES:
   - Return handwriting_box_2d [ymin, xmin, ymax, xmax] normalized 0-1000 tightly around all handwritten lines.
   - Also return gothram_box_2d, names_box_2d, and phone_box_2d around those specific handwritten lines."""


def run_structured_extraction(
    llm: Any,
    image_b64: str,
    usage_tracker: Any
) -> Tuple[ReceiptExtraction, Dict[str, Any]]:
    """Pass 2: Full-image structured extraction returning ReceiptExtraction model."""
    cb = UsageMetadataCallbackHandler()
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=[
            {"type": "text", "text": EXTRACTION_PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}}
        ])
    ]

    structured_llm = llm.with_structured_output(ReceiptExtraction)
    result = structured_llm.invoke(messages, config={"callbacks": [cb]})

    for model, meta in cb.usage_metadata.items():
        usage_tracker.log_call(
            label="2. Structured Fields Extraction",
            model_name=model,
            input_tokens=meta.get("input_tokens", 0),
            output_tokens=meta.get("output_tokens", 0),
            reasoning_tokens=(meta.get("output_token_details") or {}).get("reasoning", 0)
        )

    return result, cb.usage_metadata
