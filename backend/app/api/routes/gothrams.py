import re
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
import openpyxl
from rapidfuzz import fuzz, process
from sqlalchemy.orm import Session
from backend.app.auth.deps import get_current_user, require_roles
from backend.app.core.database import get_db
from backend.app.models.gothram import GothramMaster
from backend.app.models.user import User
from backend.app.schemas.gothram import GothramMasterCreate, GothramMasterOut, GothramSearchItem

router = APIRouter(prefix="/gothrams", tags=["Gothram Master"])


def phonetic_norm(s: str) -> str:
    """Phonetic normalization matching the notebook logic."""
    if not s:
        return ""
    s = re.sub(r"[^A-Z]", "", str(s).upper())
    s = s.replace("W", "V").replace("Z", "J")
    s = re.sub(r"([TDKGBP])H", r"\1", s)
    s = s.replace("EE", "I").replace("OO", "U").replace("AA", "A")
    return re.sub(r"(.)\1+", r"\1", s)


@router.get("/search", response_model=List[GothramSearchItem])
def search_gothrams(
    q: str = Query(..., min_length=1, description="Query string in English or Telugu"),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Phonetic and fuzzy search against the Gothram master list."""
    all_gothrams = db.query(GothramMaster).all()
    if not all_gothrams:
        return []

    query_norm = phonetic_norm(q)
    results = []

    # Map of id to record
    g_map = {g.id: g for g in all_gothrams}
    
    # Check for direct English or Telugu substrings first
    q_lower = q.strip().lower()
    for g in all_gothrams:
        if q_lower in g.gothram_en.lower() or (g.gothram_te and q_lower in g.gothram_te.lower()):
            results.append(GothramSearchItem(
                id=g.id,
                gothram_en=g.gothram_en,
                gothram_te=g.gothram_te,
                similarity_score=100.0,
                approval_status=g.approval_status,
                te_verified=g.te_verified
            ))

    # Next use rapidfuzz on phonetic normalized forms
    if query_norm:
        names_norm = [g.normalized_name for g in all_gothrams]
        fuzzy_matches = process.extract(
            query_norm,
            names_norm,
            scorer=fuzz.ratio,
            limit=limit * 2
        )
        existing_ids = {r.id for r in results}
        for _, score, idx in fuzzy_matches:
            g = all_gothrams[idx]
            if g.id not in existing_ids and score >= 60:
                results.append(GothramSearchItem(
                    id=g.id,
                    gothram_en=g.gothram_en,
                    gothram_te=g.gothram_te,
                    similarity_score=round(score, 1),
                    approval_status=g.approval_status,
                    te_verified=g.te_verified
                ))
                existing_ids.add(g.id)

    # Sort by similarity score descending
    results.sort(key=lambda x: -x.similarity_score)
    return results[:limit]


@router.get("", response_model=List[GothramMasterOut])
def list_gothrams(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(GothramMaster)
    if status_filter:
        query = query.filter(GothramMaster.approval_status == status_filter)
    return query.order_by(GothramMaster.gothram_en).offset(skip).limit(limit).all()


@router.post("", response_model=GothramMasterOut)
def create_gothram(
    gothram_in: GothramMasterCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # If added by staff, set to PENDING unless user is ADMIN
    status_val = "APPROVED" if current_user.role == "ADMIN" else "PENDING"
    norm_val = phonetic_norm(gothram_in.gothram_en)

    existing = db.query(GothramMaster).filter(GothramMaster.gothram_en == gothram_in.gothram_en.strip().upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Gothram already exists in master")

    item = GothramMaster(
        gothram_en=gothram_in.gothram_en.strip().upper(),
        gothram_te=gothram_in.gothram_te,
        normalized_name=norm_val,
        variants=gothram_in.variants or [],
        approval_status=status_val,
        te_verified=bool(gothram_in.te_verified and current_user.role == "ADMIN")
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/import-from-excel")
def import_excel_master(
    excel_path: Optional[str] = None,
    current_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    """Admin-only utility to seed or sync GothramMaster from the provided Excel file."""
    path = Path(excel_path or "Gothrams-Surname List.xlsx").resolve()
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"Excel file not found at {path}")

    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    wb.close()

    raw_gothrams = sorted({str(r[1]).strip().upper() for r in rows if r and len(r) > 1 and r[1] is not None})
    
    # Filter anomalies like '#N/A'
    cleaned = []
    for g in raw_gothrams:
        if not g or g == "#N/A":
            continue
        # If entry has multiple options like "INIVALI / PAIDIPALA", keep them
        cleaned.append(g)

    existing_set = {g.gothram_en for g in db.query(GothramMaster.gothram_en).all()}
    new_items = []
    for g in cleaned:
        if g not in existing_set:
            norm_val = phonetic_norm(g)
            new_items.append(GothramMaster(
                gothram_en=g,
                gothram_te=None,
                normalized_name=norm_val,
                variants=[],
                approval_status="APPROVED",
                te_verified=False
            ))
            existing_set.add(g)

    if new_items:
        db.bulk_save_objects(new_items)
        db.commit()

    return {
        "status": "success",
        "total_in_excel": len(cleaned),
        "newly_imported": len(new_items),
        "total_in_master": db.query(GothramMaster).count()
    }
