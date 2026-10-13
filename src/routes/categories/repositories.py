from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Category


class CategoryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_categories(self) -> list[Category]:
        result = await self._session.scalars(select(Category).order_by(Category.id))
        return list(result.all())
