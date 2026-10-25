from pydantic import BaseModel, ConfigDict

from src.db.models import BudgetGroup


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    budget_group: BudgetGroup
