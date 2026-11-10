import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import openpyxl
from rapidfuzz import fuzz, process
from backend.pipeline.schemas import GothramPick


def phonetic_norm(s: str) -> str:
    """Phonetic normalization so spelling variants of the same Telugu name collide."""
    if not s:
        return ""
    s = re.sub(r"[^A-Z]", "", str(s).upper())
    s = s.replace("W", "V").replace("Z", "J")
    s = re.sub(r"([TDKGBP])H", r"\1", s)  # TH->T, DH->D, KH->K, BH->B, GH->G, PH->P
    s = s.replace("EE", "I").replace("OO", "U").replace("AA", "A")
    return re.sub(r"(.)\1+", r"\1", s)    # collapse double letters


class GothramResolver:
    def __init__(self, excel_path_or_list: Optional[Any] = None):
        self.gothrams: List[str] = []
        self._norm_gothrams: List[str] = []

        if isinstance(excel_path_or_list, list):
            self.gothrams = sorted(set(g.strip().upper() for g in excel_path_or_list if g))
        else:
            path = Path(excel_path_or_list or "Gothrams-Surname List.xlsx")
            if path.is_file():
                wb = openpyxl.load_workbook(path, read_only=True)
                ws = wb.active
                rows = list(ws.iter_rows(min_row=2, values_only=True))
                wb.close()
                raw = {str(r[1]).strip().upper() for r in rows if r and len(r) > 1 and r[1] and str(r[1]).strip() != "#N/A"}
                self.gothrams = sorted(raw)

        self._norm_gothrams = [phonetic_norm(g) for g in self.gothrams]

    def get_candidates(self, readings: List[str], top_k: int = 40) -> List[Tuple[str, float]]:
        """Retrieve closest reference-list entries for the given OCR readings, handling both Telugu & English."""
        if not self.gothrams:
            return []

        from backend.pipeline.transliterate import is_telugu, transliterate_te_to_en, GOTHRAM_TE_TO_EN

        best_matches: Dict[int, float] = {}

        for query in readings:
            if not query or not query.strip():
                continue
            clean_q = query.strip()

            # 1. Direct Telugu Gothram lookup
            if is_telugu(clean_q):
                if clean_q in GOTHRAM_TE_TO_EN:
                    en_name = GOTHRAM_TE_TO_EN[clean_q]
                    if en_name in self.gothrams:
                        idx = self.gothrams.index(en_name)
                        best_matches[idx] = 100.0
                # Transliterate Telugu to English
                en_query = transliterate_te_to_en(clean_q).upper()
            else:
                en_query = clean_q.upper()

            # 2. Fuzzy match English against exact reference list
            for match_name, score, idx in process.extract(en_query, self.gothrams, scorer=fuzz.ratio, limit=top_k):
                best_matches[idx] = max(best_matches.get(idx, 0.0), score)

            # 3. Phonetic match for spelling variations
            nq = phonetic_norm(en_query)
            if nq:
                for _, score, idx in process.extract(nq, self._norm_gothrams, scorer=fuzz.ratio, limit=top_k):
                    best_matches[idx] = max(best_matches.get(idx, 0.0), score)

        top_sorted = sorted(best_matches.items(), key=lambda x: -x[1])[:top_k]
        return [(self.gothrams[idx], round(score, 1)) for idx, score in top_sorted]

    def build_gothram_prompt(
        self,
        readings: List[str],
        candidates: List[Tuple[str, float]],
        include_full_list: bool = False
    ) -> str:
        """Construct the prompt sent to Gemini for resolving gothram."""
        cands_str = ", ".join(f"{name} ({score:.0f}%)" for name, score in candidates) or "none"

        rules = (
            "CRITICAL INSTRUCTIONS FOR GOTHRAM IDENTIFICATION:\n"
            "1. The Sri Trikoteswara Swamy Devasthanam strictly uses the standardized English spelling from the 2,099 Reference Gothram Master List for Sankalpam registers.\n"
            "2. Telugu handwriting often uses regional phonetic spellings (e.g. 'పైడిపాల' -> PAIDIPALA, 'పైడిపల్లి' -> PAIDIPALLI, 'కాశ్యప' -> KASHYAPA, 'భరద్వాజ' -> BHARADWAJA, 'హరితస' -> HARITASA).\n"
            "3. If the handwritten strokes in the crop correspond to one of the reference candidates below, you MUST select that candidate as list_match, set final to that list entry, and set matched_in_list=true with confidence='high'.\n"
            "4. Provide the top alternative candidates in other_possible_list_matches."
        )

        prompt = (
            f"Identify the handwritten Hindu GOTHRAM on this temple receipt slip (located next to 'గోత్రము' / 'Gothram').\n\n"
            f"Extracted readings from earlier passes: {readings}\n"
            f"Top Candidates from 2,099 Devasthanam Gothram Master: {cands_str}\n\n"
            f"{rules}"
        )
        return prompt
