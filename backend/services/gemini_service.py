import os
import json
import re
import base64
from services.ocr_service import parse_dates_from_text
from services.expiry_service import compute_expiry_from_mfg

def _api_key() -> str:
    # Read at call time, not import time. Reading at import made availability
    # depend on whether database.py (which loads the .env) had been imported
    # first, so filling in the key silently had no effect on some entrypoints.
    return os.getenv("GOOGLE_API_KEY", "")

PROMPT = """You are an expert at reading expiry and manufacturing dates from product packaging labels.

Analyze this image and extract date information. Return ONLY a valid JSON object:

{
  "mfg_date": "YYYY-MM-DD or null",
  "expiry_date": "YYYY-MM-DD or null",
  "best_before_months": null or integer,
  "raw_text": "exact date-related text you can read",
  "confidence": number between 0 and 100
}

Rules:
- Indian packaging uses DD/MM/YYYY format — do NOT confuse DD/MM with MM/DD
- "Best Before 6 months from Mfg" means best_before_months=6, expiry_date=null
- "Use By", "Exp", "EXP", "BB" indicate expiry dates
- "Mfg", "MFG", "Packed on", "DOM" indicate manufacturing dates
- "BB: 12/2025" means Best Before December 2025 (expiry_date = "2025-12-31")
- Return ONLY the JSON, no extra text"""


def is_gemini_available() -> bool:
    return bool(_api_key())


async def extract_dates_with_gemini(image_bytes: bytes) -> dict | None:
    api_key = _api_key()
    if not api_key:
        return None

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")

        response = model.generate_content([
            PROMPT,
            {"mime_type": "image/jpeg", "data": base64.b64encode(image_bytes).decode()},
        ])

        raw = response.text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        data = json.loads(raw)

        mfg = data.get("mfg_date")
        expiry = data.get("expiry_date")
        bb_months = data.get("best_before_months")

        if not expiry and mfg and bb_months:
            from datetime import datetime
            mfg_dt = datetime.fromisoformat(mfg)
            expiry_dt = compute_expiry_from_mfg(mfg_dt, int(bb_months))
            expiry = expiry_dt.isoformat()

        return {
            "mfg_date": mfg,
            "expiry_date": expiry,
            "best_before_months": bb_months,
            "raw_text": data.get("raw_text", ""),
            "confidence": data.get("confidence", 90),
            "labels_found": ["gemini_vision"],
            "source": "gemini",
        }
    except Exception as e:
        print(f"Gemini Vision error: {e}")
        return None
