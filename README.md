# ShelfLife Sentinel

Catches expired stock **before** it reaches the till, instead of after a customer
complains. Scan a barcode or photograph the date panel; the product is logged
with its expiry, classified fresh / expiring / expired, and surfaced on a
dashboard with alerts.

The problem this is built around — 60%+ of Indian consumers never check a date,
FSSAI enforcement is reactive, expired stock sits on shelves until someone
complains — is written up in [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md).

## How a scan works

```
barcode ──► GS1 parse ──► product lookup ─┐
                                          ├──► expiry status ──► save + alert
date panel photo ──► Gemini Vision ───────┘         │
                     └─ falls back to ──► Tesseract (in-browser)
                                          └─ falls back to ──► manual entry
```

Two independent paths feed one record. A **GS1-128** barcode often carries the
expiry date inside the barcode itself (application identifier `17`), so when one
is present no OCR is needed at all. Otherwise the date comes from a photo of the
packaging, read by Gemini Vision if a key is configured and by Tesseract in the
browser if not. Either way the user confirms before the record is saved, because
a misread date on a food product is worse than no date.

Date parsing assumes **Indian packaging conventions** — `DD/MM/YYYY`, not
`MM/DD/YYYY`, and label forms like `Mfg`, `Pkd`, `Best Before 6 months`, `BB
12/2025`. `best_before_months` is resolved against the manufacturing date rather
than stored as a duration.

## Features

| Page | What it does |
|---|---|
| **Scan** | Camera barcode scan or date-panel photo, with manual override |
| **Result** | Confirm the extracted dates before committing the record |
| **Products** | Every logged product with its live expiry status |
| **Dashboard** | Fresh / expiring / expired counts, category breakdown, scan volume |
| **Alerts** | Generated when a product expires or crosses the warning window |
| **History** | Full scan log with confidence and method used |

## Tech stack

- **Frontend** — Next.js 16 (App Router), React 19, Tailwind CSS v4, Recharts,
  `html5-qrcode` for camera scanning, `tesseract.js` for on-device OCR
- **Backend** — FastAPI, SQLAlchemy 2.0 (async), SQLite via `aiosqlite`
- **Vision** — Google Gemini (`gemini-2.0-flash`), optional

## Running it

Two processes. The ports matter: the backend's CORS policy allows
`http://localhost:3001` only, and the frontend defaults to reading the API at
`http://localhost:8001`.

**Backend** — run from `backend/`, since `DATABASE_URL` is a relative path:

```bash
cd backend
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env          # GOOGLE_API_KEY may be left empty
.venv/bin/uvicorn main:app --port 8001 --reload
```

**Frontend:**

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev                   # already pinned to port 3001
```

Then open http://localhost:3001. Interactive API docs are at
http://localhost:8001/docs.

## Configuration

| Variable | Where | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | `backend/.env` | `sqlite+aiosqlite:///./shelflife.db` | Relative to the launch directory |
| `EXPIRY_WARNING_DAYS` | `backend/.env` | `7` | Days ahead that count as "expiring soon" |
| `GOOGLE_API_KEY` | `backend/.env` | *(empty)* | Optional — enables Gemini Vision date reading |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | `http://localhost:8000` | Set it to `:8001` to match the backend |

Without `GOOGLE_API_KEY` the app is fully functional — `/api/scan/ocr-status`
reports `gemini_available: false` and the scanner uses Tesseract plus manual
entry. Set the key and the vision path activates with no code change.

## API

All routes are under `/api`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/scan/barcode` | Look up a barcode; parses GS1-128 when detected |
| `POST` | `/scan/ocr` | Parse dates out of OCR text produced in the browser |
| `POST` | `/scan/ocr-image` | Read dates from an uploaded image via Gemini Vision |
| `GET` | `/scan/ocr-status` | Which extraction backends are available |
| `POST` | `/scan/complete` | Commit a confirmed product record and log the scan |
| `GET`/`POST` | `/products` | List / create products |
| `GET`/`DELETE` | `/products/{id}` | Fetch or remove one product |
| `GET` | `/dashboard/stats` | Fresh / expiring / expired and scan counts |
| `GET` | `/dashboard/summary` | Dashboard rollup |
| `GET` | `/dashboard/category-breakdown` | Per-category status counts |
| `GET` | `/alerts` | Open alerts |
| `PATCH` | `/alerts/{id}/read` | Mark an alert read |
| `GET` | `/history` | Scan log |

## Status

Both halves run. Verified on 2026-09-07: backend imports and serves all 19
routes under Python 3.12, every read endpoint returns data against the committed
SQLite database, CORS preflight from `:3001` succeeds, and `next build` compiles
all 10 routes with TypeScript passing.

Not verified, and worth doing before this is called finished:

- **The camera paths.** Barcode scanning and photo capture need a real device
  with a camera; they have never been exercised end to end here.
- **Gemini Vision.** No API key has been configured, so
  `extract_dates_with_gemini` has never run against the live API.
- **No tests.** There is no test suite for the date parser, which is the
  riskiest code in the project — `parse_dates_from_text` handles a lot of label
  variants and a regression there would be silent.
