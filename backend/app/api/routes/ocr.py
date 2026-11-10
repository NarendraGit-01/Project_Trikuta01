import hashlib

import shutil
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status


from pydantic import BaseModel
from PIL import Image

from backend.app.core.config import settings
from backend.app.core.database import SessionLocal

from backend.app.models.receipt import Receipt
from backend.app.storage.local import LocalStorageBackend
from backend.pipeline.image_loader import prepare_image, to_b64
from backend.pipeline.image_quality import evaluate_image_quality
from backend.pipeline.orientation import detect_orientation_heuristic, detect_orientation_with_gemini, apply_rotation
from backend.pipeline.run import get_gemini_client, process_receipt
from backend.pipeline.schemas import PipelineResult, QualityAssessment
from sqlalchemy.orm import Session

router = APIRouter(prefix="/ocr", tags=["OCR Pipeline"])

# Reference samples directory
SAMPLES_DIR = Path("Reference Images")


def check_and_annotate_duplicate(result: PipelineResult, db: Optional[Session] = None) -> PipelineResult:
    """Check if the extracted receipt number already exists in the database and annotate result."""
    if not result.receipt_no:
        return result

    clean_no = str(result.receipt_no).strip()
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        q = db.query(Receipt).filter(Receipt.receipt_no == clean_no)
        if settings.RECEIPT_UNIQUENESS_POLICY == "yearly" and result.receipt_year:
            q = q.filter(Receipt.receipt_year == result.receipt_year)

        existing = q.first()
        if existing:
            result.is_duplicate = True
            result.duplicate_receipt_id = existing.id
            result.duplicate_status = existing.status
            result.duplicate_warning = (
                f"Receipt #{clean_no} already exists in the temple database "
                f"(Status: {existing.status}, Record ID: #{existing.id})."
            )
            alert_msg = f"DUPLICATE DETECTED: Receipt #{clean_no} is already in database (Status: {existing.status})"
            if alert_msg not in result.needs_human_check:
                result.needs_human_check.insert(0, alert_msg)
    except Exception:
        pass
    finally:
        if close_db:
            db.close()

    return result

SAMPLE_METADATA = [
    {
        "filename": "sample_img10.jpeg",
        "receipt_no": "5810",
        "description": "Telugu handwriting, 4 family members, 180° inverted",
        "features": ["Receipt #5810", "Telugu Script", "4 Devotees", "180° Rotation"]
    },
    {
        "filename": "sample_img11.jpeg",
        "receipt_no": "5811",
        "description": "Telugu handwriting, 6 family members, 180° inverted",
        "features": ["Receipt #5811", "Telugu Script", "6 Devotees", "180° Rotation"]
    },
    {
        "filename": "sample_img5.jpeg",
        "receipt_no": "5812",
        "description": "Telugu handwriting, 5 family members, clear address & gothram",
        "features": ["Receipt #5812", "Telugu Script", "5 Devotees"]
    },
    {
        "filename": "sample_img7.jpeg",
        "receipt_no": "5813",
        "description": "Telugu handwriting, 3 family members",
        "features": ["Receipt #5813", "Telugu Script", "3 Devotees"]
    },
    {
        "filename": "sample_img8.jpeg",
        "receipt_no": "5814",
        "description": "Telugu handwriting, 6 family members, multiple phones",
        "features": ["Receipt #5814", "Telugu Script", "6 Devotees"]
    },
    {
        "filename": "sample_img2.jpeg",
        "receipt_no": "5815",
        "description": "Telugu handwriting, 5 devotees, country code prefix",
        "features": ["Receipt #5815", "Telugu Script", "Multiple Phones"]
    },
    {
        "filename": "sample_img3.jpeg",
        "receipt_no": "5815",
        "description": "Telugu handwriting, clear address and gothram",
        "features": ["Receipt #5815", "Telugu Script", "High Contrast"]
    },
    {
        "filename": "sample_img6.jpeg",
        "receipt_no": "5815",
        "description": "Telugu handwriting, multiple phone numbers written side-by-side",
        "features": ["Receipt #5815", "Telugu Script", "Complex Layout"]
    },
    {
        "filename": "sample_img9.jpeg",
        "receipt_no": "5815",
        "description": "Telugu handwriting, standard receipt",
        "features": ["Receipt #5815", "Telugu Script"]
    },
    {
        "filename": "sample_img4.jpeg",
        "receipt_no": "5817",
        "description": "Telugu handwriting, 4 family members",
        "features": ["Receipt #5817", "Telugu Script", "4 Devotees"]
    },
    {
        "filename": "sample_img.jpeg",
        "receipt_no": "9745",
        "description": "English handwriting, 7 family members, Hyderguda address",
        "features": ["Receipt #9745", "English Script", "7 Devotees"]
    },
]


@router.get("/samples")
def list_sample_receipts():
    """List pre-loaded reference sample receipts for rapid UI testing."""
    samples = []
    for meta in SAMPLE_METADATA:
        path = SAMPLES_DIR / meta["filename"]
        exists = path.exists()
        file_size = path.stat().st_size if exists else 0
        proc_path = SAMPLES_DIR / "processed" / meta["filename"]
        preview_url = f"/static/samples/processed/{meta['filename']}" if proc_path.exists() else f"/static/samples/{meta['filename']}"
        samples.append({
            "id": meta["filename"],
            "filename": meta["filename"],
            "receipt_no": meta["receipt_no"],
            "description": meta["description"],
            "features": meta["features"],
            "file_size": file_size,
            "url": preview_url,
            "raw_url": f"/static/samples/{meta['filename']}",
            "available": exists,
        })
    return samples


class ProcessSampleRequest(BaseModel):
    sample_filename: str
    model_name: Optional[str] = None
    skip_transcription: bool = False


@router.post("/process-sample", response_model=PipelineResult)
def process_sample_receipt(req: ProcessSampleRequest):
    """Run full OCR pipeline on one of the pre-loaded sample receipts."""
    proc_sample_path = SAMPLES_DIR / "processed" / req.sample_filename
    sample_path = proc_sample_path if proc_sample_path.exists() else (SAMPLES_DIR / req.sample_filename)
    if not sample_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sample file '{req.sample_filename}' not found."
        )

    model_to_use = req.model_name or settings.GEMINI_PRIMARY_MODEL
    try:
        result = process_receipt(
            image_input=sample_path,
            model_name=model_to_use,
            skip_transcription=req.skip_transcription
        )
        return check_and_annotate_duplicate(result)
    except Exception as e:
        # Fallback to secondary model if primary fails
        if settings.GEMINI_FALLBACK_MODEL and model_to_use != settings.GEMINI_FALLBACK_MODEL:
            try:
                result = process_receipt(
                    image_input=sample_path,
                    model_name=settings.GEMINI_FALLBACK_MODEL,
                    skip_transcription=req.skip_transcription
                )
                return check_and_annotate_duplicate(result)
            except Exception as fb_err:
                raise HTTPException(status_code=500, detail=f"OCR failed on fallback: {str(fb_err)}")
        raise HTTPException(status_code=500, detail=f"OCR execution failed: {str(e)}")


@router.post("/process-upload", response_model=PipelineResult)
async def process_uploaded_receipt(
    file: UploadFile = File(...),
    model_name: Optional[str] = Form(None),
    skip_transcription: bool = Form(False)
):
    """Run full OCR pipeline on an uploaded receipt image with auto-orientation & cropping."""
    import io
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Compute SHA-256 hash for duplicate detection
    img_hash = hashlib.sha256(contents).hexdigest()
    # Check if an identical image already exists
    db = SessionLocal()
    existing = db.query(Receipt).filter(Receipt.image_hash == img_hash).first()
    db.close()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Duplicate image detected.",
                "existing_receipt_id": existing.id,
                "receipt_no": existing.receipt_no,
                "status": existing.status,
                "created_at": existing.created_at,
            },
        )

    from backend.app.pipeline.translation import apply_translation

    from backend.pipeline.image_loader import prepare_image


    pil_img = prepare_image(contents)
    cropped_pil, rot, box = auto_orient_and_crop(pil_img)

    # Save cropped slip to storage
    buf = io.BytesIO()
    cropped_pil.save(buf, format="JPEG", quality=95)
    storage = LocalStorageBackend(base_dir=settings.STORAGE_DIR)
    storage_path = storage.save_file(buf.getvalue(), prefix="uploads", extension=".jpg")

    model_to_use = model_name or settings.GEMINI_PRIMARY_MODEL
    try:
        result = process_receipt(
            image_input=cropped_pil,
            model_name=model_to_use,
            skip_transcription=skip_transcription
        )
        # Apply translation / language detection
        result = apply_translation(result)
        # Attach hash and optional book number for later DB insertion
        result.intermediate_passes["image_hash"] = img_hash
        if book_number:
            result.intermediate_passes["book_number"] = book_number
        result.intermediate_passes["stored_original_path"] = storage_path
        return check_and_annotate_duplicate(result)
    except Exception as e:
        if settings.GEMINI_FALLBACK_MODEL and model_to_use != settings.GEMINI_FALLBACK_MODEL:
            try:
                result = process_receipt(
                    image_input=cropped_pil,
                    model_name=settings.GEMINI_FALLBACK_MODEL,
                    skip_transcription=skip_transcription
                )
                result.intermediate_passes["stored_original_path"] = storage_path
                return check_and_annotate_duplicate(result)
            except Exception as fb_err:
                raise HTTPException(status_code=500, detail=f"OCR failed on fallback: {str(fb_err)}")
        raise HTTPException(status_code=500, detail=f"OCR execution failed: {str(e)}")


class BatchItemResult(BaseModel):
    filename: str
    status: str  # "SUCCESS", "ERROR"
    result: Optional[PipelineResult] = None
    error: Optional[str] = None
    stored_path: Optional[str] = None
    preview_url: Optional[str] = None


@router.post("/process-batch", response_model=List[BatchItemResult])
async def process_batch_receipts(
    files: List[UploadFile] = File(...),
    model_name: Optional[str] = Form(None),
    skip_transcription: bool = Form(True),
    book_number: Optional[str] = Form(None)
):
    """Run OCR extraction in batch for multiple uploaded receipt images."""
    import io
    from backend.app.pipeline.translation import apply_translation

    from backend.pipeline.image_loader import prepare_image


    batch_results = []
    storage = LocalStorageBackend(base_dir=settings.STORAGE_DIR)
    model_to_use = model_name or settings.GEMINI_PRIMARY_MODEL

    for upload in files:
        fname = upload.filename or "receipt.jpg"
        contents = await upload.read()
        if not contents:
            batch_results.append(BatchItemResult(filename=fname, status="ERROR", error="Empty file."))
            continue

        try:
            pil_img = prepare_image(contents)
            cropped_pil, rot, box = auto_orient_and_crop(pil_img)

            buf = io.BytesIO()
            cropped_pil.save(buf, format="JPEG", quality=95)
            c_bytes = buf.getvalue()
            storage_path = storage.save_file(c_bytes, prefix="batch", extension=".jpg")

            res = process_receipt(
                image_input=cropped_pil,
                model_name=model_to_use,
                skip_transcription=skip_transcription
            )
            res.intermediate_passes["stored_original_path"] = storage_path
            batch_results.append(BatchItemResult(
                filename=fname,
                status="SUCCESS",
                result=res,
                stored_path=storage_path,
                preview_url=f"/static/storage/{Path(storage_path).name}"
            ))
        except Exception as e:
            batch_results.append(BatchItemResult(
                filename=fname,
                status="ERROR",
                error=str(e)
            ))

    return batch_results


@router.post("/quality-check")
async def check_image_quality(file: UploadFile = File(...)):
    """Evaluate image quality gate without invoking LLM."""
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file.")

    pil_img = prepare_image(contents)
    quality = evaluate_image_quality(pil_img)
    rot_heuristic = detect_orientation_heuristic(pil_img)
    return {
        "quality": quality.model_dump(),
        "heuristic_rotation": rot_heuristic,
    }


@router.get("/resolve-pincode")
def resolve_pincode(pincode: str):
    """
    Look up postal details (Post Office, Taluk/Mandal, District, State) for Indian PIN code.
    Specialized for Andhra Pradesh and Telangana regions.
    """
    from backend.pipeline.address_resolver import resolve_pincode_online_or_offline
    data = resolve_pincode_online_or_offline(pincode)
    if not data:
        raise HTTPException(status_code=404, detail=f"PIN code '{pincode}' not found or invalid.")
    return data


@router.post("/auto-crop")
async def auto_crop_image(file: UploadFile = File(...)):
    """
    Auto-orient image right-side up and tightly crop receipt slip,
    removing desk, fingers, and background clutter.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file.")

    from backend.app.pipeline.translation import apply_translation

    from backend.pipeline.image_loader import prepare_image


    pil_img = prepare_image(contents)
    cropped, rot, box = auto_orient_and_crop(pil_img)

    storage_dir = Path(settings.STORAGE_DIR)
    storage_dir.mkdir(parents=True, exist_ok=True)
    out_filename = f"crop_{int(time.time() * 1000)}.jpg"
    out_path = storage_dir / out_filename
    cropped.save(out_path, format="JPEG", quality=95)

    return {
        "url": f"/static/storage/{out_filename}",
        "rotation_applied": rot,
        "crop_box": box,
        "width": cropped.width,
        "height": cropped.height,
    }
