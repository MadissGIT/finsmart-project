from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Goal, GoalContribution
from src.modules.achievements.repositories import AchievementRepository


class GoalRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_goals(self, user_id: UUID) -> list[tuple[Goal, Decimal]]:
        result = await self._session.execute(
            select(Goal, func.coalesce(func.sum(GoalContribution.amount), 0))
            .outerjoin(GoalContribution)
            .where(Goal.user_id == user_id)
            .group_by(Goal.id)
            .order_by(Goal.deadline, Goal.id)
        )
        return list(result.tuples().all())

    async def get_goal(self, user_id: UUID, goal_id: UUID, lock: bool) -> Goal | None:
        query = select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id)
        if lock:
            query = query.with_for_update()
        return await self._session.scalar(query)

    async def total(self, goal_id: UUID) -> Decimal:
        total = await self._session.scalar(
            select(func.sum(GoalContribution.amount)).where(GoalContribution.goal_id == goal_id)
        )
        return total if total is not None else Decimal(0)

    async def period_progress(
        self, user_id: UUID, start: datetime, end: datetime, timezone: str
    ) -> list[tuple[Goal, Decimal, Decimal, Decimal]]:
        before = func.coalesce(
            func.sum(GoalContribution.amount).filter(GoalContribution.created_at < start), 0
        )
        during = func.coalesce(
            func.sum(GoalContribution.amount).filter(
                GoalContribution.created_at >= start, GoalContribution.created_at < end
            ),
            0,
        )
        local_day = cast(func.timezone(timezone, GoalContribution.created_at), Date)
        on_time = func.coalesce(
            func.sum(GoalContribution.amount).filter(
                GoalContribution.created_at >= start,
                GoalContribution.created_at < end,
                local_day <= Goal.deadline,
            ),
            0,
        )
        result = await self._session.execute(
            select(Goal, before, during, on_time)
            .outerjoin(GoalContribution)
            .where(Goal.user_id == user_id, Goal.created_at < end)
            .group_by(Goal.id)
        )
        return list(result.tuples().all())

    async def save(self, record: Goal | GoalContribution) -> None:
        self._session.add(record)
        await self._session.flush()
        if isinstance(record, Goal):
            await AchievementRepository(self._session).award(record.user_id, "BADGE_PIGGY_CREATED")
        else:
            goal = await self._session.get(Goal, record.goal_id)
            if goal is not None:
                await AchievementRepository(self._session).award(
                    goal.user_id, "BADGE_FIRST_DEPOSIT"
                )
                if await self.total(goal.id) >= goal.target_amount:
                    await AchievementRepository(self._session).award(
                        goal.user_id, "BADGE_GOAL_REACHED"
                    )
        await self._session.commit()

    async def delete(self, goal: Goal) -> None:
        await self._session.delete(goal)
        await self._session.commit()
