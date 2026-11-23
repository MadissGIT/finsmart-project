import json
from datetime import date, datetime, time, timedelta
from functools import lru_cache
from pathlib import Path
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import BaseModel

from src.modules.achievements.repositories import AchievementRepository
from src.modules.catalog.repositories import CatalogRepository


class Article(BaseModel):
    id: str
    slug: str
    title: str
    category: str
    read_time_min: int
    summary: str
    content_markdown: str
    action_checklist: list[str]
    tags: list[str]


class DiscountResponse(BaseModel):
    id: UUID
    code: str | None
    category_id: int
    category_name: str
    partner_name: str
    title: str
    activation: str
    benefit: str
    conditions: str
    discount_percent: int
    promocode: str | None
    affiliate_url: str
    valid_until: date
    is_demo: bool


@lru_cache(maxsize=1)
def get_articles() -> tuple[Article, ...]:
    path = Path(__file__).resolve().parents[3] / "seeds" / "articles.json"
    return tuple(Article.model_validate(row) for row in json.loads(path.read_text()))


class RecommendedDiscounts(BaseModel):
    recommendation_basis: list[str]
    items: list[DiscountResponse]


class CatalogService:
    def __init__(
        self, catalog_repository: CatalogRepository, achievement_repository: AchievementRepository
    ) -> None:
        self._catalog_repository = catalog_repository
        self._achievement_repository = achievement_repository

    def articles(self, tags: list[str]) -> list[Article]:
        selected = {tag.strip().casefold() for tag in tags}
        return [
            article
            for article in get_articles()
            if selected <= {tag.casefold() for tag in article.tags}
        ]

    async def discounts(self, category_id: int | None, today: date) -> list[DiscountResponse]:
        rows = await self._catalog_repository.discounts(category_id, today)
        return [
            DiscountResponse(
                id=row.id,
                code=row.code,
                category_id=row.category_id,
                category_name=name,
                partner_name=row.partner_name,
                title=row.title,
                activation=row.activation,
                benefit=row.benefit,
                conditions=row.conditions,
                discount_percent=row.discount_percent,
                promocode=row.promocode,
                affiliate_url=row.affiliate_url,
                valid_until=row.valid_until,
                is_demo=row.is_demo,
            )
            for row, name in rows
        ]

    async def achievements(self, user_id: UUID) -> dict:
        items = await self._achievement_repository.list_achievements(user_id)
        return {
            "items": items,
            "reward_points": sum(row["points"] for row in items if row["unlocked"]),
        }

    async def recommended_discounts(
        self, user_id: UUID, today: date, financial_timezone: ZoneInfo
    ) -> RecommendedDiscounts:
        categories = await self._catalog_repository.top_expense_categories(
            user_id=user_id,
            start=datetime.combine(today - timedelta(days=29), time.min, financial_timezone),
            end=datetime.combine(today + timedelta(days=1), time.min, financial_timezone),
        )
        rank = {category_id: position for position, (category_id, _) in enumerate(categories)}
        offers = [offer for offer in await self.discounts(None, today) if offer.category_id in rank]
        offers.sort(key=lambda offer: rank[offer.category_id])
        return RecommendedDiscounts(
            recommendation_basis=[name for _, name in categories], items=offers
        )
