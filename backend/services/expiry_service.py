from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import os

EXPIRY_WARNING_DAYS = int(os.getenv("EXPIRY_WARNING_DAYS", "7"))


def compute_status(expiry_date: datetime | None) -> str:
    if expiry_date is None:
        return "unknown"
    now = datetime.utcnow()
    if expiry_date < now:
        return "expired"
    if expiry_date <= now + timedelta(days=EXPIRY_WARNING_DAYS):
        return "expiring_soon"
    return "fresh"


def days_until_expiry(expiry_date: datetime | None) -> int | None:
    if expiry_date is None:
        return None
    delta = expiry_date - datetime.utcnow()
    return delta.days


def compute_expiry_from_mfg(mfg_date: datetime, best_before_months: int) -> datetime:
    return mfg_date + relativedelta(months=best_before_months)


def should_generate_alert(expiry_date: datetime | None) -> tuple[bool, str]:
    if expiry_date is None:
        return False, ""
    status = compute_status(expiry_date)
    if status == "expired":
        return True, "expired"
    if status == "expiring_soon":
        return True, "expiring_soon"
    return False, ""
