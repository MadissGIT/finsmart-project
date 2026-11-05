from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from src.db.models import BudgetGroup, OperationType
from src.modules.analytics.repositories import AnalyticsRepository
from src.modules.analytics.schemas import (
    BudgetAllocation,
    BudgetDashboard,
    BudgetDistribution,
    CategoryExpense,
    DashboardSummary,
    Period,
)

CENT = Decimal("0.01")


class AnalyticsService:
    def __init__(
        self, analytics_repository: AnalyticsRepository, financial_timezone: ZoneInfo
    ) -> None:
        self._analytics_repository = analytics_repository
        self._financial_timezone = financial_timezone

    async def dashboard(self, *, user_id: UUID, from_date: date, to_date: date) -> BudgetDashboard:
        if (
            from_date == date.min
            or to_date == date.max
            or to_date < from_date
            or (to_date - from_date).days > 366
        ):
            raise ValueError("Период должен составлять от одного до 367 дней")
        start = datetime.combine(from_date, datetime.min.time(), self._financial_timezone)
        end = datetime.combine(
            to_date + timedelta(days=1), datetime.min.time(), self._financial_timezone
        )
        totals = await self._analytics_repository.totals(
            user_id=user_id,
            start=start.astimezone(UTC),
            end=end.astimezone(UTC),
        )
        income = sum(
            (
                amount
                for _, _, group, direction, amount in totals
                if direction is OperationType.CREDIT and group is not BudgetGroup.SAVINGS
            ),
            Decimal(0),
        )
        expense = sum(
            (amount for _, _, _, direction, amount in totals if direction is OperationType.DEBIT),
            Decimal(0),
        )
        base = income if income > 0 else expense
        groups = {group: Decimal(0) for group in BudgetGroup}
        categories = []
        for category_id, name, group, direction, amount in totals:
            if direction is OperationType.DEBIT:
                groups[group] += amount
                categories.append(
                    CategoryExpense(
                        category_id=category_id,
                        name=name,
                        amount=amount,
                        percent=(amount / expense * 100).quantize(CENT) if expense else Decimal(0),
                    )
                )
        # Explicit saving transfers plus unspent income; no money is counted twice.
        groups[BudgetGroup.SAVINGS] += max(income - expense, Decimal(0))
        allocations = {}
        for group, target in (
            (BudgetGroup.NEEDS, Decimal("0.50")),
            (BudgetGroup.WANTS, Decimal("0.30")),
            (BudgetGroup.SAVINGS, Decimal("0.20")),
        ):
            actual = groups[group]
            limit = (base * target).quantize(CENT)
            allocations[group] = BudgetAllocation(
                amount=actual,
                percent=(actual / base * 100).quantize(CENT) if base else Decimal(0),
                target_percent=target * 100,
                target_amount=limit,
                deviation=actual - limit,
            )
        score = (
            max(
                Decimal(0),
                Decimal(100)
                - max(
                    (groups[BudgetGroup.WANTS] / base - Decimal("0.30")) / Decimal("0.20") * 100,
                    Decimal(0),
                ),
            )
            if base
            else Decimal(0)
        )
        return BudgetDashboard(
            period=Period(from_date=from_date, to=to_date),
            summary=DashboardSummary(
                total_income=income, total_expense=expense, net_balance=income - expense
            ),
            budget_50_30_20=BudgetDistribution(
                needs=allocations[BudgetGroup.NEEDS],
                wants=allocations[BudgetGroup.WANTS],
                savings=allocations[BudgetGroup.SAVINGS],
            ),
            by_categories=categories,
            income_base=base,
            deficit_financing=income == 0,
            unallocated_expense=groups[BudgetGroup.OTHER] + groups[BudgetGroup.INCOME],
            budget_score=score.quantize(CENT),
        )
