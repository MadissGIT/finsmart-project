import logging
from datetime import UTC, datetime
from typing import Annotated
from urllib.parse import quote
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import Float, case, cast, delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_async_session
from src.db.models import (
    Achievement,
    Category,
    CategoryRule,
    Discount,
    Goal,
    KnowledgeArticle,
    RefreshSession,
    RuleType,
    StatementImport,
    SupportTicket,
    Transaction,
    User,
)
from src.routes.admin.schemas import (
    AnalyticsRow,
    ArticleInput,
    ArticleRow,
    BadgeCreate,
    BadgeInput,
    BadgeRow,
    CategoryInput,
    CategoryRow,
    DiscountInput,
    DiscountRow,
    TicketResponse,
    TicketRow,
    UserBlock,
    UserRow,
)
from src.routes.auth.dependencies import get_current_user

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = logging.getLogger(__name__)
Session = Annotated[AsyncSession, Depends(get_async_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


def require_staff(user: CurrentUser) -> User:
    if user.role not in {"admin", "moderator"}:
        raise HTTPException(403, "Доступ только для сотрудников")
    return user


def require_admin(user: CurrentUser) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Требуются права администратора")
    return user


Staff = Annotated[User, Depends(require_staff)]
Admin = Annotated[User, Depends(require_admin)]


async def commit(session: AsyncSession, actor: User, action: str, target: object) -> None:
    try:
        await session.commit()
    except IntegrityError as err:
        await session.rollback()
        raise HTTPException(409, "Такая запись или привязка уже существует") from err
    logger.info("admin_change actor=%s action=%s target=%s", actor.id, action, target)


@router.get("/users")
async def users(
    _admin: Admin,
    session: Session,
    limit: Limit = 30,
    offset: Offset = 0,
    q: Annotated[str, Query(max_length=100)] = "",
) -> list[UserRow]:
    matching = User.email.icontains(q, autoescape=True) | User.full_name.icontains(
        q, autoescape=True
    )
    page = select(User.id).where(matching).order_by(User.created_at.desc(), User.id)
    page = page.limit(limit).offset(offset).cte("users_page")
    operations = (
        select(func.count()).where(Transaction.user_id == User.id).correlate(User).scalar_subquery()
    )
    imports = (
        select(func.count())
        .where(StatementImport.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    goals = select(func.count()).where(Goal.user_id == User.id).correlate(User).scalar_subquery()
    last_operation = (
        select(func.max(Transaction.created_at))
        .where(Transaction.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    last_import = (
        select(func.max(StatementImport.created_at))
        .where(StatementImport.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    last_goal = (
        select(func.max(Goal.created_at))
        .where(Goal.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    result = await session.execute(
        select(
            User.id,
            User.email,
            User.full_name,
            User.role,
            User.blocked_at,
            User.created_at,
            operations.label("operations"),
            imports.label("imports"),
            goals.label("goals"),
            func.greatest(last_operation, last_import, last_goal).label("last_activity"),
        )
        .join(page, page.c.id == User.id)
        .order_by(User.created_at.desc(), User.id)
    )
    return [UserRow.model_validate(row) for row in result.mappings()]


@router.put("/users/{user_id}/block", status_code=204)
async def block_user(user_id: UUID, payload: UserBlock, admin: Admin, session: Session) -> Response:
    user = await session.get(User, user_id, with_for_update={"key_share": True})
    if user is None:
        raise HTTPException(404, "Пользователь не найден")
    if user.role == "admin":
        raise HTTPException(409, "Учетные записи администраторов управляются отдельно")
    if payload.blocked != (user.blocked_at is not None):
        user.blocked_at = datetime.now(UTC) if payload.blocked else None
        if payload.blocked:
            user.session_version += 1
            await session.execute(delete(RefreshSession).where(RefreshSession.user_id == user_id))
        await commit(session, admin, "user_block" if payload.blocked else "user_unblock", user_id)
    return Response(status_code=204)


@router.get("/categories")
async def categories(_staff: Staff, session: Session) -> list[CategoryRow]:
    rows = list(await session.scalars(select(Category).order_by(Category.id)))
    keywords: dict[int, list[str]] = {}
    result = await session.execute(
        select(CategoryRule.category_id, CategoryRule.pattern)
        .where(CategoryRule.rule_type == RuleType.KEYWORD)
        .order_by(CategoryRule.priority, CategoryRule.id)
    )
    for category_id, text in result.tuples():
        keywords.setdefault(category_id, []).append(text)
    return [
        CategoryRow(
            id=row.id,
            name=row.name,
            parent_id=row.parent_id,
            budget_group=row.budget_group,
            keywords=keywords.get(row.id, []),
        )
        for row in rows
    ]


async def save_category(
    category_id: int | None, payload: CategoryInput, staff: User, session: AsyncSession
) -> CategoryRow:
    rows = {
        row.id: row
        for row in await session.scalars(select(Category).order_by(Category.id).with_for_update())
    }
    parent_id = payload.parent_id
    while parent_id is not None:
        if parent_id == category_id:
            raise HTTPException(422, "Категория не может быть своей родительской категорией")
        parent = rows.get(parent_id)
        if parent is None:
            raise HTTPException(422, "Родительская категория не найдена")
        parent_id = parent.parent_id
    if category_id is None:
        row = Category()
        session.add(row)
    else:
        row = rows.get(category_id)
        if row is None:
            raise HTTPException(404, "Категория не найдена")
    row.name = payload.name
    row.parent_id = payload.parent_id
    row.budget_group = payload.budget_group
    try:
        await session.flush()
    except IntegrityError as err:
        await session.rollback()
        raise HTTPException(409, "Название категории уже используется") from err
    rules = {
        rule.pattern: rule
        for rule in await session.scalars(
            select(CategoryRule).where(
                CategoryRule.category_id == row.id, CategoryRule.rule_type == RuleType.KEYWORD
            )
        )
    }
    for pattern, rule in rules.items():
        if pattern not in payload.keywords:
            await session.delete(rule)
    for pattern in payload.keywords:
        if pattern not in rules:
            session.add(
                CategoryRule(
                    category_id=row.id, rule_type=RuleType.KEYWORD, pattern=pattern, priority=100
                )
            )
    await commit(session, staff, "category_save", row.id)
    return CategoryRow(id=row.id, **payload.model_dump())


@router.post("/categories", status_code=201)
async def create_category(payload: CategoryInput, staff: Staff, session: Session) -> CategoryRow:
    return await save_category(None, payload, staff, session)


@router.put("/categories/{category_id}")
async def update_category(
    category_id: int, payload: CategoryInput, staff: Staff, session: Session
) -> CategoryRow:
    return await save_category(category_id, payload, staff, session)


def discount_row(row: Discount, category_name: str) -> DiscountRow:
    return DiscountRow.model_validate(
        {
            "id": row.id,
            "code": row.code,
            "category_name": category_name,
            "category_id": row.category_id,
            "partner_name": row.partner_name,
            "title": row.title,
            "activation": row.activation,
            "benefit": row.benefit,
            "conditions": row.conditions,
            "discount_percent": row.discount_percent,
            "promocode": row.promocode,
            "affiliate_url": row.affiliate_url,
            "valid_from": row.valid_from,
            "valid_until": row.valid_until,
            "status": row.status,
            "is_demo": row.is_demo,
            "original_price": row.original_price,
            "sale_price": row.sale_price,
        }
    )


@router.get("/discounts")
async def discounts(_staff: Staff, session: Session) -> list[DiscountRow]:
    result = await session.execute(
        select(Discount, Category.name).join(Category).order_by(Discount.partner_name, Discount.id)
    )
    return [discount_row(row, name) for row, name in result.tuples()]


async def save_discount(
    offer_id: UUID | None, payload: DiscountInput, staff: User, session: AsyncSession
) -> DiscountRow:
    category = await session.get(Category, payload.category_id)
    if category is None:
        raise HTTPException(422, "Выберите системную категорию")
    if offer_id is None:
        row = Discount(id=uuid4())
        session.add(row)
    else:
        row = await session.get(Discount, offer_id, with_for_update=True)
        if row is None:
            raise HTTPException(404, "Предложение не найдено")
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    await commit(session, staff, "discount_save", row.id)
    return discount_row(row, category.name)


@router.post("/discounts", status_code=201)
async def create_discount(payload: DiscountInput, staff: Staff, session: Session) -> DiscountRow:
    return await save_discount(None, payload, staff, session)


@router.put("/discounts/{offer_id}")
async def update_discount(
    offer_id: UUID, payload: DiscountInput, staff: Staff, session: Session
) -> DiscountRow:
    return await save_discount(offer_id, payload, staff, session)


@router.get("/articles")
async def articles(_staff: Staff, session: Session) -> list[ArticleRow]:
    rows = await session.scalars(select(KnowledgeArticle).order_by(KnowledgeArticle.title))
    return [ArticleRow.model_validate(row) for row in rows]


@router.post("/articles", status_code=201)
async def create_article(payload: ArticleInput, staff: Staff, session: Session) -> ArticleRow:
    article_id = str(uuid4())
    row = KnowledgeArticle(id=article_id, slug=article_id, **payload.model_dump())
    session.add(row)
    await commit(session, staff, "article_create", row.id)
    return ArticleRow.model_validate(row)


@router.put("/articles/{article_id}")
async def update_article(
    article_id: str, payload: ArticleInput, staff: Staff, session: Session
) -> ArticleRow:
    row = await session.get(KnowledgeArticle, article_id, with_for_update=True)
    if row is None:
        raise HTTPException(404, "Статья не найдена")
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    await commit(session, staff, "article_save", row.id)
    return ArticleRow.model_validate(row)


@router.get("/badges")
async def badges(_staff: Staff, session: Session) -> list[BadgeRow]:
    return [
        BadgeRow.model_validate(row)
        for row in await session.scalars(select(Achievement).order_by(Achievement.code))
    ]


@router.post("/badges", status_code=201)
async def create_badge(payload: BadgeCreate, staff: Staff, session: Session) -> BadgeRow:
    row = Achievement(**payload.model_dump())
    session.add(row)
    await commit(session, staff, "badge_create", row.code)
    return BadgeRow.model_validate(row)


@router.put("/badges/{code}")
async def update_badge(code: str, payload: BadgeInput, staff: Staff, session: Session) -> BadgeRow:
    row = await session.get(Achievement, code, with_for_update=True)
    if row is None:
        raise HTTPException(404, "Бейдж не найден")
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    await commit(session, staff, "badge_save", row.code)
    return BadgeRow.model_validate(row)


@router.get("/analytics")
async def analytics(_admin: Admin, session: Session) -> AnalyticsRow:
    measured = case(
        (StatementImport.total > 0, cast(StatementImport.recognized, Float) / StatementImport.total)
    )
    imports, average = (
        await session.execute(select(func.count(), func.avg(measured)).select_from(StatementImport))
    ).one()
    profiles, unblocked = (
        await session.execute(
            select(func.count(), func.count().filter(User.blocked_at.is_(None))).select_from(User)
        )
    ).one()
    labels = {"plane": "Поездки", "laptop": "Техника", "car": "Авто", "home": "Дом"}
    category = case(labels, value=Goal.icon, else_="Другое")
    counts = await session.execute(
        select(category, func.count()).group_by(category).order_by(func.count().desc())
    )
    return AnalyticsRow(
        imports=imports,
        recognition_percent=round(float(average) * 100, 1) if average is not None else None,
        profiles=profiles,
        active_accounts=unblocked,
        popular_goals=dict(counts.tuples().all()),
    )


@router.get("/tickets")
async def tickets(
    _staff: Staff, session: Session, limit: Limit = 30, offset: Offset = 0
) -> list[TicketRow]:
    result = await session.execute(
        select(
            SupportTicket.id,
            User.email,
            SupportTicket.message,
            SupportTicket.status,
            SupportTicket.reply,
            SupportTicket.answered_at,
            SupportTicket.created_at,
            SupportTicket.attachment_name,
        )
        .join(User, User.id == SupportTicket.user_id)
        .order_by(SupportTicket.created_at.desc(), SupportTicket.id)
        .limit(limit)
        .offset(offset)
    )
    return [TicketRow.model_validate(row) for row in result.mappings()]


@router.put("/tickets/{ticket_id}", status_code=204)
async def reply_ticket(
    ticket_id: UUID, payload: TicketResponse, staff: Staff, session: Session
) -> Response:
    ticket = await session.get(SupportTicket, ticket_id, with_for_update=True)
    if ticket is None:
        raise HTTPException(404, "Обращение не найдено")
    ticket.status = payload.status
    if ticket.reply != payload.reply:
        ticket.reply = payload.reply or None
        ticket.answered_at = datetime.now(UTC) if payload.reply else None
    await commit(session, staff, "ticket_reply", ticket.id)
    return Response(status_code=204)


@router.get("/tickets/{ticket_id}/attachment", response_class=Response)
async def attachment(ticket_id: UUID, _staff: Staff, session: Session) -> Response:
    row = await session.execute(
        select(SupportTicket.attachment, SupportTicket.attachment_name).where(
            SupportTicket.id == ticket_id
        )
    )
    file = row.one_or_none()
    if file is None or file.attachment is None:
        raise HTTPException(404, "Вложение не найдено")
    name = quote(file.attachment_name or "attachment", safe="")
    return Response(
        file.attachment,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": "attachment; filename*=UTF-8''" + name,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        },
    )
