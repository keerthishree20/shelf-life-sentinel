from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.product import Product
import httpx


async def lookup_product(db: AsyncSession, barcode: str) -> dict | None:
    result = await db.execute(select(Product).where(Product.barcode == barcode))
    product = result.scalar_one_or_none()
    if product:
        return {
            "id": product.id,
            "barcode": product.barcode,
            "name": product.name,
            "brand": product.brand,
            "category": product.category,
            "image_url": product.image_url,
            "source": "local_db",
        }

    off_data = await lookup_open_food_facts(barcode)
    if off_data:
        product = Product(
            barcode=barcode,
            name=off_data["name"],
            brand=off_data.get("brand"),
            category=off_data.get("category"),
            image_url=off_data.get("image_url"),
            source="openfoodfacts",
        )
        db.add(product)
        await db.commit()
        await db.refresh(product)
        return {
            "id": product.id,
            "barcode": product.barcode,
            "name": product.name,
            "brand": product.brand,
            "category": product.category,
            "image_url": product.image_url,
            "source": "openfoodfacts",
        }

    return None


async def lookup_open_food_facts(barcode: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            if data.get("status") != 1:
                return None
            p = data.get("product", {})
            name = p.get("product_name") or p.get("product_name_en") or "Unknown"
            if not name or name == "Unknown":
                return None
            return {
                "name": name,
                "brand": p.get("brands"),
                "category": (p.get("categories", "").split(",")[0].strip()) or None,
                "image_url": p.get("image_url") or p.get("image_front_url"),
            }
    except Exception:
        return None
