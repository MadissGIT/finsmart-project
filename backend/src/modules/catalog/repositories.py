from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Category, Discount


class CatalogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def discounts(self, category_id: int | None, today: date) -> list[tuple[Discount, str]]:
        query = select(Discount, Category.name).join(Category).where(Discount.valid_until >= today)
        if category_id is not None:
            query = query.where(Discount.category_id == category_id)
        return list(
            (await self._session.execute(query.order_by(Discount.code, Discount.id))).tuples().all()
        )
