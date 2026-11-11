import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional, Union
from PIL import Image

from backend.pipeline.consensus import resolve_consensus
from backend.pipeline.crop_reader import (
    run_field_gothram_crop,
    run_field_phones_crop,
    run_zoom_reread,
)
from backend.pipeline.extraction import run_structured_extraction
from backend.pipeline.gothram_matching import GothramResolver
from backend.pipeline.image_loader import (
    crop_from_box,
    prepare_image,
    resolve_image,
    to_b64,
)
from backend.pipeline.image_quality import evaluate_image_quality
from backend.pipeline.orientation import (
    apply_rotation,
    detect_orientation_heuristic,
    detect_orientation_with_gemini,
)
from backend.pipeline.schemas import (
    GothramPick,
    PipelineResult,
    QualityAssessment,
    ReceiptExtraction,
)
from backend.pipeline.transcription import SYSTEM_PROMPT, run_transcription
from backend.pipeline.usage_tracker import UsageTracker


def get_gemini_client(model_name: Optional[str] = None):
    """Instantiate LangChain ChatGoogleGenerativeAI with model discovery."""
    from langchain_google_genai import ChatGoogleGenerativeAI
    from backend.app.core.config import settings

    api_key = settings.GOOGLE_API_KEY or os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required for OCR.")

    # Sync to os.environ so all sub-libraries and google-genai find it
    os.environ["GOOGLE_API_KEY"] = api_key

    # Map any legacy or UI aliases to valid Google Gemini model identifiers
    MODEL_ALIASES = {
        "gemini-3.8-flash": "gemini-3.8-flash",
        "gemini-3.8-flash-lite": "gemini-3.8-flash-lite",
        "gemini-3.5-flash-lite": "gemini-3.8-flash",
        "gemini-3.5-flash": "gemini-3.8-flash",
        "gemini-3.1-flash-lite": "gemini-3.8-flash-lite",
        "gemini-2.5-flash": "gemini-3.8-flash",
        "gemini-2.5-flash-lite": "gemini-3.8-flash-lite",
        "gemini-2.0-flash": "gemini-3.8-flash",
        "gemini-flash": "gemini-3.8-flash",
        "gemini-flash-lite": "gemini-3.8-flash-lite",
    }
    raw_model = model_name or settings.GEMINI_PRIMARY_MODEL or "gemini-3.8-flash"
    chosen_model = MODEL_ALIASES.get(raw_model, "gemini-3.8-flash")
    return ChatGoogleGenerativeAI(model=chosen_model, max_retries=3, api_key=api_key)


def process_receipt(
    image_input: Union[str, Path, bytes, Image.Image],
    model_name: Optional[str] = None,
    resolver: Optional[GothramResolver] = None,
    skip_transcription: bool = False
) -> PipelineResult:
    """
    Main OCR pipeline execution:
    Pass 0: Prepare image + quality gate + rotation detection
    Pass 1: Line-by-line transcription
    Pass 2: Structured extraction (with handwriting and field boxes)
    Pass 3: Zoom re-read of handwriting block
    Pass 4: Adaptive targeted crops (gothram line, phones line)
    Pass 5: Tiered gothram resolution
    Pass 6: Consensus & evidence-based confidence calibration
    """
    start_time = time.time()
    tracker = UsageTracker()
    passes: Dict[str, Any] = {}

    # Initialize Gothram Resolver
    if resolver is None:
        resolver = GothramResolver()

    # Pass 0a: Load & prepare
    if isinstance(image_input, Image.Image):
        pil_img = image_input.convert("RGB")
    else:
        pil_img = prepare_image(image_input)

    # Pass 0b: Image Quality Gate
    quality: QualityAssessment = evaluate_image_quality(pil_img)
    passes["quality_assessment"] = quality.model_dump()

    # Get LLM client
    try:
        llm = get_gemini_client(model_name)
    except Exception as e:
        # If API key missing, return early with quality assessment
        return PipelineResult(
            needs_human_check=[f"AI OCR pipeline halted: {str(e)}"],
            intermediate_passes=passes,
            duration_seconds=round(time.time() - start_time, 2)
        )

    # Pass 0: Fast Auto-Orientation and Boundary Cropping via OpenCV (15ms)
    rot_deg = 0
    try:
        from backend.pipeline.auto_crop import auto_orient_and_crop
        pil_img, rot_deg, crop_box = auto_orient_and_crop(pil_img)
        passes["auto_crop_box"] = crop_box
        passes["rotation_applied"] = rot_deg
    except Exception as e:
        passes["auto_crop_error"] = str(e)

    # If image is still portrait (h > w), fallback to lightweight orientation
    w, h = pil_img.size
    if h > w:
        extra_rot, rot_assessment = detect_orientation_with_gemini(pil_img, llm_client=llm)
        passes["rotation_assessment"] = rot_assessment.model_dump() if hasattr(rot_assessment, "model_dump") else {}
        if extra_rot > 0:
            pil_img = apply_rotation(pil_img, extra_rot)
            rot_deg = (rot_deg + extra_rot) % 360
            passes["rotation_applied"] = rot_deg

    image_b64 = to_b64(pil_img)

    # Pass 1: Transcription
    transcription_text = ""
    if not skip_transcription:
        transcription_text, _ = run_transcription(llm, image_b64, tracker)
        passes["pass1_transcription"] = transcription_text

    # Pass 2: Structured Extraction
    r2, _ = run_structured_extraction(llm, image_b64, tracker)
    passes["pass2_structured"] = r2.model_dump()

    # Pass 3: Zoom Handwriting Crop (only needed if structured extraction found 0 devotees)
    r3 = None
    crop = None
    if not r2.people or len(r2.people) == 0:
        crop = crop_from_box(pil_img, r2.handwriting_box_2d)
        if crop:
            try:
                r3, _ = run_zoom_reread(llm, crop, tracker)
                passes["pass3_zoom"] = r3.model_dump()
            except Exception as e:
                passes["pass3_zoom_error"] = str(e)

    # Pass 4: Adaptive Field Crops (only needed if Pass 2 completely missed readings)
    field_gothram_readings = []
    if r2.gothram_box_2d and (not r2.gothram_readings or len(r2.gothram_readings) == 0):
        try:
            field_gothram_readings = run_field_gothram_crop(llm, pil_img, r2.gothram_box_2d, tracker)
            passes["pass4_gothram_crop"] = field_gothram_readings
        except Exception:
            pass

    field_phones = []
    if r2.phone_box_2d and (not r2.phones or len(r2.phones) == 0):
        try:
            field_phones = run_field_phones_crop(llm, pil_img, r2.phone_box_2d, tracker)
            passes["pass4_phones_crop"] = field_phones
        except Exception:
            pass

    # Pass 5: Instant Master List Gothram Resolution (RapidFuzz - 1ms, zero latency)
    all_g_readings = list(dict.fromkeys([
        *field_gothram_readings,
        *(r3.gothram_readings if r3 else []),
        *(r2.gothram_readings or [])
    ]))
    cands = resolver.get_candidates(all_g_readings, top_k=30)
    best_cand_score = cands[0][1] if cands else 0.0

    if cands and best_cand_score >= 80.0:
        top_name = cands[0][0]
        g_pick = GothramPick(
            final=top_name,
            matched_in_list=True,
            list_match=top_name,
            confidence="high" if best_cand_score >= 90.0 else "medium",
            reason=f"Verified with Devasthanam 2,099 Gothram Master ({best_cand_score:.0f}%)"
        )
    elif cands and best_cand_score >= 60.0:
        top_name = cands[0][0]
        g_pick = GothramPick(
            final=top_name,
            matched_in_list=True,
            list_match=top_name,
            confidence="medium",
            reason=f"Candidate match: {top_name} ({best_cand_score:.0f}%)"
        )
    else:
        raw_reading = all_g_readings[0] if all_g_readings else (r2.gothram_as_written or "")
        g_pick = GothramPick(
            final=raw_reading,
            matched_in_list=False,
            list_match=None,
            confidence="low",
            reason="Unlisted gothram - marked for staff verification"
        )

    passes["pass5_gothram_pick"] = g_pick.model_dump()

    # Pass 6: Consensus & Evidence-Based Confidence Calibration
    final_data, needs_check, confidences = resolve_consensus(
        r2=r2,
        r3=r3,
        gothram_pick=g_pick,
        field_phones=field_phones,
        transcription_text=transcription_text
    )

    # Overall confidence: RED if any field is RED, AMBER if any AMBER, GREEN otherwise
    has_red = any(fc.status == "RED" for fc in confidences.values())
    has_amber = any(fc.status == "AMBER" for fc in confidences.values())
    overall_conf = "RED" if has_red else ("AMBER" if has_amber else "GREEN")

    duration = round(time.time() - start_time, 2)
    summary_cost = tracker.summary()

    return PipelineResult(
        receipt_no=final_data["receipt_no"],
        receipt_year=final_data["receipt_year"],
        date=final_data["date"],
        abhishekam_from=final_data["abhishekam_from"],
        abhishekam_to=final_data["abhishekam_to"],
        amount_rupees=final_data["amount_rupees"],
        gothram_final=final_data["gothram_final"],
        gothram_as_written=final_data["gothram_as_written"],
        gothram_in_reference=final_data["gothram_in_reference"],
        gothram_alternatives=final_data["gothram_alternatives"],
        people=final_data["people"],
        address=final_data["address"],
        address_en=final_data.get("address_en"),
        address_te=final_data.get("address_te"),
        pincode=final_data["pincode"],
        geo_metadata=final_data.get("geo_metadata"),
        phones=final_data["phones"],
        needs_human_check=needs_check,
        field_confidences=confidences,
        overall_confidence=overall_conf,
        rotation_applied=rot_deg,
        intermediate_passes=passes,
        token_usage=summary_cost,
        total_cost_usd=summary_cost["total_cost_usd"],
        total_cost_inr=summary_cost["total_cost_inr"],
        duration_seconds=duration,
    )


def main():
    parser = argparse.ArgumentParser(description="Trikuta Temple Receipt OCR Pipeline")
    parser.add_argument("image_path", help="Path to temple receipt image")
    parser.add_argument("--model", default=None, help="Gemini model name (e.g. gemini-3.5-flash)")
    parser.add_argument("--output", "-o", default=None, help="Path to save JSON output")
    parser.add_argument("--skip-transcription", action="store_true", help="Skip line-by-line transcription pass to save tokens")

    args = parser.parse_args()

    print(f"\n=======================================================")
    print(f" Processing: {args.image_path}")
    print(f"=======================================================\n")

    result = process_receipt(
        image_input=args.image_path,
        model_name=args.model,
        skip_transcription=args.skip_transcription
    )

    out_json = result.model_dump_json(indent=2)
    print(out_json)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(out_json)
        print(f"\nSaved pipeline output to: {args.output}")


if __name__ == "__main__":
    main()
