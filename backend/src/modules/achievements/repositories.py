from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Achievement, UserAchievement


class AchievementRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def award(self, user_id: UUID, code: str) -> None:
        await self._session.execute(
            insert(UserAchievement)
            .values(user_id=user_id, code=code)
            .on_conflict_do_nothing(index_elements=["user_id", "code"])
        )

    async def list_achievements(self, user_id: UUID) -> list[dict]:
        result = await self._session.execute(
            select(Achievement, UserAchievement.earned_at)
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
                "points": row.points,
                "condition": row.condition,
                "earned_at": earned,
                "unlocked": earned is not None,
            }
            for row, earned in result.tuples()
        ]
