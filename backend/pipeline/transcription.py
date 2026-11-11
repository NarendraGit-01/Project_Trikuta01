from typing import Any, Dict, Tuple
from langchain_core.messages import HumanMessage, SystemMessage
from backend.pipeline.image_loader import to_b64

SYSTEM_PROMPT = (
    "You are a meticulous OCR engine for Indian temple documents containing Telugu and English, "
    "both printed and handwritten. Transcribe exactly what is written. Never translate, "
    "transliterate, summarize or invent text. Keep Telugu in Telugu script and English in English."
)

TRANSCRIPTION_PROMPT = """Transcribe ALL text in this temple receipt, top to bottom, line by line.
Rules:
- Keep printed text and handwritten text, in reading order, preserving line breaks.
- Mark handwritten text with [HW: ...] and printed text plainly without brackets.
- Copy every number, date, phone number, pincode and receipt number digit by digit.
- Pay special attention to the date written next to 'తేది' (the year is typically 2025/2026; do not confuse it with the printed 2022 commissioner order date at the bottom).
- If a word is partially hidden by a stamp, shadow or fold, write [unclear] (give your best guess in parentheses if you have one).
- If a word is illegible, write [illegible]. Do not guess silently."""


def run_transcription(
    llm: Any,
    image_b64: str,
    usage_tracker: Any
) -> Tuple[str, Dict[str, Any]]:
    """Pass 1: Complete line-by-line transcription of the receipt."""
    from langchain_core.callbacks import UsageMetadataCallbackHandler

    cb = UsageMetadataCallbackHandler()
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=[
            {"type": "text", "text": TRANSCRIPTION_PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}}
        ])
    ]

    resp = llm.invoke(messages, config={"callbacks": [cb]})
    transcription = str(resp.content or resp.text or "")

    # Log usage
    for model, meta in cb.usage_metadata.items():
        usage_tracker.log_call(
            label="1. Full-image Transcription",
            model_name=model,
            input_tokens=meta.get("input_tokens", 0),
            output_tokens=meta.get("output_tokens", 0),
            reasoning_tokens=(meta.get("output_token_details") or {}).get("reasoning", 0)
        )

    return transcription, cb.usage_metadata
