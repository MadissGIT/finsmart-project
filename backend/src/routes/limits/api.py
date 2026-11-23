from datetime import datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Path, Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.settings import get_project_settings
from src.db.database import get_async_session
from src.db.models import User
from src.modules.limits.repositories import LimitRepository
from src.modules.limits.service import InvalidLimitCategory, LimitInput, LimitService, LimitUsage
from src.routes.auth.dependencies import get_current_user

router = APIRouter(prefix="/limits", tags=["Limits"])
CurrentUser = Annotated[User, Depends(get_current_user)]
CategoryId = Annotated[int, Path(ge=1, le=2147483647)]


def limit_service(session: Annotated[AsyncSession, Depends(get_async_session)]) -> LimitService:
    return LimitService(
        LimitRepository(session), ZoneInfo(get_project_settings().financial_timezone)
    )


Service = Annotated[LimitService, Depends(limit_service)]


@router.get("")
async def retrieve_limits(user: CurrentUser, service: Service) -> list[LimitUsage]:
    today = datetime.now(ZoneInfo(get_project_settings().financial_timezone)).date()
    return await service.usage(user.id, today)


@router.put("/{category_id}", status_code=204)
async def set_limit(
    category_id: CategoryId,
    payload: LimitInput,
    user: CurrentUser,
    service: Service,
) -> Response:
    try:
        await service.set_limit(user.id, category_id, payload.amount)
    except InvalidLimitCategory as err:
        raise HTTPException(422, str(err)) from err
    return Response(status_code=204)


@router.delete("/{category_id}", status_code=204)
async def remove_limit(category_id: CategoryId, user: CurrentUser, service: Service) -> Response:
    await service.remove_limit(user.id, category_id)
    return Response(status_code=204)
