from typing import Annotated

from fastapi import APIRouter, Depends

from src.modules.categorization.service import CategorizationService
from src.routes.categories.dependencies import get_categorization_service
from src.routes.categories.schemas import CategoryResponse

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=list[CategoryResponse])
async def list_categories(
    categorization_service: Annotated[CategorizationService, Depends(get_categorization_service)],
) -> list[CategoryResponse]:
    return [
        CategoryResponse.model_validate(row)
        for row in await categorization_service.list_categories()
    ]
