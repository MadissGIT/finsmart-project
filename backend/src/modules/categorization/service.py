import re
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from src.db.models import BudgetGroup, Category, OperationType, RuleType
from src.modules.categorization.repositories import CategorizationRepository


@dataclass(frozen=True, slots=True)
class CategorizationResult:
    category_id: int
    category_name: str
    confidence: Decimal
    requires_review: bool


class CategorizationService:
    def __init__(self, categorization_repository: CategorizationRepository) -> None:
        self._categorization_repository = categorization_repository

    async def categorize(
        self,
        *,
        user_id: UUID,
        merchant_name: str,
        raw_description: str,
        mcc_code: str | None,
        operation_type: OperationType,
    ) -> CategorizationResult:
        if mcc_code is not None and re.fullmatch(r"[0-9]{4}", mcc_code) is None:
            msg = "MCC must contain exactly four ASCII digits"
            raise ValueError(msg)
        normalized_merchant = merchant_name.strip().lower()
        if normalized_merchant and (
            category := await self._categorization_repository.get_user_category(
                user_id,
                normalized_merchant,
            )
        ):
            return CategorizationResult(category.id, category.name, Decimal("1.00"), False)
        rules = await self._categorization_repository.list_rules()
        # MCC describes a merchant's activity; incoming payments are income, not spending.
        if operation_type is OperationType.DEBIT and mcc_code is not None:
            for rule, category in rules:
                if rule.rule_type is RuleType.MCC and rule.pattern == mcc_code:
                    return CategorizationResult(category.id, category.name, Decimal("0.95"), False)
        description = f"{normalized_merchant} {raw_description}".lower()
        for rule, category in rules:
            if (category.budget_group is BudgetGroup.INCOME) != (
                operation_type is OperationType.CREDIT
            ):
                continue
            if rule.rule_type is RuleType.KEYWORD and re.search(rule.pattern, description):
                return CategorizationResult(category.id, category.name, Decimal("0.80"), False)
        if (category := await self._categorization_repository.get_category(11)) is None:
            msg = "Fallback category is missing; apply the initial migration"
            raise RuntimeError(msg)
        return CategorizationResult(category.id, category.name, Decimal("0.00"), True)

    async def list_categories(self) -> list[Category]:
        return await self._categorization_repository.list_categories()
