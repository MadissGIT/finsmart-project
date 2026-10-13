from functools import lru_cache

from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL, make_url


class ProjectSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FINSMART_")

    cors_origins: list[str] = Field(default_factory=list)


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
