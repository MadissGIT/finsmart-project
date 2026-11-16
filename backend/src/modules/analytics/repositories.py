from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import BankSource, BudgetGroup, Category, Discount, OperationType, Transaction


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

    async def income(self, user_id: UUID, start: datetime, end: datetime) -> Decimal:
        result = await self._session.scalar(
            select(func.sum(Transaction.amount))
            .join(Category)
            .where(
                Transaction.user_id == user_id,
                Transaction.transaction_date >= start,
                Transaction.transaction_date < end,
                Transaction.operation_type == OperationType.CREDIT,
                Category.budget_group != BudgetGroup.SAVINGS,
            )
        )
        return result if result is not None else Decimal(0)

    async def diagnosis_rows(
        self, user_id: UUID, start: datetime, end: datetime
    ) -> list[tuple[Transaction, BudgetGroup]]:
        result = await self._session.execute(
            select(Transaction, Category.budget_group)
            .join(Category)
            .where(
                Transaction.user_id == user_id,
                Transaction.transaction_date >= start,
                Transaction.transaction_date < end,
            )
            .order_by(Transaction.transaction_date, Transaction.id)
        )
        return list(result.tuples().all())

    async def activity(
        self, user_id: UUID, start: datetime, end: datetime, timezone: str
    ) -> list[tuple[date, BankSource, int]]:
        local_day = cast(func.timezone(timezone, Transaction.created_at), Date)
        result = await self._session.execute(
            select(local_day, Transaction.bank_source, func.count())
            .where(
                Transaction.user_id == user_id,
                Transaction.created_at >= start,
                Transaction.created_at < end,
            )
            .group_by(local_day, Transaction.bank_source)
        )
        return list(result.tuples().all())

    async def discounts(self, category_ids: set[int], as_of: date) -> list[Discount]:
        result = await self._session.scalars(
            select(Discount)
            .where(Discount.category_id.in_(category_ids), Discount.valid_until >= as_of)
            .order_by(Discount.discount_percent.desc(), Discount.id)
        )
        return list(result.all())
