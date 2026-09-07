from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from database import get_db
from models.product import Product, ScanLog
from services.barcode_service import lookup_product
from services.expiry_service import compute_status, days_until_expiry, compute_expiry_from_mfg
from services.alert_service import create_alert_if_needed
from services.gs1_service import is_gs1_barcode, parse_gs1_barcode
from services.gemini_service import is_gemini_available, extract_dates_with_gemini

router = APIRouter(tags=["scan"])


@router.post("/scan/barcode")
async def scan_barcode(data: dict, db: AsyncSession = Depends(get_db)):
    barcode = data.get("barcode", "").strip()
    if not barcode:
        return {"error": "Barcode is required"}

    if is_gs1_barcode(barcode):
        gs1_data = parse_gs1_barcode(barcode)
        lookup_barcode = gs1_data.get("barcode") or barcode
        product_info = await lookup_product(db, lookup_barcode)
        return {
            "found": product_info is not None,
            "barcode": lookup_barcode,
            "product": product_info,
            "gs1": gs1_data,
        }

    product_info = await lookup_product(db, barcode)
    if product_info:
        return {"found": True, "product": product_info, "gs1": None}
    return {"found": False, "barcode": barcode, "gs1": None}


@router.post("/scan/ocr")
async def scan_ocr(data: dict, db: AsyncSession = Depends(get_db)):
    from services.ocr_service import parse_dates_from_text

    raw_text = data.get("raw_text", "")
    if not raw_text:
        return {"error": "No OCR text provided"}

    parsed = parse_dates_from_text(raw_text)
    return parsed


@router.post("/scan/ocr-image")
async def scan_ocr_image(image: UploadFile = File(...)):
    image_bytes = await image.read()

    if is_gemini_available():
        result = await extract_dates_with_gemini(image_bytes)
        if result and (result.get("expiry_date") or result.get("mfg_date")):
            return result

    return {
        "mfg_date": None,
        "expiry_date": None,
        "best_before_months": None,
        "raw_text": "",
        "confidence": 0,
        "labels_found": [],
        "source": "none",
        "message": "Gemini API not available. Using on-device OCR or enter dates manually.",
    }


@router.get("/scan/ocr-status")
async def ocr_status():
    return {
        "gemini_available": is_gemini_available(),
        "tesseract_available": True,
    }


@router.post("/scan/complete")
async def scan_complete(data: dict, db: AsyncSession = Depends(get_db)):
    barcode = data.get("barcode", "").strip()
    product_name = data.get("name")
    brand = data.get("brand")
    category = data.get("category")
    mfg_date_str = data.get("mfg_date")
    expiry_date_str = data.get("expiry_date")
    best_before_months = data.get("best_before_months")
    batch_number = data.get("batch_number")
    image_url = data.get("image_url")
    scan_type = data.get("scan_type", "barcode")
    confidence = data.get("confidence")
    raw_ocr_text = data.get("raw_ocr_text")

    mfg_date = datetime.fromisoformat(mfg_date_str) if mfg_date_str else None
    expiry_date = datetime.fromisoformat(expiry_date_str) if expiry_date_str else None

    if not expiry_date and mfg_date and best_before_months:
        expiry_date = compute_expiry_from_mfg(mfg_date, int(best_before_months))

    product = None
    if barcode:
        result = await db.execute(select(Product).where(Product.barcode == barcode))
        product = result.scalar_one_or_none()

    if product:
        if product_name:
            product.name = product_name
        if brand:
            product.brand = brand
        if category:
            product.category = category
        if mfg_date:
            product.mfg_date = mfg_date
        if expiry_date:
            product.expiry_date = expiry_date
        if batch_number:
            product.batch_number = batch_number
        product.updated_at = datetime.utcnow()
    elif barcode:
        product = Product(
            barcode=barcode,
            name=product_name or "Unknown Product",
            brand=brand,
            category=category,
            mfg_date=mfg_date,
            expiry_date=expiry_date,
            batch_number=batch_number,
            image_url=image_url,
            source="scan",
        )
        db.add(product)

    if product:
        await db.commit()
        await db.refresh(product)
        await create_alert_if_needed(db, product)

    status = compute_status(expiry_date)
    days = days_until_expiry(expiry_date)

    scan_log = ScanLog(
        product_id=product.id if product else None,
        barcode=barcode,
        scan_type=scan_type,
        result_status=status,
        expiry_date_scanned=expiry_date,
        confidence=confidence,
        raw_ocr_text=raw_ocr_text,
    )
    db.add(scan_log)
    await db.commit()
    await db.refresh(scan_log)

    return {
        "scan_id": scan_log.id,
        "product": {
            "id": product.id if product else None,
            "barcode": barcode,
            "name": product.name if product else product_name,
            "brand": product.brand if product else brand,
            "category": product.category if product else category,
            "image_url": product.image_url if product else image_url,
            "mfg_date": mfg_date.isoformat() if mfg_date else None,
            "expiry_date": expiry_date.isoformat() if expiry_date else None,
            "batch_number": batch_number,
        },
        "status": status,
        "days_until_expiry": days,
        "confidence": confidence,
    }
