import re
from typing import Dict, List, Tuple

# Telugu Unicode range: 0x0C00 - 0x0C7F
TELUGU_RANGE = re.compile(r"[\u0C00-\u0C7F]")

def is_telugu(text: str) -> bool:
    """Returns True if text contains Telugu Unicode characters."""
    if not text:
        return False
    return bool(TELUGU_RANGE.search(str(text)))

# Telugu Vowels to English
TE_VOWELS: Dict[str, str] = {
    'అ': 'a', 'ఆ': 'aa', 'ఇ': 'i', 'ఈ': 'ee', 'ఉ': 'u', 'ఊ': 'oo',
    'ఋ': 'ru', 'ఎ': 'e', 'ఏ': 'e', 'ఐ': 'ai', 'ఒ': 'o', 'ఓ': 'o', 'ఔ': 'au',
}

# Telugu Matras (vowel signs) to English
TE_MATRAS: Dict[str, str] = {
    'ా': 'aa', 'ి': 'i', 'ీ': 'ee', 'ు': 'u', 'ూ': 'oo',
    'ృ': 'ru', 'ె': 'e', 'ే': 'e', 'ై': 'ai', 'ొ': 'o', 'ో': 'o', 'ౌ': 'au',
    'ం': 'n', 'ః': 'h', '్': '',
}

# Telugu Consonants to English
TE_CONSONANTS: Dict[str, str] = {
    'క': 'k', 'ఖ': 'kh', 'గ': 'g', 'ఘ': 'gh', 'ఙ': 'ng',
    'చ': 'ch', 'ఛ': 'chh', 'జ': 'j', 'ఝ': 'jh', 'ఞ': 'ny',
    'ట': 't', 'ఠ': 'th', 'డ': 'd', 'ఢ': 'dh', 'ణ': 'n',
    'త': 't', 'థ': 'th', 'ద': 'd', 'ధ': 'dh', 'న': 'n',
    'ప': 'p', 'ఫ': 'ph', 'బ': 'b', 'భ': 'bh', 'మ': 'm',
    'య': 'y', 'ర': 'r', 'ల': 'l', 'వ': 'v', 'శ': 'sh',
    'ష': 'sh', 'స': 's', 'హ': 'h', 'ళ': 'l', 'క్ష': 'ksh', 'ఱ': 'r',
}

# Common Telugu Words / Devotee Names Dictionary
DEVOTEE_NAME_MAP: Dict[str, str] = {
    "వెంకటరమణ": "Venkataramana",
    "వెంకటలక్ష్మి": "Venkatalakshmi",
    "వెంకటసత్యనారాయణ": "Venkata Satyanarayana",
    "వెంకట సత్యనారాయణ": "Venkata Satyanarayana",
    "కనకమహాలక్ష్మి": "Kanakamahalakshmi",
    "వీరవెంకటప్రభువుణం": "Veera Venkata Prabhuvanam",
    "వీరవెంకట ప్రభువుణం": "Veera Venkata Prabhuvanam",
    "వీర వెంకట సుబ్రహ్మణ్యం": "Veera Venkata Subrahmanyam",
    "వీరవెంకట సుబ్రహ్మణ్యం": "Veera Venkata Subrahmanyam",
    "పట్టాభిరామయ్య": "Pattabhi Ramayya",
    "పట్టాభి రామయ్య": "Pattabhi Ramayya",
    "వరలక్ష్మి": "Varalakshmi",
    "వరలక్ష్మి (ప్రసన్న)": "Varalakshmi (Prasanna)",
    "ప్రసన్న": "Prasanna",
    "శ్రీ చక్రధర్": "Sri Chakradhar",
    "చక్రధర్": "Chakradhar",
    "శ్రీ వైష్ణవి": "Sri Vaishnavi",
    "వైష్ణవి": "Vaishnavi",
    "పుల్లయ్య": "Pullayya",
    "రత్నావతి": "Ratnavati",
    "నాగరాజు": "Nagaraju",
    "సుబ్బలక్ష్మి": "Subbalakshmi",
    "లక్ష్మి": "Lakshmi",
    "రమేష్ బాబు": "Ramesh Babu",
    "సత్యనారాయణ": "Satyanarayana",
    "పార్వతి": "Parvati",
    "శ్రీనివాస రావు": "Srinivasa Rao",
    "శ్రీనివాసు": "Srinivasu",
    "నాగేశ్వర రావు": "Nageswara Rao",
    "మహాలక్ష్మి": "Mahalakshmi",
    "సత్యవతి": "Satyavati",
    "రామారావు": "Rama Rao",
    "వెంకటేశ్వర రావు": "Venkateswara Rao",
}

# Common Gothrams Telugu <-> English Map
GOTHRAM_TE_TO_EN: Dict[str, str] = {
    "పైడిపాల": "PAIDIPALA",
    "పైడిపల్లి": "PAIDIPALLI",
    "పైడిపిల్లి": "PAIDIPALLI",
    "పెడుపల్ల": "PAIDIPALLI",
    "పెడిపల్లి": "PAIDIPALLI",
    "కౌశిక": "KAUSHIKA",
    "కాశ్యప": "KASHYAPA",
    "కశ్యప": "KASHYAPA",
    "భరద్వాజ": "BHARADWAJA",
    "వశిష్ట": "VASHISHTA",
    "వసిష్ట": "VASHISHTA",
    "గౌతమ": "GAUTAMA",
    "ఆత్రేయ": "ATREYA",
    "హరితస": "HARITASA",
    "హరిత": "HARITASA",
    "శ్రీవత్స": "SRIVATSA",
    "శ్రీవత్సస": "SRIVATSA",
    "మౌద్గల్య": "MAUDGALYA",
    "జామదగ్ని": "JAMADAGNI",
    "శాండిల్య": "SHANDILYA",
    "పరాశర": "PARASHARA",
    "విశ్వామిత్ర": "VISHVAMITRA",
    "అగస్త్య": "AGASTYA",
    "సాంఖ్యాయన": "SANKHYAYANA",
    "వత్స": "VATSA",
    "ఇనపనూరి": "INAPANURI",
    "ముద్గల": "MUDGALA",
    "కుండిన": "KUNDINA",
    "కౌండిన్య": "KOUNDINYA",
    "ఆంగీరస": "ANGIRASA",
    "ధనుంజయ": "DHANANJAYA",
    "ధనంజయ": "DHANANJAYA",
    "ఉపమన్యవ": "UPAMANYAVA",
    "కపిల": "KAPILA",
    "కౌత్స్య": "KAUTSA",
}

def transliterate_te_to_en(text: str) -> str:
    """
    Convert Telugu text to readable English (Latin) script.
    Checks known dictionary first, then falls back to phonetic character transliteration.
    """
    if not text or not text.strip():
        return ""

    clean = text.strip()

    # 1. Exact match in devotee lexicon
    if clean in DEVOTEE_NAME_MAP:
        return DEVOTEE_NAME_MAP[clean]

    # 2. Exact match in Gothram map
    if clean in GOTHRAM_TE_TO_EN:
        return GOTHRAM_TE_TO_EN[clean]

    if not is_telugu(clean):
        return clean

    # 3. Phonetic letter-by-letter transliteration
    out: List[str] = []
    i = 0
    n = len(clean)

    while i < n:
        c = clean[i]
        nxt = clean[i + 1] if i + 1 < n else ''

        if c in TE_VOWELS:
            out.push(TE_VOWELS[c]) if hasattr(out, 'push') else out.append(TE_VOWELS[c])
        elif c in TE_CONSONANTS:
            base = TE_CONSONANTS[c]
            if nxt == '్':
                # Virama (half-letter)
                out.append(base)
                i += 1  # skip halant
            elif nxt in TE_MATRAS:
                out.append(base + TE_MATRAS[nxt])
                i += 1  # skip matra
            else:
                out.append(base + 'a')
        elif c in TE_MATRAS:
            out.append(TE_MATRAS[c])
        else:
            out.append(c)
        i += 1

    result = "".join(out)
    # Clean up double 'a's at the end of names: e.g. "Venkataramanaa" -> "Venkataramana"
    result = re.sub(r"aa$", "a", result)
    # Capitalize each word
    return result.title()


# English to Telugu transliteration mappings
EN_TO_TE_VOWELS = {
    'aa': 'ఆ', 'ai': 'ఐ', 'au': 'ఔ', 'ee': 'ఈ', 'ii': 'ఈ',
    'oo': 'ఊ', 'uu': 'ఊ', 'ou': 'ఔ',
    'a': 'అ', 'i': 'ఇ', 'u': 'ఉ', 'e': 'ఎ', 'o': 'ఒ',
}

EN_TO_TE_MATRAS = {
    'aa': 'ా', 'ai': 'ై', 'au': 'ౌ', 'ee': 'ీ', 'ii': 'ీ',
    'oo': 'ూ', 'uu': 'ూ', 'ou': 'ౌ',
    'a': '', 'i': 'ి', 'u': 'ు', 'e': 'ె', 'o': 'ొ',
}

EN_TO_TE_CONSONANTS = {
    'ksh': 'క్ష', 'kh': 'ఖ', 'gh': 'ఘ', 'ng': 'ఙ', 'ch': 'చ', 'jh': 'ఝ',
    'th': 'థ', 'dh': 'ధ', 'ph': 'ఫ', 'bh': 'భ', 'sh': 'శ',
    'k': 'క', 'g': 'గ', 'c': 'క', 'j': 'జ', 't': 'త',
    'd': 'డ', 'n': 'న', 'p': 'ప', 'b': 'బ', 'm': 'మ',
    'y': 'య', 'r': 'ర', 'l': 'ల', 'v': 'వ', 'w': 'వ',
    's': 'స', 'h': 'హ', 'f': 'ఫ', 'z': 'జ',
}


def transliterate_en_to_te(text: str) -> str:
    """
    Convert English (Latin) text to readable Telugu script.
    Checks reverse dictionary first, then falls back to phonetic syllable mapping.
    """
    if not text or not text.strip():
        return ""
    clean = text.strip()
    if is_telugu(clean):
        return clean

    # 1. Reverse lookup in Devotee dictionary
    for te, en in DEVOTEE_NAME_MAP.items():
        if en.lower() == clean.lower():
            return te

    # 2. Word by word transliteration
    words = clean.split()
    converted_words = []
    for w in words:
        # Check reverse dictionary for individual word
        matched = False
        for te, en in DEVOTEE_NAME_MAP.items():
            if en.lower() == w.lower():
                converted_words.append(te)
                matched = True
                break
        if matched:
            continue

        s = w.lower()
        res = []
        i = 0
        pending_cons = ""

        while i < len(s):
            # Check 2-letter vowel
            vowel_key = None
            if i + 1 < len(s) and s[i:i+2] in EN_TO_TE_VOWELS:
                vowel_key = s[i:i+2]
            elif s[i] in EN_TO_TE_VOWELS:
                vowel_key = s[i]

            if vowel_key:
                if pending_cons:
                    res.append(pending_cons + EN_TO_TE_MATRAS.get(vowel_key, ""))
                    pending_cons = ""
                else:
                    res.append(EN_TO_TE_VOWELS[vowel_key])
                i += len(vowel_key)
                continue

            # Check consonants
            cons_key = None
            for clen in (3, 2, 1):
                sub = s[i:i+clen]
                if sub in EN_TO_TE_CONSONANTS:
                    cons_key = sub
                    break

            if cons_key:
                te_c = EN_TO_TE_CONSONANTS[cons_key]
                if pending_cons:
                    res.append(pending_cons + '్')
                pending_cons = te_c
                i += len(cons_key)
                continue

            if pending_cons:
                res.append(pending_cons)
                pending_cons = ""
            res.append(s[i])
            i += 1

        if pending_cons:
            res.append(pending_cons)
        converted_words.append("".join(res))

    return " ".join(converted_words)

