from datetime import date, datetime
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr, field_validator

from src.core.settings import get_project_settings

ProfileGoal = Literal["expenses", "saving", "budget", "habits"]
IncomeRange = Literal["under-30", "30-60", "60-100", "over-100", "private"]


class LoginRequest(BaseModel):
    email: EmailStr
    password: SecretStr = Field(min_length=10, max_length=128)


class RegisterRequest(LoginRequest):
    full_name: str = Field(min_length=1, max_length=200, pattern=r"\S")

    welcome: bool = False
    birth_date: date | None = None
    goal: ProfileGoal | None = None
    income_range: IncomeRange | None = None

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, value: date | None) -> date | None:
        today = datetime.now(ZoneInfo(get_project_settings().financial_timezone)).date()
        if value is not None and not date(1900, 1, 1) <= value <= today:
            raise ValueError("Укажите дату рождения с 1900 года по сегодняшний день")
        return value


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=4096)


class TokenResponse(BaseModel):
    user_id: UUID
    email: str
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    created_at: datetime
    birth_date: date | None = None
    goal: ProfileGoal | None = None
    income_range: IncomeRange | None = None
    preferences_saved: bool = False
    role: Literal["user", "admin", "moderator"] = "user"


class InvalidCredentialsError(ValueError):
    pass


class UserAlreadyExistsError(ValueError):
    pass


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    full_name: str = Field(min_length=1, max_length=200, pattern=r"\S")
    goal: ProfileGoal | None = None
    income_range: IncomeRange | None = None
