from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_async_session
from src.db.models import BankSource, OperationType, Transaction, User
from src.modules.goals.repositories import GoalRepository
from src.modules.goals.schemas import DepositRequest, DepositSource
from src.modules.statements.parser import MAX_FILE_BYTES
from src.modules.statements.repositories import TransactionRepository
from src.modules.statements.schemas import StatementError, TransactionCreate, TransactionUpdate
from src.modules.statements.service import (
    ImportResponse,
    InvalidCategoryError,
    InvalidTransactionError,
    StatementService,
    TransactionNotFoundError,
)
from src.routes.auth.dependencies import get_current_user
from src.routes.goals.api import Goals, Today
from src.routes.transactions.dependencies import get_statement_service
from src.routes.transactions.schemas import (
    CategoryUpdate,
    CategoryUpdateResponse,
    DiscountSavingsRequest,
    DiscountSavingsResponse,
    TransactionResponse,
)

router = APIRouter(prefix="/transactions", tags=["Transactions"])
DatabaseSession = Annotated[AsyncSession, Depends(get_async_session)]


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
    from_date: date | None = None,
    to_date: date | None = None,
    category_id: Annotated[int | None, Query(ge=1, le=2147483647)] = None,
    operation_type: OperationType | None = None,
    q: Annotated[str | None, Query(min_length=1, max_length=255)] = None,
) -> list[TransactionResponse]:
    try:
        rows = await statement_service.list_transactions(
            user_id=user.id,
            limit=limit,
            offset=offset,
            from_date=from_date,
            to_date=to_date,
            category_id=category_id,
            operation_type=operation_type,
            search=q.strip() if q else None,
        )
    except InvalidTransactionError as err:
        raise HTTPException(422, str(err)) from err
    return [
        TransactionResponse.from_transaction(transaction=row, category_name=category)
        for row, category in rows
    ]


@router.post("", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    payload: TransactionCreate,
    user: Annotated[User, Depends(get_current_user)],
    statement_service: Annotated[StatementService, Depends(get_statement_service)],
) -> TransactionResponse:
    try:
        transaction, category_name = await statement_service.create_transaction(
            user_id=user.id, payload=payload
        )
    except (InvalidCategoryError, InvalidTransactionError) as err:
        raise HTTPException(422, str(err)) from err
    return TransactionResponse.from_transaction(
        transaction=transaction, category_name=category_name
    )


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    statement_service: Annotated[StatementService, Depends(get_statement_service)],
    session: DatabaseSession,
) -> TransactionResponse:
    try:
        transaction, category_name = await statement_service.get_transaction(
            user_id=user.id, transaction_id=transaction_id
        )
    except TransactionNotFoundError as err:
        raise HTTPException(404, str(err)) from err
    savings = await TransactionRepository(session).get_discount_contribution(transaction.id)
    return TransactionResponse.from_transaction(transaction, category_name, savings)


@router.patch("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: UUID,
    payload: TransactionUpdate,
    user: Annotated[User, Depends(get_current_user)],
    statement_service: Annotated[StatementService, Depends(get_statement_service)],
) -> TransactionResponse:
    try:
        transaction, category_name = await statement_service.update_transaction(
            user_id=user.id, transaction_id=transaction_id, payload=payload
        )
    except TransactionNotFoundError as err:
        raise HTTPException(404, str(err)) from err
    except (InvalidCategoryError, InvalidTransactionError) as err:
        raise HTTPException(422, str(err)) from err
    return TransactionResponse.from_transaction(
        transaction=transaction, category_name=category_name
    )


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    statement_service: Annotated[StatementService, Depends(get_statement_service)],
) -> Response:
    try:
        await statement_service.delete_transaction(user_id=user.id, transaction_id=transaction_id)
    except TransactionNotFoundError as err:
        raise HTTPException(404, str(err)) from err
    return Response(status_code=204)


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


async def owned_expense(
    repo: TransactionRepository, user_id: UUID, transaction_id: UUID
) -> Transaction:
    transaction = await repo.get_transaction(
        user_id=user_id, transaction_id=transaction_id, lock=True
    )
    if transaction is None:
        raise HTTPException(404, "Операция не найдена")
    if (
        transaction.bank_source != BankSource.MANUAL
        or transaction.operation_type != OperationType.DEBIT
    ):
        raise HTTPException(422, "Экономию можно записать для расхода, добавленного вручную")
    return transaction


@router.put("/{transaction_id}/discount-savings")
async def record_discount_savings(
    transaction_id: UUID,
    payload: DiscountSavingsRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: DatabaseSession,
    goals: Goals,
    today: Today,
) -> DiscountSavingsResponse:
    repo = TransactionRepository(session)
    transaction = await owned_expense(repo, user.id, transaction_id)
    amount = payload.original_amount - transaction.amount
    if amount <= 0:
        raise HTTPException(422, "Цена до скидки должна быть больше уплаченной суммы")
    existing = await repo.get_discount_contribution(transaction.id)
    if existing:
        if existing.goal_id != payload.goal_id or existing.amount != amount:
            raise HTTPException(409, "Взнос по этому расходу уже существует")
    else:
        await goals.deposit(
            user.id,
            payload.goal_id,
            DepositRequest(amount=amount, source=DepositSource.DISCOUNT),
            today,
            transaction_id=transaction.id,
        )
    return DiscountSavingsResponse(goal_id=payload.goal_id, amount=amount)


@router.delete("/{transaction_id}/discount-savings", status_code=204)
async def remove_discount_savings(
    transaction_id: UUID, user: Annotated[User, Depends(get_current_user)], session: DatabaseSession
) -> Response:
    repo = TransactionRepository(session)
    await owned_expense(repo, user.id, transaction_id)
    existing = await repo.get_discount_contribution(transaction_id)
    # Match the lock taken by new deposits before changing the goal total.
    if existing and await GoalRepository(session).get_goal(user.id, existing.goal_id, lock=True):
        await session.delete(existing)
        await session.commit()
    return Response(status_code=204)
