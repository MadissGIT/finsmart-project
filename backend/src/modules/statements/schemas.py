from typing import Literal, Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

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


class TransactionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    amount: JsonDecimal = Field(gt=0, max_digits=14, decimal_places=2)
    operation_type: OperationType
    category_id: int = Field(ge=1)
    transaction_date: AwareDatetime
    merchant_name: str = Field(min_length=1, max_length=255)
    comment: str | None = Field(default=None, max_length=2000)
    mcc_code: str | None = Field(default=None, pattern=r"^[0-9]{4}$")


class TransactionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    amount: JsonDecimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    operation_type: OperationType | None = None
    category_id: int | None = Field(default=None, ge=1)
    transaction_date: AwareDatetime | None = None
    merchant_name: str | None = Field(default=None, min_length=1, max_length=255)
    comment: str | None = Field(default=None, max_length=2000)
    mcc_code: str | None = Field(default=None, pattern=r"^[0-9]{4}$")

    @model_validator(mode="after")
    def validate_changes(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Укажите хотя бы одно поле для изменения")
        if any(
            getattr(self, field) is None
            for field in self.model_fields_set - {"comment", "mcc_code"}
        ):
            raise ValueError("Только comment и mcc_code могут быть null")
        return self
