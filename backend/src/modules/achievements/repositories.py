from uuid import UUID

from sqlalchemy import literal, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Achievement, UserAchievement

EVENT_METRICS = {"first_import", "first_goal", "first_deposit", "goal_reached"}
PROGRESS_METRICS = {"recent_entries", "expenses", "deposits", "weekly_challenges", "challenges"}


class AchievementRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def rules(self) -> list[Achievement]:
        return list(
            await self._session.scalars(
                select(Achievement)
                .where(Achievement.enabled)
                .order_by(Achievement.code)
                .with_for_update(read=True)
            )
        )

    async def award(self, user_id: UUID, code: str) -> None:
        await self._award_matching(user_id, Achievement.code == code)

    async def award_event(self, user_id: UUID, metric: str) -> None:
        await self._award_matching(user_id, Achievement.metric == metric, Achievement.target == 1)

    async def _award_matching(self, user_id: UUID, *conditions) -> None:
        eligible = (
            select(literal(user_id), Achievement.code, Achievement.points)
            .where(Achievement.enabled, *conditions)
            .order_by(Achievement.code)
        )
        await self._session.execute(
            insert(UserAchievement)
            .from_select(["user_id", "code", "awarded_points"], eligible)
            .on_conflict_do_nothing(index_elements=["user_id", "code"])
        )

    async def list_achievements(self, user_id: UUID) -> list[dict]:
        result = await self._session.execute(
            select(Achievement, UserAchievement.earned_at, UserAchievement.awarded_points)
            .outerjoin(
                UserAchievement,
                (UserAchievement.code == Achievement.code) & (UserAchievement.user_id == user_id),
            )
            .order_by(Achievement.code)
        )
        return [
            {
                "code": row.code,
                "title": row.title,
                "level": row.level,
                "icon": row.icon,
                "points": points if points is not None else row.points,
                "condition": row.condition,
                "earned_at": earned,
                "unlocked": earned is not None,
            }
            for row, earned, points in result.tuples()
        ]
