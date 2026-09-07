from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import get_db
from models.product import ScanLog

router = APIRouter(tags=["history"])


@router.get("/history")
async def get_history(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(ScanLog)
        .options(selectinload(ScanLog.product))
        .order_by(ScanLog.scanned_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    logs = result.scalars().all()

    return [
        {
            "id": log.id,
            "product_id": log.product_id,
            "product_name": log.product.name if log.product else None,
            "barcode": log.barcode,
            "scan_type": log.scan_type,
            "result_status": log.result_status,
            "expiry_date_scanned": log.expiry_date_scanned.isoformat() if log.expiry_date_scanned else None,
            "confidence": log.confidence,
            "scanned_at": log.scanned_at.isoformat() if log.scanned_at else None,
        }
        for log in logs
    ]
