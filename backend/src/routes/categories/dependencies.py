from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_async_session
from src.modules.categorization.repositories import CategorizationRepository
from src.modules.categorization.service import CategorizationService


def get_categorization_service(
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> CategorizationService:
    return CategorizationService(CategorizationRepository(session))
