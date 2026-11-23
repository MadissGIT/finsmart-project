from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest

from src.db.models import BudgetGroup, OperationType, Transaction
from src.modules.analytics.diagnosis import diagnose, health_score
from src.modules.analytics.schemas import (
    BudgetAllocation,
    BudgetDashboard,
    BudgetDistribution,
    DashboardSummary,
    IdleCash,
    Period,
)
from src.modules.goals.service import monthly_payment, months_left

START = datetime(2026, 10, 1, tzinfo=UTC)
END = datetime(2026, 11, 1, tzinfo=UTC)


def test_health_score_matches_specification_example() -> None:
    score, indices, status, color = health_score(
        income=Decimal(80000),
        expense=Decimal(68000),
        wants=Decimal(34000),
        planned=Decimal(10000),
        deposited=Decimal(5000),
        active_weeks=3,
        manual_entries=4,
    )
    assert score == 60
    assert (indices.balance, indices.budget, indices.goals, indices.regularity) == (
        75,
        37.5,
        50,
        80,
    )
    assert status == "Зона финансового риска"
    assert color == "#F59E0B"


@pytest.mark.parametrize(
    ("income", "expense", "wants", "balance", "budget"),
    [(100, 80, 30, 100, 100), (100, 110, 50, 0, 0), (0, 0, 0, 0, 0)],
)
def test_health_boundaries(income, expense, wants, balance, budget) -> None:
    _, indices, _, _ = health_score(
        Decimal(income), Decimal(expense), Decimal(wants), Decimal(0), Decimal(0), 4, 12
    )
    assert indices.balance == balance
    assert indices.budget == budget
    assert indices.goals == 50
    assert indices.regularity == 100


def test_goal_payment_recalculates_without_moving_deadline() -> None:
    deadline = date(2026, 12, 1)
    initial = monthly_payment(Decimal(10000), months_left(date(2026, 10, 1), deadline))
    after = monthly_payment(Decimal(9000), months_left(date(2026, 11, 1), deadline))
    assert after > initial
    assert monthly_payment(Decimal(9000), months_left(deadline, deadline)) == 9000
    assert monthly_payment(Decimal(0), months_left(deadline, deadline)) == 0


def allocation(amount: int) -> BudgetAllocation:
    return BudgetAllocation(
        amount=amount, percent=0, target_percent=0, target_amount=0, deviation=0
    )


def alerts_for(
    income=10000,
    expense=8000,
    needs=5000,
    wants=3000,
    savings=2000,
    rows=(),
    on_track=False,
    idle_cash=None,
    active_goals=0,
) -> set[str]:
    dashboard = BudgetDashboard(
        period=Period(from_date=START.date(), to=(END - timedelta(days=1)).date()),
        summary=DashboardSummary(
            total_income=income, total_expense=expense, net_balance=income - expense
        ),
        budget_50_30_20=BudgetDistribution(
            needs=allocation(needs),
            wants=allocation(wants),
            savings=allocation(savings),
        ),
        by_categories=[],
        income_base=income,
        deficit_financing=False,
        unallocated_expense=0,
        budget_score=0,
    )
    transactions = sorted(rows, key=lambda item: item[0].transaction_date)
    return {
        alert.type
        for alert in diagnose(
            budget=dashboard,
            rows=transactions,
            start=START,
            end=END,
            previous_start=START - timedelta(days=31),
            financial_timezone=ZoneInfo("UTC"),
            as_of=date(2026, 10, 31),
            active_goals=active_goals,
            goals_on_track=on_track,
            idle_cash=idle_cash,
        )
    }


def transaction(
    day: int,
    category: int,
    amount: int,
    merchant: str,
    group: BudgetGroup = BudgetGroup.WANTS,
    direction: OperationType = OperationType.DEBIT,
) -> tuple[Transaction, BudgetGroup]:
    return (
        Transaction(
            transaction_date=START + timedelta(days=day),
            category_id=category,
            amount=Decimal(amount),
            merchant_name=merchant,
            operation_type=direction,
        ),
        group,
    )


def test_fd01_strict_wants_and_savings_thresholds() -> None:
    assert "FD-01" in alerts_for(wants=4501, savings=499)
    assert "FD-01" not in alerts_for(wants=4500, savings=499)
    assert "FD-01" not in alerts_for(wants=4501, savings=500)


def test_fd02_subscriptions_use_distinct_recurring_merchant_amount_pairs() -> None:
    rows = [transaction(day, 6, 400, str(i)) for i in range(4) for day in (-30, 0)]
    assert "FD-02" in alerts_for(rows=rows)
    assert "FD-02" not in alerts_for(rows=rows[:-1])


def test_fd03_requires_count_and_total() -> None:
    rows = [transaction(0, 5, 225, "coffee")] * 21
    assert "FD-03" in alerts_for(rows=rows)
    assert "FD-03" not in alerts_for(rows=rows[:-1])
    assert "FD-03" not in alerts_for(rows=[transaction(0, 5, 200, "coffee")] * 21)


def test_fd04_requires_previous_spend_and_growth() -> None:
    rows = [transaction(0, 2, 1500, "yandex go"), transaction(-10, 2, 1200, "yandex go")]
    assert "FD-04" in alerts_for(rows=rows)
    assert "FD-04" not in alerts_for(rows=rows[:1])
    assert "FD-04" not in alerts_for(rows=[rows[0], transaction(-10, 2, 1250, "yandex go")])


def test_fd05_deficit_and_low_remaining_balance() -> None:
    assert "FD-05" in alerts_for(expense=10001)
    assert "FD-05" in alerts_for(expense=9701)
    assert "FD-05" not in alerts_for(expense=9700)
    assert "FD-05" not in alerts_for(income=0, expense=0)


def test_fd06_groceries_above_40_percent() -> None:
    assert "FD-06" in alerts_for(rows=[transaction(0, 1, 4001, "grocery")])
    assert "FD-06" not in alerts_for(rows=[transaction(0, 1, 4000, "grocery")])


def test_fd07_includes_first_72_hours() -> None:
    salary = transaction(0, 10, 10000, "salary", BudgetGroup.INCOME, OperationType.CREDIT)
    assert "FD-07" in alerts_for(rows=[salary, transaction(3, 5, 1050, "coffee")])
    assert "FD-07" not in alerts_for(rows=[salary, transaction(4, 5, 1050, "coffee")])


def test_fd08_requires_evidence_for_60_days_and_no_active_goal() -> None:
    evidence = IdleCash(since=date(2026, 9, 1), amount=100000)
    assert "FD-08" in alerts_for(savings=3001, idle_cash=evidence)
    assert "FD-08" not in alerts_for(savings=3001)
    assert "FD-08" not in alerts_for(savings=3001, idle_cash=evidence, active_goals=1)
    evidence.since += timedelta(days=1)
    assert "FD-08" not in alerts_for(savings=3001, idle_cash=evidence)


def test_fd09_marketplace_thresholds() -> None:
    assert "FD-09" in alerts_for(rows=[transaction(0, 7, 1400, "ozon")] * 9)
    assert "FD-09" not in alerts_for(rows=[transaction(0, 7, 1500, "ozon")] * 9)
    assert "FD-09" not in alerts_for(rows=[transaction(0, 7, 1499, "ozon")] * 8)


def test_fd10_requires_schedule_and_balanced_budget() -> None:
    assert "FD-10" in alerts_for(on_track=True)
    assert "FD-10" in alerts_for(on_track=True, needs=5500, savings=1500)
    assert "FD-10" not in alerts_for(on_track=True, needs=5501)
    assert "FD-10" not in alerts_for(on_track=False)
