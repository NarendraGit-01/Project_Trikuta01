# Technical Decisions Log

## Decision Register

Each decision is numbered for reference. Status: **DECIDED** (implemented), **PROPOSED** (awaiting approval), **DEFERRED** (postponed).

---

### D-001: Python Version
**Status**: PROPOSED  
**Decision**: Use Python 3.12 for the project, not 3.14  
**Rationale**: Python 3.14.3 is the system default but is very new (released 2026). Several dependencies (OpenCV, LangChain) may not yet have stable wheels for 3.14. Python 3.12 is available via uv and has mature ecosystem support. The prompt specifies "Python 3.11+".  
**Risk**: Low. Can upgrade to 3.14 later when ecosystem catches up.  
**Alternative**: Use 3.14 and build from source if wheels missing. Higher risk of build failures.

---

### D-002: Virtual Environment Tool
**Status**: PROPOSED  
**Decision**: Use `uv` for virtual environment and package management  
**Rationale**: `uv` is already installed (v0.11.8). It's faster than pip and supports Python version pinning. No conda available.  
**Risk**: Low. uv is stable and widely adopted.

---

### D-003: Primary OCR Model
**Status**: PROPOSED  
**Decision**: Use `gemini-3.5-flash` (or latest available flash) as the primary OCR model, NOT flash-lite  
**Rationale**: The existing flash-lite output shows incorrect names and addresses. Flash-lite is optimized for speed/cost, not complex handwriting recognition. For a temple receipt where wrong names have real consequences, accuracy must take priority over cost. The ~₹3-5 additional cost per receipt is acceptable.  
**Risk**: Medium. Actual accuracy improvement needs to be measured via evaluation. Higher API cost.  
**Measurement**: Will be validated in baseline evaluation (run all samples with flash vs flash-lite).

---

### D-004: Rotation Detection Approach
**Status**: PROPOSED  
**Decision**: Use Gemini (thumbnail) + aspect ratio heuristic for rotation detection  
**Rationale**: 2 of 11 sample images (18%) are 180° upside down without EXIF correction. EXIF-only detection is insufficient. Content-based detection via Gemini on a small thumbnail is cheap (~$0.001) and reliable. Aspect ratio heuristic (if height > width after EXIF, likely needs 90° rotation) handles the simple case without an API call.  
**Risk**: Low. Gemini can reliably detect text orientation.

---

### D-005: Bounding Box Convention
**Status**: DECIDED  
**Decision**: Preserve the existing `[ymin, xmin, ymax, xmax]` normalized 0-1000 convention  
**Rationale**: The existing `crop_from_box()` function works correctly with this convention. Changing it would require updating all prompts and parsing logic with no functional benefit.  
**Risk**: None.

---

### D-006: Receipt Number Uniqueness Policy
**Status**: PROPOSED  
**Decision**: Receipt numbers are unique within the same temple + year combination. Store `receipt_no` + `receipt_year` as a compound key. Allow configurable uniqueness scope.  
**Rationale**: The prompt explicitly says "Do not assume all receipt numbers are globally unique across different receipt series or years." The sample receipts show sequential numbers (5810-5817) but numbers likely reset annually.  
**Risk**: Low. Overly strict uniqueness would reject valid records. Compound key is safe.  
**Note**: Need to verify with user whether receipts from multiple temples will be processed.

---

### D-007: Database Starting with SQLite
**Status**: DECIDED  
**Decision**: Use SQLite for development with SQLAlchemy ORM, designed for PostgreSQL migration  
**Rationale**: Per the prompt. SQLite is simpler for local development. SQLAlchemy abstracts the differences. UTF-8 Telugu storage works in both.  
**Risk**: Low. Well-documented migration path.

---

### D-008: Frontend Framework
**Status**: DECIDED  
**Decision**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui  
**Rationale**: Per the prompt specification. shadcn/ui provides accessible, customizable components with good mobile support.  
**Risk**: Low.

---

### D-009: Image Storage Abstraction
**Status**: PROPOSED  
**Decision**: Use a `StorageBackend` abstract class with `LocalStorageBackend` initially  
**Rationale**: The prompt requires local storage now with S3-compatible later. An abstraction layer makes migration painless.  
**Risk**: Low.  
**Interface**:
```python
class StorageBackend(ABC):
    async def save(self, file: UploadFile, path: str) -> str: ...
    async def get(self, path: str) -> bytes: ...
    async def get_url(self, path: str, expires: int) -> str: ...
    async def delete(self, path: str) -> None: ...
```

---

### D-010: Gothram Reference Data Cleanup
**Status**: PROPOSED  
**Decision**: Clean the Excel data during import: remove `#N/A`, normalize whitespace, handle entries with parentheses/slashes by splitting into primary + variant. Keep original values in a `raw_value` column.  
**Rationale**: 66 of 2100 gothrams have non-standard formatting. Cleaning improves fuzzy matching without losing information.  
**Risk**: Low. Original data preserved.

---

### D-011: Ground Truth Verification
**Status**: PROPOSED  
**Decision**: The 11 ground truth JSON files I created in `evals/expected/` are **preliminary** — they need human verification before being used as evaluation benchmarks  
**Rationale**: I read the handwriting from 800px-wide thumbnails. Some Telugu names and addresses may be incorrect. The prompt explicitly requires "Expected values must be independently verified by a human."  
**Action Required**: User to verify each `.expected.json` file against the original receipt images.

---

### D-012: API Key Management
**Status**: DECIDED  
**Decision**: Use `.env` file for local development, environment variables for production. Never in code or frontend.  
**Rationale**: Per the prompt. Standard practice.

---

### D-013: Preserve V1 Notebook and Archive
**Status**: DECIDED  
**Decision**: Keep the `Archive/` folder intact. Do not delete or modify V1 notebook.  
**Rationale**: Historical reference. V1 contains EasyOCR/Tesseract approaches that may be useful for offline fallback investigation later.

---

### D-014: Telugu Font Selection
**Status**: DECIDED  
**Decision**: Noto Sans Telugu for Telugu, Noto Sans for English  
**Rationale**: Per the prompt. Noto Sans Telugu has excellent conjunct and vowel mark support. Free and widely available.

---

### D-015: Cost Tracking Architecture  
**Status**: PROPOSED  
**Decision**: Move pricing data to a configuration file (`config/pricing.yaml`), not hardcoded in source. Do not hardcode exchange rates — fetch from config or make user-configurable in admin.  
**Rationale**: Model pricing changes frequently. The current `PRICING` dict has only 4 models. Exchange rates fluctuate.

---

### D-016: Duplicate Receipt Images
**Status**: NOTED  
**Decision**: sample_img2, sample_img3, and sample_img9 are photographs of the same receipt (#5815). All three should be kept as separate evaluation samples (they test different photo angles/conditions).  
**Rationale**: Testing OCR on the same receipt with different image quality/orientation validates robustness.

---

## Pending Questions for User

1. **D-006**: Will receipts from multiple temples ever be processed in this system, or is it exclusively Kotappakonda?
2. **D-011**: Can you verify the ground truth files in `evals/expected/`? They need human confirmation before benchmarking.
3. **D-003**: Are you comfortable with ~₹8-12 per receipt API cost if it significantly improves accuracy?
