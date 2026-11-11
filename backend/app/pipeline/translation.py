import logging
from typing import Optional

try:
    from langdetect import detect, LangDetectException
    HAS_LANGDETECT = True
except Exception:
    HAS_LANGDETECT = False

from backend.app.core.config import settings
from backend.pipeline.run import get_gemini_client
from backend.pipeline.schemas import PipelineResult, Person

logger = logging.getLogger(__name__)

def _detect_language(text: str) -> Optional[str]:
    """Return a two-letter language code ('en' or 'te') if detectable.
    Uses pure Unicode block detection for speed & zero-dependency reliability.
    """
    if not text or not isinstance(text, str):
        return None
    # Check for Telugu Unicode block (\u0C00 - \u0C7F)
    if any("\u0C00" <= ch <= "\u0C7F" for ch in text):
        return "te"
    # Otherwise check for English Latin letters
    if any(ch.isalpha() and ord(ch) < 128 for ch in text):
        return "en"
    if HAS_LANGDETECT:
        try:
            lang = detect(text)
            if lang.startswith("en"):
                return "en"
            if lang.startswith("te"):
                return "te"
        except Exception:
            pass
    return None

def _translate_with_gemini(text: str, target_lang: str) -> str:
    """Translate *text* to *target_lang* ('en' or 'te') using Gemini.
    Simple prompt – Gemini will return the translated string.
    """
    llm = get_gemini_client()
    if target_lang == 'en':
        prompt = f"Translate the following Telugu text to proper English spelling, preserving proper names: {text}"
    else:
        prompt = f"Translate the following English text to Telugu, preserving proper names: {text}"
    response = llm.invoke([{"role": "user", "content": prompt}])
    return getattr(response, "content", str(response)).strip()

def _normalize_name(name: str, source_lang: str) -> str:
    """Normalize a name using Gemini to a clean English spelling.
    For Telugu source, ask Gemini to give the canonical English version.
    For English source, we can just return the name.
    """
    llm = get_gemini_client()
    if source_lang == 'te':
        prompt = f"Give the canonical English spelling for the Telugu name '{name}'."
        response = llm.invoke([{"role": "user", "content": prompt}])
        return getattr(response, "content", str(response)).strip()
    return name

def apply_translation(result: PipelineResult) -> PipelineResult:
    """Detect language of extracted fields and fill bilingual equivalents.
    Safely non-blocking — skips gracefully on any error or translation timeout.
    """
    try:
        # Address
        if getattr(result, "address", None):
            lang = _detect_language(result.address)
            if lang == 'te' and not getattr(result, "address_en", None):
                result.address_en = _translate_with_gemini(result.address, target_lang='en')
            elif lang == 'en' and not getattr(result, "address_te", None):
                result.address_te = _translate_with_gemini(result.address, target_lang='te')
        # Gothram final
        if getattr(result, "gothram_final", None):
            lang = _detect_language(result.gothram_final)
            if lang == 'te' and not getattr(result, "gothram_en", None):
                result.gothram_en = _translate_with_gemini(result.gothram_final, target_lang='en')
            elif lang == 'en' and not getattr(result, "gothram_te", None):
                result.gothram_te = _translate_with_gemini(result.gothram_final, target_lang='te')
        # People – given_name / surname handling
        for person in getattr(result, "people", []):
            # given name
            if getattr(person, "given_name", None):
                g_lang = _detect_language(person.given_name)
                if g_lang == 'te' and not getattr(person, "given_name_en", None):
                    person.given_name_en = _normalize_name(person.given_name, source_lang='te')
                elif g_lang == 'en' and not getattr(person, "given_name_te", None):
                    person.given_name_te = _translate_with_gemini(person.given_name, target_lang='te')
            # surname
            if getattr(person, "surname", None):
                s_lang = _detect_language(person.surname)
                if s_lang == 'te' and not getattr(person, "surname_en", None):
                    person.surname_en = _normalize_name(person.surname, source_lang='te')
                elif s_lang == 'en' and not getattr(person, "surname_te", None):
                    person.surname_te = _translate_with_gemini(person.surname, target_lang='te')
    except Exception as e:
        logger.warning(f"Translation step skipped due to exception: {e}")
    return result
