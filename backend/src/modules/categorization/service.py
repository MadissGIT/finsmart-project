import re
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from src.db.models import BudgetGroup, Category, CategoryRule, OperationType, RuleType
from src.modules.categorization.repositories import CategorizationRepository
from src.modules.statements.schemas import StandardTransactionDTO

# Exact bank labels, not fuzzy substring matches (e.g. "автоплатеж" is not "авто").
BANK_CATEGORIES = {
    "супермаркеты": 1,
    "продукты": 1,
    "продукты питания": 1,
    "транспорт": 2,
    "транспорт и авто": 2,
    "авто": 2,
    "такси": 2,
    "азс": 2,
    "жкх": 3,
    "связь": 3,
    "жкх и связь": 3,
    "коммунальные платежи": 3,
    "аптеки": 4,
    "здоровье": 4,
    "аптеки и здоровье": 4,
    "медицина": 4,
    "кафе и рестораны": 5,
    "кафе, рестораны и фастфуд": 5,
    "рестораны": 5,
    "фастфуд": 5,
    "кафе": 5,
    "развлечения": 6,
    "подписки": 6,
    "одежда и обувь": 7,
    "одежда": 7,
    "маркетплейсы": 7,
    "красота": 8,
    "косметика": 8,
    "красота и уход": 8,
    "сбережения": 9,
    "инвестиции": 9,
    "перевод между своими счетами": 9,
    "зарплата": 10,
    "доходы": 10,
}


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
        bank_category_raw: str | None = None,
    ) -> CategorizationResult:
        if mcc_code is not None and re.fullmatch(r"[0-9]{4}", mcc_code) is None:
            raise ValueError("MCC must contain exactly four ASCII digits")
        normalized_merchant = merchant_name.strip().lower()
        if normalized_merchant and (
            category := await self._categorization_repository.get_user_category(
                user_id, normalized_merchant
            )
        ):
            return CategorizationResult(category.id, category.name, Decimal("1.00"), False)
        rules = await self._categorization_repository.list_rules()
        if result := self._match(
            rules=rules,
            merchant_name=normalized_merchant,
            raw_description=raw_description,
            mcc_code=mcc_code,
            operation_type=operation_type,
            bank_category_raw=bank_category_raw,
        ):
            return result
        if (category := await self._categorization_repository.get_category(11)) is None:
            raise RuntimeError("Fallback category is missing; apply the initial migration")
        return CategorizationResult(category.id, category.name, Decimal("0.00"), True)

    async def categorize_many(
        self,
        *,
        user_id: UUID,
        transactions: list[StandardTransactionDTO],
    ) -> list[CategorizationResult]:
        # Constant number of DB reads per import; no per-row queries for 1000 operations.
        user_rules = await self._categorization_repository.list_user_rules(user_id)
        rules = await self._categorization_repository.list_rules()
        if (fallback := await self._categorization_repository.get_category(11)) is None:
            raise RuntimeError("Fallback category is missing; apply the initial migration")
        results = []
        for transaction in transactions:
            if category := user_rules.get(transaction.merchant_name_clean):
                result = CategorizationResult(category.id, category.name, Decimal("1.00"), False)
            else:
                result = self._match(
                    rules=rules,
                    merchant_name=transaction.merchant_name_clean,
                    raw_description=transaction.raw_description,
                    mcc_code=f"{transaction.mcc_code:04}"
                    if transaction.mcc_code is not None
                    else None,
                    operation_type=transaction.operation_type,
                    bank_category_raw=transaction.bank_category_raw,
                ) or CategorizationResult(fallback.id, fallback.name, Decimal("0.00"), True)
            results.append(result)
        return results

    def _match(
        self,
        *,
        rules: list[tuple[CategoryRule, Category]],
        merchant_name: str,
        raw_description: str,
        mcc_code: str | None,
        operation_type: OperationType,
        bank_category_raw: str | None,
    ) -> CategorizationResult | None:
        if operation_type is OperationType.DEBIT and mcc_code is not None:
            for rule, category in rules:
                if rule.rule_type is RuleType.MCC and rule.pattern == mcc_code:
                    return CategorizationResult(category.id, category.name, Decimal("0.95"), False)
        description = f"{merchant_name} {raw_description}".lower()
        for rule, category in rules:
            eligible_groups = (
                {BudgetGroup.INCOME, BudgetGroup.SAVINGS}
                if operation_type is OperationType.CREDIT
                else {BudgetGroup.NEEDS, BudgetGroup.WANTS, BudgetGroup.SAVINGS, BudgetGroup.OTHER}
            )
            if category.budget_group not in eligible_groups:
                continue
            if rule.rule_type is RuleType.KEYWORD and re.search(rule.pattern, description):
                return CategorizationResult(category.id, category.name, Decimal("0.80"), False)
        bank_category_id = BANK_CATEGORIES.get((bank_category_raw or "").strip().lower())
        if bank_category_id is not None:
            for _, category in rules:
                if category.id == bank_category_id:
                    if operation_type is OperationType.CREDIT and category.budget_group not in {
                        BudgetGroup.INCOME,
                        BudgetGroup.SAVINGS,
                    }:
                        break
                    if (
                        operation_type is OperationType.DEBIT
                        and category.budget_group is BudgetGroup.INCOME
                    ):
                        break
                    return CategorizationResult(category.id, category.name, Decimal("0.75"), False)
        return None

    async def list_categories(self) -> list[Category]:
        return await self._categorization_repository.list_categories()
