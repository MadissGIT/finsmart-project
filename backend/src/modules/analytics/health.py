import calendar
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from src.db.models import BankSource
from src.modules.analytics.diagnosis import diagnose, health_score
from src.modules.analytics.repositories import AnalyticsRepository
from src.modules.analytics.schemas import Dashboard, Diagnostics, DiscountOffer, IdleCash
from src.modules.analytics.service import AnalyticsService
from src.modules.goals.repositories import GoalRepository
from src.modules.goals.service import monthly_payment, months_left


class FinancialHealthService:
    def __init__(
        self,
        analytics_service: AnalyticsService,
        analytics_repository: AnalyticsRepository,
        goal_repository: GoalRepository,
        financial_timezone: ZoneInfo,
    ) -> None:
        self._analytics_service = analytics_service
        self._analytics_repository = analytics_repository
        self._goal_repository = goal_repository
        self._financial_timezone = financial_timezone

    def _midnight(self, day: date) -> datetime:
        return datetime.combine(day, datetime.min.time(), self._financial_timezone).astimezone(UTC)

    async def dashboard(
        self, user_id: UUID, from_date: date, to_date: date, idle_cash: IdleCash | None
    ) -> Dashboard:
        days = (to_date - from_date).days + 1
        if not 1 <= days <= 31 or from_date < date.min + timedelta(days=90) or to_date == date.max:
            raise ValueError("Укажите корректный период от 1 до 31 дня")
        if idle_cash is not None and idle_cash.since > to_date:
            raise ValueError("Дата остатка не может быть позже конца периода")
        budget = await self._analytics_service.dashboard(
            user_id=user_id, from_date=from_date, to_date=to_date
        )
        start = self._midnight(from_date)
        end = self._midnight(to_date + timedelta(days=1))
        history = await self._analytics_repository.diagnosis_rows(
            user_id=user_id, start=self._midnight(to_date - timedelta(days=89)), end=end
        )
        progress = await self._goal_repository.period_progress(
            user_id=user_id, start=start, end=end, timezone=self._financial_timezone.key
        )
        planned, deposited = Decimal(0), Decimal(0)
        active_goals = 0
        goals_on_track = True
        for goal, previous, actual, on_time in progress:
            active_goals += previous + actual < goal.target_amount
            plan_start = max(from_date, goal.created_at.astimezone(self._financial_timezone).date())
            plan_end = min(to_date, goal.deadline)
            if plan_end < plan_start or previous >= goal.target_amount:
                continue
            plan = monthly_payment(
                goal.target_amount - previous, months_left(plan_start, goal.deadline)
            )
            eligible_days = (plan_end - plan_start).days + 1
            month_days = calendar.monthrange(plan_start.year, plan_start.month)[1]
            plan = min(goal.target_amount - previous, plan * eligible_days / month_days)
            planned += plan
            deposited += actual
            goals_on_track &= on_time >= plan.quantize(Decimal(".01"))

        activity_start = to_date - timedelta(days=27)
        activity = await self._analytics_repository.activity(
            user_id=user_id,
            start=self._midnight(activity_start),
            end=end,
            timezone=self._financial_timezone.key,
        )
        import_weeks = set()
        manual_by_week: dict[int, int] = defaultdict(int)
        for day, bank, count in activity:
            week = (day - activity_start).days // 7
            if bank is BankSource.MANUAL:
                manual_by_week[week] += count
            else:
                import_weeks.add(week)
        active_weeks = import_weeks | {week for week, count in manual_by_week.items() if count >= 3}
        score, indices, status, color = health_score(
            income=budget.summary.total_income,
            expense=budget.summary.total_expense,
            wants=budget.budget_50_30_20.wants.amount,
            planned=planned,
            deposited=deposited,
            active_weeks=len(active_weeks),
            manual_entries=sum(manual_by_week.values()),
        )
        alerts = diagnose(
            budget=budget,
            rows=history,
            start=start,
            end=end,
            previous_start=self._midnight(from_date - timedelta(days=days)),
            financial_timezone=self._financial_timezone,
            as_of=to_date,
            active_goals=active_goals,
            goals_on_track=planned > 0 and goals_on_track,
            idle_cash=idle_cash,
        )
        discount_categories = {"FD-03": 5, "FD-06": 1}
        categories = {discount_categories[a.type] for a in alerts if a.type in discount_categories}
        if categories:
            offers = await self._analytics_repository.discounts(
                category_ids=categories, as_of=to_date
            )
            for alert in alerts:
                alert.discounts = [
                    DiscountOffer(
                        id=offer.id,
                        partner_name=offer.partner_name,
                        title=offer.title,
                        discount_percent=offer.discount_percent,
                        promocode=offer.promocode,
                        affiliate_url=offer.affiliate_url,
                        valid_until=offer.valid_until,
                    )
                    for offer in offers
                    if discount_categories.get(alert.type) == offer.category_id
                ][:5]
        unavailable = (
            {"FD-08": "Нет подтверждённых сведений об остатке на беспроцентном счёте"}
            if idle_cash is None
            else {}
        )
        persona = next((a.title for a in alerts if a.type == "FD-05"), None)
        return Dashboard(
            **budget.model_dump(),
            diagnostics=Diagnostics(
                health_score=score,
                indices=indices,
                status=status,
                color=color,
                persona=persona or (alerts[0].title if alerts else status),
                alerts=alerts,
                unavailable=unavailable,
            ),
        )
