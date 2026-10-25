from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from src.common_types import JsonDecimal
from src.db.models import OperationType


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


class CategoryUpdate(BaseModel):
    category_id: int = Field(ge=1)
    save_as_global_rule: bool


class CategoryUpdateResponse(BaseModel):
    status: str = "success"
    message: str = "Категория обновлена"
