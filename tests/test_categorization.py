import asyncio
from decimal import Decimal
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from src.db.models import BudgetGroup, Category, CategoryRule, OperationType, RuleType
from src.modules.categorization.repositories import CategorizationRepository
from src.modules.categorization.service import CategorizationService


@pytest.fixture
def categorization_repository() -> AsyncMock:
    repository = AsyncMock(spec=CategorizationRepository)
    repository.get_user_category.return_value = None
    repository.get_category.return_value = Category(
        id=11,
        name="Другое / Не определено",
        budget_group=BudgetGroup.OTHER,
    )
    groceries = Category(id=1, name="Супермаркеты", budget_group=BudgetGroup.NEEDS)
    restaurants = Category(
        id=5, name="Кафе и рестораны", budget_group=BudgetGroup.WANTS
    )
    income = Category(id=10, name="Зарплата и доходы", budget_group=BudgetGroup.INCOME)
    repository.list_rules.return_value = [
        (CategoryRule(rule_type=RuleType.KEYWORD, pattern="кофе|coffee"), restaurants),
        (CategoryRule(rule_type=RuleType.MCC, pattern="5411"), groceries),
        (CategoryRule(rule_type=RuleType.KEYWORD, pattern="зарплат"), income),
    ]
    return repository


def test_user_rule_precedes_mcc_and_keywords(
    categorization_repository: AsyncMock,
) -> None:
    user_id = uuid4()
    categorization_repository.get_user_category.return_value = Category(
        id=2, name="Транспорт"
    )
    result = asyncio.run(
        CategorizationService(categorization_repository).categorize(
            user_id=user_id,
            merchant_name="  SIMPLE COFFEE  ",
            raw_description="Кофе",
            mcc_code="5411",
            operation_type=OperationType.DEBIT,
        ),
    )
    assert result.category_id == 2
    assert result.confidence == Decimal("1.00")
    assert not result.requires_review
    categorization_repository.get_user_category.assert_awaited_once_with(
        user_id, "simple coffee"
    )
    categorization_repository.list_rules.assert_not_awaited()


@pytest.mark.parametrize(
    ("mcc_code", "description", "operation_type", "category_id", "confidence"),
    [
        ("5411", "Coffee", OperationType.DEBIT, 1, "0.95"),
        (None, "SIMPLE COFFEE", OperationType.DEBIT, 5, "0.80"),
        ("9999", "Утренний кофе", OperationType.DEBIT, 5, "0.80"),
        (None, "Неизвестно", OperationType.DEBIT, 11, "0.00"),
        ("5411", "Зарплата", OperationType.CREDIT, 10, "0.80"),
        ("5411", "Coffee", OperationType.CREDIT, 11, "0.00"),
        (None, "Зарплата", OperationType.DEBIT, 11, "0.00"),
    ],
)
def test_categorization_sources(
    categorization_repository: AsyncMock,
    mcc_code: str | None,
    description: str,
    operation_type: OperationType,
    category_id: int,
    confidence: str,
) -> None:
    result = asyncio.run(
        CategorizationService(categorization_repository).categorize(
            user_id=uuid4(),
            merchant_name="",
            raw_description=description,
            mcc_code=mcc_code,
            operation_type=operation_type,
        ),
    )
    assert result.category_id == category_id
    assert result.confidence == Decimal(confidence)
    assert result.requires_review == (category_id == 11)
    categorization_repository.get_user_category.assert_not_awaited()


@pytest.mark.parametrize("mcc_code", ["", "541", "54111", "abcd", "５４１１", "5411\n"])
def test_invalid_mcc_is_rejected(
    categorization_repository: AsyncMock,
    mcc_code: str,
) -> None:
    with pytest.raises(ValueError, match="MCC"):
        asyncio.run(
            CategorizationService(categorization_repository).categorize(
                user_id=uuid4(),
                merchant_name="магазин",
                raw_description="",
                mcc_code=mcc_code,
                operation_type=OperationType.DEBIT,
            ),
        )
    categorization_repository.get_user_category.assert_not_awaited()


def test_missing_seed_fails_explicitly(categorization_repository: AsyncMock) -> None:
    categorization_repository.get_category.return_value = None
    with pytest.raises(RuntimeError, match="initial migration"):
        asyncio.run(
            CategorizationService(categorization_repository).categorize(
                user_id=uuid4(),
                merchant_name="unknown",
                raw_description="",
                mcc_code=None,
                operation_type=OperationType.DEBIT,
            ),
        )
