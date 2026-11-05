import calendar
from datetime import date, datetime, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.settings import get_project_settings
from src.db.database import get_async_session
from src.db.models import User
from src.modules.analytics.health import FinancialHealthService
from src.modules.analytics.repositories import AnalyticsRepository
from src.modules.analytics.schemas import BudgetDashboard, Dashboard, DashboardRequest, IdleCash
from src.modules.analytics.service import AnalyticsService
from src.modules.goals.repositories import GoalRepository
from src.routes.auth.dependencies import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def get_analytics_service(
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> AnalyticsService:
    return AnalyticsService(
        AnalyticsRepository(session), ZoneInfo(get_project_settings().financial_timezone)
    )


@router.get("/budget", response_model=BudgetDashboard)
async def budget(
    user: Annotated[User, Depends(get_current_user)],
    analytics_service: Annotated[AnalyticsService, Depends(get_analytics_service)],
    from_date: date | None = None,
    to_date: date | None = None,
) -> BudgetDashboard:
    if (from_date is None) != (to_date is None):
        raise HTTPException(422, "Укажите обе границы периода или не указывайте их")
    if from_date is None or to_date is None:
        today = datetime.now(ZoneInfo(get_project_settings().financial_timezone)).date()
        from_date = today.replace(day=1)
        to_date = today.replace(day=calendar.monthrange(today.year, today.month)[1])
    try:
        return await analytics_service.dashboard(
            user_id=user.id, from_date=from_date, to_date=to_date
        )
    except ValueError as err:
        raise HTTPException(422, str(err)) from err


def get_health_service(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    analytics_service: Annotated[AnalyticsService, Depends(get_analytics_service)],
) -> FinancialHealthService:
    return FinancialHealthService(
        analytics_service=analytics_service,
        analytics_repository=AnalyticsRepository(session),
        goal_repository=GoalRepository(session),
        financial_timezone=ZoneInfo(get_project_settings().financial_timezone),
    )


async def _dashboard(
    user: User,
    service: FinancialHealthService,
    from_date: date | None,
    to_date: date | None,
    idle_cash: IdleCash | None,
) -> Dashboard:
    if (from_date is None) != (to_date is None):
        raise HTTPException(422, "Укажите обе границы периода или не указывайте их")
    if from_date is None or to_date is None:
        to_date = datetime.now(ZoneInfo(get_project_settings().financial_timezone)).date()
        from_date = to_date - timedelta(days=29)
    try:
        return await service.dashboard(
            user_id=user.id, from_date=from_date, to_date=to_date, idle_cash=idle_cash
        )
    except ValueError as err:
        raise HTTPException(422, str(err)) from err


@router.get("/dashboard")
async def dashboard(
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[FinancialHealthService, Depends(get_health_service)],
    from_date: date | None = None,
    to_date: date | None = None,
) -> Dashboard:
    return await _dashboard(
        user=user, service=service, from_date=from_date, to_date=to_date, idle_cash=None
    )


@router.post("/dashboard")
async def dashboard_with_account_data(
    payload: DashboardRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[FinancialHealthService, Depends(get_health_service)],
) -> Dashboard:
    return await _dashboard(
        user=user,
        service=service,
        from_date=payload.from_date,
        to_date=payload.to_date,
        idle_cash=payload.idle_cash,
    )
