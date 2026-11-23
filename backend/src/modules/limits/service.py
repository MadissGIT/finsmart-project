from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field

from src.common_types import JsonDecimal
from src.db.models import BudgetGroup
from src.modules.limits.repositories import LimitRepository


class LimitInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)


class LimitUsage(BaseModel):
    category_id: int
    category_name: str
    amount: JsonDecimal
    spent: JsonDecimal
    percent: JsonDecimal
    status: Literal["ok", "approaching", "reached"]


class InvalidLimitCategory(ValueError):
    pass


class LimitService:
    def __init__(self, repository: LimitRepository, timezone: ZoneInfo) -> None:
        self._repository = repository
        self._timezone = timezone

    async def set_limit(self, user_id: UUID, category_id: int, amount: Decimal) -> None:
        if await self._repository.category_group(category_id) in (None, BudgetGroup.INCOME):
            raise InvalidLimitCategory("Выберите категорию расходов")
        await self._repository.save(user_id, category_id, amount)

    async def remove_limit(self, user_id: UUID, category_id: int) -> None:
        await self._repository.delete(user_id, category_id)

    async def usage(self, user_id: UUID, today: date) -> list[LimitUsage]:
        start = today.replace(day=1)
        end = date(today.year + (today.month == 12), today.month % 12 + 1, 1)
        rows = await self._repository.usage(
            user_id,
            datetime.combine(start, time.min, self._timezone),
            datetime.combine(end, time.min, self._timezone),
        )
        return [
            LimitUsage(
                category_id=category_id,
                category_name=name,
                amount=amount,
                spent=spent,
                percent=(spent / amount * 100).quantize(Decimal(".01")),
                status="reached"
                if spent >= amount
                else ("approaching" if spent >= amount * Decimal(".8") else "ok"),
            )
            for category_id, name, amount, spent in rows
        ]
