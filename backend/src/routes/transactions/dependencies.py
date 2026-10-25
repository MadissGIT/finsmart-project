from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.settings import get_project_settings
from src.db.database import get_async_session
from src.modules.categorization.service import CategorizationService
from src.modules.statements.parser import StatementParser
from src.modules.statements.repositories import TransactionRepository
from src.modules.statements.service import StatementService
from src.routes.categories.dependencies import get_categorization_service


def get_statement_service(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    categorization_service: Annotated[CategorizationService, Depends(get_categorization_service)],
) -> StatementService:
    return StatementService(
        statement_parser=StatementParser(ZoneInfo(get_project_settings().financial_timezone)),
        categorization_service=categorization_service,
        transaction_repository=TransactionRepository(session),
    )
