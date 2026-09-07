from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from services.alert_service import get_active_alerts, mark_alert_read, refresh_alerts

router = APIRouter(tags=["alerts"])


def alert_to_dict(alert) -> dict:
    return {
        "id": alert.id,
        "product_id": alert.product_id,
        "alert_type": alert.alert_type,
        "message": alert.message,
        "is_read": alert.is_read,
        "days_until_expiry": alert.days_until_expiry,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
    }


@router.get("/alerts")
async def get_alerts_endpoint(
    include_read: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    await refresh_alerts(db)
    alerts = await get_active_alerts(db, include_read=include_read)
    return [alert_to_dict(a) for a in alerts]


@router.patch("/alerts/{alert_id}/read")
async def mark_read(alert_id: int, db: AsyncSession = Depends(get_db)):
    alert = await mark_alert_read(db, alert_id)
    if not alert:
        return {"error": "Alert not found"}
    return alert_to_dict(alert)
