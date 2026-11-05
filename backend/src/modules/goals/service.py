import calendar
from datetime import date, datetime, timedelta
from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from src.db.models import Goal, GoalContribution
from src.modules.analytics.repositories import AnalyticsRepository
from src.modules.goals.repositories import GoalRepository
from src.modules.goals.schemas import (
    DepositRequest,
    DepositResponse,
    DepositSource,
    GoalCreate,
    GoalResponse,
    GoalUpdate,
)

CENT = Decimal("0.01")


class GoalNotFoundError(ValueError):
    pass


class InvalidGoalError(ValueError):
    pass


def months_left(today: date, deadline: date) -> Decimal:
    return max(Decimal(0), Decimal((deadline - today).days) / Decimal("30.4"))


def monthly_payment(remaining: Decimal, months: Decimal) -> Decimal:
    return max(remaining, Decimal(0)) / max(Decimal(1), months)


class GoalService:
    def __init__(
        self,
        goal_repository: GoalRepository,
        analytics_repository: AnalyticsRepository,
        financial_timezone: ZoneInfo,
    ) -> None:
        self._goal_repository = goal_repository
        self._analytics_repository = analytics_repository
        self._financial_timezone = financial_timezone

    async def _monthly_income(self, user_id: UUID, today: date) -> Decimal:
        start = today.replace(day=1)
        end = start + timedelta(days=calendar.monthrange(today.year, today.month)[1])
        return await self._analytics_repository.income(
            user_id=user_id,
            start=datetime.combine(start, datetime.min.time(), self._financial_timezone),
            end=datetime.combine(end, datetime.min.time(), self._financial_timezone),
        )

    async def _get(self, user_id: UUID, goal_id: UUID, lock: bool) -> Goal:
        if (goal := await self._goal_repository.get_goal(user_id, goal_id, lock)) is None:
            raise GoalNotFoundError("Копилка не найдена")
        return goal

    @staticmethod
    def _response(goal: Goal, current: Decimal, today: date, income: Decimal) -> GoalResponse:
        months = months_left(today, goal.deadline)
        remaining = goal.target_amount - current
        payment = monthly_payment(remaining, months)
        warning = None
        if payment > income / 2:
            if income:
                extra = (remaining / (income / 2) - months).to_integral_value(ROUND_CEILING)
                warning = (
                    f"Взнос выше половины дохода. Добавьте месяцев к сроку: {extra}, "
                    "или уменьшите целевую сумму."
                )
            else:
                warning = "Для взноса нужен доход. Уточните поступления или уменьшите цель."
        return GoalResponse(
            id=goal.id,
            title=goal.title,
            target_amount=goal.target_amount,
            current_amount=current,
            deadline=goal.deadline,
            icon=goal.icon,
            monthly_payment_recommended=payment.quantize(CENT),
            weekly_payment_recommended=(payment / Decimal("4.33")).quantize(CENT),
            progress_percent=min(Decimal(100), current / goal.target_amount * 100).quantize(CENT),
            months_left=months.quantize(CENT),
            exceeds_half_income=warning is not None,
            warning=warning,
        )

    async def list_goals(self, user_id: UUID, today: date) -> list[GoalResponse]:
        rows = await self._goal_repository.list_goals(user_id)
        income = await self._monthly_income(user_id, today)
        return [self._response(goal, current, today, income) for goal, current in rows]

    async def get_goal(self, user_id: UUID, goal_id: UUID, today: date) -> GoalResponse:
        goal = await self._get(user_id, goal_id, lock=False)
        current = await self._goal_repository.total(goal.id)
        return self._response(goal, current, today, await self._monthly_income(user_id, today))

    async def create(self, user_id: UUID, payload: GoalCreate, today: date) -> GoalResponse:
        if payload.deadline < today:
            raise InvalidGoalError("Срок копилки не может быть в прошлом")
        goal = Goal(user_id=user_id, **payload.model_dump())
        income = await self._monthly_income(user_id, today)
        await self._goal_repository.save(goal)
        return self._response(goal, Decimal(0), today, income)

    async def update(
        self, user_id: UUID, goal_id: UUID, payload: GoalUpdate, today: date
    ) -> GoalResponse:
        goal = await self._get(user_id, goal_id, lock=True)
        current = await self._goal_repository.total(goal.id)
        if payload.deadline is not None and payload.deadline < today:
            raise InvalidGoalError("Срок копилки не может быть в прошлом")
        if payload.target_amount is not None and payload.target_amount < current:
            raise InvalidGoalError("Целевая сумма не может быть меньше накопленной")
        income = await self._monthly_income(user_id, today)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(goal, field, value)
        await self._goal_repository.save(goal)
        return self._response(goal, current, today, income)

    async def deposit(
        self, user_id: UUID, goal_id: UUID, payload: DepositRequest, today: date
    ) -> DepositResponse:
        goal = await self._get(user_id, goal_id, lock=True)
        current = await self._goal_repository.total(goal.id)
        if current + payload.amount > goal.target_amount:
            raise InvalidGoalError("Взнос превышает остаток до цели")
        previous_payment = monthly_payment(
            goal.target_amount - current, months_left(today, goal.deadline)
        )
        days = (
            int(
                (payload.amount * Decimal("30.4") / previous_payment).to_integral_value(
                    ROUND_HALF_UP
                )
            )
            if payload.source is DepositSource.DISCOUNT and previous_payment > 0
            else 0
        )
        income = await self._monthly_income(user_id, today)
        await self._goal_repository.save(
            GoalContribution(goal_id=goal.id, amount=payload.amount, source=payload.source.value)
        )
        progress = self._response(goal, current + payload.amount, today, income)
        return DepositResponse(
            goal_id=goal.id,
            current_amount=progress.current_amount,
            progress_percent=progress.progress_percent,
            monthly_payment_recommended=progress.monthly_payment_recommended,
            weekly_payment_recommended=progress.weekly_payment_recommended,
            exceeds_half_income=progress.exceeds_half_income,
            warning=progress.warning,
            acceleration_days=days,
            message="Взнос добавлен",
        )

    async def delete(self, user_id: UUID, goal_id: UUID) -> None:
        goal = await self._get(user_id, goal_id, lock=True)
        await self._goal_repository.delete(goal)
