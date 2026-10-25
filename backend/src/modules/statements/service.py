from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from src.common_types import JsonDecimal
from src.db.models import BankSource, Transaction
from src.modules.categorization.service import CategorizationService
from src.modules.statements.parser import StatementParser
from src.modules.statements.repositories import TransactionRepository
from src.modules.statements.schemas import StandardTransactionDTO


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


class StatementService:
    def __init__(
        self,
        statement_parser: StatementParser,
        categorization_service: CategorizationService,
        transaction_repository: TransactionRepository,
    ) -> None:
        self._statement_parser = statement_parser
        self._categorization_service = categorization_service
        self._transaction_repository = transaction_repository

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
        transaction = await self._transaction_repository.get_transaction(
            user_id=user_id, transaction_id=transaction_id
        )
        if transaction is None:
            raise TransactionNotFoundError("Операция не найдена")
        if (category := await self._transaction_repository.get_category(category_id)) is None:
            raise InvalidCategoryError("Категория не найдена")
        await self._transaction_repository.correct_category(
            transaction=transaction,
            category=category,
            save_rule=save_rule,
        )

    async def list_transactions(
        self, *, user_id: UUID, limit: int, offset: int
    ) -> list[tuple[Transaction, str]]:
        rows = await self._transaction_repository.list_transactions(
            user_id=user_id, limit=limit, offset=offset
        )
        return [(transaction, category.name) for transaction, category in rows]
