from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta
from database import get_db
from models.product import Product
from services.expiry_service import compute_status, days_until_expiry
from services.alert_service import create_alert_if_needed
import os

router = APIRouter(tags=["products"])

EXPIRY_WARNING_DAYS = int(os.getenv("EXPIRY_WARNING_DAYS", "7"))


def product_to_dict(p: Product) -> dict:
    status = compute_status(p.expiry_date)
    return {
        "id": p.id,
        "barcode": p.barcode,
        "name": p.name,
        "brand": p.brand,
        "category": p.category,
        "mfg_date": p.mfg_date.isoformat() if p.mfg_date else None,
        "expiry_date": p.expiry_date.isoformat() if p.expiry_date else None,
        "batch_number": p.batch_number,
        "image_url": p.image_url,
        "source": p.source,
        "status": status,
        "days_until_expiry": days_until_expiry(p.expiry_date),
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/products")
async def list_products(
    filter: str = Query("all", regex="^(all|fresh|expiring_soon|expired)$"),
    category: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Product)
    now = datetime.utcnow()

    if filter == "expired":
        query = query.where(Product.expiry_date < now)
    elif filter == "expiring_soon":
        query = query.where(
            Product.expiry_date >= now,
            Product.expiry_date <= now + timedelta(days=EXPIRY_WARNING_DAYS),
        )
    elif filter == "fresh":
        query = query.where(Product.expiry_date > now + timedelta(days=EXPIRY_WARNING_DAYS))

    if category:
        query = query.where(Product.category == category)
    if search:
        query = query.where(
            Product.name.ilike(f"%{search}%") | Product.barcode.ilike(f"%{search}%")
        )

    query = query.order_by(Product.created_at.desc())
    result = await db.execute(query)
    products = result.scalars().all()
    return [product_to_dict(p) for p in products]


@router.post("/products")
async def create_product(data: dict, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(Product).where(Product.barcode == data.get("barcode"))
    )
    product = existing.scalar_one_or_none()

    if product:
        for key in ["name", "brand", "category", "mfg_date", "expiry_date", "batch_number", "image_url"]:
            if key in data and data[key] is not None:
                value = data[key]
                if key in ("mfg_date", "expiry_date") and isinstance(value, str):
                    value = datetime.fromisoformat(value)
                setattr(product, key, value)
        product.updated_at = datetime.utcnow()
    else:
        mfg = data.get("mfg_date")
        exp = data.get("expiry_date")
        if isinstance(mfg, str):
            mfg = datetime.fromisoformat(mfg)
        if isinstance(exp, str):
            exp = datetime.fromisoformat(exp)

        product = Product(
            barcode=data.get("barcode"),
            name=data.get("name", "Unknown Product"),
            brand=data.get("brand"),
            category=data.get("category"),
            mfg_date=mfg,
            expiry_date=exp,
            batch_number=data.get("batch_number"),
            image_url=data.get("image_url"),
            source=data.get("source", "manual"),
        )
        db.add(product)

    await db.commit()
    await db.refresh(product)
    await create_alert_if_needed(db, product)
    return product_to_dict(product)


@router.get("/products/{product_id}")
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        return {"error": "Product not found"}
    return product_to_dict(product)


@router.delete("/products/{product_id}")
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        return {"error": "Product not found"}
    await db.delete(product)
    await db.commit()
    return {"message": "Product deleted"}
