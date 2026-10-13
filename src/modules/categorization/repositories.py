from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Category, CategoryRule, UserRule


class CategorizationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_user_category(
        self, user_id: UUID, merchant_name: str
    ) -> Category | None:
        return await self._session.scalar(
            select(Category)
            .join(UserRule, UserRule.category_id == Category.id)
            .where(
                UserRule.user_id == user_id, UserRule.merchant_name == merchant_name
            ),
        )

    async def list_rules(self) -> list[tuple[CategoryRule, Category]]:
        result = await self._session.execute(
            select(CategoryRule, Category)
            .join(Category, CategoryRule.category_id == Category.id)
            .order_by(CategoryRule.priority, CategoryRule.id),
        )
        return [(rule, category) for rule, category in result.tuples()]

    async def get_category(self, category_id: int) -> Category | None:
        return await self._session.get(Category, category_id)
