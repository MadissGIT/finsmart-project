from datetime import date
from enum import StrEnum
from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.common_types import JsonDecimal

Money = Annotated[JsonDecimal, Field(gt=0, max_digits=14, decimal_places=2)]
Title = Annotated[str, Field(min_length=1, max_length=200)]
Icon = Annotated[str, Field(min_length=1, max_length=32)]


class DepositSource(StrEnum):
    FREE_MONEY = "free_money"
    DISCOUNT = "discount"


class GoalCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: Title
    target_amount: Money
    deadline: date
    icon: Icon = "target"


class GoalUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: Title | None = None
    target_amount: Money | None = None
    deadline: date | None = None
    icon: Icon | None = None

    @model_validator(mode="after")
    def validate_changes(self) -> Self:
        if not self.model_fields_set or any(
            getattr(self, field) is None for field in self.model_fields_set
        ):
            raise ValueError("Передайте хотя бы одно поле без null")
        return self


class DepositRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: Money
    source: DepositSource


class GoalResponse(BaseModel):
    id: UUID
    title: str
    target_amount: JsonDecimal
    current_amount: JsonDecimal
    deadline: date
    icon: str
    monthly_payment_recommended: JsonDecimal
    weekly_payment_recommended: JsonDecimal
    progress_percent: JsonDecimal
    months_left: JsonDecimal
    exceeds_half_income: bool
    warning: str | None


class DepositResponse(BaseModel):
    goal_id: UUID
    current_amount: JsonDecimal
    progress_percent: JsonDecimal
    monthly_payment_recommended: JsonDecimal
    weekly_payment_recommended: JsonDecimal
    exceeds_half_income: bool
    warning: str | None
    acceleration_days: int
    message: str
