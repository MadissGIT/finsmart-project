from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import BaseModel

from src.common_types import JsonDecimal
from src.db.models import BankSource, Transaction
from src.modules.categorization.service import CategorizationService
from src.modules.statements.parser import StatementParser, clean_merchant
from src.modules.statements.repositories import TransactionRepository
from src.modules.statements.schemas import (
    StandardTransactionDTO,
    TransactionCreate,
    TransactionUpdate,
)


class ImportedTransaction(StandardTransactionDTO):
    id: UUID
    date: datetime
    category_id: int
    category_name: str
    merchant_name: str
    confidence: JsonDecimal
    requires_review: bool


class ImportResponse(BaseModel):
    total_rows: int
    skipped_rows: int
    total_parsed: int
    imported_count: int
    duplicates_skipped: int
    successfully_categorized: int
    recognition_rate: float
    # Compatibility with the initial frontend contract: recognition, not measured accuracy.
    accuracy_rate: float
    imported_transactions: list[ImportedTransaction]


class TransactionNotFoundError(ValueError):
    pass


class InvalidCategoryError(ValueError):
    pass


class InvalidTransactionError(ValueError):
    pass


class StatementService:
    def __init__(
        self,
        statement_parser: StatementParser,
        categorization_service: CategorizationService,
        transaction_repository: TransactionRepository,
        financial_timezone: ZoneInfo,
    ) -> None:
        self._statement_parser = statement_parser
        self._categorization_service = categorization_service
        self._transaction_repository = transaction_repository
        self._financial_timezone = financial_timezone

    async def import_statement(
        self,
        *,
        content: bytes,
        filename: str,
        user_id: UUID,
        bank_hint: BankSource | None,
    ) -> ImportResponse:
        # Parsing is CPU work; perform it off the event loop.
        from starlette.concurrency import run_in_threadpool

        parsed = await run_in_threadpool(
            self._statement_parser.parse,
            content=content,
            filename=filename,
            user_id=user_id,
            bank_hint=bank_hint,
        )
        categories = await self._categorization_service.categorize_many(
            user_id=user_id,
            transactions=parsed.transactions,
        )
        records = []
        responses = {}
        recognized = 0
        for item, category in zip(parsed.transactions, categories, strict=True):
            records.append(
                Transaction(
                    user_id=user_id,
                    category_id=category.category_id,
                    amount=item.amount,
                    operation_type=item.operation_type,
                    transaction_date=item.transaction_date,
                    merchant_name=item.merchant_name_clean,
                    raw_description=item.raw_description,
                    bank_source=item.bank_source,
                    currency=item.currency,
                    bank_category_raw=item.bank_category_raw,
                    mcc_code=f"{item.mcc_code:04}" if item.mcc_code is not None else None,
                    import_hash=item.external_id,
                    confidence=category.confidence,
                    requires_review=category.requires_review,
                )
            )
            responses[item.external_id] = (item, category)
            recognized += not category.requires_review
        imported = await self._transaction_repository.import_transactions(records)
        imported_responses = []
        for record in imported:
            if record.import_hash is None:
                raise RuntimeError("Imported transaction is missing its identity")
            item, category = responses[record.import_hash]
            imported_responses.append(
                ImportedTransaction(
                    **item.model_dump(),
                    id=record.id,
                    date=item.transaction_date,
                    category_id=category.category_id,
                    category_name=category.category_name,
                    merchant_name=item.merchant_name_clean,
                    confidence=category.confidence,
                    requires_review=category.requires_review,
                )
            )
        rate = recognized / len(parsed.transactions) if parsed.transactions else 0.0
        return ImportResponse(
            total_rows=parsed.total_rows,
            skipped_rows=parsed.skipped_rows,
            total_parsed=len(parsed.transactions),
            imported_count=len(imported),
            duplicates_skipped=len(parsed.transactions) - len(imported),
            successfully_categorized=recognized,
            recognition_rate=rate,
            accuracy_rate=rate,
            imported_transactions=imported_responses,
        )

    async def correct_category(
        self,
        *,
        user_id: UUID,
        transaction_id: UUID,
        category_id: int,
        save_rule: bool,
    ) -> None:
        transaction = await self._get_transaction(user_id=user_id, transaction_id=transaction_id)
        if (category := await self._transaction_repository.get_category(category_id)) is None:
            raise InvalidCategoryError("Категория не найдена")
        await self._transaction_repository.correct_category(
            transaction=transaction,
            category=category,
            save_rule=save_rule,
        )

    async def create_transaction(
        self, user_id: UUID, payload: TransactionCreate
    ) -> tuple[Transaction, str]:
        if (
            category := await self._transaction_repository.get_category(payload.category_id)
        ) is None:
            raise InvalidCategoryError("Категория не найдена")
        merchant = clean_merchant(payload.merchant_name)
        if not merchant:
            raise InvalidTransactionError("Укажите название контрагента")
        transaction = Transaction(
            **payload.model_dump(exclude={"merchant_name", "transaction_date"}),
            user_id=user_id,
            merchant_name=merchant,
            transaction_date=payload.transaction_date.astimezone(UTC),
            bank_source=BankSource.MANUAL,
            raw_description=payload.merchant_name,
            confidence=Decimal("1.00"),
            requires_review=False,
        )
        await self._transaction_repository.save_transaction(transaction)
        return transaction, category.name

    async def _get_transaction(self, user_id: UUID, transaction_id: UUID) -> Transaction:
        transaction = await self._transaction_repository.get_transaction(
            user_id=user_id, transaction_id=transaction_id
        )
        if transaction is None:
            raise TransactionNotFoundError("Операция не найдена")
        return transaction

    async def get_transaction(self, user_id: UUID, transaction_id: UUID) -> tuple[Transaction, str]:
        transaction = await self._get_transaction(user_id=user_id, transaction_id=transaction_id)
        if (
            category := await self._transaction_repository.get_category(transaction.category_id)
        ) is None:
            raise InvalidCategoryError("Категория не найдена")
        return transaction, category.name

    async def update_transaction(
        self, user_id: UUID, transaction_id: UUID, payload: TransactionUpdate
    ) -> tuple[Transaction, str]:
        transaction = await self._get_transaction(user_id=user_id, transaction_id=transaction_id)
        category_id = (
            payload.category_id if payload.category_id is not None else transaction.category_id
        )
        if (category := await self._transaction_repository.get_category(category_id)) is None:
            raise InvalidCategoryError("Категория не найдена")
        changes = payload.model_dump(exclude_unset=True)
        if payload.merchant_name is not None:
            merchant = clean_merchant(payload.merchant_name)
            if not merchant:
                raise InvalidTransactionError("Укажите название контрагента")
            changes["merchant_name"] = merchant
        if payload.transaction_date is not None:
            changes["transaction_date"] = payload.transaction_date.astimezone(UTC)
        for field, value in changes.items():
            setattr(transaction, field, value)
        if "category_id" in changes:
            transaction.confidence = Decimal("1.00")
            transaction.requires_review = False
        await self._transaction_repository.save_transaction(transaction)
        return transaction, category.name

    async def delete_transaction(self, user_id: UUID, transaction_id: UUID) -> None:
        transaction = await self._get_transaction(user_id=user_id, transaction_id=transaction_id)
        await self._transaction_repository.delete_transaction(transaction)

    async def list_transactions(
        self, user_id: UUID, limit: int, offset: int, from_date: date | None, to_date: date | None
    ) -> list[tuple[Transaction, str]]:
        if (
            from_date == date.min
            or to_date == date.max
            or (from_date is not None and to_date is not None and to_date < from_date)
        ):
            raise InvalidTransactionError("Некорректные границы периода")
        start = (
            datetime.combine(from_date, datetime.min.time(), self._financial_timezone).astimezone(
                UTC
            )
            if from_date is not None
            else None
        )
        end = (
            datetime.combine(
                to_date + timedelta(days=1), datetime.min.time(), self._financial_timezone
            ).astimezone(UTC)
            if to_date is not None
            else None
        )
        rows = await self._transaction_repository.list_transactions(
            user_id=user_id, limit=limit, offset=offset, start=start, end=end
        )
        return [(transaction, category.name) for transaction, category in rows]
