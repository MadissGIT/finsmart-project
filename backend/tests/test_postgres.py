import asyncio
import re
from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession

from src.db.models import (
    Base,
    BudgetGroup,
    CategoryRule,
    Goal,
    GoalContribution,
    OperationType,
    RuleType,
    Transaction,
    User,
    UserRule,
)
from src.modules.categorization.repositories import CategorizationRepository
from src.modules.categorization.service import CategorizationService


def test_migration_matches_models_and_seed(
    postgres: tuple[asyncio.Runner, AsyncConnection],
) -> None:
    runner, connection = postgres

    async def scenario() -> None:
        differences = await connection.run_sync(
            lambda sync: compare_metadata(MigrationContext.configure(sync), Base.metadata),
        )
        assert differences == []
        async with AsyncSession(
            bind=connection, join_transaction_mode="create_savepoint"
        ) as session:
            categories = await CategorizationService(
                CategorizationRepository(session)
            ).list_categories()
            assert [category.id for category in categories] == list(range(1, 12))
            assert categories[4].name == "Кафе и рестораны"
            assert categories[-1].budget_group is BudgetGroup.OTHER
            rules = list((await session.scalars(select(CategoryRule))).all())
            assert len(rules) == 38
            for rule in rules:
                if rule.rule_type is RuleType.KEYWORD:
                    re.compile(rule.pattern)
                else:
                    assert re.fullmatch(r"[0-9]{4}", rule.pattern)

    runner.run(scenario())


@pytest.mark.parametrize(
    ("merchant", "category_id"),
    [
        ("Пятерочка", 1),
        ("Яндекс Go", 2),
        ("МТС", 3),
        ("Планета здоровья", 4),
        ("Simple Coffee", 5),
        ("Кинопоиск", 6),
        ("OZON", 7),
        ("Золотое Яблоко", 8),
        ("Накопительный вклад", 9),
        ("Магнит Косметик", 8),
        ("Неизвестный магазин", 11),
        ("merchant2unknown", 11),
    ],
)
def test_seed_keywords(
    postgres: tuple[asyncio.Runner, AsyncConnection],
    merchant: str,
    category_id: int,
) -> None:
    runner, connection = postgres

    async def scenario() -> None:
        async with AsyncSession(bind=connection) as session:
            result = await CategorizationService(CategorizationRepository(session)).categorize(
                user_id=uuid4(),
                merchant_name=merchant,
                raw_description="",
                mcc_code=None,
                operation_type=OperationType.DEBIT,
            )
            assert result.category_id == category_id
            assert result.requires_review == (category_id == 11)

    runner.run(scenario())


def test_every_seed_mcc_and_income(
    postgres: tuple[asyncio.Runner, AsyncConnection],
) -> None:
    runner, connection = postgres

    async def scenario() -> None:
        async with AsyncSession(bind=connection) as session:
            repository = CategorizationRepository(session)
            service = CategorizationService(repository)
            for rule, category in await repository.list_rules():
                if rule.rule_type is RuleType.MCC:
                    result = await service.categorize(
                        user_id=uuid4(),
                        merchant_name="Coffee",
                        raw_description="",
                        mcc_code=rule.pattern,
                        operation_type=OperationType.DEBIT,
                    )
                    assert result.category_id == category.id
            result = await service.categorize(
                user_id=uuid4(),
                merchant_name="Работодатель",
                raw_description="Зарплата",
                mcc_code="5411",
                operation_type=OperationType.CREDIT,
            )
            assert result.category_id == 10

    runner.run(scenario())


def test_user_rules_are_isolated(
    postgres: tuple[asyncio.Runner, AsyncConnection],
) -> None:
    runner, connection = postgres

    async def scenario() -> None:
        async with AsyncSession(
            bind=connection, join_transaction_mode="create_savepoint"
        ) as session:
            user_id = uuid4()
            session.add(
                User(
                    id=user_id,
                    email="user@example.com",
                    hashed_password="hash",
                    full_name="User",
                )
            )
            await session.flush()
            session.add(UserRule(user_id=user_id, merchant_name="simple coffee", category_id=2))
            await session.flush()
            service = CategorizationService(CategorizationRepository(session))
            for current_user, expected in [(user_id, 2), (uuid4(), 1)]:
                result = await service.categorize(
                    user_id=current_user,
                    merchant_name=" SIMPLE COFFEE ",
                    raw_description="",
                    mcc_code="5411",
                    operation_type=OperationType.DEBIT,
                )
                assert result.category_id == expected

    runner.run(scenario())


def test_import_deduplication_and_manual_entries(
    postgres: tuple[asyncio.Runner, AsyncConnection],
) -> None:
    runner, connection = postgres

    async def scenario() -> None:
        async with AsyncSession(
            bind=connection, join_transaction_mode="create_savepoint"
        ) as session:
            users = [
                User(id=uuid4(), email=email, hashed_password="hash", full_name="User")
                for email in ["first@example.com", "second@example.com"]
            ]
            session.add_all(users)
            await session.flush()
            fields = {
                "category_id": 1,
                "amount": Decimal("123.45"),
                "operation_type": OperationType.DEBIT,
                "transaction_date": datetime.now(UTC),
                "merchant_name": "Магнит",
                "confidence": Decimal("0.95"),
                "requires_review": False,
            }
            for user in users:
                session.add(Transaction(user_id=user.id, import_hash="a" * 64, **fields))
            session.add_all([Transaction(user_id=users[0].id, **fields) for _ in range(2)])
            await session.flush()
            with pytest.raises(IntegrityError):
                async with session.begin_nested():
                    session.add(Transaction(user_id=users[0].id, import_hash="a" * 64, **fields))
                    await session.flush()
            assert await session.scalar(select(func.count()).select_from(Transaction)) == 4

    runner.run(scenario())


@pytest.mark.parametrize("amount", [Decimal("0"), Decimal("-1"), Decimal("NaN")])
def test_invalid_money_is_rejected(
    postgres: tuple[asyncio.Runner, AsyncConnection],
    amount: Decimal,
) -> None:
    runner, connection = postgres

    async def scenario() -> None:
        async with AsyncSession(
            bind=connection, join_transaction_mode="create_savepoint"
        ) as session:
            user_id = uuid4()
            session.add(
                User(
                    id=user_id,
                    email="user@example.com",
                    hashed_password="hash",
                    full_name="User",
                )
            )
            await session.flush()
            with pytest.raises(IntegrityError):
                async with session.begin_nested():
                    session.add(
                        Goal(
                            user_id=user_id,
                            title="Goal",
                            target_amount=amount,
                            deadline=date(2027, 1, 1),
                        )
                    )
                    await session.flush()

    runner.run(scenario())


def test_contribution_cascades_with_user(
    postgres: tuple[asyncio.Runner, AsyncConnection],
) -> None:
    runner, connection = postgres

    async def scenario() -> None:
        async with AsyncSession(
            bind=connection, join_transaction_mode="create_savepoint"
        ) as session:
            user = User(email="user@example.com", hashed_password="hash", full_name="User")
            session.add(user)
            await session.flush()
            goal = Goal(
                user_id=user.id,
                title="Laptop",
                target_amount=Decimal("60000"),
                deadline=date(2027, 4, 1),
            )
            session.add(goal)
            await session.flush()
            session.add(GoalContribution(goal_id=goal.id, amount=Decimal("600")))
            await session.flush()
            await session.delete(user)
            await session.flush()
            assert await session.scalar(select(func.count()).select_from(Goal)) == 0
            assert await session.scalar(select(func.count()).select_from(GoalContribution)) == 0

    runner.run(scenario())


def test_migration_round_trip(postgres: tuple[asyncio.Runner, AsyncConnection]) -> None:
    runner, connection = postgres
    config = Config("alembic.ini")

    def scenario(sync) -> None:
        config.attributes["connection"] = sync
        command.downgrade(config, "base")
        command.upgrade(config, "head")
        assert compare_metadata(MigrationContext.configure(sync), Base.metadata) == []

    runner.run(connection.run_sync(scenario))
