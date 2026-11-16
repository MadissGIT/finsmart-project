from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

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


class HealthIndices(BaseModel):
    balance: JsonDecimal
    budget: JsonDecimal
    goals: JsonDecimal
    regularity: JsonDecimal


class DiscountOffer(BaseModel):
    id: UUID
    partner_name: str
    title: str
    discount_percent: JsonDecimal
    promocode: str | None
    affiliate_url: str
    valid_until: date


class DiagnosticAlert(BaseModel):
    type: str
    category: str
    title: str
    message: str
    recommendation: str
    potential_saving: JsonDecimal = Decimal(0)
    badge: str | None = None
    discounts: list[DiscountOffer] = Field(default_factory=list)


class Diagnostics(BaseModel):
    health_score: int
    indices: HealthIndices
    status: str
    color: str
    persona: str
    alerts: list[DiagnosticAlert]
    unavailable: dict[str, str]


class Dashboard(BudgetDashboard):
    diagnostics: Diagnostics


class IdleCash(BaseModel):
    model_config = ConfigDict(extra="forbid")

    since: date
    amount: JsonDecimal = Field(gt=0, max_digits=14, decimal_places=2)


class DashboardRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    from_date: date | None = None
    to_date: date | None = None
    idle_cash: IdleCash
