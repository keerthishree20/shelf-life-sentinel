from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.product import Product, Alert
from services.expiry_service import should_generate_alert, days_until_expiry


async def create_alert_if_needed(db: AsyncSession, product: Product) -> Alert | None:
    should_alert, alert_type = should_generate_alert(product.expiry_date)
    if not should_alert:
        return None

    existing = await db.execute(
        select(Alert).where(
            Alert.product_id == product.id,
            Alert.alert_type == alert_type,
            Alert.is_read == False,
        )
    )
    if existing.scalar_one_or_none():
        return None

    days = days_until_expiry(product.expiry_date)
    if alert_type == "expired":
        message = f"{product.name} (Barcode: {product.barcode}) has EXPIRED {abs(days)} day(s) ago."
    else:
        message = f"{product.name} (Barcode: {product.barcode}) expires in {days} day(s)."

    alert = Alert(
        product_id=product.id,
        alert_type=alert_type,
        message=message,
        days_until_expiry=days,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert


async def get_active_alerts(db: AsyncSession, include_read: bool = False) -> list[Alert]:
    query = select(Alert).order_by(Alert.days_until_expiry.asc())
    if not include_read:
        query = query.where(Alert.is_read == False)
    result = await db.execute(query)
    return list(result.scalars().all())


async def mark_alert_read(db: AsyncSession, alert_id: int) -> Alert | None:
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if alert:
        alert.is_read = True
        await db.commit()
        await db.refresh(alert)
    return alert


async def refresh_alerts(db: AsyncSession) -> int:
    result = await db.execute(select(Product).where(Product.expiry_date.isnot(None)))
    products = result.scalars().all()
    count = 0
    for product in products:
        alert = await create_alert_if_needed(db, product)
        if alert:
            count += 1
    return count
