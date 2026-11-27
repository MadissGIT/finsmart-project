from datetime import date, datetime
from typing import Annotated, Literal, Self
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from src.common_types import JsonDecimal
from src.db.models import BudgetGroup
from src.modules.achievements.repositories import EVENT_METRICS, PROGRESS_METRICS
from src.modules.catalog.service import Article, DiscountResponse

ContentStatus = Literal["draft", "published", "hidden"]
TicketStatus = Literal["open", "answered", "closed"]
Price = Annotated[JsonDecimal, Field(ge=0, max_digits=14, decimal_places=2)]
Keyword = Annotated[str, Field(min_length=1, max_length=200)]
Tag = Annotated[str, Field(min_length=1, max_length=100)]
ChecklistItem = Annotated[str, Field(min_length=1, max_length=1000)]


class AdminInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class UserRow(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    blocked_at: datetime | None
    created_at: datetime
    operations: int
    imports: int
    goals: int
    last_activity: datetime | None


class UserBlock(AdminInput):
    blocked: bool


class CategoryInput(AdminInput):
    name: str = Field(min_length=1, max_length=100)
    parent_id: int | None = Field(default=None, gt=0)
    budget_group: BudgetGroup
    keywords: list[Keyword] = Field(default_factory=list, max_length=40)

    @field_validator("keywords")
    @classmethod
    def normalize_keywords(cls, values: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(value.strip().lower() for value in values))
        if "" in normalized:
            raise ValueError("Ключевое слово не может быть пустым")
        return normalized


class CategoryRow(CategoryInput):
    id: int


class DiscountInput(AdminInput):
    category_id: int = Field(gt=0)
    partner_name: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=500)
    discount_percent: int = Field(default=0, ge=0, le=100)
    promocode: str | None = Field(default=None, max_length=100)
    affiliate_url: str = Field(default="", max_length=2000)
    valid_from: date | None = None
    valid_until: date
    status: ContentStatus = "draft"
    is_demo: bool = False
    activation: str = Field(default="", max_length=4000)
    benefit: str = Field(default="", max_length=200)
    conditions: str = Field(default="", max_length=4000)
    original_price: Price | None = None
    sale_price: Price | None = None

    @field_validator("affiliate_url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        if value:
            url = urlsplit(value)
            if url.scheme != "https" or not url.hostname or url.username or url.password:
                raise ValueError("Укажите прямую HTTPS-ссылку на магазин")
        return value

    @model_validator(mode="after")
    def validate_offer(self) -> Self:
        if self.valid_from is not None and self.valid_from > self.valid_until:
            raise ValueError("Дата начала должна предшествовать дате окончания")
        if (self.original_price is None) != (self.sale_price is None):
            raise ValueError("Укажите обе цены или оставьте их пустыми")
        if (
            self.original_price is not None
            and self.sale_price is not None
            and (self.original_price <= 0 or self.sale_price > self.original_price)
        ):
            raise ValueError("Новая цена не может быть выше исходной")
        return self


class DiscountRow(DiscountResponse):
    status: ContentStatus
    valid_from: date | None


class ArticleInput(AdminInput):
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=1000)
    category: str = Field(min_length=1, max_length=100)
    content_markdown: str = Field(min_length=1, max_length=60000)
    read_time_min: int = Field(ge=1, le=180)
    tags: list[Tag] = Field(default_factory=list, max_length=20)
    action_checklist: list[ChecklistItem] = Field(default_factory=list, max_length=30)
    status: ContentStatus = "draft"


class ArticleRow(Article):
    status: ContentStatus


class BadgeInput(AdminInput):
    title: str = Field(min_length=1, max_length=100)
    level: Literal["Бронза", "Серебро", "Золото", "Платина"]
    icon: str = Field(min_length=1, max_length=20)
    condition: str = Field(min_length=1, max_length=500)
    points: int = Field(ge=0, le=1000)
    metric: str | None = None
    target: int = Field(default=1, ge=1, le=10000)
    enabled: bool = False

    @model_validator(mode="after")
    def validate_rule(self) -> Self:
        if self.metric is not None and self.metric not in EVENT_METRICS | PROGRESS_METRICS:
            raise ValueError("Выберите поддерживаемое условие")
        if self.enabled and self.metric is None:
            raise ValueError("У активного бейджа должно быть условие")
        if self.metric in EVENT_METRICS and self.target != 1:
            raise ValueError("Для разового события порог должен равняться 1")
        return self


class BadgeCreate(BadgeInput):
    code: str = Field(min_length=1, max_length=40, pattern=r"^[A-Z][A-Z0-9_]*$")


class BadgeRow(BadgeInput):
    model_config = ConfigDict(from_attributes=True)

    code: str


class TicketResponse(AdminInput):
    status: TicketStatus
    reply: str | None = Field(default=None, max_length=4000)

    @model_validator(mode="after")
    def validate_reply(self) -> Self:
        if self.status == "answered" and not self.reply:
            raise ValueError("Напишите ответ на обращение")
        return self


class TicketRow(BaseModel):
    id: UUID
    email: str
    message: str
    status: TicketStatus
    reply: str | None
    answered_at: datetime | None
    created_at: datetime
    attachment_name: str | None


class AnalyticsRow(BaseModel):
    imports: int
    recognition_percent: float | None
    profiles: int
    active_accounts: int
    popular_goals: dict[str, int]
