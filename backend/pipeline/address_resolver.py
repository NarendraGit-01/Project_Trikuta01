import json
import re
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

# All 26 Districts of Andhra Pradesh (Post-2022 reorganization) with Telugu names
AP_DISTRICTS: Dict[str, str] = {
    "Alluri Sitharama Raju": "అల్లూరి సీతారామరాజు జిల్లా",
    "Anakapalli": "అనకాపల్లి జిల్లా",
    "Ananthapuramu": "అనంతపురం జిల్లా",
    "Annamayya": "అన్నమయ్య జిల్లా",
    "Bapatla": "బాపట్ల జిల్లా",
    "Chittoor": "చిత్తూరు జిల్లా",
    "Dr. B.R. Ambedkar Konaseema": "డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ జిల్లా",
    "Konaseema": "కోనసీమ జిల్లా",
    "East Godavari": "తూర్పు గోదావరి జిల్లా",
    "Eluru": "ఏలూరు జిల్లా",
    "Guntur": "గుంటూరు జిల్లా",
    "Kakinada": "కాకినాడ జిల్లా",
    "Krishna": "కృష్ణా జిల్లా",
    "Kurnool": "కర్నూలు జిల్లా",
    "Nandyal": "నంద్యాల జిల్లా",
    "NTR": "ఎన్టీఆర్ జిల్లా",
    "Palnadu": "పల్నాడు జిల్లా",
    "Parvathipuram Manyam": "పార్వతీపురం మన్యం జిల్లా",
    "Prakasam": "ప్రకాశం జిల్లా",
    "Sri Potti Sriramulu Nellore": "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు జిల్లా",
    "Nellore": "నెల్లూరు జిల్లా",
    "Sri Sathya Sai": "శ్రీ సత్యసాయి జిల్లా",
    "Srikakulam": "శ్రీకాకుళం జిల్లా",
    "Tirupati": "తిరుపతి జిల్లా",
    "Visakhapatnam": "విశాఖపట్నం జిల్లా",
    "Vizianagaram": "విజయనగరం జిల్లా",
    "West Godavari": "పశ్చిమ గోదావరి జిల్లా",
    "YSR": "వైఎస్సార్ కడప జిల్లా",
    "Kadapa": "కడప జిల్లా",
}

# Major Telangana Districts
TS_DISTRICTS: Dict[str, str] = {
    "Hyderabad": "హైదరాబాద్ జిల్లా",
    "Ranga Reddy": "రంగారెడ్డి జిల్లా",
    "Medchal-Malkajgiri": "మేడ్చల్-మల్కాజ్‌గిరి జిల్లా",
    "Sangareddy": "సంగారెడ్డి జిల్లా",
    "Warangal": "వరంగల్ జిల్లా",
    "Hanamkonda": "హనుమకొండ జిల్లా",
    "Karimnagar": "కరీంనగర్ జిల్లా",
    "Khammam": "ఖమ్మం జిల్లా",
    "Nalgonda": "నల్గొండ జిల్లా",
    "Nizamabad": "నిజామాబాద్ జిల్లా",
    "Mahabubnagar": "మహబూబ్‌నగర్ జిల్లా",
    "Siddipet": "సిద్దిపేట జిల్లా",
    "Yadadri Bhuvanagiri": "యాదాద్రి భువనగిరి జిల్లా",
}

# Reverse mapping: Telugu District Name -> English District Name
TELUGU_TO_EN_DISTRICTS: Dict[str, str] = {
    v.replace(" జిల్లా", "").strip(): k for k, v in {**AP_DISTRICTS, **TS_DISTRICTS}.items()
}

# Major Andhra & Telangana Towns/Mandals mapped to default PIN and District
KNOWN_TOWNS: Dict[str, Dict[str, str]] = {
    "angara": {"en": "Angara", "te": "అంగర", "mandal_en": "Kapileswarapuram", "mandal_te": "కపిలేశ్వరపురం", "district_en": "Dr. B.R. Ambedkar Konaseema", "district_te": "కోనసీమ జిల్లా", "pincode": "533307", "state": "Andhra Pradesh"},
    "అంగర": {"en": "Angara", "te": "అంగర", "mandal_en": "Kapileswarapuram", "mandal_te": "కపిలేశ్వరపురం", "district_en": "Dr. B.R. Ambedkar Konaseema", "district_te": "కోనసీమ జిల్లా", "pincode": "533307", "state": "Andhra Pradesh"},
    "peddapuram": {"en": "Peddapuram", "te": "పెద్దాపురం", "mandal_en": "Peddapuram", "mandal_te": "పెద్దాపురం", "district_en": "Kakinada", "district_te": "కాకినాడ జిల్లా", "pincode": "533437", "state": "Andhra Pradesh"},
    "పెద్దాపురం": {"en": "Peddapuram", "te": "పెద్దాపురం", "mandal_en": "Peddapuram", "mandal_te": "పెద్దాపురం", "district_en": "Kakinada", "district_te": "కాకినాడ జిల్లా", "pincode": "533437", "state": "Andhra Pradesh"},
    "mandapeta": {"en": "Mandapeta", "te": "మండపేట", "mandal_en": "Mandapeta", "mandal_te": "మండపేట", "district_en": "Dr. B.R. Ambedkar Konaseema", "district_te": "కోనసీమ జిల్లా", "pincode": "533308", "state": "Andhra Pradesh"},
    "మండపేట": {"en": "Mandapeta", "te": "మండపేట", "mandal_en": "Mandapeta", "mandal_te": "మండపేట", "district_en": "Dr. B.R. Ambedkar Konaseema", "district_te": "కోనసీమ జిల్లా", "pincode": "533308", "state": "Andhra Pradesh"},
    "narasaraopet": {"en": "Narasaraopet", "te": "నరసరావుపేట", "mandal_en": "Narasaraopet", "mandal_te": "నరసరావుపేట", "district_en": "Palnadu", "district_te": "పల్నాడు జిల్లా", "pincode": "522601", "state": "Andhra Pradesh"},
    "నరసరావుపేట": {"en": "Narasaraopet", "te": "నరసరావుపేట", "mandal_en": "Narasaraopet", "mandal_te": "నరసరావుపేట", "district_en": "Palnadu", "district_te": "పల్నాడు జిల్లా", "pincode": "522601", "state": "Andhra Pradesh"},
    "kotappakonda": {"en": "Kotappakonda", "te": "కోటప్పకొండ", "mandal_en": "Narasaraopet", "mandal_te": "నరసరావుపేట", "district_en": "Palnadu", "district_te": "పల్నాడు జిల్లా", "pincode": "522601", "state": "Andhra Pradesh"},
    "కోటప్పకొండ": {"en": "Kotappakonda", "te": "కోటప్పకొండ", "mandal_en": "Narasaraopet", "mandal_te": "నరసరావుపేట", "district_en": "Palnadu", "district_te": "పల్నాడు జిల్లా", "pincode": "522601", "state": "Andhra Pradesh"},
    "hyderabad": {"en": "Hyderabad", "te": "హైదరాబాద్", "mandal_en": "Hyderabad", "mandal_te": "హైదరాబాద్", "district_en": "Hyderabad", "district_te": "హైదరాబాద్ జిల్లా", "pincode": "500001", "state": "Telangana"},
    "హైదరాబాద్": {"en": "Hyderabad", "te": "హైదరాబాద్", "mandal_en": "Hyderabad", "mandal_te": "హైదరాబాద్", "district_en": "Hyderabad", "district_te": "హైదరాబాద్ జిల్లా", "pincode": "500001", "state": "Telangana"},
    "hyderguda": {"en": "Hyderguda", "te": "హైదర్‌గూడ", "mandal_en": "Himayatnagar", "mandal_te": "హిమాయత్‌నగర్", "district_en": "Hyderabad", "district_te": "హైదరాబాద్ జిల్లా", "pincode": "500029", "state": "Telangana"},
    "హైదర్‌గూడ": {"en": "Hyderguda", "te": "హైదర్‌గూడ", "mandal_en": "Himayatnagar", "mandal_te": "హిమాయత్‌నగర్", "district_en": "Hyderabad", "district_te": "హైదరాబాద్ జిల్లా", "pincode": "500029", "state": "Telangana"},
    "kauthavaram": {"en": "Kauthavaram", "te": "కౌతవరం", "mandal_en": "Gudlavalleru", "mandal_te": "గుడ్లవల్లేరు", "district_en": "Krishna", "district_te": "కృష్ణా జిల్లా", "pincode": "521331", "state": "Andhra Pradesh"},
    "కౌతవరం": {"en": "Kauthavaram", "te": "కౌతవరం", "mandal_en": "Gudlavalleru", "mandal_te": "గుడ్లవల్లేరు", "district_en": "Krishna", "district_te": "కృష్ణా జిల్లా", "pincode": "521331", "state": "Andhra Pradesh"},
    "amalapuram": {"en": "Amalapuram", "te": "అమలాపురం", "mandal_en": "Amalapuram", "mandal_te": "అమలాపురం", "district_en": "Dr. B.R. Ambedkar Konaseema", "district_te": "కోనసీమ జిల్లా", "pincode": "533201", "state": "Andhra Pradesh"},
    "అమలాపురం": {"en": "Amalapuram", "te": "అమలాపురం", "mandal_en": "Amalapuram", "mandal_te": "అమలాపురం", "district_en": "Dr. B.R. Ambedkar Konaseema", "district_te": "కోనసీమ జిల్లా", "pincode": "533201", "state": "Andhra Pradesh"},
    "ravulapalem": {"en": "Ravulapalem", "te": "రావులపాలెం", "mandal_en": "Ravulapalem", "mandal_te": "రావులపాలెం", "district_en": "Dr. B.R. Ambedkar Konaseema", "district_te": "కోనసీమ జిల్లా", "pincode": "533238", "state": "Andhra Pradesh"},
    "రావులపాలెం": {"en": "Ravulapalem", "te": "రావులపాలెం", "mandal_en": "Ravulapalem", "mandal_te": "రావులపాలెం", "district_en": "Dr. B.R. Ambedkar Konaseema", "district_te": "కోనసీమ జిల్లా", "pincode": "533238", "state": "Andhra Pradesh"},
    "rajahmundry": {"en": "Rajahmundry", "te": "రాజమండ్రి", "mandal_en": "Rajahmundry Urban", "mandal_te": "రాజమండ్రి అర్బన్", "district_en": "East Godavari", "district_te": "తూర్పు గోదావరి జిల్లా", "pincode": "533101", "state": "Andhra Pradesh"},
    "రాజమండ్రి": {"en": "Rajahmundry", "te": "రాజమండ్రి", "mandal_en": "Rajahmundry Urban", "mandal_te": "రాజమండ్రి అర్బన్", "district_en": "East Godavari", "district_te": "తూర్పు గోదావరి జిల్లా", "pincode": "533101", "state": "Andhra Pradesh"},
}

# In-memory PIN Code cache
_PINCODE_CACHE: Dict[str, Dict[str, Any]] = {}


def resolve_pincode_online_or_offline(pin: str) -> Optional[Dict[str, str]]:
    """Look up 6-digit Indian PIN code using India Post API with offline fallback."""
    clean_pin = re.sub(r"\D", "", str(pin))
    if len(clean_pin) != 6:
        return None

    if clean_pin in _PINCODE_CACHE:
        return _PINCODE_CACHE[clean_pin]

    # Try online India Post API
    try:
        url = f"https://api.postalpincode.in/pincode/{clean_pin}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, timeout=3) as res:
            data = json.loads(res.read().decode("utf-8"))
            if data and data[0].get("Status") == "Success":
                po_list = data[0].get("PostOffice", [])
                if po_list:
                    po = po_list[0]
                    dist_en = po.get("District", "")
                    state = po.get("State", "")
                    taluk = po.get("Taluk") or po.get("Block") or ""
                    name = po.get("Name", "")

                    # Map district to Telugu
                    dist_te = AP_DISTRICTS.get(dist_en) or TS_DISTRICTS.get(dist_en) or f"{dist_en} జిల్లా"

                    result = {
                        "pincode": clean_pin,
                        "post_office": name,
                        "taluk": taluk,
                        "district_en": dist_en,
                        "district_te": dist_te,
                        "state": state,
                    }
                    _PINCODE_CACHE[clean_pin] = result
                    return result
    except Exception:
        pass

    # Offline Fallback based on AP & TS PIN code series
    prefix_2 = clean_pin[:2]
    prefix_3 = clean_pin[:3]

    state = "Andhra Pradesh" if prefix_2 in ("51", "52", "53") else ("Telangana" if prefix_2 == "50" else "India")
    district_en = "Andhra Pradesh"
    district_te = "ఆంధ్రప్రదేశ్"

    if prefix_3 == "500":
        district_en, district_te = "Hyderabad", "హైదరాబాద్ జిల్లా"
    elif prefix_3 in ("533", "534"):
        district_en, district_te = "Dr. B.R. Ambedkar Konaseema", "కోనసీమ జిల్లా"
    elif prefix_3 == "522":
        district_en, district_te = "Guntur / Palnadu", "గుంటూరు / పల్నాడు జిల్లా"
    elif prefix_3 in ("520", "521"):
        district_en, district_te = "Krishna", "కృష్ణా జిల్లా"
    elif prefix_3 == "530":
        district_en, district_te = "Visakhapatnam", "విశాఖపట్నం జిల్లా"

    res = {
        "pincode": clean_pin,
        "post_office": "",
        "taluk": "",
        "district_en": district_en,
        "district_te": district_te,
        "state": state,
    }
    _PINCODE_CACHE[clean_pin] = res
    return res


def standardize_andhra_telangana_address(raw_text: str, pin: Optional[str] = None) -> Tuple[str, str, Optional[str], Dict[str, Any]]:
    """
    Standardize raw address into clean Telugu and English formats,
    resolving missing Mandal, District, and PIN code.
    """
    if not raw_text:
        return "", "", pin, {}

    text_lower = raw_text.lower()

    # Look for known towns in text
    detected_town_info = None
    for kw, info in KNOWN_TOWNS.items():
        if kw in text_lower or kw in raw_text:
            detected_town_info = info
            break

    # Extract or resolve PIN
    pincode = pin
    if not pincode:
        m = re.search(r"\b([5][0-3]\d{4})\b", raw_text)
        if m:
            pincode = m.group(1)
        elif detected_town_info and detected_town_info.get("pincode"):
            pincode = detected_town_info["pincode"]

    geo_data = resolve_pincode_online_or_offline(pincode) if pincode else {}

    # Expand known abbreviations
    cleaned_te = raw_text
    abbreviations = [
        (r"\bK\.P\.\s*పురం\b", "కపిలేశ్వరపురం"),
        (r"\bK\.P\.\s*Puram\b", "Kapileswarapuram"),
        (r"\bD\.No[:\.]?", "డి.నెం:"),
        (r"\bOpp[:\.]?", "ఎదురుగా"),
        (r"\bNr[:\.]?", "సమీపంలో"),
    ]
    for pattern, repl in abbreviations:
        cleaned_te = re.sub(pattern, repl, cleaned_te, flags=re.IGNORECASE)

    # If district is not explicitly stated, enrich with resolved district
    dist_en = (geo_data.get("district_en") or (detected_town_info.get("district_en") if detected_town_info else "") or "").strip()
    dist_te = (geo_data.get("district_te") or (detected_town_info.get("district_te") if detected_town_info else "") or "").strip()

    if dist_te and dist_te not in cleaned_te:
        cleaned_te = f"{cleaned_te.rstrip(', ')}, {dist_te}"

    # Build clean English representation
    # Convert Telugu tokens to English using transliteration and known places
    en_parts = []
    if detected_town_info:
        en_parts.append(f"{detected_town_info['en']}")
        if detected_town_info.get("mandal_en"):
            en_parts.append(f"{detected_town_info['mandal_en']} Mandal")
        if dist_en:
            en_parts.append(f"{dist_en} Dist")
        if detected_town_info.get("state"):
            en_parts.append(detected_town_info["state"])
        cleaned_en = ", ".join(en_parts)
    else:
        cleaned_en = cleaned_te
        if dist_en and dist_en not in cleaned_en:
            cleaned_en = f"{cleaned_en.rstrip(', ')}, {dist_en}"

    meta = {
        "detected_town": detected_town_info.get("en") if detected_town_info else None,
        "mandal": detected_town_info.get("mandal_en") if detected_town_info else geo_data.get("taluk"),
        "district_en": dist_en,
        "district_te": dist_te,
        "state": geo_data.get("state") or (detected_town_info.get("state") if detected_town_info else "Andhra Pradesh"),
        "pincode": pincode,
    }

    return cleaned_en, cleaned_te, pincode, meta


# Comprehensive Telugu Devotee Name Lexicon with Canonical English spellings
TELUGU_DEVOTEE_LEXICON: Dict[str, str] = {
    "పట్టాభి రామయ్య": "Pattabhi Ramayya",
    "వరలక్ష్మి": "Varalakshmi",
    "ప్రసన్న": "Prasanna",
    "శ్రీ చక్రధర్": "Sri Chakradhar",
    "చక్రధర్": "Chakradhar",
    "శ్రీ వైష్ణవి": "Sri Vaishnavi",
    "వైష్ణవి": "Vaishnavi",
    "పుల్లయ్య": "Pullayya",
    "రత్నావతి": "Ratnavati",
    "నాగరాజు": "Nagaraju",
    "సుబ్బలక్ష్మి": "Subbalakshmi",
    "సాయి నాథ్ లిపిత్": "Sai Nath Lipith",
    "సాయి లక్ష్మి గాయత్రిరాజ్": "Sai Lakshmi Gayatriraj",
    "వెంకటరమణ": "Venkataramana",
    "వెంకటలక్ష్మి": "Venkatalakshmi",
    "వీర వెంకట సత్యనారాయణ": "Veera Venkata Satyanarayana",
    "కనకమహాలక్ష్మి": "Kanakamahalakshmi",
    "వీర వెంకట సుబ్రహ్మణ్యం": "Veera Venkata Subrahmanyam",
    "పార్వతి": "Parvati",
    "వినయ నాగదుర్గ వెంకట సాయి సూరి": "Vinaya Nagadurga Venkata Sai Soori",
    "నాగదుర్గ విశ్వనాథ్": "Nagadurga Viswanath",
    "నాగేశ్వర రావు": "Nageswara Rao",
    "సత్యవేణి": "Satyaveni",
    "పవన్ నాగ వర భద్ర సంతోష్": "Pavan Naga Vara Bhadra Santosh",
    "భరత్ నాగ సాయి ఈశ్వర వసంత్": "Bharat Naga Sai Eswara Vasant",
    "మహాలక్ష్మి": "Mahalakshmi",
    "శ్రీనివాసు": "Srinivasu",
    "శ్రీనివాసులు": "Srinivasulu",
    "సత్యవాణి": "Satyavani",
    "జయప్రలక్ష్మి సరళ": "Jayapralakshmi Sarala",
    "శ్రీ సాయి సునీల్": "Sri Sai Sunil",
    "నాగ వెంకట కృష్ణ": "Naga Venkata Krishna",
    "హేమచంద్ర మల్లికార్జున రావు": "Hemachandra Mallikarjuna Rao",
    "సుబ్రహ్మణ్యం": "Subrahmanyam",
    "సత్యవతి": "Satyavati",
    "శ్రీనివాస్": "Srinivas",
    "నమశ్శివాయ": "Namahsivaya",
    "రత్నకుమారి": "Ratnakumari",
    "రామ్‌కుమార్": "Ramkumar",
    "పద్మావతి": "Padmavati",
    "కియాన్ష్": "Kiyansh",
    "అయాన్ష్": "Ayansh",
    "సర్వోత్తం": "Sarvotham",
    "శ్వేత": "Shwetha",
    "అక్షర": "Akshara",
    "అభిరామ్": "Abhiram",
    "నుపూర్తి": "Nupurti",
    "రామారావు": "Rama Rao",
    "వెంకటేశ్వర రావు": "Venkateswara Rao",
}


def resolve_canonical_telugu_name(name_str: str) -> Tuple[str, str]:
    """
    Look up canonical Telugu and English representations from the devotee lexicon.
    Returns (english_name, telugu_name).
    """
    clean_name = name_str.strip()
    if clean_name in TELUGU_DEVOTEE_LEXICON:
        return TELUGU_DEVOTEE_LEXICON[clean_name], clean_name

    # Check reverse
    for te, en in TELUGU_DEVOTEE_LEXICON.items():
        if en.lower() == clean_name.lower():
            return en, te

    from backend.pipeline.transliterate import is_telugu, transliterate_te_to_en, transliterate_en_to_te

    # Substring check for compound names
    for te, en in TELUGU_DEVOTEE_LEXICON.items():
        if te in clean_name:
            return transliterate_te_to_en(clean_name), clean_name
        if en.lower() in clean_name.lower():
            return clean_name, te

    # If input is in Telugu script, ALWAYS transliterate to proper English for english_name!
    if is_telugu(clean_name):
        return transliterate_te_to_en(clean_name), clean_name

    # If input is English, transliterate to Telugu
    return clean_name, transliterate_en_to_te(clean_name)
