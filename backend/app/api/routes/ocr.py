import hashlib
import logging
import shutil
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status

logger = logging.getLogger(__name__)


from pydantic import BaseModel
from PIL import Image

from backend.app.core.config import settings
from backend.app.core.database import SessionLocal

from backend.app.models.receipt import Receipt
from backend.app.models.staged_image import StagedImage
from backend.app.api.routes.receipts import normalize_book_num
from backend.app.storage import get_storage
from backend.pipeline.auto_crop import auto_orient_and_crop
from backend.pipeline.image_loader import prepare_image, to_b64
from backend.pipeline.image_quality import evaluate_image_quality
from backend.pipeline.orientation import detect_orientation_heuristic, detect_orientation_with_gemini, apply_rotation
from backend.pipeline.run import get_gemini_client, process_receipt
from backend.pipeline.schemas import PipelineResult, QualityAssessment
from sqlalchemy import or_
from sqlalchemy.orm import Session

router = APIRouter(prefix="/ocr", tags=["OCR Pipeline"])

# Reference samples directory
SAMPLES_DIR = Path("Reference Images")


def check_and_annotate_duplicate(result: PipelineResult, db: Optional[Session] = None) -> PipelineResult:
    """Check if the extracted receipt number already exists in the database and annotate result."""
    clean_no = str(result.receipt_no).strip() if result.receipt_no else ""
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        existing = None

        if clean_no:
            clean_numeric = clean_no.lstrip("0") or "0" if clean_no.isdigit() else clean_no
            q = db.query(Receipt).filter(
                or_(Receipt.is_archived == False, Receipt.is_archived == None),
                or_(
                    Receipt.receipt_no == clean_no,
                    Receipt.receipt_no == clean_numeric,
                )
            )
            # First check with specific receipt year if present
            if settings.RECEIPT_UNIQUENESS_POLICY == "yearly" and result.receipt_year:
                existing = q.filter(Receipt.receipt_year == result.receipt_year).first()

            # If not found for that year, check globally across all years
            if not existing:
                existing = q.first()

        # Also check by image_hash if available
        img_hash = getattr(result, "image_hash", None)
        if not img_hash and isinstance(result.intermediate_passes, dict):
            img_hash = result.intermediate_passes.get("image_hash")
        if not existing and img_hash:
            existing = db.query(Receipt).filter(
                Receipt.image_hash == img_hash,
                or_(Receipt.is_archived == False, Receipt.is_archived == None)
            ).first()

        if existing:
            result.is_duplicate = True
            result.duplicate_receipt_id = existing.id
            result.duplicate_status = existing.status
            display_no = clean_no or existing.receipt_no or str(existing.id)
            result.duplicate_warning = (
                f"Receipt #{display_no} already exists in the temple database "
                f"(Status: {existing.status}, Record ID: #{existing.id})."
            )
            alert_msg = f"DUPLICATE DETECTED: Receipt #{display_no} is already stored in database (Status: {existing.status}, ID: #{existing.id})"
            if alert_msg not in result.needs_human_check:
                result.needs_human_check.insert(0, alert_msg)
    except Exception as e:
        logger.warning(f"Error checking duplicate receipt in DB: {e}")
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
        return PipelineResult(
            receipt_no=None,
            is_model_failure=True,
            extraction_error=f"Sample file '{req.sample_filename}' not found.",
            needs_human_check=[f"Sample file '{req.sample_filename}' not found on server."],
            overall_confidence="RED",
            intermediate_passes={"error": "sample_not_found"},
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
        logger.error(f"Sample OCR extraction error: {e}", exc_info=True)
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
                logger.error(f"Sample OCR fallback failed: {fb_err}", exc_info=True)
        return PipelineResult(
            receipt_no=None,
            is_model_failure=True,
            extraction_error=str(e),
            needs_human_check=[f"AI model error: {str(e)}"],
            overall_confidence="RED",
            intermediate_passes={"error": str(e)},
        )


@router.post("/process-upload", response_model=PipelineResult)
async def process_uploaded_receipt(
    file: UploadFile = File(...),
    model_name: Optional[str] = Form(None),
    skip_transcription: bool = Form(True),
    book_number: Optional[str] = Form(None)
):
    """Run full OCR pipeline on an uploaded receipt image with auto-orientation & cropping."""
    import io
    contents = await file.read()
    if not contents:
        return PipelineResult(
            receipt_no=None,
            is_model_failure=True,
            extraction_error="Uploaded file is empty.",
            needs_human_check=["Uploaded file has 0 bytes."],
            overall_confidence="RED",
        )

    # Compute SHA-256 hash for duplicate detection
    img_hash = hashlib.sha256(contents).hexdigest()
    # Check if an identical active image already exists
    existing = None
    try:
        db = SessionLocal()
        try:
            existing = db.query(Receipt).filter(
                Receipt.image_hash == img_hash,
                or_(Receipt.is_archived == False, Receipt.is_archived == None)
            ).first()
        finally:
            db.close()
    except Exception as db_err:
        logger.warning(f"Duplicate check DB query skipped due to error: {db_err}")

    if existing:
        return PipelineResult(
            receipt_no=existing.receipt_no,
            is_duplicate=True,
            duplicate_receipt_id=existing.id,
            duplicate_status=existing.status,
            duplicate_warning=f"Receipt #{existing.receipt_no or existing.id} already exists in the temple database (Status: {existing.status}, Record ID: #{existing.id}).",
            needs_human_check=[f"DUPLICATE DETECTED: Receipt #{existing.receipt_no or existing.id} is already stored in database (Status: {existing.status}, ID: #{existing.id})"],
            overall_confidence="RED",
            intermediate_passes={"image_hash": img_hash, "stored_original_path": existing.original_image_path or ""},
        )

    from backend.app.pipeline.translation import apply_translation
    from backend.pipeline.image_loader import prepare_image

    try:
        pil_img = prepare_image(contents)
        cropped_pil, rot, box = auto_orient_and_crop(pil_img)

        # Save cropped slip to storage
        buf = io.BytesIO()
        cropped_pil.save(buf, format="JPEG", quality=95)
        storage = get_storage()
        storage_path = storage.save_file(buf.getvalue(), prefix="uploads", extension=".jpg")

        model_to_use = model_name or settings.GEMINI_PRIMARY_MODEL
        try:
            result = process_receipt(
                image_input=cropped_pil,
                model_name=model_to_use,
                skip_transcription=skip_transcription
            )
        except Exception as proc_err:
            logger.error(f"Primary model OCR failed: {proc_err}", exc_info=True)
            if settings.GEMINI_FALLBACK_MODEL and model_to_use != settings.GEMINI_FALLBACK_MODEL:
                result = process_receipt(
                    image_input=cropped_pil,
                    model_name=settings.GEMINI_FALLBACK_MODEL,
                    skip_transcription=skip_transcription
                )
            else:
                raise proc_err

        # Apply translation / language detection safely
        try:
            result = apply_translation(result)
        except Exception as t_err:
            logger.warning(f"apply_translation error: {t_err}")

        # Attach hash and optional book number for later DB insertion
        result.intermediate_passes["image_hash"] = img_hash
        if book_number:
            result.intermediate_passes["book_number"] = normalize_book_num(book_number)
        result.intermediate_passes["stored_original_path"] = storage_path
        return check_and_annotate_duplicate(result)
    except Exception as e:
        logger.error(f"OCR execution failed for uploaded receipt: {e}", exc_info=True)
        return PipelineResult(
            receipt_no=None,
            is_model_failure=True,
            extraction_error=str(e),
            needs_human_check=[f"AI model error: {str(e)}"],
            overall_confidence="RED",
            intermediate_passes={"error": str(e), "image_hash": img_hash},
        )


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
    storage = get_storage()
    model_to_use = model_name or settings.GEMINI_PRIMARY_MODEL

    for upload in files:
        fname = upload.filename or "receipt.jpg"
        contents = await upload.read()
        if not contents:
            batch_results.append(BatchItemResult(filename=fname, status="ERROR", error="Empty file."))
            continue

        try:
            # Duplicate image detection per file
            img_hash = hashlib.sha256(contents).hexdigest()
            db = SessionLocal()
            existing = db.query(Receipt).filter(Receipt.image_hash == img_hash).first()
            db.close()
            if existing:
                batch_results.append(BatchItemResult(
                    filename=fname,
                    status="ERROR",
                    error=f"Duplicate: This image was already uploaded as Receipt #{existing.receipt_no or existing.id} (Status: {existing.status})."
                ))
                continue

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
            res = apply_translation(res)
            res.intermediate_passes["stored_original_path"] = storage_path
            res.intermediate_passes["image_hash"] = img_hash
            if book_number:
                res.intermediate_passes["book_number"] = normalize_book_num(book_number)
            res = check_and_annotate_duplicate(res)
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


@router.post("/staging")
async def stage_upload_receipts(
    files: List[UploadFile] = File(...),
    book_number: Optional[str] = Form(None),
    device_label: Optional[str] = Form("Mobile Device"),
):
    """
    Stage raw uploaded receipt images into persistent queue before processing.
    Allows mobile users to capture/upload receipts that immediately become
    available for processing on a desktop or laptop.
    """
    staged_items = []
    storage = get_storage()
    db = SessionLocal()

    try:
        for upload in files:
            fname = upload.filename or "receipt.jpg"
            contents = await upload.read()
            if not contents:
                continue

            img_hash = hashlib.sha256(contents).hexdigest()
            ext = Path(fname).suffix or ".jpg"
            storage_path = storage.save_file(contents, prefix="staging", extension=ext)
            file_name_only = Path(storage_path).name

            staged = StagedImage(
                filename=fname,
                file_path=storage_path,
                preview_url=storage.get_url(storage_path),
                file_size=len(contents),
                image_hash=img_hash,
                book_number=normalize_book_num(book_number) if book_number else None,
                device_label=device_label or "Mobile Device",
                status="PENDING",
            )
            db.add(staged)
            staged_items.append(staged)

        db.commit()
        for item in staged_items:
            db.refresh(item)
    finally:
        db.close()

    return [
        {
            "id": item.id,
            "filename": item.filename,
            "file_size": item.file_size,
            "preview_url": item.preview_url,
            "book_number": item.book_number,
            "device_label": item.device_label,
            "status": item.status,
            "created_at": item.created_at.isoformat(),
        }
        for item in staged_items
    ]


@router.get("/staging")
def list_staged_receipts():
    """List all pending / extracted staged images waiting to be reviewed and saved."""
    db = SessionLocal()
    try:
        items = (
            db.query(StagedImage)
            .filter(StagedImage.status.in_(["PENDING", "EXTRACTED"]))
            .order_by(StagedImage.id.asc())
            .all()
        )
        return [
            {
                "id": item.id,
                "filename": item.filename,
                "file_size": item.file_size,
                "preview_url": item.preview_url,
                "image_url": f"/api/v1/ocr/staging/{item.id}/image",
                "book_number": item.book_number,
                "device_label": item.device_label,
                "status": item.status,
                "created_at": item.created_at.isoformat(),
            }
            for item in items
        ]
    finally:
        db.close()


@router.get("/staging/{staged_id}/image")
def get_staged_receipt_image(staged_id: int):
    """Serve staged image bytes from same origin (prevents canvas CORS tainting during manual crop)."""
    db = SessionLocal()
    try:
        item = db.query(StagedImage).filter(StagedImage.id == staged_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Staged item not found")

        storage = get_storage()
        contents = storage.get(item.file_path)
        if contents is None:
            file_full_path = Path(item.file_path)
            if not file_full_path.exists():
                file_full_path = Path(settings.STORAGE_DIR) / Path(item.file_path).name
            if file_full_path.exists():
                with open(file_full_path, "rb") as f:
                    contents = f.read()

        if not contents:
            raise HTTPException(status_code=404, detail="Staged image file not found")

        return Response(
            content=contents,
            media_type="image/jpeg",
            headers={"Cache-Control": "no-store"},
        )
    finally:
        db.close()


@router.put("/staging/{staged_id}/image")
async def update_staged_receipt_image(staged_id: int, file: UploadFile = File(...)):
    """Replace a staged receipt image after manual crop, auto-crop, or rotation."""
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded cropped image is empty.")

    db = SessionLocal()
    try:
        item = db.query(StagedImage).filter(StagedImage.id == staged_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Staged item not found")

        storage = get_storage()
        old_path = item.file_path
        ext = Path(item.filename).suffix or ".jpg"
        new_path = storage.save_file(contents, prefix="staging", extension=ext)

        item.file_path = new_path
        item.preview_url = storage.get_url(new_path)
        item.file_size = len(contents)
        item.image_hash = hashlib.sha256(contents).hexdigest()
        item.status = "PENDING"
        db.commit()
        db.refresh(item)

        if old_path and old_path != new_path:
            try:
                storage.delete(old_path)
            except Exception:
                pass

        return {
            "id": item.id,
            "filename": item.filename,
            "file_size": item.file_size,
            "preview_url": item.preview_url,
            "image_url": f"/api/v1/ocr/staging/{item.id}/image",
            "book_number": item.book_number,
            "device_label": item.device_label,
            "status": item.status,
            "created_at": item.created_at.isoformat(),
        }
    finally:
        db.close()


@router.delete("/staging/{staged_id}")
def delete_staged_receipt(staged_id: int, delete_file: bool = False):
    """Remove a staged image from the queue (only deletes underlying storage file if delete_file is True)."""
    db = SessionLocal()
    try:
        item = db.query(StagedImage).filter(StagedImage.id == staged_id).first()
        if not item:
            return {"status": "deleted", "id": staged_id, "already_deleted": True}
        file_path = item.file_path
        db.delete(item)
        db.commit()
        if delete_file and file_path:
            try:
                get_storage().delete(file_path)
            except Exception:
                pass
        return {"status": "deleted", "id": staged_id}
    finally:
        db.close()


@router.post("/staging/{staged_id}/process", response_model=PipelineResult)
def process_staged_receipt(
    staged_id: int,
    model_name: Optional[str] = None,
    skip_transcription: bool = True,
):
    """Run full OCR pipeline on an already staged image."""
    db = SessionLocal()
    try:
        item = db.query(StagedImage).filter(StagedImage.id == staged_id).first()
        if not item:
            return PipelineResult(
                receipt_no=None,
                is_model_failure=True,
                extraction_error="Staged receipt item not found or already processed.",
                needs_human_check=["Staged receipt was not found in queue."],
                overall_confidence="RED",
                intermediate_passes={"staged_id": staged_id},
            )

        storage = get_storage()
        contents = storage.get(item.file_path)
        if contents is None:
            file_full_path = Path(item.file_path)
            if not file_full_path.exists():
                file_full_path = Path(settings.STORAGE_DIR) / Path(item.file_path).name
            if file_full_path.exists():
                with open(file_full_path, "rb") as f:
                    contents = f.read()

        if not contents:
            return PipelineResult(
                receipt_no=None,
                is_model_failure=True,
                extraction_error="Staged image file could not be retrieved from storage. Please re-upload.",
                needs_human_check=["Image file missing from storage."],
                overall_confidence="RED",
                intermediate_passes={"staged_id": staged_id},
            )

        # Fast duplicate check by image_hash before running expensive LLM call (ignore archived)
        if item.image_hash:
            existing = db.query(Receipt).filter(
                Receipt.image_hash == item.image_hash,
                or_(Receipt.is_archived == False, Receipt.is_archived == None)
            ).first()
            if existing:
                return PipelineResult(
                    receipt_no=existing.receipt_no,
                    is_duplicate=True,
                    duplicate_receipt_id=existing.id,
                    duplicate_status=existing.status,
                    duplicate_warning=f"Receipt #{existing.receipt_no or existing.id} already exists in the temple database (Status: {existing.status}, Record ID: #{existing.id}).",
                    needs_human_check=[f"DUPLICATE DETECTED: Receipt #{existing.receipt_no or existing.id} is already stored in database (Status: {existing.status}, ID: #{existing.id})"],
                    overall_confidence="RED",
                    intermediate_passes={"image_hash": item.image_hash, "stored_original_path": item.file_path, "staged_id": staged_id},
                )

        from backend.app.pipeline.translation import apply_translation
        from backend.pipeline.image_loader import prepare_image

        try:
            pil_img = prepare_image(contents)
        except Exception as img_err:
            logger.error(f"Image preparation failed for staged {staged_id}: {img_err}", exc_info=True)
            return PipelineResult(
                receipt_no=None,
                is_model_failure=True,
                extraction_error=f"Image decoding failed: {str(img_err)}",
                needs_human_check=[f"Image decode error: {str(img_err)}"],
                overall_confidence="RED",
                intermediate_passes={"staged_id": staged_id},
            )

        model_to_use = model_name or settings.GEMINI_PRIMARY_MODEL
        try:
            result = process_receipt(
                image_input=pil_img,
                model_name=model_to_use,
                skip_transcription=skip_transcription,
            )
        except Exception as proc_err:
            logger.error(f"process_receipt failed for staged {staged_id}: {proc_err}", exc_info=True)
            result = PipelineResult(
                receipt_no=None,
                is_model_failure=True,
                extraction_error=str(proc_err),
                needs_human_check=[f"AI extraction error: {str(proc_err)}"],
                overall_confidence="RED",
            )

        if not result.is_model_failure:
            try:
                result = apply_translation(result)
            except Exception as t_err:
                logger.warning(f"apply_translation failed for staged {staged_id}: {t_err}")

        result.intermediate_passes["stored_original_path"] = item.file_path
        result.intermediate_passes["image_hash"] = item.image_hash
        result.intermediate_passes["staged_id"] = staged_id
        if item.book_number:
            result.intermediate_passes["book_number"] = item.book_number

        result = check_and_annotate_duplicate(result, db=db)

        # Mark as EXTRACTED (stays visible in queue until operator reviews & saves to DB)
        try:
            item.status = "EXTRACTED"
            db.commit()
        except Exception as c_err:
            logger.warning(f"Failed to update staged item status: {c_err}")
            db.rollback()

        return result
    except Exception as unhandled:
        logger.error(f"Unhandled error in process_staged_receipt {staged_id}: {unhandled}", exc_info=True)
        return PipelineResult(
            receipt_no=None,
            is_model_failure=True,
            extraction_error=f"Processing error: {str(unhandled)}",
            needs_human_check=[f"Processing error: {str(unhandled)}"],
            overall_confidence="RED",
            intermediate_passes={"staged_id": staged_id, "error": str(unhandled)},
        )
    finally:
        db.close()


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

    buf = io.BytesIO()
    cropped.save(buf, format="JPEG", quality=95)
    storage = get_storage()
    out_path = storage.save_file(buf.getvalue(), prefix="crop", extension=".jpg")

    return {
        "url": storage.get_url(out_path),
        "rotation_applied": rot,
        "crop_box": box,
        "width": cropped.width,
        "height": cropped.height,
    }
