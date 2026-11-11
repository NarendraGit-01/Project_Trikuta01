import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from backend.app.auth.deps import get_current_user, get_optional_current_user
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.models.audit import AuditLog
from backend.app.models.correction import Correction
from backend.app.models.dispatch import PrasadamDispatch
from backend.app.models.person import ReceiptPerson
from backend.app.models.phone import ReceiptPhone
from backend.app.models.receipt import Receipt
from backend.app.models.user import User
from backend.app.schemas.receipt import ReceiptCreate, ReceiptListItem, ReceiptOut, ReceiptUpdate
from backend.app.storage import get_storage

router = APIRouter(prefix="/receipts", tags=["Receipts"])


@router.get("/books/summary")
def get_books_summary(db: Session = Depends(get_db)):
    """Return categorized folder stats grouped by book number."""
    from typing import Dict, Any
    all_receipts = db.query(Receipt.id, Receipt.book_number, Receipt.status, Receipt.is_archived).all()

    archived_count = sum(1 for r in all_receipts if r.is_archived)
    active_receipts = [r for r in all_receipts if not r.is_archived]

    total_all = len(active_receipts)
    processed_all = sum(1 for r in active_receipts if r.status == "CONFIRMED")
    pending_all = sum(1 for r in active_receipts if r.status != "CONFIRMED")

    book_stats: Dict[str, Dict[str, Any]] = {}
    for r in active_receipts:
        bn = (r.book_number or "").strip()
        key = bn if bn else "__UNASSIGNED__"
        if key not in book_stats:
            book_stats[key] = {
                "book_number": key,
                "display_name": f"Book #{key}" if key != "__UNASSIGNED__" else "Unassigned (పుస్తకం లేనివి)",
                "total": 0,
                "processed": 0,
                "pending": 0,
            }
        book_stats[key]["total"] += 1
        if r.status == "CONFIRMED":
            book_stats[key]["processed"] += 1
        else:
            book_stats[key]["pending"] += 1

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
    receipts = query.order_by(Receipt.id.desc()).offset(actual_skip).limit(actual_limit).all()

    items = []
    for r in receipts:
        first_person = r.persons[0] if r.persons else None
        p_name = ""
        if first_person:
            p_name = f"{first_person.given_name_en or first_person.given_name_te or ''} {first_person.surname_en or first_person.surname_te or ''}".strip()

        storage = get_storage()
        img_url = None
        if r.original_image_path:
            img_url = r.original_image_path if r.original_image_path.startswith("http") else storage.get_url(r.original_image_path)

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


@router.get("/{receipt_id}", response_model=ReceiptOut)
def get_receipt(receipt_id: int, db: Session = Depends(get_db)):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


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
    # Check duplicate detection
    dup_query = db.query(Receipt).filter(Receipt.receipt_no == receipt_in.receipt_no.strip())
    if settings.RECEIPT_UNIQUENESS_POLICY == "yearly" and receipt_in.receipt_year:
        dup_query = dup_query.filter(Receipt.receipt_year == receipt_in.receipt_year)
    
    if dup_query.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Receipt number '{receipt_in.receipt_no}' already exists in the system."
        )

    receipt = Receipt(
        receipt_no=receipt_in.receipt_no.strip(),
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
        original_image_path=receipt_in.original_image_path,
        corrected_image_path=receipt_in.corrected_image_path,
        handwriting_crop_path=receipt_in.handwriting_crop_path,
        ocr_raw=receipt_in.ocr_raw,
        confidence_data=receipt_in.confidence_data,
        model_name=receipt_in.model_name,
        processing_cost=receipt_in.processing_cost,
        processing_duration=receipt_in.processing_duration,
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

    # Add audit log
    audit = AuditLog(
        user_id=current_user.id if current_user else None,
        action="CREATE_RECEIPT",
        entity="Receipt",
        entity_id=receipt.id,
        new_value=json.dumps({"receipt_no": receipt.receipt_no, "status": receipt.status}),
    )
    db.add(audit)

    db.commit()
    db.refresh(receipt)
    return receipt


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


@router.get("/export/excel")
def export_receipts_excel(
    book_number: Optional[str] = Query(None, description="Optional filter by book number"),
    status_filter: Optional[str] = Query(None, description="Optional filter by status"),
    db: Session = Depends(get_db)
):
    """Export all processed receipt records into a consolidated, beautifully formatted Excel workbook."""
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    from fastapi.responses import Response

    query = db.query(Receipt)
    if book_number and book_number.strip():
        bn = book_number.strip()
        if bn in ("__UNASSIGNED__", "unassigned", "None", "-"):
            query = query.filter(or_(Receipt.book_number == None, Receipt.book_number == ""))
        else:
            query = query.filter(Receipt.book_number == bn)
    if status_filter and status_filter.strip():
        query = query.filter(Receipt.status == status_filter.strip())

    receipts = query.order_by(Receipt.id.desc()).all()

    wb = Workbook()
    ws = wb.active
    if book_number and book_number.strip():
        clean_title = "Unassigned" if book_number.strip() in ("__UNASSIGNED__", "unassigned", "None", "-") else f"Book {book_number.strip()}"
        ws.title = clean_title[:31]  # Excel sheet title max 31 chars
    else:
        ws.title = "All Receipts"

    # Header styling
    header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    data_font = Font(name="Segoe UI", size=10)
    border_side = Side(border_style="thin", color="D9D9D9")
    thin_border = Border(left=border_side, right=border_side, top=border_side, bottom=border_side)
    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center")

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

    # Style header row
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws.row_dimensions[1].height = 28

    # Populate rows
    current_row = 2
    for r in receipts:
        # Multi-person preservation: if multiple persons exist, list them or output primary with all devotees preserved
        persons = r.persons or []
        phones = r.phones or []

        p1 = persons[0] if len(persons) > 0 else None
        # In case multiple devotees exist, join their details cleanly
        given_en = ", ".join(p.given_name_en for p in persons if p.given_name_en) if len(persons) > 1 else (p1.given_name_en if p1 else "")
        given_te = ", ".join(p.given_name_te for p in persons if p.given_name_te) if len(persons) > 1 else (p1.given_name_te if p1 else "")
        sur_en = ", ".join(p.surname_en for p in persons if p.surname_en) if len(persons) > 1 else (p1.surname_en if p1 else "")
        sur_te = ", ".join(p.surname_te for p in persons if p.surname_te) if len(persons) > 1 else (p1.surname_te if p1 else "")
        verif_status = ", ".join(f"{p.given_name_en or 'P'}:{p.verification_status}" for p in persons if p.verification_status) if persons else "N/A"

        phone1 = phones[0].number if len(phones) > 0 else ""
        phone2 = phones[1].number if len(phones) > 1 else ""

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
            if col_idx in (1, 2, 3, 4, 5, 15, 16, 17, 18, 20):
                cell.alignment = center_align
            else:
                cell.alignment = left_align
        ws.row_dimensions[current_row].height = 20
        current_row += 1

    # Enable Excel Auto-Filter on headers
    last_col_letter = get_column_letter(len(headers))
    ws.auto_filter.ref = f"A1:{last_col_letter}{max(current_row - 1, 1)}"

    # Auto-fit column widths with readable margin
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
    if book_number and book_number.strip():
        safe_bn = "unassigned" if book_number.strip() in ("__UNASSIGNED__", "unassigned", "None", "-") else book_number.strip().replace(" ", "_")
        filename = f"temple_receipts_book_{safe_bn}_{ts}.xlsx"
    else:
        filename = f"temple_receipts_all_{ts}.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

