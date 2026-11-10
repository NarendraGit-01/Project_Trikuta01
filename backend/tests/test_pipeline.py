import numpy as np
from PIL import Image
from backend.pipeline.consensus import resolve_consensus
from backend.pipeline.gothram_matching import GothramResolver, phonetic_norm
from backend.pipeline.image_loader import crop_from_box, from_b64, prepare_image, to_b64
from backend.pipeline.image_quality import evaluate_image_quality
from backend.pipeline.orientation import apply_rotation, detect_orientation_heuristic
from backend.pipeline.schemas import GothramPick, HW, Person, ReceiptExtraction
from backend.pipeline.usage_tracker import UsageTracker
from backend.pipeline.validation import (
    clean_phone,
    clean_pincode,
    extract_year_from_date,
    parse_date_flexibly,
    validate_date_range,
    validate_indian_mobile,
    validate_indian_pincode,
)


def test_validation_phone():
    assert clean_phone("+91 99639 50472") == "9963950472"
    assert clean_phone("09963950472") == "9963950472"
    assert clean_phone("99639-50472") == "9963950472"

    assert validate_indian_mobile("9963950472") is True
    assert validate_indian_mobile("7036075105") is True
    assert validate_indian_mobile("8897794815") is True
    assert validate_indian_mobile("1234567890") is False
    assert validate_indian_mobile("996395047") is False


def test_validation_pincode():
    assert clean_pincode("533307") == "533307"
    assert clean_pincode("533 307") == "533307"
    assert clean_pincode("invalid") is None

    assert validate_indian_pincode("533307") is True
    assert validate_indian_pincode("500029") is True
    assert validate_indian_pincode("012345") is False
    assert validate_indian_pincode("53330") is False


def test_validation_dates():
    dt = parse_date_flexibly("10/10/2025")
    assert dt is not None and dt.year == 2025 and dt.month == 10 and dt.day == 10

    dt_short = parse_date_flexibly("22/10/25")
    assert dt_short is not None and dt_short.year == 2025

    assert extract_year_from_date("10/10/2025") == 2025
    assert extract_year_from_date("02/11/26") == 2026

    valid, _ = validate_date_range("22/10/25", "20/11/25")
    assert valid is True

    invalid, msg = validate_date_range("20/11/25", "22/10/25")
    assert invalid is False


def test_gothram_normalization_and_candidates():
    assert phonetic_norm("PAIDIBAALA") == "PAIDIBALA"
    assert phonetic_norm("PAIDIPAALA") == "PAIDIPALA"
    assert phonetic_norm("KASHYAPA") == "KASHYAPA"
    assert phonetic_norm("MARKANDEYA") == "MARKANDEYA"

    resolver = GothramResolver(["PAIDIPALA", "KASHYAPA", "MARKANDEYA", "ENDAVALLI"])
    cands = resolver.get_candidates(["Paidibaala", "Kashyap"], top_k=5)
    assert len(cands) >= 2
    matched_names = [c[0] for c in cands]
    assert "PAIDIPALA" in matched_names
    assert "KASHYAPA" in matched_names


def test_image_quality_assessment():
    img = prepare_image("Reference Images/sample_img.jpeg")
    res = evaluate_image_quality(img)
    assert res.verdict in ("GOOD", "ACCEPTABLE")
    assert res.can_proceed is True


def test_orientation_operations():
    img = Image.new("RGB", (400, 200), color="white")
    rot_90 = apply_rotation(img, 90)
    assert rot_90.size == (200, 400)

    rot_180 = apply_rotation(img, 180)
    assert rot_180.size == (400, 200)

    tall = Image.new("RGB", (200, 600), color="white")
    assert detect_orientation_heuristic(tall) == 90


def test_cropping():
    img = Image.new("RGB", (1000, 1000), color="blue")
    box = [200, 100, 800, 900]
    cropped = crop_from_box(img, box, pad=0.02, target_long_side=2000)
    assert cropped is not None
    assert max(cropped.size) >= 1500

    assert crop_from_box(img, [900, 100, 200, 800]) is None


def test_consensus_and_confidence():
    r2 = ReceiptExtraction(
        receipt_no="5813",
        date="10/10/2025",
        abhishekam_from="22/10/25",
        abhishekam_to="20/11/25",
        amount_rupees="1000-00",
        gothram_readings=["Kashyapa"],
        people=[Person(given_name="Subrahmanyam", surname="Kotinandini")],
        address="Srinivasapuram mandalam, Angadam gramam",
        pincode="533307",
        phones=["9603850122"]
    )
    r3 = HW(
        gothram_readings=["Kashyapa"],
        people=[Person(given_name="Subrahmanyam", surname="Kotinandini")],
        address="Srinivasapuram mandalam, Angadam gramam",
        pincode="533307",
        phones=["9603850122"]
    )
    g_pick = GothramPick(
        as_written="Kashyapa",
        final="KASHYAPA",
        matched_in_list=True,
        list_match="KASHYAPA",
        other_possible_list_matches=[],
        confidence="high",
        reason="Clear handwriting"
    )

    final_data, needs_check, confidences = resolve_consensus(
        r2=r2,
        r3=r3,
        gothram_pick=g_pick
    )

    assert final_data["receipt_no"] == "5813"
    assert final_data["gothram_final"] == "KASHYAPA"
    assert len(final_data["phones"]) == 1
    assert confidences["receipt_no"].status == "GREEN"
    assert confidences["gothram"].status == "GREEN"
    assert confidences["phones"].status == "GREEN"
    assert len(needs_check) == 0
