import calendar
from datetime import date, datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.settings import get_project_settings
from src.db.database import get_async_session
from src.db.models import User
from src.modules.analytics.repositories import AnalyticsRepository
from src.modules.analytics.schemas import BudgetDashboard
from src.modules.analytics.service import AnalyticsService
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
