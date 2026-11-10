# Implementation Plan — Temple Receipt OCR System

## Milestones Summary

| M | Name | Duration | Deliverable |
|---|------|----------|-------------|
| M1 | Analysis & Planning | Done | This document |
| M2 | Backend Foundation | 1-2 days | FastAPI + DB + Auth |
| M3 | OCR Pipeline | 2-3 days | Improved pipeline + CLI |
| M4 | Capture UX | 1-2 days | Camera + upload + quality gate |
| M5 | Review Screen | 2-3 days | Bilingual form + correction |
| M6 | Save & Search | 1-2 days | Persistence + search |
| M7 | Pooja & Prasadam | 1-2 days | PDF lists + dispatch |
| M8 | Dashboard & Offline | 1 day | Analytics + PWA offline |
| M9 | Hardening | 1-2 days | Security + tests + deploy |

---

## M2: Backend Foundation

### Directory Structure
```
backend/
  app/
    api/routes/           # FastAPI routers
    core/config.py        # Settings (pydantic-settings)
    core/security.py      # JWT, hashing
    models/               # SQLAlchemy ORM models
    schemas/              # Pydantic request/response schemas
    services/             # Business logic
    repositories/         # DB queries
    auth/                 # Auth middleware
    storage/              # Storage abstraction
    utils/
  pipeline/               # OCR pipeline (independent)
  migrations/             # Alembic
  tests/
  .env.example
  requirements.txt
```

### Tasks
- [ ] `uv` virtual environment with Python 3.12
- [ ] FastAPI app skeleton + CORS + health check
- [ ] SQLAlchemy models for all 8 tables
- [ ] Alembic init + first migration
- [ ] JWT authentication (login/logout)
- [ ] Admin + Staff roles
- [ ] `StorageBackend` ABC + `LocalStorageBackend`
- [ ] `config.py` via `pydantic-settings` from `.env`
- [ ] `/api/v1/` prefix for all routes

### Models to Create
1. `User` — id, username, password_hash, role, active, created_at
2. `Receipt` — all fields from spec + indexes
3. `ReceiptPerson` — FK to Receipt, bilingual fields
4. `ReceiptPhone` — FK to Receipt, number, is_primary
5. `GothramMaster` — id, gothram_en, gothram_te, normalized, variants, approval_status
6. `Correction` — FK to Receipt, field audit
7. `AuditLog` — full audit trail
8. `PrasadamDispatch` — FK to Receipt, status, courier, tracking

---

## M3: OCR Pipeline

### Module Structure
```
backend/pipeline/
  image_loader.py      # resolve_image, prepare_image, to_b64 (from notebook)
  image_quality.py     # blur, brightness, contrast, resolution checks
  orientation.py       # EXIF + aspect heuristic + Gemini-based detection
  preprocessing.py     # CLAHE, bilateral filter, sharpening (optional)
  document_detection.py # Is this a receipt? Basic region check
  transcription.py     # Pass 1: full-image transcription
  extraction.py        # Pass 2: structured extraction (Receipt schema)
  handwriting_detection.py # Pass 3: zoom re-read (HW schema)
  crop_reader.py       # Pass 4: field-level crops + targeted reads
  gothram_matching.py  # GothramRef + tiered resolution (from notebook)
  transliteration.py   # EN→TE, TE→EN
  validation.py        # phone, pincode, date, address validation
  consensus.py         # Cross-pass evidence evaluation
  confidence.py        # Confidence scoring (not model-reported)
  usage_tracker.py     # Token counting + cost (from notebook)
  run.py               # CLI entrypoint: python -m pipeline.run image.jpg
  schemas.py           # All Pydantic schemas (from notebook)
```

### Pipeline Flow (8 Passes)
```
Image Input
  → orientation.py     (Pass 0: Rotate if needed)
  → image_quality.py   (Pass 0: Quality gate → GOOD/ACCEPTABLE/POOR/UNUSABLE)
  → transcription.py   (Pass 1: Full-image free-text)
  → extraction.py      (Pass 2: Structured Receipt schema + bounding boxes)
  → crop_reader.py     (Pass 3: Zoom handwriting crop)
  → crop_reader.py     (Pass 4: Field-level crops — adaptive)
  → gothram_matching.py (Pass 5: Tiered gothram resolution)
  → consensus.py       (Pass 6: Cross-validate all passes)
  → Final JSON output
```

### Key Improvements Over Notebook
1. Use `gemini-3.5-flash` (not flash-lite) for OCR passes
2. Add Pass 0 rotation detection
3. Add field-level bounding boxes in schema
4. Add individual field crops (gothram always, others adaptive)
5. Fix date year contamination with clearer prompt
6. Move pricing to `config/pricing.yaml`
7. Add proper error handling + retries
8. Make all thresholds configurable

---

## M4: Capture Experience

### Frontend Pages
- `/scan` — Main capture page
  - Camera view (rear camera default)
  - File upload button
  - Overlay receipt guide frame
  - Flash toggle (if supported)
  - Instructions (EN + TE)
  - Retake / Confirm buttons
- Quality feedback overlay (GOOD/POOR/UNUSABLE banner)
- Optional: 2nd close-up photo prompt

### Key APIs
- `POST /api/v1/receipts/upload` — Upload image → start OCR → return job_id
- `GET /api/v1/receipts/status/{job_id}` — Poll for completion
- Background task: Runs pipeline, saves to DB

---

## M5: Review & Correction Screen

### Frontend Pages
- `/receipts/{id}/review` — Main review/correction screen

### Layout
- **Desktop**: Image viewer (left 50%) | Form (right 50%)
- **Mobile**: Image thumbnail (top) | Form (scrollable) | Sticky Save button

### Form Sections
1. Receipt Details (receipt_no, date, abhishekam_from/to, amount)
2. Devotee Details (multiple people, EN+TE names)
3. Gothram (searchable dropdown + free text + alternatives)
4. Contact (address EN+TE, pincode, phones)
5. Notes

### Confidence Indicators
- 🟢 Green: passes agree, validation passes
- 🟡 Amber: single pass or low agreement
- 🔴 Red: validation failed or missing

### Key APIs
- `GET /api/v1/receipts/{id}` — Full receipt + all OCR passes
- `PATCH /api/v1/receipts/{id}` — Save field corrections
- `POST /api/v1/receipts/{id}/confirm` — Mark as confirmed
- `POST /api/v1/receipts/{id}/save-incomplete` — Save incomplete

---

## M6: Save & Search

### Search API
- `GET /api/v1/receipts?q=&field=&status=&date_from=&date_to=`
- Indexed: receipt_no, phone, gothram_en, pincode
- Telugu search: exact match (not normalized) to preserve characters

### Duplicate Detection
- On upload: check receipt_no within same year
- If found: return existing record with conflict flag
- Never auto-overwrite

---

## M7: Pooja & Prasadam

### Pooja List
- `GET /api/v1/pooja?date=YYYY-MM-DD` → receipts where abhishekam_from ≤ date ≤ abhishekam_to
- Grouped by gothram
- PDF endpoint: `GET /api/v1/pooja/pdf?date=` using ReportLab or WeasyPrint
- Telugu font: Noto Sans Telugu TTF embedded in PDF

### Prasadam Dispatch
- `GET /api/v1/dispatch?status=&pincode=&date=`
- `POST /api/v1/dispatch/{id}/status` — Update status
- Address labels PDF endpoint

---

## M8: Dashboard & Offline

### Dashboard Stats API
- `GET /api/v1/dashboard/stats`
- Counts by status, today's scans, monthly totals, pending dispatches
- API cost totals from receipts table

### Offline (PWA)
- Service Worker with Workbox
- IndexedDB queue for pending uploads
- Sync when online

---

## M9: Production Hardening

### Security
- Rate limiting (slowapi)
- File upload validation (magic bytes, size limit 15MB)
- Signed image URLs (time-limited)
- HTTPS enforcement headers

### Testing
- pytest for unit tests
- httpx + pytest for API integration tests
- Playwright for E2E (mobile 360px viewport)

---

## Technology Decisions Summary

| Component | Technology | Reason |
|-----------|-----------|--------|
| Python | 3.12 (uv) | Stability + ecosystem |
| Backend | FastAPI | Async, pydantic native |
| DB | SQLite → PostgreSQL | Per spec |
| ORM | SQLAlchemy 2.x | Per spec |
| Migrations | Alembic | Per spec |
| Images | Pillow + OpenCV | Per spec |
| OCR model | gemini-3.5-flash | Accuracy priority |
| LLM client | langchain-google-genai | Reuse existing |
| Frontend | React + Vite + TypeScript | Per spec |
| CSS | Tailwind + shadcn/ui | Per spec |
| Fonts | Noto Sans Telugu + Noto Sans | Per spec |
| PDF | WeasyPrint or ReportLab | Telugu font support |
| Auth | JWT (python-jose) | Stateless |
| Testing | pytest + Playwright | Per spec |
