# OCR Improvement Plan

## Priority-Ordered Improvements

---

## 1. CRITICAL: Model Selection for Accuracy

### Problem
The current preferred model list prioritizes cheap flash-lite models:
```python
PREFERRED = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", ...]
```
The observed output (sample_img7) shows names and addresses were **completely wrong** in both passes. Flash-lite models are optimized for speed/cost, not for complex Telugu handwriting recognition.

### Recommendation
- **Primary model**: `gemini-3.5-flash` or `gemini-3.7-flash` (better accuracy, reasonable cost)
- **Fallback**: `gemini-2.5-flash` or `gemini-2.5-pro`
- **Never use flash-lite for OCR** — reserve it only for non-critical tasks like image assessment
- Make model configurable per-pass (e.g., use cheaper model for "is this a receipt?" and better model for extraction)

### Expected Impact
- Significantly improved name, address, and gothram accuracy
- Cost increase from ~₹1.80 to ~₹5-15 per receipt (acceptable for this use case)

### Measurement
- Run all 11 samples with flash-lite vs flash vs pro
- Compare field-level accuracy, especially names and addresses

---

## 2. CRITICAL: Content-Based Rotation Detection

### Problem
- sample_img10 and sample_img11 are **180° upside down** with EXIF orientation=1
- `exif_transpose()` cannot fix them
- Sending an upside-down image to OCR will produce garbage

### Recommendation
- **Pass 0 (new)**: Before any extraction, use Gemini to detect orientation
  - Send a low-resolution thumbnail (saves tokens)
  - Ask: "Is this document right-side up? If not, how many degrees clockwise must it be rotated?"
  - Use structured output: `{"rotation_needed": 0|90|180|270}`
- Apply rotation before all subsequent passes
- Also use heuristic: if aspect ratio < 1.0 after EXIF transpose, the image is likely rotated 90° (all receipts are landscape ~2.2:1)

### Expected Impact
- 2 of 11 sample images (18%) currently unusable → become processable
- Small additional API cost (~$0.002 per image with thumbnail)

---

## 3. HIGH: Individual Field-Level Crops

### Problem
Currently only one large handwriting crop is made. The model must read gothram, all names, address, pincode, and phones from one image. This creates confusion — the model can mix up fields or miss some.

### Recommendation
After Pass 2 returns bounding boxes, request **field-level bounding boxes**:
- Extend the Receipt schema to include:
  ```python
  gothram_box: List[int]       # bounding box for gothram line
  names_box: List[int]         # bounding box for names section  
  address_box: List[int]       # bounding box for address section
  phone_box: List[int]         # bounding box for phone numbers
  ```
- Crop each field independently
- Use field-specific prompts:
  - "This crop shows ONLY the handwritten gothram. Read it letter by letter."
  - "This crop shows handwritten phone numbers. Read each digit carefully."

### Adaptive Strategy
- Don't crop every field for every receipt
- Crop gothram always (highest priority)
- Crop phones when validation fails or passes disagree
- Crop names when passes disagree
- Crop address only when inconsistent

### Expected Impact
- Better gothram accuracy (focused reading)
- Better phone number accuracy (isolated digits)
- Moderate cost increase (1-3 extra calls only when needed)

---

## 4. HIGH: Improved Cross-Validation Logic

### Problem
Current cross-validation is simplistic:
- Zoomed reading is preferred by default for names, address, pincode
- No evidence-based selection between readings
- Address comparison uses `norm()` (phonetic normalization designed for gothrams) which may damage Telugu

### Recommendation
- **Do not auto-prefer the zoomed pass** — evaluate each reading on its own merit
- Use field-specific comparison:
  - **Phones**: Compare digit-by-digit; prefer the reading with valid 10-digit format
  - **Pincode**: Prefer the reading that passes `[1-9]\d{5}` validation
  - **Names**: If passes disagree, flag for human review (don't guess)
  - **Gothram**: Use the multi-pass gothram resolution (already good)
  - **Address**: Present both readings to the user if they differ significantly
- Add a **consensus confidence score** based on agreement:
  - All passes agree → high confidence
  - Partial agreement → medium confidence  
  - Complete disagreement → low confidence, human review required

---

## 5. HIGH: Telugu Name Extraction Improvement

### Problem
Names are the weakest field. For sample_img7:
- Pass 2: శ్రీమతి శ్రీవల్లి, శ్రీనివాస ప్రసాదురావు (wrong)
- Pass 3: శ్రీవంశీ ప్రసన్నవత్సవాయి (wrong)

### Recommendation
- Use a more capable model (see #1)
- Add specific name-extraction instructions:
  ```
  The fields after శ్రీ/శ్రీమతి contain devotee names.
  Each person has a given name and a surname (ఇంటిపేరు).
  శ్రీ and శ్రీమతి are honorifics, NOT names. Do not include them as given names.
  Multiple people may be listed, separated by commas or on different lines.
  ```
- Parse the receipt structure: the form has specific labeled sections for names
- Consider a separate name-focused crop and prompt

---

## 6. MEDIUM: Date Year Correction

### Problem
Receipt date "10/10/2025" was read as "10/10/2022". The printed year on the form's terms section (Dt. 05-10-2022) may be contaminating the handwritten date reading.

### Recommendation
- Add instruction: "The receipt DATE is handwritten next to the printed label 'తేది'. Do NOT read dates from the printed terms section."
- Validate dates: abhishekam_from should be after receipt_date
- Cross-check: if receipt_no is in a series, dates should be approximately sequential

---

## 7. MEDIUM: Enhanced Image Preprocessing

### Problem
No preprocessing is done beyond EXIF transpose and resize. Some images are blurry (edge_var=46.7 for sample_img5) or have low contrast.

### Recommendation
- **Image quality assessment** (before OCR):
  - Laplacian variance for blur detection (threshold ~50-70 based on sample data)
  - Mean luminance for brightness (very dark < 80, very bright > 230)
  - Standard deviation for contrast (low contrast < 25)
- **Enhancement pipeline** (when quality is marginal):
  - CLAHE for contrast enhancement
  - Bilateral filter for denoising (preserves edges/handwriting strokes)
  - Sharpening for slightly blurry images
- **Never enhance good images** — enhancement can damage clear handwriting
- **Always keep original** — enhanced version is supplementary

### Dependency
- Requires `opencv-python-headless` installation

---

## 8. MEDIUM: Improved Prompt Engineering

### Current Prompts
The existing prompts are good but can be improved:

### Recommended Changes
1. **Transcription prompt**: Add "Pay special attention to Telugu conjuncts (క్ష, త్ర, శ్రీ etc.). Read each character carefully."
2. **Extraction prompt**: Add the form layout description so the model understands which printed labels correspond to which fields
3. **Zoom prompt**: Strengthen "Do not read the printed Telugu form labels. Read ONLY the handwritten ink marks."
4. **Add receipt-specific context**: "This is a temple abhishekam booking receipt. Common gothram names include KASHYAPA, BHARADWAJA, VASISHTA, PAIDIPALA etc."

---

## 9. LOW: Gothram Matching Refinements

### Current Status
Gothram matching is the **strongest component** — KASHYAPA was correctly resolved from కాశ్యపస. The tiered approach works well.

### Minor Improvements
1. **Clean the reference data**: Remove `#N/A`, normalize entries with parentheses/slashes
2. **Tune `norm()` more carefully**: The current transformations (TH→T, DH→D) may be too aggressive for some gothrams. Test against the full 2100 list.
3. **Store normalized forms in DB** for faster lookup (avoid recomputing)
4. **k=40 vs k=12 discrepancy**: The `candidates()` default is k=12 but called with k=40. Standardize to k=40 as used.
5. **Add Telugu-to-English transliteration** for gothram: when handwriting is in Telugu script, transliterate before fuzzy matching

---

## 10. LOW: Cost Optimization

### Current Cost
~₹1.81 per receipt (4 API calls with flash-lite)

### Projected Cost with Improvements
| Scenario | Calls | Est. Cost |
|----------|-------|-----------|
| Current (flash-lite, 4 calls) | 4 | ₹1.80 |
| Better model (flash, 4 calls) | 4 | ₹5-8 |
| + rotation detection | 5 | ₹6-9 |
| + field crops (adaptive, avg 2) | 6-7 | ₹8-12 |
| + quality gate (saves bad images) | varies | saves ₹5-12 on bad images |

### Optimization Strategies
1. **Quality gate** — Don't spend on images that won't OCR well
2. **Adaptive passes** — Skip field crops when agreement is high
3. **Thumbnail for rotation** — Use low-res image for Pass 0
4. **Cache gothram candidates** — Avoid recomputing fuzzy matches

---

## Improvement Priority Matrix

| # | Improvement | Impact | Effort | Risk | Priority |
|---|------------|--------|--------|------|----------|
| 1 | Better model selection | 🔴 Critical | Low | Low | **P0** |
| 2 | Rotation detection | 🔴 Critical | Medium | Low | **P0** |
| 3 | Field-level crops | 🟠 High | Medium | Low | **P1** |
| 4 | Cross-validation logic | 🟠 High | Medium | Low | **P1** |
| 5 | Name extraction prompts | 🟠 High | Low | Low | **P1** |
| 6 | Date year fix | 🟡 Medium | Low | Low | **P2** |
| 7 | Image preprocessing | 🟡 Medium | High | Medium | **P2** |
| 8 | Prompt engineering | 🟡 Medium | Low | Low | **P2** |
| 9 | Gothram refinements | 🟢 Low | Low | Low | **P3** |
| 10 | Cost optimization | 🟢 Low | Low | Low | **P3** |
