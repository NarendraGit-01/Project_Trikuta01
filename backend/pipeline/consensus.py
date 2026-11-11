import difflib
import re
from typing import Any, Dict, List, Optional, Tuple
from backend.pipeline.gothram_matching import phonetic_norm
from backend.pipeline.schemas import (
    FieldConfidence,
    GothramPick,
    HW,
    Person,
    PipelineResult,
    ReceiptExtraction,
)
from backend.pipeline.validation import (
    clean_phone,
    clean_pincode,
    extract_year_from_date,
    validate_date_range,
    validate_indian_mobile,
    validate_indian_pincode,
)


def compare_names(list_a: List[Person], list_b: List[Person]) -> float:
    """Calculate similarity ratio between two lists of devotee people."""
    if not list_a and not list_b:
        return 1.0
    if not list_a or not list_b:
        return 0.0

    str_a = " ".join(f"{p.given_name} {p.surname}" for p in list_a).strip()
    str_b = " ".join(f"{p.given_name} {p.surname}" for p in list_b).strip()

    return difflib.SequenceMatcher(None, phonetic_norm(str_a), phonetic_norm(str_b)).ratio()


def resolve_consensus(
    r2: ReceiptExtraction,
    r3: Optional[HW],
    gothram_pick: GothramPick,
    field_phones: Optional[List[str]] = None,
    transcription_text: str = ""
) -> Tuple[Dict[str, Any], List[str], Dict[str, FieldConfidence]]:
    """
    Synthesize findings from all extraction passes into a final validated result.
    Flags disagreements, validates formats, and assigns calibrated confidence indicators.
    """
    needs_check: List[str] = []
    field_confidences: Dict[str, FieldConfidence] = {}

    # 1. RECEIPT NUMBER
    receipt_no = r2.receipt_no
    if not receipt_no or not re.search(r"\d+", receipt_no):
        needs_check.append("Receipt number is missing or unreadable.")
        field_confidences["receipt_no"] = FieldConfidence(
            field_name="receipt_no", status="RED", score=0.0, reason="Missing receipt number"
        )
    else:
        field_confidences["receipt_no"] = FieldConfidence(
            field_name="receipt_no", status="GREEN", score=0.95, reason="Clearly extracted"
        )

    # 2. DATE & YEAR
    date_val = r2.date
    receipt_year = extract_year_from_date(date_val, default_year=2025)
    if not date_val:
        needs_check.append("Receipt date is missing.")
        field_confidences["date"] = FieldConfidence(
            field_name="date", status="RED", score=0.0, reason="Missing date"
        )
    elif "2022" in str(date_val) and "2025" in transcription_text:
        needs_check.append(f"Date year may be contaminated by printed terms (extracted '{date_val}')")
        field_confidences["date"] = FieldConfidence(
            field_name="date", status="AMBER", score=0.5, reason="Possible year confusion with printed order date"
        )
    else:
        field_confidences["date"] = FieldConfidence(
            field_name="date", status="GREEN", score=0.9, reason="Date format valid"
        )

    # 3. ABHISHEKAM DATES
    is_valid_range, range_msg = validate_date_range(r2.abhishekam_from, r2.abhishekam_to)
    if not is_valid_range:
        needs_check.append(f"Abhishekam date range issue: {range_msg}")
        field_confidences["abhishekam_dates"] = FieldConfidence(
            field_name="abhishekam_dates", status="RED", score=0.2, reason=range_msg
        )
    else:
        field_confidences["abhishekam_dates"] = FieldConfidence(
            field_name="abhishekam_dates", status="GREEN", score=0.9, reason="Valid range"
        )

    # 4. GOTHRAM
    g_final = gothram_pick.final
    g_written = gothram_pick.as_written
    g_matched = gothram_pick.matched_in_list
    g_conf = gothram_pick.confidence.lower()

    if g_conf == "high" and g_matched:
        field_confidences["gothram"] = FieldConfidence(
            field_name="gothram", status="GREEN", score=0.95,
            reason=f"Matched in reference master: {gothram_pick.list_match}"
        )
    elif g_matched:
        needs_check.append(f"Gothram '{g_final}' matched with medium confidence: {gothram_pick.reason}")
        field_confidences["gothram"] = FieldConfidence(
            field_name="gothram", status="AMBER", score=0.7,
            reason=gothram_pick.reason
        )
    else:
        needs_check.append(f"Gothram '{g_final}' (as written: '{g_written}') not found in master list: {gothram_pick.reason}")
        field_confidences["gothram"] = FieldConfidence(
            field_name="gothram", status="AMBER", score=0.5,
            reason="Unmatched in master list — verify spelling"
        )

    # 5. PHONE NUMBERS
    raw_phones = list(r2.phones or [])
    if r3 and r3.phones:
        raw_phones.extend(r3.phones)
    if field_phones:
        raw_phones.extend(field_phones)

    cleaned_phones = []
    seen = set()
    for p in raw_phones:
        cp = clean_phone(p)
        if cp and len(cp) == 10 and cp not in seen:
            cleaned_phones.append(cp)
            seen.add(cp)

    # Check validity
    valid_phones = [p for p in cleaned_phones if validate_indian_mobile(p)]
    invalid_phones = [p for p in cleaned_phones if not validate_indian_mobile(p)]

    if not valid_phones:
        needs_check.append("No valid 10-digit Indian mobile number found.")
        field_confidences["phones"] = FieldConfidence(
            field_name="phones", status="RED", score=0.0, reason="Missing or invalid phone"
        )
    elif invalid_phones:
        needs_check.append(f"Some extracted phone numbers are invalid: {invalid_phones}")
        field_confidences["phones"] = FieldConfidence(
            field_name="phones", status="AMBER", score=0.6, reason="Mixed valid/invalid phones"
        )
    else:
        field_confidences["phones"] = FieldConfidence(
            field_name="phones", status="GREEN", score=0.95,
            reason=f"{len(valid_phones)} valid phone number(s)"
        )

    # 6. PINCODE
    pin_r2 = clean_pincode(r2.pincode)
    pin_r3 = clean_pincode(r3.pincode) if r3 else None
    chosen_pin = pin_r3 or pin_r2

    if chosen_pin and validate_indian_pincode(chosen_pin):
        if pin_r2 and pin_r3 and pin_r2 != pin_r3:
            needs_check.append(f"Pincode differs between passes: pass2 '{pin_r2}' vs zoom '{pin_r3}'")
            field_confidences["pincode"] = FieldConfidence(
                field_name="pincode", status="AMBER", score=0.7, reason="Pass disagreement"
            )
        else:
            field_confidences["pincode"] = FieldConfidence(
                field_name="pincode", status="GREEN", score=0.95, reason="Valid 6-digit PIN"
            )
    else:
        # Pincode is optional on some receipts (e.g. sample_img4, sample_img11)
        field_confidences["pincode"] = FieldConfidence(
            field_name="pincode", status="AMBER", score=0.5, reason="Pincode blank or unverified"
        )

    # 7. DEVOTEES & SHARED FAMILY SURNAME
    from backend.app.core.config import settings
    from backend.pipeline.address_resolver import (
        resolve_canonical_telugu_name,
        standardize_andhra_telangana_address,
    )
    from backend.pipeline.transliterate import is_telugu, transliterate_en_to_te

    use_bilingual = getattr(settings, "USE_BILINGUAL_LLM_EXTRACTION", True)

    people_r2 = r2.people or []
    people_r3 = r3.people if r3 else []

    # Choose whichever pass identified more family members to avoid dropping devotees
    if len(people_r2) > len(people_r3):
        raw_chosen_people = people_r2
    else:
        raw_chosen_people = people_r3 if people_r3 else people_r2

    # Shared family surname (intiperu) extracted at receipt level or from first person
    fam_surname_te = ((r3.family_surname_te if r3 else None) or r2.family_surname_te or "").strip()
    fam_surname_en = ((r3.family_surname_en if r3 else None) or r2.family_surname_en or "").strip()

    if use_bilingual and (fam_surname_te or fam_surname_en):
        if fam_surname_te and (not fam_surname_en or is_telugu(fam_surname_en)):
            fam_surname_en, fam_surname_te = resolve_canonical_telugu_name(fam_surname_te)
        elif fam_surname_en and (not fam_surname_te or not is_telugu(fam_surname_te)):
            fam_surname_en, fam_surname_te = resolve_canonical_telugu_name(fam_surname_en)
    else:
        fam_surname_te = ""
        fam_surname_en = ""

    chosen_people: List[Person] = []
    for p in raw_chosen_people:
        p_obj = p if isinstance(p, Person) else Person(**p)

        # Resolve given name (prefer LLM bilingual pair if valid scripts)
        g_te = (p_obj.given_name_te or "").strip()
        g_en = (p_obj.given_name_en or "").strip()
        if use_bilingual and g_te and g_en and is_telugu(g_te) and not is_telugu(g_en):
            p_obj.given_name_te = g_te
            p_obj.given_name_en = g_en
            if not p_obj.given_name:
                p_obj.given_name = g_te
        elif p_obj.given_name or g_te or g_en:
            raw_g = p_obj.given_name or g_te or g_en
            c_en, c_te = resolve_canonical_telugu_name(raw_g)
            p_obj.given_name_en = g_en if (use_bilingual and g_en and not is_telugu(g_en)) else c_en
            p_obj.given_name_te = g_te if (use_bilingual and g_te and is_telugu(g_te)) else c_te
            if not p_obj.given_name:
                p_obj.given_name = raw_g

        # Resolve surname (prefer per-person bilingual pair -> raw surname -> shared family surname)
        s_te = (p_obj.surname_te or "").strip()
        s_en = (p_obj.surname_en or "").strip()
        if use_bilingual and s_te and s_en and is_telugu(s_te) and not is_telugu(s_en):
            p_obj.surname_te = s_te
            p_obj.surname_en = s_en
        elif p_obj.surname or s_te or s_en:
            raw_s = p_obj.surname or s_te or s_en
            c_en, c_te = resolve_canonical_telugu_name(raw_s)
            p_obj.surname_en = s_en if (use_bilingual and s_en and not is_telugu(s_en)) else c_en
            p_obj.surname_te = s_te if (use_bilingual and s_te and is_telugu(s_te)) else c_te
        elif fam_surname_en or fam_surname_te:
            p_obj.surname_en = fam_surname_en
            p_obj.surname_te = fam_surname_te

        if not p_obj.surname:
            p_obj.surname = p_obj.surname_te or p_obj.surname_en or ""

        if not fam_surname_en and p_obj.surname_en:
            fam_surname_en = p_obj.surname_en
        if not fam_surname_te and p_obj.surname_te:
            fam_surname_te = p_obj.surname_te

        chosen_people.append(p_obj)

    if people_r2 and people_r3:
        sim = compare_names(people_r2, people_r3)
        if sim < 0.70:
            needs_check.append(
                f"Devotee names differ between passes: {[f'{p.given_name} {p.surname}' for p in people_r2]} "
                f"vs {[f'{p.given_name} {p.surname}' for p in people_r3]}"
            )
            field_confidences["devotees"] = FieldConfidence(
                field_name="devotees", status="AMBER", score=0.4,
                reason="Disagreement between full image and zoomed read"
            )
        else:
            field_confidences["devotees"] = FieldConfidence(
                field_name="devotees", status="GREEN", score=0.85, reason="Consistent across passes"
            )
    elif chosen_people:
        field_confidences["devotees"] = FieldConfidence(
            field_name="devotees", status="AMBER", score=0.7, reason="Single pass extraction"
        )
    else:
        needs_check.append("No devotee names were extracted.")
        field_confidences["devotees"] = FieldConfidence(
            field_name="devotees", status="RED", score=0.0, reason="Missing devotee names"
        )

    # 8. ADDRESS & AP/TS GEOLOCATION RESOLUTION
    addr_r2 = r2.address or ""
    addr_r3 = (r3.address or "") if r3 else ""
    llm_addr_te = ((r3.address_te if r3 else None) or r2.address_te or "").strip()
    llm_addr_en = ((r3.address_en if r3 else None) or r2.address_en or "").strip()
    chosen_addr = addr_r3 or addr_r2 or llm_addr_te or llm_addr_en

    clean_addr_en, clean_addr_te, resolved_pin, geo_meta = standardize_andhra_telangana_address(
        llm_addr_te or chosen_addr, chosen_pin
    )
    if resolved_pin and not chosen_pin:
        chosen_pin = resolved_pin

    # When Gemini returned natural bilingual addresses directly, prefer them over Python transliteration
    if use_bilingual and llm_addr_en and not is_telugu(llm_addr_en):
        clean_addr_en = llm_addr_en
    if use_bilingual and llm_addr_te and is_telugu(llm_addr_te):
        clean_addr_te = llm_addr_te

    # Bilingual gothram Telugu preservation
    llm_gothram_te = ((r3.gothram_te if r3 else None) or r2.gothram_te or "").strip()
    if use_bilingual and llm_gothram_te and is_telugu(llm_gothram_te):
        gothram_te = llm_gothram_te
    elif g_written and is_telugu(g_written):
        gothram_te = g_written
    else:
        gothram_te = transliterate_en_to_te(g_final) if g_final else ""

    if not chosen_addr and not clean_addr_te and not clean_addr_en:
        needs_check.append("Address is missing.")
        field_confidences["address"] = FieldConfidence(
            field_name="address", status="RED", score=0.0, reason="Missing address"
        )
    elif addr_r2 and addr_r3 and difflib.SequenceMatcher(None, addr_r2, addr_r3).ratio() < 0.60:
        needs_check.append(f"Address differs between passes: '{addr_r2}' vs '{addr_r3}'")
        field_confidences["address"] = FieldConfidence(
            field_name="address", status="AMBER", score=0.5, reason="Disagreement between passes"
        )
    else:
        field_confidences["address"] = FieldConfidence(
            field_name="address", status="GREEN", score=0.85, reason="Address resolved and verified"
        )

    # Compile consolidated data
    final_data = {
        "receipt_no": receipt_no,
        "receipt_year": receipt_year,
        "date": date_val,
        "abhishekam_from": r2.abhishekam_from,
        "abhishekam_to": r2.abhishekam_to,
        "amount_rupees": r2.amount_rupees,
        "gothram_final": g_final,
        "gothram_te": gothram_te,
        "gothram_as_written": g_written,
        "gothram_in_reference": g_matched,
        "gothram_alternatives": gothram_pick.other_possible_list_matches or [],
        "family_surname_en": fam_surname_en or None,
        "family_surname_te": fam_surname_te or None,
        "people": chosen_people,
        "address": clean_addr_te or clean_addr_en or chosen_addr,
        "address_en": clean_addr_en,
        "address_te": clean_addr_te,
        "pincode": chosen_pin,
        "geo_metadata": geo_meta,
        "phones": valid_phones or cleaned_phones,
    }

    return final_data, needs_check, field_confidences
