import re
from datetime import datetime
from typing import List, Optional, Tuple


def clean_phone(p: str) -> str:
    """Normalize phone number: strip non-digits, drop +91 or leading 0."""
    if not p:
        return ""
    digits = re.sub(r"\D", "", str(p))
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits


def validate_indian_mobile(phone: str) -> bool:
    """Checks if cleaned phone is a valid 10-digit Indian mobile starting with 6, 7, 8, or 9."""
    cleaned = clean_phone(phone)
    return bool(re.fullmatch(r"[6-9]\d{9}", cleaned))


def clean_pincode(pin: Optional[str]) -> Optional[str]:
    """Extract clean 6 digits from pincode string."""
    if not pin:
        return None
    digits = re.sub(r"\D", "", str(pin))
    return digits if len(digits) == 6 else None


def validate_indian_pincode(pin: Optional[str]) -> bool:
    """Validate 6-digit Indian Postal PIN code (does not start with 0)."""
    if not pin:
        return False
    digits = re.sub(r"\D", "", str(pin))
    return bool(re.fullmatch(r"[1-9]\d{5}", digits))


def parse_date_flexibly(date_str: Optional[str]) -> Optional[datetime]:
    """Parse Indian receipt date formats like 10/10/2025, 10-10-25, 02/11/26."""
    if not date_str:
        return None
    cleaned = date_str.strip().replace(".", "/").replace("-", "/")
    parts = cleaned.split("/")
    if len(parts) != 3:
        return None

    try:
        day = int(parts[0])
        month = int(parts[1])
        year_str = parts[2].strip()

        if len(year_str) == 2:
            year = 2000 + int(year_str)
        else:
            year = int(year_str)

        return datetime(year, month, day)
    except Exception:
        return None


def extract_year_from_date(date_str: Optional[str], default_year: int = 2025) -> int:
    """Extract 4-digit calendar year from date string or fallback."""
    dt = parse_date_flexibly(date_str)
    if dt:
        return dt.year
    # Try direct regex for 4 digits or 2 digits
    match_4 = re.search(r"20\d{2}", str(date_str))
    if match_4:
        return int(match_4.group(0))
    match_2 = re.search(r"\b(2[0-9])\b", str(date_str))
    if match_2:
        return 2000 + int(match_2.group(1))
    return default_year


def validate_date_range(from_date_str: Optional[str], to_date_str: Optional[str]) -> Tuple[bool, str]:
    """Validate that abhishekam from_date is before or equal to to_date."""
    dt_from = parse_date_flexibly(from_date_str)
    dt_to = parse_date_flexibly(to_date_str)

    if not dt_from or not dt_to:
        return True, "One or both dates could not be parsed"

    if dt_from > dt_to:
        return False, f"Starting date ({from_date_str}) is after ending date ({to_date_str})"

    return True, "Valid date range"
