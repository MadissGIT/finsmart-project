import secrets
from functools import lru_cache
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, PostgresDsn, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL, make_url


class ProjectSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FINSMART_")

    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    financial_timezone: str = "Europe/Moscow"

    @field_validator("financial_timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as err:
            raise ValueError("Нужна существующая часовая зона IANA") from err
        return value


class AuthSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FINSMART_", hide_input_in_errors=True)

    jwt_secret: SecretStr = Field(
        default_factory=lambda: SecretStr(secrets.token_urlsafe(48)), min_length=32
    )
    access_token_minutes: int = Field(default=60, ge=1, le=1440)
    refresh_token_days: int = Field(default=30, ge=1, le=90)


class PostgresSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FINSMART_")

    database_url: PostgresDsn

    @property
    def async_database_url(self) -> URL:
        return make_url(str(self.database_url)).set(drivername="postgresql+asyncpg")


@lru_cache(maxsize=1)
def get_project_settings() -> ProjectSettings:
    return ProjectSettings()


@lru_cache(maxsize=1)
def get_postgres_settings() -> PostgresSettings:
    return PostgresSettings()


@lru_cache(maxsize=1)
def get_auth_settings() -> AuthSettings:
    return AuthSettings()
