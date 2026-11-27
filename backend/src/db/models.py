from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Identity,
    Index,
    LargeBinary,
    MetaData,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    false,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class BudgetGroup(StrEnum):
    NEEDS = "NEEDS"
    WANTS = "WANTS"
    SAVINGS = "SAVINGS"
    INCOME = "INCOME"
    OTHER = "OTHER"


class OperationType(StrEnum):
    DEBIT = "DEBIT"
    CREDIT = "CREDIT"


class BankSource(StrEnum):
    TBANK = "TBANK"
    SBER = "SBER"
    VTB = "VTB"
    MANUAL = "MANUAL"


class RuleType(StrEnum):
    MCC = "MCC"
    KEYWORD = "KEYWORD"


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        },
    )


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("email = lower(trim(email))", name="normalized_email"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(200))
    birth_date: Mapped[date | None]
    goal: Mapped[str | None] = mapped_column(String(16))
    income_range: Mapped[str | None] = mapped_column(String(16))
    role: Mapped[str] = mapped_column(String(16), server_default="user")
    blocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    session_version: Mapped[int] = mapped_column(server_default="0")
    preferences_saved: Mapped[bool] = mapped_column(server_default=false())
    welcome_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    first_manual_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))
    name: Mapped[str] = mapped_column(String(100), unique=True)
    budget_group: Mapped[BudgetGroup] = mapped_column(Enum(BudgetGroup, name="budget_group"))


class CategoryRule(Base):
    __tablename__ = "category_rules"
    __table_args__ = (
        UniqueConstraint("rule_type", "pattern"),
        CheckConstraint("priority >= 0", name="nonnegative_priority"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))
    rule_type: Mapped[RuleType] = mapped_column(Enum(RuleType, name="rule_type"))
    pattern: Mapped[str] = mapped_column(String(1000))
    priority: Mapped[int]


class UserRule(Base):
    __tablename__ = "user_rules"
    __table_args__ = (
        UniqueConstraint("user_id", "merchant_name"),
        CheckConstraint("length(trim(merchant_name)) > 0", name="nonempty_merchant"),
        CheckConstraint("merchant_name = lower(trim(merchant_name))", name="normalized_merchant"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))
    merchant_name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint("user_id", "import_hash"),
        Index("ix_transactions_user_date", "user_id", "transaction_date"),
        Index("ix_transactions_user_category_date", "user_id", "category_id", "transaction_date"),
        Index("ix_transactions_user_created_at", "user_id", "created_at"),
        CheckConstraint("amount BETWEEN 0.01 AND 999999999999.99", name="positive_amount"),
        CheckConstraint("confidence BETWEEN 0 AND 1", name="confidence_range"),
        CheckConstraint("mcc_code IS NULL OR mcc_code ~ '^[0-9]{4}$'", name="valid_mcc"),
        CheckConstraint("currency = 'RUB'", name="rub_currency"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    operation_type: Mapped[OperationType] = mapped_column(
        Enum(OperationType, name="operation_type")
    )
    transaction_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    merchant_name: Mapped[str] = mapped_column(String(255))
    comment: Mapped[str | None] = mapped_column(String(2000))
    mcc_code: Mapped[str | None] = mapped_column(String(4))
    # NULL for manual entries; repeated imports are unique within one user's account.
    import_hash: Mapped[str | None] = mapped_column(String(64))
    confidence: Mapped[Decimal] = mapped_column(Numeric(3, 2))
    requires_review: Mapped[bool]
    bank_source: Mapped[BankSource] = mapped_column(
        Enum(BankSource, native_enum=False, create_constraint=True, name="bank_source"),
        default=BankSource.MANUAL,
        server_default="MANUAL",
    )
    raw_description: Mapped[str] = mapped_column(Text, default="", server_default="")
    bank_category_raw: Mapped[str | None] = mapped_column(String(255))
    currency: Mapped[str] = mapped_column(String(3), default="RUB", server_default="RUB")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (
        Index("ix_goals_user_id", "user_id"),
        CheckConstraint("target_amount BETWEEN 0.01 AND 999999999999.99", name="positive_target"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    target_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    deadline: Mapped[date]
    icon: Mapped[str] = mapped_column(String(32), server_default="target")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    __table_args__ = (UniqueConstraint("user_id", "request_id"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    request_id: Mapped[UUID]
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), server_default="open")
    reply: Mapped[str | None] = mapped_column(Text)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attachment_name: Mapped[str | None] = mapped_column(String(255))
    attachment_type: Mapped[str | None] = mapped_column(String(32))
    attachment: Mapped[bytes | None] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GoalContribution(Base):
    __tablename__ = "goal_contributions"
    __table_args__ = (
        Index("ix_goal_contributions_goal_date", "goal_id", "created_at", "id"),
        CheckConstraint("source IN ('free_money', 'discount')", name="valid_source"),
        CheckConstraint("amount BETWEEN 0.01 AND 999999999999.99", name="positive_amount"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    goal_id: Mapped[UUID] = mapped_column(ForeignKey("goals.id", ondelete="CASCADE"))
    transaction_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"), unique=True
    )
    source: Mapped[str] = mapped_column(String(10), server_default="free_money")
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Discount(Base):
    __tablename__ = "discounts"
    __table_args__ = (
        Index("ix_discounts_category_valid_until", "category_id", "valid_until"),
        CheckConstraint("discount_percent BETWEEN 0 AND 100", name="discount_range"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))
    partner_name: Mapped[str] = mapped_column(String(200))
    title: Mapped[str] = mapped_column(String(500))
    discount_percent: Mapped[int]
    promocode: Mapped[str | None] = mapped_column(String(100))
    affiliate_url: Mapped[str] = mapped_column(String(2000))
    status: Mapped[str] = mapped_column(String(16), server_default="published")
    valid_from: Mapped[date | None]
    original_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    sale_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    valid_until: Mapped[date]
    code: Mapped[str | None] = mapped_column(String(10), unique=True)
    activation: Mapped[str] = mapped_column(Text, server_default="")
    benefit: Mapped[str] = mapped_column(Text, server_default="")
    conditions: Mapped[str] = mapped_column(Text, server_default="")
    is_demo: Mapped[bool] = mapped_column(server_default="true")


class RefreshSession(Base):
    __tablename__ = "refresh_sessions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Achievement(Base):
    __tablename__ = "achievements"

    code: Mapped[str] = mapped_column(String(40), primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    level: Mapped[str] = mapped_column(String(20))
    icon: Mapped[str] = mapped_column(String(20))
    points: Mapped[int]
    condition: Mapped[str] = mapped_column(Text)
    metric: Mapped[str | None] = mapped_column(String(32))
    target: Mapped[int] = mapped_column(server_default="1")
    enabled: Mapped[bool] = mapped_column(server_default=false())


class UserAchievement(Base):
    __tablename__ = "user_achievements"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    code: Mapped[str] = mapped_column(
        ForeignKey("achievements.code", ondelete="CASCADE"), primary_key=True
    )
    awarded_points: Mapped[int]
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserChallenge(Base):
    __tablename__ = "user_challenges"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    code: Mapped[str] = mapped_column(String(40), primary_key=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reward_points: Mapped[int] = mapped_column(server_default="0")


class CategoryLimit(Base):
    __tablename__ = "category_limits"
    __table_args__ = (
        CheckConstraint("amount BETWEEN 0.01 AND 999999999999.99", name="positive_amount"),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))


class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100))
    read_time_min: Mapped[int]
    summary: Mapped[str] = mapped_column(Text)
    content_markdown: Mapped[str] = mapped_column(Text)
    action_checklist: Mapped[list[str]] = mapped_column(JSONB)
    tags: Mapped[list[str]] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(16), server_default="draft")


class StatementImport(Base):
    __tablename__ = "statement_imports"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    total: Mapped[int]
    recognized: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
