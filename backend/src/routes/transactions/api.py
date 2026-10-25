from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile, status

from src.db.models import BankSource, User
from src.modules.statements.parser import MAX_FILE_BYTES
from src.modules.statements.schemas import StatementError
from src.modules.statements.service import (
    ImportResponse,
    InvalidCategoryError,
    StatementService,
    TransactionNotFoundError,
)
from src.routes.auth.dependencies import get_current_user
from src.routes.transactions.dependencies import get_statement_service
from src.routes.transactions.schemas import (
    CategoryUpdate,
    CategoryUpdateResponse,
    TransactionResponse,
)

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.post("/import-statement", response_model=ImportResponse)
async def import_statement(
    file: UploadFile,
    user: Annotated[User, Depends(get_current_user)],
    statement_service: Annotated[StatementService, Depends(get_statement_service)],
    bank_hint: Annotated[Literal["auto", "tinkoff", "tbank", "sber", "vtb"], Form()] = "auto",
) -> ImportResponse:
    content = await file.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Максимальный размер файла — 5 МБ")
    banks = {
        "tinkoff": BankSource.TBANK,
        "tbank": BankSource.TBANK,
        "sber": BankSource.SBER,
        "vtb": BankSource.VTB,
    }
    try:
        return await statement_service.import_statement(
            content=content,
            filename=file.filename or "",
            user_id=user.id,
            bank_hint=banks.get(bank_hint),
        )
    except StatementError as err:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(err)) from err


@router.get("", response_model=list[TransactionResponse])
async def list_transactions(
    user: Annotated[User, Depends(get_current_user)],
    statement_service: Annotated[StatementService, Depends(get_statement_service)],
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[TransactionResponse]:
    rows = await statement_service.list_transactions(user_id=user.id, limit=limit, offset=offset)
    return [
        TransactionResponse(
            id=row.id,
            amount=row.amount,
            operation_type=row.operation_type,
            category_id=row.category_id,
            category_name=category,
            transaction_date=row.transaction_date,
            merchant_name=row.merchant_name,
            requires_review=row.requires_review,
            confidence=row.confidence,
        )
        for row, category in rows
    ]


@router.patch("/{transaction_id}/category", response_model=CategoryUpdateResponse)
async def update_category(
    transaction_id: UUID,
    payload: CategoryUpdate,
    user: Annotated[User, Depends(get_current_user)],
    statement_service: Annotated[StatementService, Depends(get_statement_service)],
) -> CategoryUpdateResponse:
    try:
        await statement_service.correct_category(
            user_id=user.id,
            transaction_id=transaction_id,
            category_id=payload.category_id,
            save_rule=payload.save_as_global_rule,
        )
    except TransactionNotFoundError as err:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(err)) from err
    except InvalidCategoryError as err:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(err)) from err
    return CategoryUpdateResponse()
