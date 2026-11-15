import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload
from backend.app.auth.deps import get_current_user, get_optional_current_user
from backend.app.core.config import settings
from backend.app.core.database import Base, engine, get_db
from backend.app.models.audit import AuditLog
from backend.app.models.correction import Correction
from backend.app.models.dispatch import PrasadamDispatch
from backend.app.models.person import ReceiptPerson
from backend.app.models.phone import ReceiptPhone
from backend.app.models.receipt import Receipt
from backend.app.models.user import User
from backend.app.schemas.receipt import ReceiptCreate, ReceiptListItem, ReceiptOut, ReceiptUpdate
from backend.app.storage import get_storage

from pydantic import BaseModel

router = APIRouter(prefix="/receipts", tags=["Receipts"])


class RenameBookIn(BaseModel):
    new_book_number: str
    receipt_year: Optional[int] = None


def _get_receipt_image_url(r, storage) -> Optional[str]:
    path = r.original_image_path
    if r.ocr_raw and isinstance(r.ocr_raw, dict):
        stored = r.ocr_raw.get("stored_original_path")
        if stored:
            path = stored
    if not path:
        return None
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return storage.get_url(path)


@router.get("/books/summary")
def get_books_summary(
    receipt_year: Optional[int] = Query(None, description="Optional filter by receipt year"),
    db: Session = Depends(get_db)
):
    """Return categorized folder stats grouped by book number."""
    from typing import Dict, Any
    from sqlalchemy import func

    # Ultra-fast aggregate query directly in SQL engine
    q = db.query(
        Receipt.book_number,
        Receipt.status,
        Receipt.is_archived,
        func.count(Receipt.id)
    )
    if receipt_year is not None:
        q = q.filter(Receipt.receipt_year == receipt_year)
    rows = q.group_by(Receipt.book_number, Receipt.status, Receipt.is_archived).all()

    archived_count = 0
    total_all = 0
    processed_all = 0
    pending_all = 0
    book_stats: Dict[str, Dict[str, Any]] = {}

    for book_num, status, is_archived, count in rows:
        if is_archived:
            archived_count += count
            continue

        total_all += count
        if status == "CONFIRMED":
            processed_all += count
        else:
            pending_all += count

        bn = (book_num or "").strip()
        key = bn if bn else "__UNASSIGNED__"
        if key not in book_stats:
            book_stats[key] = {
                "book_number": key,
                "display_name": f"Book #{key}" if key != "__UNASSIGNED__" else "Unassigned (పుస్తకం లేనివి)",
                "total": 0,
                "processed": 0,
                "pending": 0,
            }
        book_stats[key]["total"] += count
        if status == "CONFIRMED":
            book_stats[key]["processed"] += count
        else:
            book_stats[key]["pending"] += count

    def sort_key(item):
        k = item["book_number"]
        if k == "__UNASSIGNED__":
            return (1, "")
        return (0, k)

    folders = sorted(book_stats.values(), key=sort_key)

    return {
        "total_all": total_all,
        "processed_all": processed_all,
        "pending_all": pending_all,
        "archived_count": archived_count,
        "folders": folders,
    }


@router.get("", response_model=List[ReceiptListItem])
def list_receipts(
    q: Optional[str] = Query(None, description="Search query (receipt no, name, phone, gothram, book no)"),
    book_number: Optional[str] = Query(None, description="Filter by book number"),
    receipt_year: Optional[int] = Query(None, description="Filter by receipt year"),
    status_filter: Optional[str] = Query(None, description="PENDING_VERIFICATION, CONFIRMED, INCOMPLETE"),
    archived_only: bool = Query(False, description="Filter for archived/deleted receipts only"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Receipt)

    if archived_only:
        query = query.filter(Receipt.is_archived == True)
    else:
        query = query.filter(or_(Receipt.is_archived == False, Receipt.is_archived == None))

    if receipt_year is not None:
        query = query.filter(Receipt.receipt_year == receipt_year)

    if isinstance(book_number, str) and book_number.strip():
        bn = book_number.strip()
        if bn in ("__UNASSIGNED__", "unassigned", "None", "-"):
            query = query.filter(or_(Receipt.book_number == None, Receipt.book_number == ""))
        else:
            query = query.filter(Receipt.book_number == bn)

    if isinstance(status_filter, str) and status_filter.strip():
        query = query.filter(Receipt.status == status_filter.strip())

    if isinstance(q, str) and q.strip():
        q_term = f"%{q.strip()}%"
        # Search receipt_no, gothram_en, gothram_te, address, or join with phones / persons
        matching_person_receipt_ids = (
            select(ReceiptPerson.receipt_id)
            .filter(
                or_(
                    ReceiptPerson.given_name_en.ilike(q_term),
                    ReceiptPerson.given_name_te.ilike(q_term),
                    ReceiptPerson.surname_en.ilike(q_term),
                    ReceiptPerson.surname_te.ilike(q_term),
                )
            )
        )

        matching_phone_receipt_ids = (
            select(ReceiptPhone.receipt_id)
            .filter(ReceiptPhone.number.ilike(q_term))
        )

        query = query.filter(
            or_(
                Receipt.receipt_no.ilike(q_term),
                Receipt.book_number.ilike(q_term),
                Receipt.gothram_en.ilike(q_term),
                Receipt.gothram_te.ilike(q_term),
                Receipt.address_en.ilike(q_term),
                Receipt.address_te.ilike(q_term),
                Receipt.pincode.ilike(q_term),
                Receipt.id.in_(matching_person_receipt_ids),
                Receipt.id.in_(matching_phone_receipt_ids),
            )
        )

    actual_skip = skip if isinstance(skip, int) else 0
    actual_limit = limit if isinstance(limit, int) else 25
    receipts = (
        query.options(selectinload(Receipt.persons))
        .order_by(Receipt.id.desc())
        .offset(actual_skip)
        .limit(actual_limit)
        .all()
    )

    storage = get_storage()
    items = []
    for r in receipts:
        first_person = r.persons[0] if r.persons else None
        p_name = ""
        if first_person:
            p_name = f"{first_person.given_name_en or first_person.given_name_te or ''} {first_person.surname_en or first_person.surname_te or ''}".strip()

        img_url = _get_receipt_image_url(r, storage)

        items.append(
            ReceiptListItem(
                id=r.id,
                receipt_no=r.receipt_no,
                receipt_year=r.receipt_year,
                receipt_date=r.receipt_date,
                gothram_en=r.gothram_en,
                gothram_te=r.gothram_te,
                primary_devotee=p_name or None,
                abhishekam_from=r.abhishekam_from,
                abhishekam_to=r.abhishekam_to,
                status=r.status,
                book_number=r.book_number,
                is_archived=bool(r.is_archived),
                archived_at=r.archived_at,
                original_image_url=img_url,
                created_at=r.created_at,
            )
        )
    return items


@router.get("/detailed", response_model=List[ReceiptOut])
def list_detailed_receipts(
    status_filter: Optional[str] = Query(None, description="PENDING_VERIFICATION, CONFIRMED, INCOMPLETE"),
    book_number: Optional[str] = Query(None, description="Filter by book number"),
    receipt_year: Optional[int] = Query(None, description="Filter by receipt year"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Fetch full receipt details (persons, phones, dispatch) in one batched query for Sankalpam & Dispatch views."""
    query = db.query(Receipt).filter(or_(Receipt.is_archived == False, Receipt.is_archived == None))
    if receipt_year is not None:
        query = query.filter(Receipt.receipt_year == receipt_year)
    if isinstance(status_filter, str) and status_filter.strip():
        query = query.filter(Receipt.status == status_filter.strip())
    if isinstance(book_number, str) and book_number.strip():
        query = query.filter(Receipt.book_number == book_number.strip())

    actual_skip = skip if isinstance(skip, int) else 0
    actual_limit = limit if isinstance(limit, int) else 100
    receipts = (
        query.options(
            selectinload(Receipt.persons),
            selectinload(Receipt.phones),
            selectinload(Receipt.dispatch),
        )
        .order_by(Receipt.id.desc())
        .offset(actual_skip)
        .limit(actual_limit)
        .all()
    )

    storage = get_storage()
    results = []
    for r in receipts:
        item = ReceiptOut.model_validate(r)
        item.original_image_url = _get_receipt_image_url(r, storage)
        results.append(item)
    return results


@router.get("/{receipt_id}", response_model=ReceiptOut)
def get_receipt(receipt_id: int, db: Session = Depends(get_db)):
    receipt = (
        db.query(Receipt)
        .options(
            selectinload(Receipt.persons),
            selectinload(Receipt.phones),
            selectinload(Receipt.dispatch),
        )
        .filter(Receipt.id == receipt_id)
        .first()
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    storage = get_storage()
    out = ReceiptOut.model_validate(receipt)
    out.original_image_url = _get_receipt_image_url(receipt, storage)
    return out


@router.post("/check-duplicate")
def check_duplicate_receipt(
    receipt_no: str,
    year: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Check if receipt_no already exists based on uniqueness policy."""
    query = db.query(Receipt).filter(Receipt.receipt_no == receipt_no.strip())
    if settings.RECEIPT_UNIQUENESS_POLICY == "yearly" and year:
        query = query.filter(Receipt.receipt_year == year)

    existing = query.first()
    if existing:
        return {
            "is_duplicate": True,
            "existing_id": existing.id,
            "receipt_no": existing.receipt_no,
            "status": existing.status,
            "created_at": existing.created_at,
        }
    return {"is_duplicate": False}


@router.post("", response_model=ReceiptOut)
def create_receipt(
    receipt_in: ReceiptCreate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Ensure tables exist (critical on serverless cold starts / ephemeral /tmp SQLite)
        try:
            Base.metadata.create_all(bind=engine)
        except Exception:
            pass

        # Check duplicate detection
        clean_receipt_no = receipt_in.receipt_no.strip()
        dup_query = db.query(Receipt).filter(Receipt.receipt_no == clean_receipt_no)
        if settings.RECEIPT_UNIQUENESS_POLICY == "yearly" and receipt_in.receipt_year:
            dup_query = dup_query.filter(Receipt.receipt_year == receipt_in.receipt_year)
        
        existing = dup_query.first()
        if existing:
            # Update existing receipt record with confirmed/verified fields
            existing.receipt_no = clean_receipt_no
            existing.receipt_year = receipt_in.receipt_year
            existing.receipt_date = receipt_in.receipt_date
            existing.abhishekam_from = receipt_in.abhishekam_from
            existing.abhishekam_to = receipt_in.abhishekam_to
            existing.amount = receipt_in.amount
            existing.gothram_en = receipt_in.gothram_en
            existing.gothram_te = receipt_in.gothram_te
            existing.gothram_master_id = receipt_in.gothram_master_id
            existing.gothram_as_written = receipt_in.gothram_as_written
            existing.address_en = receipt_in.address_en
            existing.address_te = receipt_in.address_te
            existing.pincode = receipt_in.pincode
            existing.status = receipt_in.status
            if receipt_in.book_number:
                existing.book_number = receipt_in.book_number
            if receipt_in.image_hash:
                existing.image_hash = receipt_in.image_hash
            if receipt_in.original_image_path:
                existing.original_image_path = receipt_in.original_image_path
            existing.model_name = receipt_in.model_name
            existing.processing_cost = receipt_in.processing_cost or 0.0
            existing.processing_duration = receipt_in.processing_duration or 0.0
            existing.confidence_data = receipt_in.confidence_data
            existing.ocr_raw = receipt_in.ocr_raw

            # Replace persons
            db.query(ReceiptPerson).filter(ReceiptPerson.receipt_id == existing.id).delete()
            for p in receipt_in.persons:
                person = ReceiptPerson(
                    receipt_id=existing.id,
                    position=p.position,
                    given_name_en=p.given_name_en,
                    given_name_te=p.given_name_te,
                    surname_en=p.surname_en,
                    surname_te=p.surname_te,
                    original_ocr=p.original_ocr,
                    verification_status=p.verification_status,
                )
                db.add(person)

            # Replace phones
            db.query(ReceiptPhone).filter(ReceiptPhone.receipt_id == existing.id).delete()
            for ph in receipt_in.phones:
                phone = ReceiptPhone(
                    receipt_id=existing.id,
                    number=ph.number.strip(),
                    is_primary=ph.is_primary,
                    verification_status=ph.verification_status,
                )
                db.add(phone)

            # Ensure dispatch record exists
            if not existing.dispatch:
                dispatch = PrasadamDispatch(receipt_id=existing.id, status="PENDING")
                db.add(dispatch)

            db.commit()
            db.refresh(existing)
            # Load relationships before returning
            _ = list(existing.persons)
            _ = list(existing.phones)
            _ = existing.dispatch

            # Non-blocking audit log
            try:
                audit = AuditLog(
                    user_id=current_user.id if current_user else None,
                    action="UPDATE_RECEIPT",
                    entity="Receipt",
                    entity_id=existing.id,
                    new_value=json.dumps({"receipt_no": existing.receipt_no, "status": existing.status}),
                )
                db.add(audit)
                db.commit()
            except Exception:
                db.rollback()

            return existing

        # New receipt creation
        receipt = Receipt(
            receipt_no=clean_receipt_no,
            receipt_year=receipt_in.receipt_year,
            receipt_date=receipt_in.receipt_date,
            abhishekam_from=receipt_in.abhishekam_from,
            abhishekam_to=receipt_in.abhishekam_to,
            amount=receipt_in.amount,
            gothram_en=receipt_in.gothram_en,
            gothram_te=receipt_in.gothram_te,
            gothram_master_id=receipt_in.gothram_master_id,
            gothram_as_written=receipt_in.gothram_as_written,
            address_en=receipt_in.address_en,
            address_te=receipt_in.address_te,
            pincode=receipt_in.pincode,
            status=receipt_in.status,
            book_number=receipt_in.book_number,
            image_hash=receipt_in.image_hash,
            original_image_path=receipt_in.original_image_path or "uploaded_image.jpg",
            corrected_image_path=receipt_in.corrected_image_path,
            handwriting_crop_path=receipt_in.handwriting_crop_path,
            ocr_raw=receipt_in.ocr_raw,
            confidence_data=receipt_in.confidence_data,
            model_name=receipt_in.model_name,
            processing_cost=receipt_in.processing_cost or 0.0,
            processing_duration=receipt_in.processing_duration or 0.0,
            created_by=current_user.id if current_user else None,
        )
        db.add(receipt)
        db.flush()  # get receipt.id

        # Add persons
        for p in receipt_in.persons:
            person = ReceiptPerson(
                receipt_id=receipt.id,
                position=p.position,
                given_name_en=p.given_name_en,
                given_name_te=p.given_name_te,
                surname_en=p.surname_en,
                surname_te=p.surname_te,
                original_ocr=p.original_ocr,
                verification_status=p.verification_status,
            )
            db.add(person)

        # Add phones
        for ph in receipt_in.phones:
            phone = ReceiptPhone(
                receipt_id=receipt.id,
                number=ph.number.strip(),
                is_primary=ph.is_primary,
                verification_status=ph.verification_status,
            )
            db.add(phone)

        # Create empty dispatch record
        dispatch = PrasadamDispatch(receipt_id=receipt.id, status="PENDING")
        db.add(dispatch)

        db.commit()
        db.refresh(receipt)
        # Load relationships before returning
        _ = list(receipt.persons)
        _ = list(receipt.phones)
        _ = receipt.dispatch

        # Non-blocking audit log
        try:
            audit = AuditLog(
                user_id=current_user.id if current_user else None,
                action="CREATE_RECEIPT",
                entity="Receipt",
                entity_id=receipt.id,
                new_value=json.dumps({"receipt_no": receipt.receipt_no, "status": receipt.status}),
            )
            db.add(audit)
            db.commit()
        except Exception:
            db.rollback()

        return receipt
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database save error: {str(e)}"
        )


@router.patch("/{receipt_id}", response_model=ReceiptOut)
def update_receipt(
    receipt_id: int,
    update_data: ReceiptUpdate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    update_dict = update_data.model_dump(exclude_unset=True)

    # Track corrections and audit
    for field, new_val in update_dict.items():
        if field in ("persons", "phones"):
            continue
        old_val = getattr(receipt, field)
        if old_val != new_val:
            setattr(receipt, field, new_val)
            # Record correction
            corr = Correction(
                receipt_id=receipt.id,
                field_name=field,
                original_value=str(old_val) if old_val is not None else None,
                corrected_value=str(new_val) if new_val is not None else "",
                corrected_by=current_user.id if current_user else None,
            )
            db.add(corr)
            # Record audit
            audit = AuditLog(
                user_id=current_user.id if current_user else None,
                action="UPDATE_FIELD",
                entity="Receipt",
                entity_id=receipt.id,
                field_name=field,
                old_value=str(old_val),
                new_value=str(new_val),
            )
            db.add(audit)

    # Update persons if provided
    if update_data.persons is not None:
        db.query(ReceiptPerson).filter(ReceiptPerson.receipt_id == receipt.id).delete()
        for idx, p in enumerate(update_data.persons, start=1):
            db.add(ReceiptPerson(
                receipt_id=receipt.id,
                position=p.position or idx,
                given_name_en=p.given_name_en,
                given_name_te=p.given_name_te,
                surname_en=p.surname_en,
                surname_te=p.surname_te,
                original_ocr=p.original_ocr,
                verification_status="VERIFIED",
            ))

    # Update phones if provided
    if update_data.phones is not None:
        db.query(ReceiptPhone).filter(ReceiptPhone.receipt_id == receipt.id).delete()
        for ph in update_data.phones:
            db.add(ReceiptPhone(
                receipt_id=receipt.id,
                number=ph.number.strip(),
                is_primary=ph.is_primary,
                verification_status="VERIFIED",
            ))

    receipt.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(receipt)
    return receipt


@router.post("/{receipt_id}/confirm", response_model=ReceiptOut)
def confirm_receipt(
    receipt_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """Mark record CONFIRMED after strict validation of required fields."""
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    # Save validation rules (Rule from Section 13):
    # Required: receipt_no, gothram, at least one devotee name, at least one valid phone number, address
    errors = []
    if not receipt.receipt_no:
        errors.append("Receipt number is required.")
    if not (receipt.gothram_en or receipt.gothram_te or receipt.gothram_as_written):
        errors.append("Gothram is required.")
    if not receipt.persons:
        errors.append("At least one devotee person is required.")
    else:
        has_name = any(p.given_name_en or p.given_name_te for p in receipt.persons)
        if not has_name:
            errors.append("At least one devotee given name is required.")
    if not receipt.phones:
        errors.append("At least one phone number is required.")
    if not (receipt.address_en or receipt.address_te):
        errors.append("Address is required.")

    if errors:
        raise HTTPException(status_code=400, detail={"validation_errors": errors})

    receipt.status = "CONFIRMED"
    receipt.updated_at = datetime.now(timezone.utc)

    # Mark all persons and phones as VERIFIED
    for p in receipt.persons:
        p.verification_status = "VERIFIED"
    for ph in receipt.phones:
        ph.verification_status = "VERIFIED"

    audit = AuditLog(
        user_id=current_user.id if current_user else None,
        action="CONFIRM_RECORD",
        entity="Receipt",
        entity_id=receipt.id,
        old_value="PENDING_VERIFICATION",
        new_value="CONFIRMED",
    )
    db.add(audit)
    db.commit()
    db.refresh(receipt)
    return receipt


@router.delete("/{receipt_id}")
def delete_receipt(
    receipt_id: int,
    reason: Optional[str] = Query(None, description="Reason for deletion/archive"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete / archive a receipt so it can be restored if accidentally deleted."""
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    receipt.is_archived = True
    receipt.archived_at = datetime.now(timezone.utc)
    if reason:
        receipt.archive_reason = reason
    receipt.updated_at = datetime.now(timezone.utc)

    audit = AuditLog(
        user_id=current_user.id if current_user else None,
        action="ARCHIVE_RECEIPT",
        entity="Receipt",
        entity_id=receipt.id,
        new_value=json.dumps({"receipt_no": receipt.receipt_no, "reason": reason or "User deletion"}),
    )
    db.add(audit)
    db.commit()
    return {
        "status": "archived",
        "receipt_id": receipt.id,
        "receipt_no": receipt.receipt_no,
        "message": f"Receipt #{receipt.receipt_no} moved to archive. It can be restored at any time."
    }


@router.post("/{receipt_id}/restore")
def restore_receipt(
    receipt_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """Restore an archived/deleted receipt back to active receipts."""
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    receipt.is_archived = False
    receipt.archived_at = None
    receipt.archive_reason = None
    receipt.updated_at = datetime.now(timezone.utc)

    audit = AuditLog(
        user_id=current_user.id if current_user else None,
        action="RESTORE_RECEIPT",
        entity="Receipt",
        entity_id=receipt.id,
        new_value=json.dumps({"receipt_no": receipt.receipt_no, "action": "restored"}),
    )
    db.add(audit)
    db.commit()
    return {
        "status": "restored",
        "receipt_id": receipt.id,
        "receipt_no": receipt.receipt_no,
        "message": f"Receipt #{receipt.receipt_no} restored successfully."
    }


@router.post("/{receipt_id}/save-incomplete", response_model=ReceiptOut)
def save_incomplete_receipt(
    receipt_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """Explicitly save an incomplete record when required fields are missing."""
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    old_status = receipt.status
    receipt.status = "INCOMPLETE"
    receipt.updated_at = datetime.now(timezone.utc)

    audit = AuditLog(
        user_id=current_user.id if current_user else None,
        action="SAVE_INCOMPLETE",
        entity="Receipt",
        entity_id=receipt.id,
        old_value=old_status,
        new_value="INCOMPLETE",
    )
    db.add(audit)
    db.commit()
    db.refresh(receipt)
    return receipt


@router.get("/export/csv")
def export_receipts_csv(
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Export receipt records to CSV with UTF-8 BOM for Excel bilingual support."""
    import csv
    import io
    from fastapi.responses import Response

    query = db.query(Receipt)
    if isinstance(status_filter, str) and status_filter.strip():
        query = query.filter(Receipt.status == status_filter.strip())
    receipts = query.order_by(Receipt.id.desc()).all()

    output = io.StringIO()
    # Write UTF-8 BOM so Excel opens Telugu without corruption
    output.write("\ufeff")
    writer = csv.writer(output)

    writer.writerow([
        "Receipt No", "Year", "Date", "Abhishekam From", "Abhishekam To", "Amount (Rs)",
        "Gothram (EN)", "Gothram (TE)", "Devotees (Family Members)",
        "Phone Numbers", "Address (EN)", "Address (TE)", "PIN Code", "Status", "Created At"
    ])

    for r in receipts:
        devotees_str = "; ".join(
            f"{p.surname_en or p.surname_te or ''} {p.given_name_en or p.given_name_te or ''}".strip()
            for p in r.persons
        )
        phones_str = "; ".join(ph.number for ph in r.phones)

        writer.writerow([
            r.receipt_no,
            r.receipt_year or "",
            r.receipt_date or "",
            r.abhishekam_from or "",
            r.abhishekam_to or "",
            r.amount or "",
            r.gothram_en or "",
            r.gothram_te or "",
            devotees_str,
            phones_str,
            r.address_en or "",
            r.address_te or "",
            r.pincode or "",
            r.status,
            r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
        ])

    csv_data = output.getvalue().encode("utf-8")
    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=trikuta_temple_receipts.csv"}
    )


@router.get("/export/sankalpam-csv")
def export_sankalpam_csv(db: Session = Depends(get_db)):
    """Export confirmed devotees grouped by Gothram for Sankalpam chanting."""
    import csv
    import io
    from fastapi.responses import Response

    receipts = db.query(Receipt).filter(Receipt.status == "CONFIRMED").order_by(Receipt.gothram_en).all()

    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output)

    writer.writerow([
        "Gothram (TE)", "Gothram (EN)", "Devotee Full Names (Sankalpam Namavali)",
        "Receipt No", "Abhishekam Period", "Village / Town"
    ])

    for r in receipts:
        names_te = ", ".join(
            f"{p.surname_te or p.surname_en or ''} {p.given_name_te or p.given_name_en or ''}".strip()
            for p in r.persons
        )
        writer.writerow([
            r.gothram_te or "",
            r.gothram_en or "",
            names_te,
            r.receipt_no,
            f"{r.abhishekam_from or ''} to {r.abhishekam_to or ''}",
            r.address_te or r.address_en or "",
        ])

    csv_data = output.getvalue().encode("utf-8")
    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=sankalpam_namavali.csv"}
    )


@router.put("/books/{book_number}/rename")
def rename_book(
    book_number: str,
    payload: RenameBookIn,
    db: Session = Depends(get_db)
):
    """Rename a book number across all receipts belonging to that book and optional year."""
    new_num = payload.new_book_number.strip()
    if not new_num:
        raise HTTPException(status_code=400, detail="New book number cannot be empty")

    clean_old = book_number.strip()
    q = db.query(Receipt)
    if clean_old in ("__UNASSIGNED__", "unassigned", "None", "-"):
        q = q.filter(or_(Receipt.book_number == None, Receipt.book_number == ""))
    else:
        q = q.filter(Receipt.book_number == clean_old)

    if payload.receipt_year is not None:
        q = q.filter(Receipt.receipt_year == payload.receipt_year)

    receipts = q.all()
    if not receipts:
        raise HTTPException(status_code=404, detail=f"No receipts found for Book #{book_number}")

    for r in receipts:
        r.book_number = new_num
    db.commit()
    return {
        "message": f"Updated {len(receipts)} receipts to Book #{new_num}",
        "count": len(receipts),
        "new_book_number": new_num,
    }


@router.get("/export/excel")
def export_receipts_excel(
    book_number: Optional[str] = Query(None, description="Optional filter by book number"),
    receipt_year: Optional[int] = Query(None, description="Optional filter by receipt year"),
    status_filter: Optional[str] = Query(None, description="Optional filter by status"),
    export_type: Optional[str] = Query("all", description="all, sankalpam, or dispatch"),
    db: Session = Depends(get_db)
):
    """Export receipt records into a consolidated, beautifully formatted Excel workbook (All, Sankalpam, or Dispatch)."""
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    from fastapi.responses import Response

    query = db.query(Receipt)
    if receipt_year is not None:
        query = query.filter(Receipt.receipt_year == receipt_year)
    if book_number and book_number.strip():
        bn = book_number.strip()
        if bn in ("__UNASSIGNED__", "unassigned", "None", "-"):
            query = query.filter(or_(Receipt.book_number == None, Receipt.book_number == ""))
        else:
            query = query.filter(Receipt.book_number == bn)
    if status_filter and status_filter.strip():
        query = query.filter(Receipt.status == status_filter.strip())

    receipts = query.options(
        selectinload(Receipt.persons),
        selectinload(Receipt.phones),
        selectinload(Receipt.dispatch),
    ).order_by(Receipt.id.desc()).all()

    wb = Workbook()
    ws = wb.active
    clean_bn = (book_number or "").strip()
    year_tag = f"_{receipt_year}" if receipt_year else ""

    if clean_bn:
        clean_title = "Unassigned" if clean_bn in ("__UNASSIGNED__", "unassigned", "None", "-") else f"Book {clean_bn}"
        ws.title = clean_title[:31]
    else:
        ws.title = "All Receipts"

    header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    if export_type == "sankalpam":
        header_fill = PatternFill(start_color="B45309", end_color="B45309", fill_type="solid")  # Amber/Saffron
    elif export_type == "dispatch":
        header_fill = PatternFill(start_color="047857", end_color="047857", fill_type="solid")  # Emerald/Postal

    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    data_font = Font(name="Segoe UI", size=10)
    border_side = Side(border_style="thin", color="D9D9D9")
    thin_border = Border(left=border_side, right=border_side, top=border_side, bottom=border_side)
    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center")

    if export_type == "sankalpam":
        headers = [
            "Sl. No (క్రమ సంఖ్య)",
            "Book No (పుస్తకం)",
            "Receipt No (రసీదు సంఖ్య)",
            "Gothram (గోత్రం - తెలుగు)",
            "Gothram (English)",
            "Devotee Names (భక్తుల పేర్లు - తెలుగు)",
            "Devotee Names (English)",
            "Abhishekam From (నుండి)",
            "Abhishekam To (వరకు)",
            "Amount (రూపాయలు)",
            "Receipt Date (తేదీ)",
        ]
    elif export_type == "dispatch":
        headers = [
            "Sl. No (క్రమ సంఖ్య)",
            "Book No (పుస్తకం)",
            "Receipt No (రసీదు సంఖ్య)",
            "Devotee Name (భక్తుని పేరు - తెలుగు)",
            "Devotee Name (English)",
            "Address (చిరునామా - తెలుగు)",
            "Address (English)",
            "PIN Code (పిన్)",
            "Mobile (ఫోన్ నెంబర్)",
            "Abhishekam Period",
            "Dispatch Status (పంపిణీ)",
        ]
    else:
        headers = [
            "Receipt Number",
            "Book Number",
            "Receipt Date",
            "Abhishekam From",
            "Abhishekam To",
            "Amount",
            "Gothram (English)",
            "Gothram (Telugu)",
            "Devotee Given Name (English)",
            "Devotee Given Name (Telugu)",
            "Surname (English)",
            "Surname (Telugu)",
            "Address (English)",
            "Address (Telugu)",
            "Phone Number 1",
            "Phone Number 2",
            "Pincode",
            "Processing Status",
            "Verification Status",
            "Created Date",
        ]

    ws.append(headers)

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws.row_dimensions[1].height = 28

    current_row = 2
    for idx, r in enumerate(receipts, start=1):
        persons = r.persons or []
        phones = r.phones or []
        p1 = persons[0] if len(persons) > 0 else None

        given_en = ", ".join(p.given_name_en for p in persons if p.given_name_en) if len(persons) > 1 else (p1.given_name_en if p1 else "")
        given_te = ", ".join(p.given_name_te for p in persons if p.given_name_te) if len(persons) > 1 else (p1.given_name_te if p1 else "")
        sur_en = ", ".join(p.surname_en for p in persons if p.surname_en) if len(persons) > 1 else (p1.surname_en if p1 else "")
        sur_te = ", ".join(p.surname_te for p in persons if p.surname_te) if len(persons) > 1 else (p1.surname_te if p1 else "")

        full_devotee_te = f"{sur_te} {given_te}".strip() or given_te or sur_te
        full_devotee_en = f"{sur_en} {given_en}".strip() or given_en or sur_en

        phone1 = phones[0].number if len(phones) > 0 else ""
        phone2 = phones[1].number if len(phones) > 1 else ""

        if export_type == "sankalpam":
            row_data = [
                idx,
                r.book_number or "-",
                r.receipt_no or "",
                r.gothram_te or "",
                r.gothram_en or "",
                full_devotee_te,
                full_devotee_en,
                r.abhishekam_from or "",
                r.abhishekam_to or "",
                r.amount or "100",
                r.receipt_date or "",
            ]
        elif export_type == "dispatch":
            disp_status = r.dispatch.status if r.dispatch else "PENDING"
            row_data = [
                idx,
                r.book_number or "-",
                r.receipt_no or "",
                full_devotee_te,
                full_devotee_en,
                r.address_te or "",
                r.address_en or "",
                r.pincode or "",
                phone1,
                f"{r.abhishekam_from or ''} to {r.abhishekam_to or ''}".strip(),
                disp_status,
            ]
        else:
            verif_status = ", ".join(f"{p.given_name_en or 'P'}:{p.verification_status}" for p in persons if p.verification_status) if persons else "N/A"
            created_str = r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else ""
            row_data = [
                r.receipt_no or "",
                r.book_number or "",
                r.receipt_date or "",
                r.abhishekam_from or "",
                r.abhishekam_to or "",
                r.amount or "",
                r.gothram_en or "",
                r.gothram_te or "",
                given_en or "",
                given_te or "",
                sur_en or "",
                sur_te or "",
                r.address_en or "",
                r.address_te or "",
                phone1 or "",
                phone2 or "",
                r.pincode or "",
                r.status or "",
                verif_status or "",
                created_str or "",
            ]

        ws.append(row_data)

        for col_idx in range(1, len(row_data) + 1):
            cell = ws.cell(row=current_row, column=col_idx)
            cell.font = data_font
            cell.border = thin_border
            if col_idx in (1, 2, 3):
                cell.alignment = center_align
            else:
                cell.alignment = left_align
        ws.row_dimensions[current_row].height = 20
        current_row += 1

    last_col_letter = get_column_letter(len(headers))
    ws.auto_filter.ref = f"A1:{last_col_letter}{max(current_row - 1, 1)}"

    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val = str(cell.value or "")
            if len(val) > max_len:
                max_len = len(val)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    type_tag = f"_{export_type}" if export_type != "all" else ""
    if clean_bn:
        safe_bn = "unassigned" if clean_bn in ("__UNASSIGNED__", "unassigned", "None", "-") else clean_bn.replace(" ", "_")
        filename = f"temple_receipts_book_{safe_bn}{type_tag}{year_tag}_{ts}.xlsx"
    else:
        filename = f"temple_receipts_all{type_tag}{year_tag}_{ts}.xlsx"

    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

