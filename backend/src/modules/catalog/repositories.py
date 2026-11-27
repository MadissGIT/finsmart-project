from datetime import date, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Category, Discount, KnowledgeArticle, OperationType, Transaction


class CatalogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def discounts(self, category_id: int | None, today: date) -> list[tuple[Discount, str]]:
        query = (
            select(Discount, Category.name)
            .join(Category)
            .where(
                Discount.status == "published",
                Discount.valid_until >= today,
                Discount.valid_from.is_(None) | (Discount.valid_from <= today),
            )
        )
        if category_id is not None:
            query = query.where(Discount.category_id == category_id)
        result = await self._session.execute(
            query.order_by(Discount.is_demo, Discount.code, Discount.id)
        )
        return list(result.tuples().all())

    async def articles(self) -> list[KnowledgeArticle]:
        return list(
            await self._session.scalars(
                select(KnowledgeArticle)
                .where(KnowledgeArticle.status == "published")
                .order_by(KnowledgeArticle.id)
            )
        )

    async def top_expense_categories(
        self,
        user_id: UUID,
        start: datetime,
        end: datetime,
    ) -> list[tuple[int, str]]:
        result = await self._session.execute(
            select(Category.id, Category.name)
            .join(Transaction, Transaction.category_id == Category.id)
            .where(
                Transaction.user_id == user_id,
                Transaction.operation_type == OperationType.DEBIT,
                Transaction.transaction_date >= start,
                Transaction.transaction_date < end,
            )
            .group_by(Category.id, Category.name)
            .order_by(func.sum(Transaction.amount).desc(), Category.id)
            .limit(3)
        )
        return list(result.tuples().all())
