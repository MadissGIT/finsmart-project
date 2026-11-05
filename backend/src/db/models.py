from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    MetaData,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GoalContribution(Base):
    __tablename__ = "goal_contributions"
    __table_args__ = (
        Index("ix_goal_contributions_goal_id", "goal_id"),
        CheckConstraint("amount BETWEEN 0.01 AND 999999999999.99", name="positive_amount"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    goal_id: Mapped[UUID] = mapped_column(ForeignKey("goals.id", ondelete="CASCADE"))
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
    valid_until: Mapped[date]


class RefreshSession(Base):
    __tablename__ = "refresh_sessions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
