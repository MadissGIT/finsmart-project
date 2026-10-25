from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Category, Transaction, UserRule


class TransactionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def import_transactions(self, transactions: list[Transaction]) -> list[Transaction]:
        if not transactions:
            return []
        records = [
            {
                "user_id": item.user_id,
                "amount": item.amount,
                "operation_type": item.operation_type,
                "transaction_date": item.transaction_date,
                "merchant_name": item.merchant_name,
                "raw_description": item.raw_description,
                "bank_source": item.bank_source,
                "currency": item.currency,
                "bank_category_raw": item.bank_category_raw,
                "mcc_code": item.mcc_code,
                "import_hash": item.import_hash,
                "category_id": item.category_id,
                "confidence": item.confidence,
                "requires_review": item.requires_review,
            }
            for item in transactions
        ]
        result = await self._session.scalars(
            insert(Transaction)
            .values(records)
            .on_conflict_do_nothing(index_elements=[Transaction.user_id, Transaction.import_hash])
            .returning(Transaction),
        )
        imported = list(result.all())
        await self._session.commit()
        return imported

    async def list_transactions(
        self, *, user_id: UUID, limit: int, offset: int
    ) -> list[tuple[Transaction, Category]]:
        result = await self._session.execute(
            select(Transaction, Category)
            .join(Category, Transaction.category_id == Category.id)
            .where(Transaction.user_id == user_id)
            .order_by(Transaction.transaction_date.desc(), Transaction.id)
            .limit(limit)
            .offset(offset),
        )
        return [(transaction, category) for transaction, category in result.tuples()]

    async def get_transaction(self, *, user_id: UUID, transaction_id: UUID) -> Transaction | None:
        result = await self._session.scalars(
            select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.id == transaction_id,
            )
        )
        return result.one_or_none()

    async def get_category(self, category_id: int) -> Category | None:
        return await self._session.get(Category, category_id)

    async def correct_category(
        self,
        *,
        transaction: Transaction,
        category: Category,
        save_rule: bool,
    ) -> None:
        if save_rule:
            # Upsert the rule first to serialize concurrent corrections of the same merchant.
            await self._session.execute(
                insert(UserRule)
                .values(
                    user_id=transaction.user_id,
                    merchant_name=transaction.merchant_name,
                    category_id=category.id,
                )
                .on_conflict_do_update(
                    index_elements=[UserRule.user_id, UserRule.merchant_name],
                    set_={"category_id": category.id},
                )
            )
            await self._session.execute(
                update(Transaction)
                .where(
                    Transaction.user_id == transaction.user_id,
                    Transaction.merchant_name == transaction.merchant_name,
                )
                .values(category_id=category.id, confidence=1, requires_review=False)
            )
        transaction.category_id = category.id
        transaction.confidence = Decimal("1.00")
        transaction.requires_review = False
        await self._session.commit()
