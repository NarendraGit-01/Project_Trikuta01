from typing import Any, Dict, Tuple
from langchain_core.callbacks import UsageMetadataCallbackHandler
from langchain_core.messages import HumanMessage, SystemMessage
from backend.app.core.config import settings
from backend.pipeline.schemas import ReceiptExtraction
from backend.pipeline.transcription import SYSTEM_PROMPT

BILINGUAL_SYSTEM_PROMPT = (
    "You are an expert OCR and bilingual Telugu/English extraction engine for Andhra Pradesh and Telangana temple receipts "
    "(Sri Trikoteswara Swamy Devasthanam, Kotappakonda). Read handwritten ink markings meticulously without inventing, "
    "summarizing, or dropping any detail. For every Telugu text field, output BOTH the faithful Telugu script (*_te) AND "
    "clean, natural Indian-English spelling/translation (*_en). If a field was handwritten in English, also provide its "
    "accurate Telugu script equivalent (*_te)."
)

LEGACY_EXTRACTION_PROMPT = """Extract the structured fields from this temple receipt image.

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

BILINGUAL_EXTRACTION_PROMPT = """Extract all structured fields from this temple receipt image in BOTH Telugu script and natural Indian English.

Important Instructions:
1. GOTHRAM:
   - Look next to 'అభిషేకము చేయించుకొనువారి గోత్రము'.
   - Provide `gothram_readings` (1-3 plausible spellings, best first), `gothram_te` (Telugu script, e.g. కాశ్యప, పైడిపల్లి), and `gothram_en` (English, e.g. KASHYAPA, PAIDIPALLI).
2. SHARED FAMILY SURNAME (ఇంటిపేరు / INTIPERU) & DEVOTEES:
   - On Telugu receipts, the family surname/intiperu (e.g. యడ్ల, రావురి, కోటినందిని, కంభంపాటి) is usually written ONCE before the FIRST devotee's name, and shared by the whole family unless another person explicitly has a different surname.
   - Put that shared surname into `family_surname_te` (Telugu) and `family_surname_en` (natural English, e.g. Yadla, Ravuri), AND also fill `surname` / `surname_te` / `surname_en` on each Person.
   - NEVER put given-name suffixes or honorifics like Rao (రావు), Sarma (శర్మ), Murthy (మూర్తి), Kumar (కుమార్), Prasad (ప్రసాద్), Raju (రాజు), Babu (బాబు), Reddy (రెడ్డి), Lakshmi (లక్ష్మి), Devi (దేవి) into surname — keep them inside `given_name` / `given_name_te` / `given_name_en`!
   - NEVER treat printed words 'శ్రీ/శ్రీమతి' (Sri/Srimati), 'దంపతులు' (couple), 'మరియు' (and), 'కుమారులు' (sons) as names.
   - For every devotee, populate `given_name` (as written), `given_name_te` (Telugu), `given_name_en` (natural Indian English spelling, e.g. పట్టాభి రామయ్య -> Pattabhi Ramayya, వెంకట రావు -> Venkata Rao, సుబ్రహ్మణ్యం -> Subrahmanyam).
3. POSTAL ADDRESS (CRITICAL — BILINGUAL 1:1):
   - Populate `address` (raw handwritten text), `address_te` (complete Telugu address), AND `address_en` (faithful Indian English translation/transliteration).
   - Preserve EVERY single handwritten detail: door/house number, street, shop/landmark, village, hamlet in parentheses (e.g. (గుడపరురిగూడెము) -> (Gudaparru Gudem)), mandal, taluk, and district.
   - Translate standard address terms accurately into English (`డి.నెం` -> `D.No`, `మెయిన్ రోడ్డు` -> `Main Road`, `వీధి` -> `Street`, `బజార్` -> `Bazaar`, `ప్రక్కన` -> `Beside`, `ఎదురుగా` -> `Opp.`, `సమీపంలో` -> `Near`, `పోస్ట్` -> `Post`, `వయా` -> `Via`, `గ్రామం` -> `Village`, `మండలం` -> `Mandal`, `జిల్లా` -> `Dist`). Never drop handwritten tokens or invent unprinted places.
4. RECEIPT DATE & NUMBER:
   - Receipt date is handwritten top-right next to 'తేది' (e.g. 10/10/2025). Do NOT read the printed commissioner order date 'Dt. 05-10-2022' at the bottom.
   - Receipt number is next to 'రశీదు నెం'.
5. ABHISHEKAM DATES:
   - Extract starting date (`తే. ... నుండి`) and ending date (`తే. ... వరకు`).
6. PHONE NUMBERS:
   - Extract ONLY handwritten mobile numbers next to 'ఫోన్ నెం / సెల్ నెం'. Do NOT extract printed temple header contact numbers (79953 18954, etc.).
7. BOUNDING BOXES:
   - Return `handwriting_box_2d`, `gothram_box_2d`, `names_box_2d`, and `phone_box_2d` [ymin, xmin, ymax, xmax] normalized 0-1000."""

EXTRACTION_PROMPT = BILINGUAL_EXTRACTION_PROMPT


def run_structured_extraction(
    llm: Any,
    image_b64: str,
    usage_tracker: Any
) -> Tuple[ReceiptExtraction, Dict[str, Any]]:
    """Pass 2: Full-image structured extraction returning ReceiptExtraction model."""
    use_bilingual = getattr(settings, "USE_BILINGUAL_LLM_EXTRACTION", True)
    sys_prompt = BILINGUAL_SYSTEM_PROMPT if use_bilingual else SYSTEM_PROMPT
    ext_prompt = BILINGUAL_EXTRACTION_PROMPT if use_bilingual else LEGACY_EXTRACTION_PROMPT

    cb = UsageMetadataCallbackHandler()
    messages = [
        SystemMessage(content=sys_prompt),
        HumanMessage(content=[
            {"type": "text", "text": ext_prompt},
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
