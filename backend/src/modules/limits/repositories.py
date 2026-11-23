from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import BudgetGroup, Category, CategoryLimit, OperationType, Transaction


class LimitRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def category_group(self, category_id: int) -> BudgetGroup | None:
        return await self._session.scalar(
            select(Category.budget_group).where(Category.id == category_id)
        )

    async def save(self, user_id: UUID, category_id: int, amount: Decimal) -> None:
        await self._session.execute(
            insert(CategoryLimit)
            .values(user_id=user_id, category_id=category_id, amount=amount)
            .on_conflict_do_update(
                index_elements=[CategoryLimit.user_id, CategoryLimit.category_id],
                set_={"amount": amount},
            )
        )
        await self._session.commit()

    async def delete(self, user_id: UUID, category_id: int) -> None:
        await self._session.execute(
            delete(CategoryLimit).where(
                CategoryLimit.user_id == user_id, CategoryLimit.category_id == category_id
            )
        )
        await self._session.commit()

    async def usage(
        self, user_id: UUID, start: datetime, end: datetime
    ) -> list[tuple[int, str, Decimal, Decimal]]:
        result = await self._session.execute(
            select(
                CategoryLimit.category_id,
                Category.name,
                CategoryLimit.amount,
                func.coalesce(func.sum(Transaction.amount), 0),
            )
            .join(Category, Category.id == CategoryLimit.category_id)
            .outerjoin(
                Transaction,
                (Transaction.user_id == CategoryLimit.user_id)
                & (Transaction.category_id == CategoryLimit.category_id)
                & (Transaction.operation_type == OperationType.DEBIT)
                & (Transaction.transaction_date >= start)
                & (Transaction.transaction_date < end),
            )
            .where(CategoryLimit.user_id == user_id)
            .group_by(CategoryLimit.category_id, Category.name, CategoryLimit.amount)
            .order_by(CategoryLimit.category_id)
        )
        return list(result.tuples().all())
