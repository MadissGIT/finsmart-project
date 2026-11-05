from datetime import date

from pydantic import BaseModel, Field

from src.common_types import JsonDecimal


class BudgetAllocation(BaseModel):
    amount: JsonDecimal
    percent: JsonDecimal
    target_percent: JsonDecimal
    target_amount: JsonDecimal
    deviation: JsonDecimal


class BudgetDistribution(BaseModel):
    needs: BudgetAllocation
    wants: BudgetAllocation
    savings: BudgetAllocation


class DashboardSummary(BaseModel):
    total_income: JsonDecimal
    total_expense: JsonDecimal
    net_balance: JsonDecimal


class CategoryExpense(BaseModel):
    category_id: int
    name: str
    amount: JsonDecimal
    percent: JsonDecimal


class Period(BaseModel):
    from_date: date = Field(serialization_alias="from")
    to: date


class BudgetDashboard(BaseModel):
    period: Period
    summary: DashboardSummary
    budget_50_30_20: BudgetDistribution
    by_categories: list[CategoryExpense]
    income_base: JsonDecimal
    deficit_financing: bool
    unallocated_expense: JsonDecimal
    budget_score: JsonDecimal
