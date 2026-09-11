"""Date-panel parsing tests.

`parse_dates_from_text` is the riskiest code in the project: it reads whatever
Tesseract or Gemini returned for a printed date panel, and a regression here is
silent -- a product still gets logged, just with the wrong expiry, which is the
exact failure the app exists to prevent. Every case below is a label format
that actually appears on Indian retail packaging.
"""

import pytest

from services.expiry_service import (
    compute_expiry_from_mfg,
    compute_status,
    days_until_expiry,
    should_generate_alert,
)
from services.ocr_service import parse_dates_from_text

from datetime import datetime, timedelta


def _dates(text):
    r = parse_dates_from_text(text)
    return r["mfg_date"], r["expiry_date"]


# --- both dates printed ------------------------------------------------------

@pytest.mark.parametrize(
    "text,mfg,exp",
    [
        ("MFG 12/2024 EXP 12/2026", "2024-12-01", "2026-12-01"),
        ("MFG: 01/03/2025  EXP: 01/03/2026", "2025-03-01", "2026-03-01"),
        ("MFG 15/06/2025 EXP 15/06/2026 Batch A1", "2025-06-15", "2026-06-15"),
        ("MFD 01.04.2025 EXPD 01.04.2027", "2025-04-01", "2027-04-01"),
        ("Date of Manufacture: 10/01/2025 Use By: 10/07/2025", "2025-01-10", "2025-07-10"),
    ],
)
def test_both_dates_labelled(text, mfg, exp):
    m, e = _dates(text)
    assert m.startswith(mfg)
    assert e.startswith(exp)


# --- ISO / yyyy-mm-dd --------------------------------------------------------
# Regression guard: the day-first patterns used to match the tail of an ISO
# date, so "EXP 2026-08-15" was read as 26 Aug 2015 -- a fresh product logged
# as eleven years expired.

@pytest.mark.parametrize(
    "text,exp",
    [
        ("Batch No 4412 EXP 2026-08-15", "2026-08-15"),
        ("EXPIRY 2027-01-31", "2027-01-31"),
        ("USE BY 2026/12/01", "2026-12-01"),
    ],
)
def test_iso_dates_are_not_read_day_first(text, exp):
    _, e = _dates(text)
    assert e.startswith(exp)


def test_iso_mfg_and_expiry_together():
    m, e = _dates("MFG 2025-01-10  USE BY 2026-01-10")
    assert m.startswith("2025-01-10")
    assert e.startswith("2026-01-10")


# --- expiry only -------------------------------------------------------------

@pytest.mark.parametrize(
    "text,exp",
    [
        ("USE BY 30/11/2026", "2026-11-30"),
        ("USE BEFORE 31/12/2026", "2026-12-31"),
        ("EXP MAR 2027", "2027-03-01"),
        ("Valid until 01/09/2026", "2026-09-01"),
        ("Consume before 20 DEC 2026", "2026-12-20"),
    ],
)
def test_expiry_only(text, exp):
    m, e = _dates(text)
    assert e.startswith(exp)
    assert m is None


def test_day_is_kept_when_month_is_spelled_out():
    # "05 JAN 2025" used to collapse to the 1st because the month-year pattern
    # was tried before the day-month-year one.
    m, e = _dates("MFG DATE: 05 JAN 2025 EXPIRY DATE: 05 JAN 2027")
    assert m.startswith("2025-01-05")
    assert e.startswith("2027-01-05")


# --- short year and space-separated month/year -------------------------------

@pytest.mark.parametrize(
    "text,exp",
    [
        ("Exp. 07/26", "2026-07-01"),
        ("EXP 12 2026", "2026-12-01"),
        ("USE BY 03-27", "2027-03-01"),
    ],
)
def test_short_and_spaced_month_year(text, exp):
    _, e = _dates(text)
    assert e.startswith(exp)


# --- best-before durations ---------------------------------------------------

@pytest.mark.parametrize(
    "text,mfg,exp,months",
    [
        ("PKD 15.06.2025 BEST BEFORE 6 MONTHS FROM MFG", "2025-06-15", "2025-12-15", 6),
        ("Best Before 12 Months from Packaging. MFD 02/2025", "2025-02-01", "2026-02-01", 12),
        ("BB 18 MONTHS  MFG 03/2025", "2025-03-01", "2026-09-01", 18),
        ("DOM: 11/2024 BEST BEFORE 24 MONTHS", "2024-11-01", "2026-11-01", 24),
        ("MFG 01/2025 Use within 9 months", "2025-01-01", "2025-10-01", 9),
    ],
)
def test_best_before_months_derive_expiry(text, mfg, exp, months):
    r = parse_dates_from_text(text)
    assert r["best_before_months"] == months
    assert r["mfg_date"].startswith(mfg)
    assert r["expiry_date"].startswith(exp)


def test_printed_expiry_wins_over_derived_one():
    r = parse_dates_from_text("MFG 01/01/2025 BEST BEFORE 6 MONTHS EXP 01/06/2026")
    assert r["expiry_date"].startswith("2026-06-01")


# --- mfg only ----------------------------------------------------------------

def test_mfg_only_leaves_expiry_unknown():
    r = parse_dates_from_text("PACKED ON 01/02/2025")
    assert r["mfg_date"].startswith("2025-02-01")
    assert r["expiry_date"] is None
    assert r["confidence"] == 40


# --- unlabelled dates --------------------------------------------------------

def test_two_bare_dates_are_read_as_mfg_then_expiry():
    r = parse_dates_from_text("10/01/2025    10/01/2027")
    assert r["mfg_date"].startswith("2025-01-10")
    assert r["expiry_date"].startswith("2027-01-10")
    assert r["confidence"] == 60


def test_single_bare_date_is_treated_as_expiry():
    r = parse_dates_from_text("Net Wt 200g  12/08/2026")
    assert r["expiry_date"].startswith("2026-08-12")
    assert r["mfg_date"] is None


# --- nothing to find ---------------------------------------------------------

@pytest.mark.parametrize(
    "text",
    [
        "",
        "   ",
        "MRP Rs 45 Net Wt 200g",
        "Lot 2026 only",
        "Ingredients: wheat flour, sugar, palm oil",
    ],
)
def test_no_dates_found(text):
    r = parse_dates_from_text(text)
    assert r["mfg_date"] is None
    assert r["expiry_date"] is None
    assert r["confidence"] == 0


def test_impossible_date_is_rejected_not_guessed():
    # OCR misreads produce these. Returning nothing is correct; inventing a
    # date the operator then trusts is not.
    r = parse_dates_from_text("expiry 32/13/2026")
    assert r["expiry_date"] is None


# --- output contract ---------------------------------------------------------

def test_raw_text_is_echoed_unchanged():
    text = "MFG 01/2025\nEXP 01/2027"
    assert parse_dates_from_text(text)["raw_text"] == text


def test_labels_found_is_deduplicated():
    r = parse_dates_from_text("EXP 12/2026 EXP 12/2026 EXP 12/2026")
    assert r["labels_found"].count("expiry") == 1


def test_confidence_is_higher_when_a_label_was_seen():
    labelled = parse_dates_from_text("EXP 12/08/2026")["confidence"]
    bare = parse_dates_from_text("Net Wt 200g  12/08/2026")["confidence"]
    assert labelled > bare


# --- expiry_service, which consumes the parsed dates -------------------------

def test_status_buckets():
    now = datetime.utcnow()
    assert compute_status(None) == "unknown"
    assert compute_status(now - timedelta(days=1)) == "expired"
    assert compute_status(now + timedelta(days=3)) == "expiring_soon"
    assert compute_status(now + timedelta(days=60)) == "fresh"


def test_days_until_expiry():
    assert days_until_expiry(None) is None
    assert days_until_expiry(datetime.utcnow() + timedelta(days=10, hours=1)) == 10


def test_expiry_from_mfg_adds_calendar_months_not_30_day_blocks():
    # 31 Jan + 1 month is 28 Feb, not 2 March.
    assert compute_expiry_from_mfg(datetime(2025, 1, 31), 1) == datetime(2025, 2, 28)
    assert compute_expiry_from_mfg(datetime(2025, 6, 15), 18) == datetime(2026, 12, 15)


def test_alerts_fire_only_for_expired_or_expiring():
    now = datetime.utcnow()
    assert should_generate_alert(None) == (False, "")
    assert should_generate_alert(now - timedelta(days=1)) == (True, "expired")
    assert should_generate_alert(now + timedelta(days=2)) == (True, "expiring_soon")
    assert should_generate_alert(now + timedelta(days=90)) == (False, "")


# --- the loose two-token forms must not volunteer a date --------------------
# "07/26" and "12 2026" are only trustworthy once a label has said a date is
# coming. Unlabelled, a batch number or a price looks identical.

@pytest.mark.parametrize(
    "text",
    [
        "Batch 12/26 MRP 45.00",
        "EXP: 12.50",
        "MRP 45.50 Net Wt 200g",
        "Code 08 2026 pack of 6",
    ],
)
def test_batch_numbers_and_prices_are_not_read_as_dates(text):
    r = parse_dates_from_text(text)
    assert r["expiry_date"] is None
    assert r["mfg_date"] is None


def test_a_real_label_still_wins_over_a_batch_number():
    _, e = _dates("Batch No 12/26 EXP 08/2027")
    assert e.startswith("2027-08-01")


def test_implausible_two_digit_year_is_rejected():
    # 2050 is not a shelf life, it is an OCR misread.
    assert parse_dates_from_text("EXP 12/50")["expiry_date"] is None
