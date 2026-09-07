from __future__ import annotations
import re
from datetime import datetime

AI_PATTERNS = {
    "01": {"name": "gtin", "length": 14},
    "02": {"name": "content_gtin", "length": 14},
    "10": {"name": "batch_number", "length": None},
    "11": {"name": "mfg_date", "length": 6},
    "13": {"name": "pack_date", "length": 6},
    "15": {"name": "best_before_date", "length": 6},
    "17": {"name": "expiry_date", "length": 6},
    "21": {"name": "serial_number", "length": None},
    "30": {"name": "quantity", "length": None},
    "37": {"name": "count", "length": None},
}

GS1_DATE_AIS = {"11", "13", "15", "17"}

GS = "\x1d"


def is_gs1_barcode(data: str) -> bool:
    data = data.strip()
    if data.startswith("]C1") or data.startswith("]e0") or data.startswith("]d2"):
        return True
    if re.match(r"^\(?\d{2}\)", data):
        return True
    if data.startswith("01") and len(data) >= 16:
        try:
            int(data[:16])
            return True
        except ValueError:
            pass
    return False


def _parse_gs1_date(value: str) -> datetime | None:
    if len(value) != 6:
        return None
    try:
        yy = int(value[0:2])
        mm = int(value[2:4])
        dd = int(value[4:6])
        year = 2000 + yy
        if dd == 0:
            dd = 1
        return datetime(year, mm, dd)
    except (ValueError, OverflowError):
        return None


def parse_gs1_barcode(data: str) -> dict:
    data = data.strip()
    for prefix in ["]C1", "]e0", "]d2"]:
        if data.startswith(prefix):
            data = data[len(prefix):]
            break

    clean = re.sub(r"[()]", "", data)

    result = {
        "is_gs1": True,
        "gtin": None,
        "barcode": None,
        "mfg_date": None,
        "expiry_date": None,
        "best_before_date": None,
        "batch_number": None,
        "serial_number": None,
        "raw_data": data,
        "parsed_ais": {},
    }

    pos = 0
    while pos < len(clean):
        matched = False

        for ai_code, ai_info in sorted(AI_PATTERNS.items(), key=lambda x: -len(x[0])):
            if clean[pos:pos + len(ai_code)] == ai_code:
                pos += len(ai_code)
                field_name = ai_info["name"]
                fixed_len = ai_info["length"]

                if fixed_len:
                    value = clean[pos:pos + fixed_len]
                    pos += fixed_len
                else:
                    gs_pos = clean.find(GS, pos)
                    next_ai_pos = len(clean)
                    for other_ai in AI_PATTERNS:
                        search_start = pos + 1
                        while search_start < len(clean):
                            idx = clean.find(other_ai, search_start)
                            if idx == -1:
                                break
                            if idx > pos and (clean[idx - 1:idx].isdigit() or idx == pos):
                                candidate = clean[pos:idx]
                                if len(candidate) >= 1:
                                    next_ai_pos = min(next_ai_pos, idx)
                                    break
                            search_start = idx + 1

                    if gs_pos != -1 and gs_pos < next_ai_pos:
                        value = clean[pos:gs_pos]
                        pos = gs_pos + 1
                    else:
                        value = clean[pos:next_ai_pos]
                        pos = next_ai_pos

                result["parsed_ais"][ai_code] = value

                if field_name == "gtin":
                    result["gtin"] = value
                    if value.startswith("0"):
                        result["barcode"] = value[1:]
                    else:
                        result["barcode"] = value
                elif field_name in ("mfg_date", "pack_date"):
                    parsed = _parse_gs1_date(value)
                    if parsed:
                        result["mfg_date"] = parsed.isoformat()
                elif field_name == "expiry_date":
                    parsed = _parse_gs1_date(value)
                    if parsed:
                        result["expiry_date"] = parsed.isoformat()
                elif field_name == "best_before_date":
                    parsed = _parse_gs1_date(value)
                    if parsed:
                        result["best_before_date"] = parsed.isoformat()
                        if not result["expiry_date"]:
                            result["expiry_date"] = parsed.isoformat()
                elif field_name == "batch_number":
                    result["batch_number"] = value
                elif field_name == "serial_number":
                    result["serial_number"] = value

                matched = True
                break

        if not matched:
            pos += 1

    return result
