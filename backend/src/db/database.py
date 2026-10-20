from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine

from src.core.settings import get_postgres_settings


@lru_cache(maxsize=1)
def get_async_engine() -> AsyncEngine:
    return create_async_engine(
        get_postgres_settings().async_database_url,
        pool_pre_ping=True,
        connect_args={"timeout": 5, "command_timeout": 5},
    )


async def get_async_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSession(get_async_engine(), expire_on_commit=False) as session:
        yield session
