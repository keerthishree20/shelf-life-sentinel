import re
from datetime import datetime
from services.expiry_service import compute_expiry_from_mfg

MONTH_MAP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

MFG_LABELS = re.compile(
    r"(?:mfg|mfd|manufactured|packed\s*on|pkd|pkg\s*d(?:ate)?|dom|date\s*of\s*(?:mfg|manufacture|packing|pkg))\s*[:.>)}\-]?\s*",
    re.IGNORECASE,
)

EXP_LABELS = re.compile(
    r"(?:exp|expiry|expd|expires?|use\s*by|best\s*before|bb|use\s*before|valid\s*until|consume\s*before)\s*[:.>)}\-]?\s*",
    re.IGNORECASE,
)

BEST_BEFORE_PATTERN = re.compile(
    r"(?:best\s*before|bb|use\s*within)\s*[:.>)}\-]?\s*(\d+)\s*(?:months?|mos?\.?|m)\s*(?:from\s*(?:mfg|manufacture|packing|packaging))?",
    re.IGNORECASE,
)

DATE_PATTERNS = [
    (re.compile(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})"), "dmy_full"),
    (re.compile(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})"), "dmy_short"),
    (re.compile(r"(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})"), "ymd"),
    (re.compile(r"(\d{1,2})[/\-.](\d{4})"), "my"),
    (re.compile(r"([A-Za-z]{3,9})\s*[,.]?\s*(\d{4})"), "month_year"),
    (re.compile(r"(\d{1,2})\s*[,.]?\s*([A-Za-z]{3,9})\s*[,.]?\s*(\d{4})"), "d_month_y"),
]


def _parse_date(text: str) -> datetime | None:
    text = text.strip()

    for pattern, fmt in DATE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue

        try:
            if fmt == "dmy_full":
                d, m, y = int(match.group(1)), int(match.group(2)), int(match.group(3))
                if d > 31:
                    d, m = m, d
                return datetime(y, m, d)
            elif fmt == "dmy_short":
                d, m, y = int(match.group(1)), int(match.group(2)), int(match.group(3))
                y += 2000
                if d > 31:
                    d, m = m, d
                return datetime(y, m, d)
            elif fmt == "ymd":
                y, m, d = int(match.group(1)), int(match.group(2)), int(match.group(3))
                return datetime(y, m, d)
            elif fmt == "my":
                m, y = int(match.group(1)), int(match.group(2))
                if m > 12:
                    m, y = y, m
                return datetime(y, m, 1)
            elif fmt == "month_year":
                month_str = match.group(1).lower()
                y = int(match.group(2))
                m = MONTH_MAP.get(month_str)
                if m:
                    return datetime(y, m, 1)
            elif fmt == "d_month_y":
                d = int(match.group(1))
                month_str = match.group(2).lower()
                y = int(match.group(3))
                m = MONTH_MAP.get(month_str)
                if m:
                    return datetime(y, m, d)
        except (ValueError, KeyError):
            continue

    return None


def parse_dates_from_text(raw_text: str) -> dict:
    mfg_date = None
    expiry_date = None
    best_before_months = None
    labels_found = []

    lines = raw_text.replace("\n", " ").strip()

    bb_match = BEST_BEFORE_PATTERN.search(lines)
    if bb_match:
        best_before_months = int(bb_match.group(1))
        labels_found.append("best_before")

    for match in MFG_LABELS.finditer(lines):
        labels_found.append("mfg")
        remaining = lines[match.end():match.end() + 40]
        parsed = _parse_date(remaining)
        if parsed:
            mfg_date = parsed
            break

    for match in EXP_LABELS.finditer(lines):
        labels_found.append("expiry")
        remaining = lines[match.end():match.end() + 40]

        bb_inline = re.match(r"(\d+)\s*(?:months?|mos?\.?)\b", remaining, re.IGNORECASE)
        if bb_inline:
            best_before_months = int(bb_inline.group(1))
            continue

        parsed = _parse_date(remaining)
        if parsed:
            expiry_date = parsed
            break

    if not mfg_date and not expiry_date:
        dates = []
        for pattern, fmt in DATE_PATTERNS:
            for m in pattern.finditer(lines):
                parsed = _parse_date(m.group())
                if parsed and 2020 <= parsed.year <= 2030:
                    dates.append(parsed)
        if len(dates) >= 2:
            dates.sort()
            mfg_date = dates[0]
            expiry_date = dates[-1]
        elif len(dates) == 1:
            expiry_date = dates[0]

    if not expiry_date and mfg_date and best_before_months:
        expiry_date = compute_expiry_from_mfg(mfg_date, best_before_months)

    confidence = 0
    if expiry_date:
        confidence = 85 if labels_found else 60
    elif mfg_date and best_before_months:
        confidence = 75
    elif mfg_date:
        confidence = 40

    return {
        "mfg_date": mfg_date.isoformat() if mfg_date else None,
        "expiry_date": expiry_date.isoformat() if expiry_date else None,
        "best_before_months": best_before_months,
        "raw_text": raw_text,
        "confidence": confidence,
        "labels_found": list(set(labels_found)),
    }
