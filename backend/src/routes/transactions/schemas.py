from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from src.common_types import JsonDecimal
from src.db.models import BankSource, OperationType, Transaction


class TransactionResponse(BaseModel):
    id: UUID
    amount: JsonDecimal
    operation_type: OperationType
    category_id: int
    category_name: str
    transaction_date: datetime
    merchant_name: str
    requires_review: bool
    confidence: JsonDecimal
    comment: str | None
    mcc_code: str | None
    bank_source: BankSource

    @classmethod
    def from_transaction(
        cls, transaction: Transaction, category_name: str
    ) -> "TransactionResponse":
        return cls(
            id=transaction.id,
            amount=transaction.amount,
            operation_type=transaction.operation_type,
            category_id=transaction.category_id,
            category_name=category_name,
            transaction_date=transaction.transaction_date,
            merchant_name=transaction.merchant_name,
            requires_review=transaction.requires_review,
            confidence=transaction.confidence,
            comment=transaction.comment,
            mcc_code=transaction.mcc_code,
            bank_source=transaction.bank_source,
        )


class CategoryUpdate(BaseModel):
    category_id: int = Field(ge=1)
    save_as_global_rule: bool


class CategoryUpdateResponse(BaseModel):
    status: str = "success"
    message: str = "Категория обновлена"
