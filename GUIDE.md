# ShelfLife Sentinel — Complete Project Guide

A complete guide from zero to a working expiry-date scanner for shops. Covers every feature, every
design decision and the reason behind it, with the real code. It is self-contained: you can paste it
into any AI chat and ask questions about the project without sharing the repository.

**Repository:** https://github.com/keerthishree20/shelf-life-sentinel

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Why](#2-tech-stack--why)
3. [Project Setup from Scratch](#3-project-setup-from-scratch)
4. [Core Ideas in Plain Words](#4-core-ideas-in-plain-words)
5. [Project Structure](#5-project-structure)
6. [Database Design](#6-database-design)
7. [How a Scan Works](#7-how-a-scan-works)
8. [GS1-128 Barcodes: Dates Inside the Barcode](#8-gs1-128-barcodes-dates-inside-the-barcode)
9. [Product Lookup](#9-product-lookup)
10. [Reading Dates from Text (the Riskiest Code)](#10-reading-dates-from-text-the-riskiest-code)
11. [Gemini Vision](#11-gemini-vision)
12. [Tesseract in the Browser](#12-tesseract-in-the-browser)
13. [Expiry Status](#13-expiry-status)
14. [Alerts](#14-alerts)
15. [The Confirm Step](#15-the-confirm-step)
16. [Dashboard and Statistics](#16-dashboard-and-statistics)
17. [Frontend Pages](#17-frontend-pages)
18. [Installing on a Phone](#18-installing-on-a-phone)
19. [API Reference](#19-api-reference)
20. [Configuration](#20-configuration)
21. [Testing](#21-testing)
22. [What Is and Is Not Verified](#22-what-is-and-is-not-verified)
23. [Troubleshooting](#23-troubleshooting)
24. [Complete Feature Summary](#24-complete-feature-summary)

---

## 1. Project Overview

ShelfLife Sentinel catches expired stock **before** it reaches the till, instead of after a customer
complains. Staff scan a product's barcode or photograph its date panel. The app reads the
manufacturing and expiry dates, classifies the product as **fresh**, **expiring soon** or **expired**,
saves it, and raises alerts on a dashboard.

### The problem
Over 60% of Indian consumers never check a date, FSSAI enforcement is reactive, and expired stock sits
on shelves until someone complains. The full write-up is in `PROBLEM_STATEMENT.md`.

**Status:** both halves run; the date parser has 46 tests; Gemini date reading verified live on
2026-09-18. Camera paths untested on a phone. Not deployed.

---

## 2. Tech Stack & Why

| Technology | Role | Why We Chose It |
|---|---|---|
| **Next.js 16 (App Router), React 19** | Frontend | pages for scan, results, dashboard |
| **Tailwind CSS v4** | Styling | quick responsive layout |
| **Recharts** | Charts | category and status charts |
| **html5-qrcode** | Camera scanning | reads barcodes in the browser |
| **tesseract.js** | OCR in the browser | reads date text with no server or key |
| **FastAPI** | Backend | typed async API |
| **SQLAlchemy 2.0 (async) + aiosqlite** | Database | SQLite with no server |
| **Google Gemini** (optional) | Vision | reads curved or shiny packaging better than Tesseract |
| **Open Food Facts** | Product names | free public barcode database |

---

## 3. Project Setup from Scratch

The ports matter: the backend allows CORS only from `http://localhost:3001`, and runs on `8001`.

### Backend (run from `backend/`, because the SQLite path is relative)
```bash
git clone https://github.com/keerthishree20/shelf-life-sentinel.git
cd shelf-life-sentinel/backend
python3.12 -m venv .venv          # the system python3 here is 3.6
.venv/bin/pip install -r requirements.txt
cp .env.example .env              # GOOGLE_API_KEY may stay empty
.venv/bin/uvicorn main:app --port 8001 --reload
```

### Frontend
```bash
cd ../frontend
npm install
cp .env.example .env.local        # optional; already points at http://localhost:8001
npm run dev                       # port 3001
```

Open http://localhost:3001. API docs: http://localhost:8001/docs.

---

## 4. Core Ideas in Plain Words

| Idea | Meaning |
|---|---|
| **MFG / PKD** | manufacturing or packing date printed on the pack |
| **EXP / Use by** | expiry date |
| **Best before N months** | expiry given as a duration from the manufacturing date |
| **GS1-128** | a barcode standard that can carry dates, batch and serial numbers inside it |
| **Application identifier (AI)** | a code in a GS1 barcode saying what comes next: `17` = expiry, `11` = mfg, `10` = batch |
| **OCR** | reading printed text from an image |
| **Day-first** | Indian packs print `DD/MM/YYYY`, not the American `MM/DD/YYYY` |

---

## 5. Project Structure

```
backend/
  main.py                 app, CORS, routers under /api
  database.py             async engine, sessions, table creation on startup
  models/product.py       Product, ScanLog, Alert
  routes/
    scan.py               barcode, ocr, ocr-image, ocr-status, complete
    products.py           list, create, get, delete
    dashboard.py          stats, summary, category breakdown
    alerts.py             list, mark read
    history.py            scan log
  services/
    gs1_service.py        is_gs1_barcode, parse_gs1_barcode
    barcode_service.py    lookup_product (local DB, then Open Food Facts)
    ocr_service.py        parse_dates_from_text: the date parser
    gemini_service.py     extract_dates_with_gemini
    expiry_service.py     compute_status, days_until_expiry, compute_expiry_from_mfg
    alert_service.py      create_alert_if_needed, get_active_alerts, mark_alert_read, refresh_alerts
  tests/test_ocr_parsing.py   46 cases
frontend/
  app/page.tsx  scan/  result/  products/  dashboard/  alerts/  history/
  components/BarcodeScanner.tsx  ImageCapture.tsx  ExpiryStatusBadge.tsx
             StatCard.tsx  AlertBanner.tsx  Sidebar.tsx
  lib/api.ts  lib/gs1.ts  lib/ocr.ts  lib/types.ts
  public/manifest.json
PROBLEM_STATEMENT.md
```

---

## 6. Database Design

`backend/models/product.py`. Tables are created on startup.

### `products`
| Column | Purpose |
|---|---|
| `id` | primary key |
| `barcode` | unique |
| `name`, `brand`, `category` | from Open Food Facts or entered |
| `mfg_date`, `expiry_date` | the dates |
| `batch_number` | from GS1 or the label |
| `image_url` | product image |
| `source` | `manual`, `openfoodfacts`, `local_db`... |
| `created_at`, `updated_at` | timestamps |

### `scan_logs`
`product_id`, `barcode`, `scan_type`, `result_status`, `expiry_date_scanned`, `confidence`,
`raw_ocr_text`, `scanned_at`. Every scan is logged with its method and confidence.

### `alerts`
`product_id`, `alert_type` (`expired` or `expiring_soon`), `message`, `is_read`, `days_until_expiry`,
`created_at`.

---

## 7. How a Scan Works

```
barcode ──► GS1 parse ──► product lookup ─┐
                                          ├──► expiry status ──► save + alert
date panel photo ──► Gemini Vision ───────┘         │
                     └─ falls back to ──► Tesseract (in the browser)
                                          └─ falls back to ──► manual entry
```

Two independent paths feed one record. A **GS1-128** barcode often carries the expiry inside it, so no
reading of the label is needed. Otherwise the date comes from a photo. **Either way, a person confirms
the dates before saving**, because a misread date on food is worse than no date.

---

## 8. GS1-128 Barcodes: Dates Inside the Barcode

`services/gs1_service.py` (and a matching `frontend/lib/gs1.ts` for the browser):

| AI | Field | Length |
|---|---|---|
| `01` | GTIN (product number) | 14 |
| `10` | batch number | variable |
| `11` | manufacturing date | 6 (`YYMMDD`) |
| `13` | packaging date | 6 |
| `15` | best before | 6 |
| `17` | expiry date | 6 |
| `21` | serial number | variable |

```python
def parse_gs1_barcode(data):
    for prefix in ["]C1", "]e0", "]d2"]:          # scanner symbology prefixes
        if data.startswith(prefix):
            data = data[len(prefix):]
    clean = re.sub(r"[()]", "", data)            # "(17)260911" → "17260911"
    pos = 0
    while pos < len(clean):
        for ai_code, ai_info in sorted(AI_PATTERNS.items(), key=lambda x: -len(x[0])):
            if clean[pos:pos + len(ai_code)] == ai_code:
                # fixed-length: take N chars; variable-length: read to the GS separator or next AI
                ...
```

Longer AI codes are tried first, so `17` is not mistaken for something starting with `1`.

---

## 9. Product Lookup

`services/barcode_service.py` `lookup_product(db, barcode)`:
1. check the local `products` table first (`source: local_db`),
2. otherwise ask **Open Food Facts**
   (`https://world.openfoodfacts.org/api/v2/product/{barcode}.json`) for name, brand, category and
   image (`source: openfoodfacts`),
3. otherwise the user types the name.

---

## 10. Reading Dates from Text (the Riskiest Code)

`services/ocr_service.py` `parse_dates_from_text(raw_text)`. A bug here is **silent**: the product still
saves, just with the wrong expiry. So it has 46 tests.

### Labels it understands
```python
MFG_LABELS = r"mfg|mfd|manufactured|packed on|pkd|pkg date|dom|date of mfg|manufacture|packing"
EXP_LABELS = r"exp|expiry|expd|expires|use by|best before|bb|use before|valid until|consume before"
BEST_BEFORE_PATTERN = r"(best before|bb|use within) N (months|mos|m) [from mfg]"
```

### Date formats, tried in order (first match wins)
| Pattern | Example | Note |
|---|---|---|
| `ymd` | `2026-08-15` | ISO first, because a day-first reading of it is plausible and badly wrong |
| `dmy_full` | `15/08/2026` | day first |
| `dmy_short` | `15/08/26` | |
| `d_month_y` | `05 JAN 2025` | |
| `month_year` | `AUG 2026` | |
| `my` | `08/2026` | |
| `my_short` | `07/26` | **weak**: only after an EXP/MFG label |
| `m_space_y` | `12 2026` | **weak**: only after a label |

### Boundary guards
```python
_B = r"(?<![\d/.\-])"      # not glued to digits or separators before
_E = r"(?![\d/.\-])"       # or after
```
Without these, `12/08/20` was found inside `12/08/2026`, inventing a date never printed.

### The algorithm
1. Find "best before N months".
2. After an MFG label, parse the next 40 characters as the manufacturing date.
3. After an EXP label, parse the next 40 characters as expiry (or an inline "N months").
4. If no labelled dates: collect unlabelled dates (strong patterns only, years 2020–2030). Two or more →
   earliest is mfg, latest is expiry. One → expiry.
5. No expiry but mfg + best-before → compute it (`relativedelta`, so "6 months" is calendar months).

### Confidence
| Found | Confidence |
|---|---|
| expiry with labels | 85 |
| expiry without labels | 60 |
| mfg + best-before | 75 |
| mfg only | 40 |

### Why weak patterns need a label
On unlabelled text, a batch number or a price looks the same: `Batch 12/26 MRP 45.00` is correctly read
as having **no** date.

---

## 11. Gemini Vision

`services/gemini_service.py`. When `GOOGLE_API_KEY` is set, the photo goes to Gemini with a prompt
asking for mfg date, expiry, best-before months and the raw text, in day-first order.

```python
model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-3.6-flash"))
```

The original `gemini-2.0-flash` was **retired** and returned 404, so photo date reading never worked.
Now the model is a setting. Verified live on 2026-09-18: a label reading `PKD: 12/03/2026` and
`EXP: 11/09/2026` came back as manufactured 12 March and expiring 11 September 2026, confidence 99.

`GET /api/scan/ocr-status` reports `gemini_available`, so the frontend knows which path to use.

---

## 12. Tesseract in the Browser

Without a Gemini key, `frontend/lib/ocr.ts` runs **tesseract.js** on the device, then sends the text to
`POST /api/scan/ocr`, which runs the same date parser. No key, no upload of the image. It struggles with
curved or shiny packaging, which is why the confirm step exists.

---

## 13. Expiry Status

```python
def compute_status(expiry_date):
    if expiry_date is None:
        return "unknown"
    now = datetime.utcnow()
    if expiry_date < now:
        return "expired"
    if expiry_date <= now + timedelta(days=EXPIRY_WARNING_DAYS):   # 7 by default
        return "expiring_soon"
    return "fresh"
```

`ExpiryStatusBadge` shows it with colour and text.

---

## 14. Alerts

```python
async def create_alert_if_needed(db, product):
    should_alert, alert_type = should_generate_alert(product.expiry_date)   # expired / expiring_soon
    if not should_alert:
        return None
    # skip if an unread alert of the same type already exists for this product
    days = days_until_expiry(product.expiry_date)
    message = (f"{product.name} (Barcode: {product.barcode}) has EXPIRED {abs(days)} day(s) ago."
               if alert_type == "expired"
               else f"{product.name} (Barcode: {product.barcode}) expires in {days} day(s).")
```

- No duplicate unread alerts for the same product and type.
- `refresh_alerts()` re-checks every product, so a product that was fresh yesterday raises an alert
  today.
- `PATCH /api/alerts/{id}/read` marks one read.

---

## 15. The Confirm Step

After a scan, the **Result** page shows the extracted dates, confidence and method. The user corrects
anything misread, then presses save, which calls `POST /api/scan/complete`. That saves the product, logs
the scan, and creates an alert if needed. Nothing is saved without a person looking at it.

---

## 16. Dashboard and Statistics

| Endpoint | Returns |
|---|---|
| `/api/dashboard/stats` | fresh, expiring soon, expired counts; scan counts |
| `/api/dashboard/summary` | the dashboard rollup |
| `/api/dashboard/category-breakdown` | status counts per category |

The Dashboard page draws these with Recharts and `StatCard`s.

---

## 17. Frontend Pages

| Route | Purpose |
|---|---|
| `/` | landing page: what it does, three steps |
| `/scan` | camera barcode scan (`BarcodeScanner`) or date-panel photo (`ImageCapture`), manual override |
| `/result` | confirm the extracted dates before saving |
| `/products` | every logged product with its live status |
| `/dashboard` | counts, category breakdown, scan volume |
| `/alerts` | open alerts; mark as read (`AlertBanner`) |
| `/history` | full scan log with confidence and method |

`Sidebar` handles navigation. `lib/api.ts` calls the backend at `NEXT_PUBLIC_API_URL`, default
`http://localhost:8001`.

---

## 18. Installing on a Phone

`public/manifest.json` makes it installable to a phone's home screen. **The camera only works on
`localhost` or HTTPS**, so a phone on the network needs the app served over HTTPS.

---

## 19. API Reference

All routes are under `/api`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/scan/barcode` | look up a barcode; parses GS1-128 when detected |
| POST | `/scan/ocr` | parse dates from OCR text produced in the browser |
| POST | `/scan/ocr-image` | read dates from an image with Gemini |
| GET | `/scan/ocr-status` | which extraction methods are available |
| POST | `/scan/complete` | save a confirmed product and log the scan |
| GET, POST | `/products` | list or create |
| GET, DELETE | `/products/{id}` | fetch or remove |
| GET | `/dashboard/stats`, `/dashboard/summary`, `/dashboard/category-breakdown` | dashboard data |
| GET | `/alerts` | open alerts |
| PATCH | `/alerts/{id}/read` | mark read |
| GET | `/history` | scan log |

---

## 20. Configuration

| Variable | File | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | `backend/.env` | `sqlite+aiosqlite:///./shelflife.db` | relative to where the backend starts |
| `EXPIRY_WARNING_DAYS` | `backend/.env` | 7 | days ahead that count as expiring soon |
| `GOOGLE_API_KEY` | `backend/.env` | empty | optional; enables Gemini Vision |
| `GEMINI_MODEL` | `backend/.env` | `gemini-3.6-flash` | change when Google retires it |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | `http://localhost:8001` | |

---

## 21. Testing

```bash
cd backend
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest tests/ -q          # 46 tests
```

`tests/test_ocr_parsing.py` uses real Indian retail label formats: both dates printed, expiry only, ISO
dates, spelled-out months, two-digit years, best-before durations, unlabelled dates, and text with no
date. It also covers status and alert logic.

### Four bugs the tests found, all fixed
| Label | Was read as | Now |
|---|---|---|
| `EXP 2026-08-15` | 26 Aug **2015** (fresh product logged as expired) | 15 Aug 2026 |
| unlabelled `12/08/2026` | also matched `12/08/20`: two phantom dates | one date |
| `05 JAN 2025` | 1 January (day lost) | 5 January |
| `07/26`, `EXP 12 2026` | nothing | read after an EXP/MFG label |

When changing the parser, **add a test for the new label format first**.

---

## 22. What Is and Is Not Verified

- **Verified:** backend serves every route; CORS from `:3001`; frontend builds; date parser (46 tests);
  Gemini date reading live (2026-09-18).
- **Not verified:** camera barcode scanning and photo capture on a real phone.
- **Not deployed.**

---

## 23. Troubleshooting

| Problem | Fix |
|---|---|
| frontend shows network errors | backend on 8001? if `.env.local` sets `NEXT_PUBLIC_API_URL`, make it match |
| CORS errors | the frontend must be on `http://localhost:3001` |
| database empty or in the wrong place | start the backend from inside `backend/` |
| camera does not open | only on `localhost` or HTTPS |
| photo reading is poor | add a Gemini key, or type the dates on the Result page |
| Gemini 404 in the logs | the model was retired; set `GEMINI_MODEL` |

---

## 24. Complete Feature Summary

### All Features Built

| # | Feature | Type | Key Files |
|---|---|---|---|
| 1 | Camera barcode scanning | Frontend | `BarcodeScanner.tsx` |
| 2 | GS1-128 parsing (server and browser) | Backend / Frontend | `gs1_service.py`, `lib/gs1.ts` |
| 3 | Product lookup: local then Open Food Facts | Backend | `barcode_service.py` |
| 4 | Date-panel photo capture | Frontend | `ImageCapture.tsx` |
| 5 | Gemini Vision date reading | AI | `gemini_service.py` |
| 6 | Tesseract OCR in the browser | Frontend | `lib/ocr.ts` |
| 7 | Indian-format date parser | Backend | `ocr_service.py` |
| 8 | Best-before month calculation | Backend | `expiry_service.py` |
| 9 | Fresh / expiring soon / expired status | Backend | `expiry_service.py` |
| 10 | Confirm-before-save step | Frontend | `app/result` |
| 11 | De-duplicated alerts and refresh | Backend | `alert_service.py` |
| 12 | Dashboard with charts | Frontend | `app/dashboard`, `StatCard.tsx` |
| 13 | Scan history with confidence | Full stack | `routes/history.py`, `app/history` |
| 14 | Installable web app | Frontend | `manifest.json` |
| 15 | 46-case parser test suite | Testing | `tests/test_ocr_parsing.py` |

### Data Flow Architecture

```
Phone browser (Next.js :3001)
  ├── BarcodeScanner ──► POST /api/scan/barcode
  │        ├── GS1? ──► parse AIs (17 expiry, 11 mfg, 10 batch)
  │        └── lookup_product: local DB ──► Open Food Facts
  ├── ImageCapture ──► gemini available?
  │        ├── yes ──► POST /api/scan/ocr-image ──► Gemini (GEMINI_MODEL)
  │        └── no  ──► tesseract.js in browser ──► POST /api/scan/ocr ──► parse_dates_from_text
  └── /result: confirm or correct ──► POST /api/scan/complete
            └── save Product + ScanLog ──► compute_status ──► create_alert_if_needed

/dashboard ──► stats, summary, category breakdown (Recharts)
/alerts    ──► open alerts ──► PATCH read
```

### Tech Stack at a Glance

```
Frontend:  Next.js 16 + React 19 + Tailwind v4 + Recharts + html5-qrcode + tesseract.js
Backend:   FastAPI + SQLAlchemy 2.0 async + SQLite (aiosqlite)
AI:        Google Gemini (optional) for reading date panels
Data:      Open Food Facts for product names
Testing:   pytest, 46 real-label parser cases
```
