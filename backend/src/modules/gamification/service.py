from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import Date, cast, distinct, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.settings import get_project_settings
from src.db.models import (
    BankSource,
    Goal,
    GoalContribution,
    OperationType,
    Transaction,
    UserChallenge,
)
from src.modules.achievements.repositories import EVENT_METRICS, AchievementRepository


class ChallengeRule(BaseModel):
    code: str
    title: str
    description: str
    days: int
    target: int
    unit: Literal["expenses", "days", "rubles"]
    points: int


CHALLENGES = {
    rule.code: rule
    for rule in (
        ChallengeRule(
            code="five-expenses",
            title="Пять расходов",
            description="Запишите вручную 5 расходов за 7 дней.",
            days=7,
            target=5,
            unit="expenses",
            points=15,
        ),
        ChallengeRule(
            code="three-days",
            title="Три дня учёта",
            description="Запишите хотя бы один расход вручную в три разных дня за неделю.",
            days=7,
            target=3,
            unit="days",
            points=20,
        ),
        ChallengeRule(
            code="savings-in-motion",
            title="Копилка в движении",
            description="Внесите суммарно 1 000 ₽ в копилки за 14 дней.",
            days=14,
            target=1000,
            unit="rubles",
            points=35,
        ),
    )
}
LEAGUES = ((0, "Бронзовая"), (50, "Серебряная"), (120, "Золотая"), (250, "Платиновая"))


class Challenge(ChallengeRule):
    status: Literal["available", "active", "completed", "expired"] = "available"
    current: float = 0
    deadline: datetime | None = None
    completed_at: datetime | None = None


class BadgeProgress(BaseModel):
    current: int
    target: int


class Badge(BaseModel):
    code: str
    title: str
    level: str
    icon: str
    points: int
    condition: str
    earned_at: datetime | None
    unlocked: bool
    progress: BadgeProgress | None


class League(BaseModel):
    title: str
    minimum: int
    next_title: str | None = None
    next_minimum: int | None = None


class GameProgress(BaseModel):
    items: list[Badge]
    challenges: list[Challenge]
    reward_points: int
    league: League
    welcome_stage: Literal["first_transaction", "completed"] | None = None


def account_league(points: int) -> League:
    league = League(title=LEAGUES[0][1], minimum=LEAGUES[0][0])
    for minimum, title in LEAGUES[1:]:
        if points < minimum:
            league.next_title = title
            league.next_minimum = minimum
            break
        league = League(title=title, minimum=minimum)
    return league


class Gamification:
    def __init__(self, session: AsyncSession, user_id: UUID) -> None:
        self.session = session
        self.user_id = user_id
        self.badges = AchievementRepository(session)

    async def accept(self, code: str) -> None:
        await self.session.execute(
            insert(UserChallenge)
            .values(user_id=self.user_id, code=code)
            .on_conflict_do_nothing(index_elements=["user_id", "code"])
        )
        await self.session.commit()

    async def _manual_count(
        self,
        start: datetime | None = None,
        end: datetime | None = None,
        *,
        by_day: bool = False,
        expenses_only: bool = True,
    ) -> int:
        count = func.count()
        if by_day:
            timezone = get_project_settings().financial_timezone
            day = cast(func.timezone(timezone, Transaction.created_at), Date)
            count = func.count(distinct(day))
        query = (
            select(count)
            .select_from(Transaction)
            .where(
                Transaction.user_id == self.user_id,
                Transaction.bank_source == BankSource.MANUAL,
            )
        )
        if expenses_only:
            query = query.where(Transaction.operation_type == OperationType.DEBIT)
        if start is not None and end is not None:
            query = query.where(Transaction.created_at >= start, Transaction.created_at <= end)
        return await self.session.scalar(query) or 0

    async def _contributions(
        self, start: datetime | None = None, end: datetime | None = None
    ) -> Decimal:
        total = func.count() if start is None else func.sum(GoalContribution.amount)
        query = (
            select(total)
            .select_from(GoalContribution)
            .join(Goal)
            .where(
                Goal.user_id == self.user_id,
            )
        )
        if start is not None and end is not None:
            query = query.where(
                GoalContribution.created_at >= start, GoalContribution.created_at <= end
            )
        return Decimal(await self.session.scalar(query) or 0)

    async def _challenge_progress(
        self, rule: ChallengeRule, row: UserChallenge | None, now: datetime
    ) -> Challenge:
        challenge = Challenge(**rule.model_dump())
        if row is None:
            return challenge
        challenge.deadline = row.started_at + timedelta(days=rule.days)
        if row.completed_at is None:
            end = min(challenge.deadline, now)
            current = (
                await self._contributions(row.started_at, end)
                if rule.unit == "rubles"
                else await self._manual_count(row.started_at, end, by_day=rule.unit == "days")
            )
            challenge.current = float(min(current, rule.target))
            if current >= rule.target:
                row.completed_at = now
                row.reward_points = rule.points
        if row.completed_at is not None:
            challenge.status = "completed"
            challenge.completed_at = row.completed_at
            challenge.points = row.reward_points
            challenge.current = rule.target
        else:
            challenge.status = "expired" if now >= challenge.deadline else "active"
        return challenge

    async def progress(self) -> GameProgress:
        rows = {
            row.code: row
            for row in await self.session.scalars(
                select(UserChallenge)
                .where(UserChallenge.user_id == self.user_id)
                .order_by(UserChallenge.code)
                .with_for_update()
            )
        }
        now = datetime.now(UTC)
        challenges = [
            await self._challenge_progress(rule, rows.get(rule.code), now)
            for rule in CHALLENGES.values()
        ]
        completed = [challenge for challenge in challenges if challenge.status == "completed"]
        expenses = await self._manual_count()
        recent_entries = await self._manual_count(now - timedelta(days=7), now, expenses_only=False)
        deposits = int(await self._contributions())
        metrics = {
            "recent_entries": recent_entries,
            "expenses": expenses,
            "deposits": deposits,
            "weekly_challenges": sum(challenge.days == 7 for challenge in completed),
            "challenges": len(completed),
        }
        rules = {rule.code: rule for rule in await self.badges.rules()}
        items = await self.badges.list_achievements(self.user_id)
        to_award = []
        for item in items:
            rule = rules.get(item["code"])
            if rule and not item["unlocked"] and metrics.get(rule.metric or "", 0) >= rule.target:
                to_award.append(rule.code)
        for code in to_award:
            await self.badges.award(self.user_id, code)
        if to_award:
            items = await self.badges.list_achievements(self.user_id)
        await self.session.commit()
        badges = []
        for item in items:
            progress = None
            if not item["unlocked"]:
                rule = rules.get(item["code"])
                if rule is None or rule.metric is None:
                    continue
                current = 0 if rule.metric in EVENT_METRICS else metrics.get(rule.metric, 0)
                progress = BadgeProgress(current=min(current, rule.target), target=rule.target)
            badges.append(Badge(**item, progress=progress))
        points = sum(badge.points for badge in badges if badge.unlocked) + sum(
            challenge.points for challenge in completed
        )
        return GameProgress(
            items=badges, challenges=challenges, reward_points=points, league=account_league(points)
        )
