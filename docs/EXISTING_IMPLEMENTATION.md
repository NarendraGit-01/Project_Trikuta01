# Existing Implementation Analysis

## 1. Project Overview

**Project**: Temple Receipt OCR — Trikuta OCR  
**Temple**: శ్రీ త్రికోటేశ్వర స్వామి వారి దేవస్థానము (Sri Trikoteswara Swami Devasthanam), Kotappakonda  
**Purpose**: Extract handwritten information from abhishekam booking receipts  
**Current State**: Jupyter notebook prototype (V2), no web application, no database, no tests  

---

## 2. Project File Inventory

```
Proj_Trikuta_OCR/
├── telugu_english_handwriting_ocr -V2.ipynb    (9.6 MB — active notebook with outputs)
├── Gothrams-Surname List.xlsx                   (197 KB — reference data)
├── Reference Images/
│   ├── sample_img.jpeg      (335 KB,  1265×866,  EXIF=1)
│   ├── sample_img2.jpeg     (1.2 MB,  2766×1844, EXIF=1)
│   ├── sample_img3.jpeg     (2.5 MB,  1844×4096, EXIF=8)   ← needs 90° CW
│   ├── sample_img4.jpeg     (3.2 MB,  4096×1844, EXIF=1)
│   ├── sample_img5.jpeg     (1.6 MB,  1844×4096, EXIF=8)   ← needs 90° CW
│   ├── sample_img6.jpeg     (3.2 MB,  4096×1844, EXIF=1)
│   ├── sample_img7.jpeg     (1.5 MB,  4096×1844, EXIF=1)
│   ├── sample_img8.jpeg     (3.4 MB,  4096×1844, EXIF=1)
│   ├── sample_img9.jpeg     (3.2 MB,  4096×1844, EXIF=1)
│   ├── sample_img10.jpeg    (3.2 MB,  1844×4096, EXIF=1)   ← 180° UPSIDE DOWN
│   └── sample_img11.jpeg    (3.4 MB,  1844×4096, EXIF=1)   ← 180° UPSIDE DOWN
├── Archive/
│   ├── telugu_english_handwriting_ocr.ipynb     (V1 notebook — EasyOCR/Tesseract/Claude)
│   ├── ocr_gemini.json                          (V2 output for sample_img7)
│   ├── 390944742-GotraList.txt                  (273 lines — smaller reference)
│   └── 512595141-Kapu-Sirnames-and-Gothralu.txt (5727 lines — older reference)
```

---

## 3. Notebook V2 Architecture (22 cells)

### Cell Map

| Cell | Type | Purpose | Status |
|------|------|---------|--------|
| 0 | markdown | Header (mentions EasyOCR/Tesseract/Claude — **outdated**) | Stale docs |
| 1-2 | markdown/code | Install dependencies (all commented out) | OK |
| 3-6 | markdown/code | Old EasyOCR setup (all commented out) | Dead code |
| 7-8 | code | Google GenAI client, model listing | Working |
| 9 | code | **Main setup**: imports, model discovery, LLM init | Working |
| 10 | code | Commented `os.listdir()` | Dead code |
| 11 | code | **GothramRef** class, phonetic `norm()`, RapidFuzz | Working |
| 12 | code | **Image loading**: `resolve_image()`, `prepare_image()`, `to_b64()` | Working |
| 13 | code | **Pydantic schemas** + helpers + cost tracking | Working |
| 14 | code | **Pass 1**: Full-image transcription | Working |
| 15 | code | **Pass 2**: Structured extraction (Receipt schema) | Working |
| 16 | code | **Pass 3**: Handwriting crop + zoom re-read | Working |
| 17 | code | **Pass 4**: Gothram resolution (tiered) | Working |
| 18 | code | **Pass 5**: Cross-validation + final output | Working |
| 19-21 | code | Empty cells | — |

### Data Flow

```
IMAGE_PATH
  → resolve_image() → prepare_image() → to_b64()
  → Pass 1: Transcription (full image, free-text)
  → Pass 2: Structured Extraction (full image → Receipt schema + bounding box)
  → crop_from_box() → upscale to ~2000px → to_b64(crop)
  → Pass 3: Zoom Re-read (cropped handwriting → HW schema)
  → Pass 4: Gothram Resolution
       → GothramRef.candidates() [RapidFuzz, TOP_K=40]
       → ask_gothram(full_list=False) → GothramPick schema
       → Escalate if confidence ≠ "high" OR best_score < 85
       → ask_gothram(full_list=True) → GothramPick schema
  → Pass 5: Cross-validation
       → Compare phones, address, pincode, gothram, names between passes
       → Build NEEDS_HUMAN_CHECK list
       → Final JSON output → ocr_gemini.json
```

---

## 4. Pydantic Schemas

### Person
```python
class Person(BaseModel):
    given_name: str   # First/given name exactly as written
    surname: str      # Surname exactly as written, letter by letter
```

### HW (Handwriting extraction)
```python
class HW(BaseModel):
    gothram_readings: List[str]      # 1-3 plausible spellings
    people: List[Person]
    address: Optional[str]
    pincode: Optional[str]
    phones: List[str]                # ALL handwritten phone numbers
    uncertain_fields: List[str]
```

### Receipt (extends HW)
```python
class Receipt(HW):
    receipt_no: Optional[str]
    date: Optional[str]
    abhishekam_from: Optional[str]
    abhishekam_to: Optional[str]
    amount_rupees: Optional[str]
    temple_name: Optional[str]
    handwriting_box_2d: List[int]    # [ymin, xmin, ymax, xmax] normalized 0-1000
```

### GothramPick
```python
class GothramPick(BaseModel):
    as_written: str
    final: str
    matched_in_list: bool
    list_match: Optional[str]
    other_possible_list_matches: List[str]  # up to 3
    confidence: str                          # high/medium/low
    reason: str
```

---

## 5. Key Functions

### Image Processing
- **`prepare_image(path, max_side=3000)`** — Opens image, applies `ImageOps.exif_transpose()`, resizes if > 3000px. Returns PIL Image.
- **`to_b64(img, q=95)`** — Converts PIL Image to base64-encoded JPEG string.
- **`crop_from_box(img, box, pad=0.03)`** — Crops using normalized [ymin,xmin,ymax,xmax] (0-1000). Validates box area ≥ 5%. Upscales crop to ~2000px on longest side using LANCZOS.

### Gothram Matching
- **`norm(s)`** — Phonetic normalization: uppercase, strip non-alpha, W→V, Z→J, aspirate collapse (TH→T, DH→D, KH→K), vowel normalization (EE→I, OO→U, AA→A), double-letter collapse.
- **`GothramRef.__init__(xlsx)`** — Loads column B (Gothram), deduplicates via `set()`, sorts, pre-normalizes all entries.
- **`GothramRef.candidates(readings, k=12)`** — Takes multiple OCR readings, normalizes each, runs `process.extract()` with `fuzz.ratio`, merges by max score, returns top-k `(gothram, score)` tuples.

### Validation
- **`clean_phone(p)`** — Strips non-digits, removes +91 prefix (12→10 digits), removes leading 0 (11→10 digits).
- **Phone validation** — Regex `[6-9]\d{9}` for 10-digit Indian mobile.
- **Pincode validation** — Regex `[1-9]\d{5}` for 6-digit PIN.
- **Address comparison** — `SequenceMatcher.ratio() < 0.85` flags disagreement.
- **Name comparison** — Compares sorted normalized names between passes.

### Cost Tracking
- **`PRICING`** dict — Hardcoded USD/1M tokens for 4 models.
- **`USD_TO_INR = 88.0`** — Hardcoded exchange rate.
- **`report_usage()`** — Iterates `UsageMetadataCallbackHandler`, calculates per-call and total cost.

---

## 6. LLM Configuration

### Model Selection
```python
PREFERRED = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.7-flash",
             "gemini-3.5-flash", "gemini-3.6-flash", "gemini-2.5-pro"]
```
- Prioritizes cheaper flash-lite models over more capable ones.
- Uses LangChain `ChatGoogleGenerativeAI` with `max_retries=3`.
- Last used model: `gemini-3.5-flash-lite`.

### System Prompt
```
"You are a meticulous OCR engine for Indian documents containing Telugu and English,
both printed and handwritten. Transcribe exactly what is written. Never translate,
transliterate, summarize or invent text. Keep Telugu in Telugu script and English in English."
```

### Gothram Resolution Rules
```
RULES:
- The reference list is a hint, NOT ground truth.
- Choose a list entry ONLY if each letter is plausible from the handwriting.
- If nothing in the list fits, set matched_in_list=false and keep the spelling as written.
- Fill other_possible_list_matches with close alternatives.
```

---

## 7. Observed Output Quality (sample_img7)

### What Worked
| Field | Pass 2 (Full) | Pass 3 (Zoom) | Final | Assessment |
|-------|---------------|----------------|-------|------------|
| Receipt No | 5813 | — | 5813 | ✅ Correct |
| Date | 10/10/2022 | — | 10/10/2022 | ⚠️ Year should be 2025 |
| Gothram | కాశ్యప / Kashyapa | కాశ్యపస | KASHYAPA | ✅ Correctly resolved |
| Phones | 9603850122 | 9603850122 | 9603850122 | ✅ Agreement |
| Pincode | null | 533307 | 533307 | ✅ Zoom found it |
| Abhishekam | 22/10/22 → 20/11/22 | — | 22/10/22 → 20/11/22 | ⚠️ Year |
| Amount | 1000-00 | — | 1000-00 | ✅ Correct |
| Cost | — | — | $0.0205 (₹1.81) | 4 API calls |

### What Failed
| Field | Pass 2 (Full) | Pass 3 (Zoom) | Assessment |
|-------|---------------|----------------|------------|
| Names | శ్రీమతి శ్రీవల్లి, శ్రీనివాస ప్రసాదురావు | శ్రీవంశీ ప్రసన్నవత్సవాయి | ❌ Both different, both wrong |
| Address | కొటప్పకొండ మండలం నరసరావుపేట | శ్రీనివాసపురం మండలం, పిండ్రం... | ❌ Completely different |

**Critical Finding**: Names and address were wrong in BOTH passes. The zoomed pass produced entirely different (also incorrect) names, suggesting the flash-lite model struggles with Telugu handwriting.

---

## 8. Excel Reference File Analysis

### Structure
- **Sheet**: Sheet2 (only sheet)
- **Columns**: Surname-Gothram (combined text), Gothram, Surname
- **Rows**: 5462 data rows + 1 header

### Statistics
| Metric | Count |
|--------|-------|
| Total rows | 5462 |
| Unique gothrams (upper) | 2100 |
| Unique surnames (upper) | 3308 |
| Non-alphabetic gothram entries | 66 |
| Gothrams with Telugu characters | 0 |

### Data Quality Issues
1. **66 non-clean gothram entries**: `#N/A`, entries with parentheses `(TIGRANIA)`, spaces `ADI THANGEDI`, slashes `INIVALI / PAIDIPALA`, ellipses `MIDIPALA...`, complex names `MUNDOLIYA ( MUHUDHOLIYA )L`.
2. **No Telugu column** — all gothrams and surnames are English-only.
3. **Many-to-many relationship**: One surname maps to multiple gothrams (PASUPULETI → 32 gothrams). One gothram maps to many surnames (PAIDIPALA → 829 surnames).
4. **Column A** contains numbered combined text like `"  1.    AADHISETTI — ARYAKATTA"` — useful only for display.
5. **273 empty rows** — Column A has 5189 entries vs 5462 for columns B and C.

### Top Gothrams by Surname Count
| Gothram | Surname Count |
|---------|--------------|
| PAIDIPALA | 829 |
| PYDIPALA | 412 |
| JANAKULA | 216 |
| PAIDIPALLA | 167 |
| NAGULA | 128 |

---

## 9. Sample Image Analysis

### Receipt Format
All 11 images are from the same temple. The receipt is a **pre-printed pink/salmon form** with:
- **Printed header**: Temple name, contact info, receipt number box
- **Handwritten fields**: Gothram, devotee names, address, pincode, phones, dates, amount
- **Printed footer**: Terms & conditions, bank details
- **Signatures area**: Payer, collector, officer signatures

### Image Characteristics
| Image | Receipt # | Orientation Issue | Language | Edge Var | Notes |
|-------|-----------|-------------------|----------|----------|-------|
| sample_img | 9745 | None | English HW | 444.5 | Sharpest, English handwriting |
| sample_img2 | 5815 | None | Telugu | 87.2 | Same receipt as img3, img9 |
| sample_img3 | 5815 | EXIF=8 (90° CCW) | Telugu | 79.0 | Same receipt as img2, img9 |
| sample_img4 | 5817 | None | Telugu | 95.1 | |
| sample_img5 | 5812 | EXIF=8 (90° CCW) | Telugu | 46.7 | Blurriest |
| sample_img6 | 5816 | None | Telugu | 99.1 | |
| sample_img7 | 5813 | None | Telugu | 49.2 | Used for existing test run |
| sample_img8 | 5814 | None | Telugu/English | 115.6 | Mixed language address |
| sample_img9 | 5815 | None | Telugu | 105.5 | Same receipt as img2, img3 |
| sample_img10 | 5810 | **180° UPSIDE DOWN** | Telugu | 100.0 | No EXIF help |
| sample_img11 | 5811 | **180° UPSIDE DOWN** | Telugu | 103.3 | No EXIF help |

### Key Observations
1. **3 duplicate receipt images**: sample_img2, sample_img3, sample_img9 are all receipt #5815 (different photos).
2. **2 images are 180° upside down** with EXIF=1 — `exif_transpose()` cannot fix these. Requires content-based rotation detection.
3. **2 images need EXIF rotation** (sample_img3, sample_img5 with EXIF=8).
4. **1 image has English handwriting** (sample_img) — all others are Telugu.
5. **Image quality varies**: edge_var ranges from 46.7 (blurry) to 444.5 (sharp).

---

## 10. Dependencies

### Currently Installed (Python 3.14.3)
| Package | Version | Used By |
|---------|---------|---------|
| Pillow | 12.3.0 | Image handling |
| numpy | 2.5.3 | Array ops |
| openpyxl | 3.1.5 | Excel reading |
| RapidFuzz | 3.14.6 | Gothram matching |
| pydantic | 2.13.5 | Schema validation |
| requests | 2.34.2 | HTTP (indirect) |

### Missing (Required)
| Package | Purpose |
|---------|---------|
| langchain-google-genai | LLM integration |
| langchain-core | Message types |
| google-genai | Model discovery |
| opencv-python-headless | Image processing |
| fastapi | Web framework |
| uvicorn | ASGI server |
| sqlalchemy | Database ORM |
| alembic | Migrations |

### Environment Issues
- **Python 3.14.3** — Very new; some packages may not have wheels. Python 3.12 also available via uv.
- **No virtual environment** — Everything in global site-packages.
- **No `.env` file** — `GOOGLE_API_KEY` not set.
- **No `cv2`** — OpenCV not installed despite being imported in V1 notebook.

---

## 11. Identified Issues

### Critical
1. **Name extraction accuracy is poor** — Both passes gave wrong names for sample_img7.
2. **Model selection prioritizes cost over accuracy** — flash-lite is cheapest but least capable.
3. **180° rotated images cannot be handled** — No content-based rotation detection.
4. **No evaluation framework** — Cannot measure or compare accuracy.

### Important
5. **Date year extraction incorrect** — "10/10/2022" vs actual "10/10/2025".
6. **No individual field crops** — Only one large handwriting crop, no targeted field reading.
7. **Hardcoded pricing and exchange rate** — `PRICING` dict and `USD_TO_INR = 88.0`.
8. **Notebook markdown is stale** — Still references EasyOCR/Tesseract/Claude.
9. **`candidates()` default k=12 but called with k=40** — Constructor default doesn't match usage.

### Minor
10. **No error handling** — API failures crash the notebook.
11. **No image quality assessment** — Every image goes to OCR.
12. **No Telugu in gothram master** — Excel has English-only gothrams.
13. **Archive folder contains old V1 code** — Should be preserved but not used.

---

## 12. What Works Well (Preserve)

1. **`prepare_image()`** — EXIF transpose + resize is correct and necessary.
2. **`crop_from_box()`** — Normalized bounding box convention, padding, upscaling logic.
3. **`GothramRef`** — RapidFuzz candidate retrieval architecture.
4. **`norm()`** — Phonetic normalization (needs tuning, not replacement).
5. **Pydantic schemas** — Good structure, need extension not replacement.
6. **Tiered gothram resolution** — Candidate pass → escalation pattern.
7. **Cross-validation architecture** — Comparing passes is the right approach.
8. **`NEEDS_HUMAN_CHECK` pattern** — Flagging disagreements for review.
9. **Intermediate result preservation** — All passes saved in JSON.
10. **Cost tracking** — Token counting and cost estimation.

---

## 13. Baseline Evaluation Summary

> **⚠️ Important**: A proper baseline evaluation requires running the pipeline against all 11 images with a GOOGLE_API_KEY. The ground truth files in `evals/expected/` were created by my visual inspection of receipt thumbnails and **require human verification** before they can be used as an evaluation benchmark.

### From Existing Output (sample_img7 only)

| Field | Expected (visual) | OCR Output | Correct? |
|-------|-------------------|------------|----------|
| Receipt No | 5813 | 5813 | ✅ |
| Gothram | KASHYAPA | KASHYAPA | ✅ |
| Phone | 9603850122 | 9603850122 | ✅ |
| Pincode | 533307 | 533307 | ✅ (zoom only) |
| Names | ~3 people | 1 person (wrong) | ❌ |
| Date year | 2025 | 2022 | ❌ |
| Address | — | Inconsistent between passes | ❌ |
| API Cost | — | $0.0205 (₹1.81) | — |
| Calls | — | 4 | — |
