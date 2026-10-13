from typing import Annotated

from fastapi import APIRouter, Depends

from src.routes.categories.dependencies import get_category_repository
from src.routes.categories.repositories import CategoryRepository
from src.routes.categories.schemas import CategoryResponse

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=list[CategoryResponse])
async def list_categories(
    category_repository: Annotated[
        CategoryRepository, Depends(get_category_repository)
    ],
) -> list[CategoryResponse]:
    return [
        CategoryResponse.model_validate(row)
        for row in await category_repository.list_categories()
    ]
