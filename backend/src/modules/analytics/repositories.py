from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import BudgetGroup, Category, OperationType, Transaction


class AnalyticsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def totals(
        self,
        *,
        user_id: UUID,
        start: datetime,
        end: datetime,
    ) -> list[tuple[int, str, BudgetGroup, OperationType, Decimal]]:
        result = await self._session.execute(
            select(
                Category.id,
                Category.name,
                Category.budget_group,
                Transaction.operation_type,
                func.sum(Transaction.amount),
            )
            .join(Category, Transaction.category_id == Category.id)
            .where(
                Transaction.user_id == user_id,
                Transaction.transaction_date >= start,
                Transaction.transaction_date < end,
            )
            .group_by(Category.id, Category.name, Category.budget_group, Transaction.operation_type)
            .order_by(Category.id, Transaction.operation_type),
        )
        return [
            (cid, name, group, direction, amount)
            for cid, name, group, direction, amount in result.tuples()
        ]
