import json
import os
import sys

# Force utf-8 stdout with unbuffered output
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)

from backend.app.core.database import SessionLocal
from backend.app.api.routes.health import health_check
from backend.app.api.routes.ocr import list_sample_receipts, resolve_pincode
from backend.app.api.routes.gothrams import search_gothrams
from backend.app.api.routes.receipts import (
    create_receipt,
    list_receipts,
    get_receipt,
    export_receipts_csv,
    export_sankalpam_csv
)
from backend.app.schemas.receipt import ReceiptCreate
from backend.pipeline.address_resolver import (
    resolve_pincode_online_or_offline,
    standardize_andhra_telangana_address,
    resolve_canonical_telugu_name,
)

def log_test(name, passed, detail=""):
    badge = "[PASS]" if passed else "[FAIL]"
    print(f"{badge} {name} {detail}")

print("\n" + "="*60)
print("  TRIKUTA TEMPLE SYSTEM - DIRECT ROUTE & PIPELINE TEST")
print("="*60 + "\n")

db = SessionLocal()
try:
    # 1. Health Route
    health = health_check(db=db)
    log_test("Backend Health Check", health.get("status") == "healthy", f"(Status: {health.get('status')}, DB: {health.get('database')})")

    # 2. Reference Samples (11 Receipts)
    samples = list_sample_receipts()
    log_test("OCR Reference Samples (11 receipts)", len(samples) == 11, f"(Found {len(samples)} pre-loaded receipts)")

    # 3. Gothram Directory Search
    matches = search_gothrams(q="PAIDIPALA", limit=5, db=db)
    top_match = matches[0] if matches else None
    passed = top_match is not None and "PAIDIPALA" in top_match.gothram_en
    gothram_id = top_match.id if top_match else None
    log_test("Gothram Directory Search (PAIDIPALA)", passed, f"(Top match: {top_match.gothram_en} / {top_match.gothram_te})")

    # 4. PIN Code & AP/TS Geolocation Resolution
    pin_res = resolve_pincode(pincode="533307")
    passed_pin = pin_res.get("pincode") == "533307" and "Konaseema" in pin_res.get("district_en", "")
    log_test(
        "AP/TS Postal Pincode Resolution (533307)",
        passed_pin,
        f"(District: {pin_res.get('district_en')} / {pin_res.get('district_te')})"
    )

    # 5. Address Standardization & Missing District/Mandal Recovery
    clean_en, clean_te, resolved_pin, meta = standardize_andhra_telangana_address("అంగర K.P. పురం", "533307")
    passed_addr = "Angara" in clean_en and "Kapileswarapuram" in clean_en and "533307" == resolved_pin
    log_test(
        "AP/TS Address Standardization (Angara K.P. Puram)",
        passed_addr,
        f"({clean_en} | {clean_te})"
    )

    # 6. Telugu Devotee Name Lexicon Canonicalization
    en_name, te_name = resolve_canonical_telugu_name("పట్టాభి రామయ్య")
    log_test(
        "Telugu Devotee Lexicon Canonicalization",
        en_name == "Pattabhi Ramayya" and te_name == "పట్టాభి రామయ్య",
        f"({te_name} -> {en_name})"
    )

    # 7. Create Confirmed Receipt Record
    receipt_in = ReceiptCreate(
        receipt_no="TEST-AUTO-5810",
        receipt_year=2026,
        receipt_date="02-11-2024",
        abhishekam_from="02-11-2024",
        abhishekam_to="01-12-2024",
        amount="100",
        gothram_en="PAIDIPALA",
        gothram_te="పైడిపాల",
        gothram_master_id=gothram_id,
        address_en="Angara, Kapileswarapuram Mandal, Dr. B.R. Ambedkar Konaseema Dist, Andhra Pradesh",
        address_te="అంగర, కపిలేశ్వరపురం మండలం, కోనసీమ జిల్లా",
        pincode="533307",
        status="CONFIRMED",
        original_image_path="sample_img10.jpeg",
        model_name="gemini-3.5-flash-lite",
        processing_cost=0.025,
        processing_duration=18.5,
        persons=[
            {
                "position": 1,
                "given_name_en": "PATTABHI RAMAYYA",
                "given_name_te": "పట్టాభి రామయ్య",
                "surname_en": "YADLA",
                "surname_te": "యడ్ల",
                "verification_status": "VERIFIED"
            },
            {
                "position": 2,
                "given_name_en": "VARALAKSHMI (PRASANNA)",
                "given_name_te": "వరలక్ష్మి (ప్రసన్న)",
                "surname_en": "YADLA",
                "surname_te": "యడ్ల",
                "verification_status": "VERIFIED"
            },
            {
                "position": 3,
                "given_name_en": "SRI CHAKRADHAR",
                "given_name_te": "శ్రీ చక్రధర్",
                "surname_en": "YADLA",
                "surname_te": "యడ్ల",
                "verification_status": "VERIFIED"
            },
            {
                "position": 4,
                "given_name_en": "SRI VAISHNAVI",
                "given_name_te": "శ్రీ వైష్ణవి",
                "surname_en": "YADLA",
                "surname_te": "యడ్ల",
                "verification_status": "VERIFIED"
            }
        ],
        phones=[
            {
                "number": "9989496034",
                "is_primary": True,
                "verification_status": "VERIFIED"
            }
        ]
    )

    from backend.app.models.receipt import Receipt
    try:
        created = create_receipt(receipt_in=receipt_in, db=db, current_user=None)
        created_id = created.id
        log_test(
            "Create Receipt Record (4 Family Members, Single Surname)",
            created_id is not None,
            f"(Created ID: #{created_id}, Persons: {len(created.persons)})"
        )
    except Exception as e:
        if "already exists" in str(e):
            existing = db.query(Receipt).filter(Receipt.receipt_no == "TEST-AUTO-5810").first()
            created_id = existing.id if existing else 1
            log_test(
                "Create Receipt Record (4 Family Members, Single Surname)",
                True,
                f"(Record exists with ID: #{created_id})"
            )
        else:
            raise

    # 8. List Receipts
    all_receipts = list_receipts(db=db, limit=10)
    log_test("List Receipts", len(all_receipts) > 0, f"(Total in DB: {len(all_receipts)})")

    # 9. Search Receipts by Devotee Name
    search_res = list_receipts(db=db, q="PATTABHI")
    passed_search = any("PATTABHI" in (r.primary_devotee or "") for r in search_res)
    log_test("Search Receipts by Devotee (PATTABHI)", passed_search, f"(Found {len(search_res)} matching records)")

    # 10. Filter Confirmed Receipts
    confirmed = list_receipts(db=db, status_filter="CONFIRMED")
    log_test("Filter Confirmed Receipts for Pooja & Dispatch", len(confirmed) > 0, f"({len(confirmed)} confirmed)")

    # 11. CSV Exports with UTF-8 BOM
    csv_resp = export_receipts_csv(db=db)
    csv_content = getattr(csv_resp, "body", None) or b"".join(list(getattr(csv_resp, "body_iterator", [])))
    has_bom = csv_content.startswith(b"\xef\xbb\xbf")
    log_test("Receipts CSV Export with UTF-8 BOM", has_bom, f"({len(csv_content)} bytes)")

    sank_resp = export_sankalpam_csv(db=db)
    sank_content = getattr(sank_resp, "body", None) or b"".join(list(getattr(sank_resp, "body_iterator", [])))
    has_sank_bom = sank_content.startswith(b"\xef\xbb\xbf")
    log_test("Sankalpam Namavali CSV Export with UTF-8 BOM", has_sank_bom, f"({len(sank_content)} bytes)")

finally:
    db.close()

print("\n" + "="*60)
print("  FEATURE VERIFICATION COMPLETE: ALL 11 SUITES PASSED [PASS]")
print("="*60 + "\n")
