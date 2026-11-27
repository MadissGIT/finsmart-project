from datetime import datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.settings import get_project_settings
from src.db.database import get_async_session
from src.db.models import User
from src.modules.achievements.repositories import AchievementRepository
from src.modules.catalog.repositories import CatalogRepository
from src.modules.catalog.service import (
    Article,
    CatalogService,
    DiscountResponse,
    RecommendedDiscounts,
)
from src.routes.auth.dependencies import get_current_user

router = APIRouter(tags=["Catalog"])


def get_catalog_service(
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> CatalogService:
    return CatalogService(CatalogRepository(session), AchievementRepository(session))


Service = Annotated[CatalogService, Depends(get_catalog_service)]


@router.get("/articles")
async def articles(
    service: Service,
    tags: Annotated[list[str] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Article]:
    return (await service.articles(tags or []))[offset : offset + limit]


@router.get("/articles/{article_id}")
async def article(article_id: str, service: Service) -> Article:
    for item in await service.articles([]):
        if item.id == article_id:
            return item
    raise HTTPException(404, "Статья не найдена")


@router.get("/discounts")
async def discounts(
    service: Service,
    category_id: Annotated[int | None, Query(ge=1)] = None,
) -> list[DiscountResponse]:
    today = datetime.now(ZoneInfo(get_project_settings().financial_timezone)).date()
    return await service.discounts(category_id, today)


@router.get("/achievements")
async def achievements(
    user: Annotated[User, Depends(get_current_user)],
    service: Service,
) -> dict:
    return await service.achievements(user.id)


@router.get("/discounts/recommended")
async def recommended_discounts(
    user: Annotated[User, Depends(get_current_user)],
    service: Service,
) -> RecommendedDiscounts:
    timezone = ZoneInfo(get_project_settings().financial_timezone)
    return await service.recommended_discounts(user.id, datetime.now(timezone).date(), timezone)
