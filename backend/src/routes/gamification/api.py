from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_async_session
from src.db.models import User
from src.modules.gamification.service import CHALLENGES, GameProgress, Gamification
from src.routes.auth.dependencies import get_current_user

router = APIRouter(prefix="/gamification", tags=["Gamification"])
UserDependency = Annotated[User, Depends(get_current_user)]
SessionDependency = Annotated[AsyncSession, Depends(get_async_session)]


@router.post("/progress")
async def progress(user: UserDependency, session: SessionDependency) -> GameProgress:
    result = await Gamification(session, user.id).progress()
    if user.welcome_started_at and datetime.now(UTC) < user.welcome_started_at + timedelta(days=7):
        result.welcome_stage = "completed" if user.first_manual_at else "first_transaction"
    return result


@router.post("/challenges/{code}", status_code=204)
async def accept(code: str, user: UserDependency, session: SessionDependency) -> Response:
    if code not in CHALLENGES:
        raise HTTPException(status_code=404, detail="Челлендж не найден")
    await Gamification(session, user.id).accept(code)
    return Response(status_code=204)
