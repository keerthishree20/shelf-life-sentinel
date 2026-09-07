from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta
from database import get_db
from models.product import Product, ScanLog
import os

router = APIRouter(tags=["dashboard"])

EXPIRY_WARNING_DAYS = int(os.getenv("EXPIRY_WARNING_DAYS", "7"))


@router.get("/dashboard/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    now = datetime.utcnow()
    warning_date = now + timedelta(days=EXPIRY_WARNING_DAYS)

    total = (await db.execute(select(func.count(Product.id)))).scalar() or 0
    expired = (await db.execute(
        select(func.count(Product.id)).where(Product.expiry_date < now)
    )).scalar() or 0
    expiring_soon = (await db.execute(
        select(func.count(Product.id)).where(
            Product.expiry_date >= now,
            Product.expiry_date <= warning_date,
        )
    )).scalar() or 0
    fresh = (await db.execute(
        select(func.count(Product.id)).where(Product.expiry_date > warning_date)
    )).scalar() or 0

    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    scans_today = (await db.execute(
        select(func.count(ScanLog.id)).where(ScanLog.scanned_at >= today_start)
    )).scalar() or 0
    scans_this_week = (await db.execute(
        select(func.count(ScanLog.id)).where(ScanLog.scanned_at >= week_start)
    )).scalar() or 0

    return {
        "total_products": total,
        "expired_count": expired,
        "expiring_soon_count": expiring_soon,
        "fresh_count": fresh,
        "scans_today": scans_today,
        "scans_this_week": scans_this_week,
    }


@router.get("/dashboard/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    total_scans = (await db.execute(select(func.count(ScanLog.id)))).scalar() or 0
    total_products = (await db.execute(select(func.count(Product.id)))).scalar() or 0
    expired_caught = (await db.execute(
        select(func.count(ScanLog.id)).where(ScanLog.result_status == "expired")
    )).scalar() or 0
    return {
        "total_scans": total_scans,
        "total_products": total_products,
        "expired_caught": expired_caught,
    }


@router.get("/dashboard/category-breakdown")
async def get_category_breakdown(db: AsyncSession = Depends(get_db)):
    now = datetime.utcnow()
    warning_date = now + timedelta(days=EXPIRY_WARNING_DAYS)

    result = await db.execute(
        select(Product.category, func.count(Product.id).label("total"))
        .where(Product.category.isnot(None))
        .group_by(Product.category)
    )
    categories = result.all()

    breakdown = []
    for cat_name, total in categories:
        expired = (await db.execute(
            select(func.count(Product.id)).where(
                Product.category == cat_name,
                Product.expiry_date < now,
            )
        )).scalar() or 0

        expiring = (await db.execute(
            select(func.count(Product.id)).where(
                Product.category == cat_name,
                Product.expiry_date >= now,
                Product.expiry_date <= warning_date,
            )
        )).scalar() or 0

        breakdown.append({
            "category": cat_name,
            "total": total,
            "expired": expired,
            "expiring_soon": expiring,
            "fresh": total - expired - expiring,
        })

    return breakdown
