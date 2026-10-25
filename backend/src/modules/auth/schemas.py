from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: SecretStr = Field(min_length=10, max_length=128)


class RegisterRequest(LoginRequest):
    full_name: str = Field(min_length=1, max_length=200, pattern=r"\S")


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


class InvalidCredentialsError(ValueError):
    pass


class UserAlreadyExistsError(ValueError):
    pass
