from datetime import date, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Category, Discount, OperationType, Transaction


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
