import asyncio
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest

from src.db.models import BudgetGroup, OperationType
from src.modules.analytics.repositories import AnalyticsRepository
from src.modules.analytics.service import AnalyticsService


@pytest.mark.parametrize(
    ("income", "needs", "wants", "savings", "expected_score"),
    [
        (100000, 50000, 30000, 10000, 100),
        (100000, 50000, 40000, 0, 50),
        (100000, 50000, 50000, 0, 0),
        (100000, 50000, 60000, 0, 0),
        (0, 0, 0, 0, 0),
        (0, 500, 500, 0, 0),
    ],
)
def test_budget_formula(
    income: int, needs: int, wants: int, savings: int, expected_score: int
) -> None:
    repository = AsyncMock(spec=AnalyticsRepository)
    repository.totals.return_value = [
        (10, "Зарплата", BudgetGroup.INCOME, OperationType.CREDIT, Decimal(income)),
        (1, "Продукты", BudgetGroup.NEEDS, OperationType.DEBIT, Decimal(needs)),
        (5, "Кафе", BudgetGroup.WANTS, OperationType.DEBIT, Decimal(wants)),
        (9, "Накопления", BudgetGroup.SAVINGS, OperationType.DEBIT, Decimal(savings)),
        (9, "Накопления", BudgetGroup.SAVINGS, OperationType.CREDIT, Decimal(999999)),
    ]
    result = asyncio.run(
        AnalyticsService(repository, ZoneInfo("Europe/Moscow")).dashboard(
            user_id=uuid4(),
            from_date=date(2026, 10, 1),
            to_date=date(2026, 10, 31),
        )
    )
    assert result.summary.total_income == income
    assert result.summary.total_expense == needs + wants + savings
    assert result.budget_score == expected_score
    assert result.deficit_financing == (income == 0)
    base = income or needs + wants + savings
    assert result.budget_50_30_20.needs.target_amount == Decimal(base) * Decimal("0.50")
    assert result.budget_50_30_20.savings.amount == savings + max(
        income - needs - wants - savings, 0
    )
    params = repository.totals.await_args.kwargs
    assert params["start"].isoformat() == "2026-09-30T21:00:00+00:00"
    assert params["end"].isoformat() == "2026-10-31T21:00:00+00:00"
    assert isinstance(result.model_dump(mode="json")["summary"]["total_income"], (float, int))


@pytest.mark.parametrize(
    ("start", "end"),
    [
        (date(2026, 10, 2), date(2026, 10, 1)),
        (date(2020, 1, 1), date(2026, 1, 1)),
        (date.min, date.min),
        (date.max, date.max),
    ],
)
def test_invalid_budget_period(start: date, end: date) -> None:
    repository = AsyncMock(spec=AnalyticsRepository)
    with pytest.raises(ValueError, match="Период"):
        asyncio.run(
            AnalyticsService(repository, ZoneInfo("Europe/Moscow")).dashboard(
                user_id=uuid4(),
                from_date=start,
                to_date=end,
            )
        )
    repository.totals.assert_not_awaited()
