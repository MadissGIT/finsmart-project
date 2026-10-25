from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field

from src.common_types import JsonDecimal
from src.db.models import BankSource, OperationType


class StandardTransactionDTO(BaseModel):
    external_id: str = Field(pattern=r"^[0-9a-f]{64}$")
    bank_source: BankSource
    transaction_date: AwareDatetime
    amount: JsonDecimal = Field(gt=0, max_digits=14, decimal_places=2)
    operation_type: OperationType
    currency: Literal["RUB"] = "RUB"
    raw_description: str = Field(min_length=1, max_length=6000)
    merchant_name_clean: str = Field(min_length=1, max_length=255)
    mcc_code: int | None = Field(default=None, ge=0, le=9999)
    bank_category_raw: str | None = Field(default=None, max_length=255)


class ParsedStatement(BaseModel):
    bank_source: BankSource
    total_rows: int
    skipped_rows: int
    transactions: list[StandardTransactionDTO]


class StatementError(ValueError):
    pass
