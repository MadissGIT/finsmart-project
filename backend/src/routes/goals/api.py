from datetime import date, datetime
from typing import Annotated
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.settings import get_project_settings
from src.db.database import get_async_session
from src.db.models import User
from src.modules.analytics.repositories import AnalyticsRepository
from src.modules.goals.repositories import GoalRepository
from src.modules.goals.schemas import (
    DepositRequest,
    DepositResponse,
    GoalCreate,
    GoalResponse,
    GoalUpdate,
)
from src.modules.goals.service import GoalService
from src.routes.auth.dependencies import get_current_user

router = APIRouter(prefix="/goals", tags=["Goals"])
CurrentUser = Annotated[User, Depends(get_current_user)]


def get_goal_service(session: Annotated[AsyncSession, Depends(get_async_session)]) -> GoalService:
    return GoalService(
        goal_repository=GoalRepository(session),
        analytics_repository=AnalyticsRepository(session),
        financial_timezone=ZoneInfo(get_project_settings().financial_timezone),
    )


def financial_today() -> date:
    return datetime.now(ZoneInfo(get_project_settings().financial_timezone)).date()


Goals = Annotated[GoalService, Depends(get_goal_service)]
Today = Annotated[date, Depends(financial_today)]


@router.get("")
async def list_goals(user: CurrentUser, service: Goals, today: Today) -> list[GoalResponse]:
    return await service.list_goals(user_id=user.id, today=today)


@router.post("", status_code=201)
async def create_goal(
    payload: GoalCreate, user: CurrentUser, service: Goals, today: Today
) -> GoalResponse:
    return await service.create(user_id=user.id, payload=payload, today=today)


@router.get("/{goal_id}")
async def get_goal(goal_id: UUID, user: CurrentUser, service: Goals, today: Today) -> GoalResponse:
    return await service.get_goal(user_id=user.id, goal_id=goal_id, today=today)


@router.patch("/{goal_id}")
async def update_goal(
    goal_id: UUID, payload: GoalUpdate, user: CurrentUser, service: Goals, today: Today
) -> GoalResponse:
    return await service.update(user_id=user.id, goal_id=goal_id, payload=payload, today=today)


@router.post("/{goal_id}/deposit")
async def deposit(
    goal_id: UUID, payload: DepositRequest, user: CurrentUser, service: Goals, today: Today
) -> DepositResponse:
    return await service.deposit(user_id=user.id, goal_id=goal_id, payload=payload, today=today)


@router.delete("/{goal_id}", status_code=204)
async def delete_goal(goal_id: UUID, user: CurrentUser, service: Goals) -> Response:
    await service.delete(user_id=user.id, goal_id=goal_id)
    return Response(status_code=204)
