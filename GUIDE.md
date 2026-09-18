# ShelfLife Sentinel — Complete Project Guide

## Table of Contents
1. [What is ShelfLife Sentinel?](#what-is-shelflife-sentinel)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [Architecture](#architecture)
5. [Database Schema](#database-schema)
6. [Backend Deep Dive](#backend-deep-dive)
7. [Frontend Deep Dive](#frontend-deep-dive)
8. [Feature Walkthrough](#feature-walkthrough)
9. [API Reference](#api-reference)
10. [Configuration](#configuration)
11. [Testing Strategy](#testing-strategy)
12. [What Is and Is Not Verified](#what-is-and-is-not-verified)
13. [Troubleshooting](#troubleshooting)

---

## What is ShelfLife Sentinel?

A web app that helps shops catch expired stock before it is sold. Staff scan a product's barcode or
photograph its date panel. The app reads the manufacturing and expiry dates, classifies the product
as **fresh**, **expiring** or **expired**, saves it, and raises alerts on a dashboard.

The problem behind it, including FSSAI enforcement and Indian shopping habits, is written up in
`PROBLEM_STATEMENT.md`.

---

## Quick Start

The ports matter. The backend allows CORS only from `http://localhost:3001`, and the backend should
run on `8001`.

### Backend
Run from `backend/`, because the SQLite path is relative. The system `python3` is 3.6, so use 3.12.

```bash
cd backend
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env          # GOOGLE_API_KEY may stay empty
.venv/bin/uvicorn main:app --port 8001 --reload
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local    # optional; already points at http://localhost:8001
npm run dev                   # port 3001
```

Open http://localhost:3001. API docs are at http://localhost:8001/docs.

---

## Core Concepts

### Two ways to get a date
1. **GS1-128 barcodes** can carry the expiry date inside the barcode, under application identifier
   `17`, as `YYMMDD`. When present, no reading of the label is needed.
2. **A photo of the date panel**, read by one of:
   - Gemini Vision on the server, if `GOOGLE_API_KEY` is set,
   - Tesseract running in the browser, if not,
   - manual entry, if both fail.

Whichever path is used, a person confirms the dates before the record is saved. A wrong date on food
is worse than no date.

### Indian date conventions
The parser assumes `DD/MM/YYYY`, not `MM/DD/YYYY`, and understands labels such as `Mfg`, `Pkd`,
`Exp`, `Use By`, `Best Before 6 months` and `BB 12/2025`. A "best before N months" label is turned
into a real expiry date from the manufacturing date.

Short forms like `07/26` are read only after an explicit `EXP` or `MFG` label. Otherwise a batch
number or a price looks the same.

### Status
| status | meaning |
|---|---|
| `fresh` | expiry more than `EXPIRY_WARNING_DAYS` away, 7 by default |
| `expiring` | within the warning window |
| `expired` | past the expiry date |

---

## Architecture

```
  Browser (Next.js 16, :3001)
   /scan   html5-qrcode camera scan, photo capture
           tesseract.js OCR in the browser, lib/gs1.ts barcode parsing
   /result confirm dates
   /products /dashboard /alerts /history
         │ fetch (lib/api.ts)
         ▼
  FastAPI (:8001)  main.py, all routes under /api
   routes/scan.py      ── gs1_service, barcode_service (local DB, then Open Food Facts)
                       ── ocr_service (date parsing), gemini_service (vision)
   routes/products.py  ── expiry_service, alert_service
   routes/dashboard.py, alerts.py, history.py
         │ SQLAlchemy 2.0 async
         ▼
  SQLite  backend/shelflife.db   (tables created on startup)
```

---

## Database Schema

Defined in `backend/models/product.py`. Tables are created on startup by `database.py`.

### `products`
`id`, `barcode` (unique), `name`, `brand`, `category`, `mfg_date`, `expiry_date`, `batch_number`,
`image_url`, `source` (such as `manual` or `openfoodfacts`), `created_at`, `updated_at`.

### `scan_logs`
`id`, `product_id`, `barcode`, `scan_type`, `result_status`, `expiry_date_scanned`, `confidence`,
`raw_ocr_text`, `scanned_at`. Every scan is logged, with the method used and its confidence.

### `alerts`
`id`, `product_id`, `alert_type`, `message`, `is_read`, `days_until_expiry`, `created_at`.

---

## Backend Deep Dive

| file | key functions |
|---|---|
| `services/gs1_service.py` | `is_gs1_barcode()`, `parse_gs1_barcode()` for application identifiers such as `17` expiry and `10` batch |
| `services/barcode_service.py` | `lookup_product()` checks the local database, then `lookup_open_food_facts()` for name, brand and category |
| `services/ocr_service.py` | `parse_dates_from_text()` finds mfg and expiry dates in OCR text. The riskiest code in the project |
| `services/gemini_service.py` | `is_gemini_available()`, `extract_dates_with_gemini(image_bytes)` using the model in `GEMINI_MODEL`, default `gemini-3.6-flash` |
| `services/expiry_service.py` | `compute_status()`, `days_until_expiry()`, `compute_expiry_from_mfg()`, `should_generate_alert()` |
| `services/alert_service.py` | `create_alert_if_needed()`, `get_active_alerts()`, `mark_alert_read()`, `refresh_alerts()` |
| `database.py` | the async engine, sessions, and table creation |

---

## Frontend Deep Dive

Next.js 16 with the App Router, React 19, Tailwind CSS v4 and Recharts.

| route | purpose |
|---|---|
| `/` | landing page |
| `/scan` | camera barcode scan or date-panel photo, with manual override |
| `/result` | confirm the extracted dates before saving |
| `/products` | every logged product with its live status |
| `/dashboard` | fresh, expiring and expired counts, category breakdown, scan volume |
| `/alerts` | open alerts, mark as read |
| `/history` | the full scan log with confidence and method |

Components: `BarcodeScanner` wraps `html5-qrcode`, `ImageCapture` takes photos, `ExpiryStatusBadge`
shows status, `StatCard` and `AlertBanner` build the dashboard, and `Sidebar` handles navigation.
`lib/ocr.ts` runs Tesseract in the browser and `lib/gs1.ts` parses GS1 barcodes client-side.

`public/manifest.json` lets the app be installed on a phone's home screen.

---

## Feature Walkthrough

1. **Open Scan** on a phone and allow camera access.
2. **Scan the barcode.** A GS1-128 barcode with an expiry fills the dates at once. A normal barcode
   looks up the product name.
3. **If no expiry came from the barcode, photograph the date panel.** Gemini or Tesseract reads it.
4. **Confirm on the Result page**, correcting anything misread.
5. **Save.** The product appears on Products with its status, the scan is logged, and an alert is
   created if it is expiring or expired.
6. **Check the Dashboard and Alerts** each day.

---

## API Reference

All routes are under `/api`.

| method | path | purpose |
|---|---|---|
| `POST` | `/scan/barcode` | look up a barcode, parsing GS1-128 when detected |
| `POST` | `/scan/ocr` | parse dates from OCR text produced in the browser |
| `POST` | `/scan/ocr-image` | read dates from an image with Gemini Vision |
| `GET` | `/scan/ocr-status` | which extraction methods are available |
| `POST` | `/scan/complete` | save a confirmed product and log the scan |
| `GET`, `POST` | `/products` | list or create products |
| `GET`, `DELETE` | `/products/{id}` | fetch or remove one product |
| `GET` | `/dashboard/stats` | status counts and scan counts |
| `GET` | `/dashboard/summary` | dashboard rollup |
| `GET` | `/dashboard/category-breakdown` | status counts per category |
| `GET` | `/alerts` | open alerts |
| `PATCH` | `/alerts/{id}/read` | mark an alert read |
| `GET` | `/history` | the scan log |

---

## Configuration

| variable | file | default | notes |
|---|---|---|---|
| `DATABASE_URL` | `backend/.env` | `sqlite+aiosqlite:///./shelflife.db` | relative to where the backend starts |
| `EXPIRY_WARNING_DAYS` | `backend/.env` | `7` | days ahead that count as expiring |
| `GOOGLE_API_KEY` | `backend/.env` | empty | optional. Enables Gemini Vision |
| `GEMINI_MODEL` | `backend/.env` | `gemini-3.6-flash` | change it when Google retires the model |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | `http://localhost:8001` | matches the backend's port |

---

## Testing Strategy

```bash
cd backend
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest tests/ -q
```

`tests/test_ocr_parsing.py` has 46 cases from real Indian label formats: both dates printed, expiry
only, ISO dates, spelled-out months, two-digit years, best-before durations, unlabelled dates, and
text with no date. It also covers the status and alert logic.

Writing these tests found four parsing bugs, all fixed. The README lists them. The worst read
`EXP 2026-08-15` as 26 August 2015, logging a fresh product as expired.

When changing `ocr_service.py`, add a test case for every new label format first. A parsing bug is
silent: the product still saves, with the wrong date.

---

## What Is and Is Not Verified

- **Verified:** the backend serves all routes, CORS from `:3001` works, and the frontend builds.
- **Verified 2026-09-18:** Gemini Vision reads a date label correctly against the live API, after
  the retired `gemini-2.0-flash` was replaced.
- **Not verified:** the camera paths, which need a phone. Open the app on a phone over HTTPS and scan
  one barcode and one date label.
- **Not deployed.**

---

## Troubleshooting

### The frontend shows network errors
Check the backend is running on port 8001. If `frontend/.env.local` sets `NEXT_PUBLIC_API_URL` to
another address, make it match, then restart `npm run dev`. Without that variable the frontend uses
`http://localhost:8001`.

### CORS errors
The frontend must be on `http://localhost:3001`. Other ports are blocked.

### The database appears empty or in the wrong place
The SQLite path is relative. Always start the backend from inside `backend/`.

### The camera does not open
Browsers allow the camera only on `localhost` or HTTPS. On a phone over the network, serve the app
over HTTPS.

### Photo reading is poor
Without `GOOGLE_API_KEY`, Tesseract does the reading, which struggles with curved or shiny packaging.
Add a Gemini key, or enter the dates manually on the Result page.
