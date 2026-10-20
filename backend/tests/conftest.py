import asyncio
import os
from collections.abc import Iterator
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine


@pytest.fixture
def postgres() -> Iterator[tuple[asyncio.Runner, AsyncConnection]]:
    if not (database_url := os.getenv("FINSMART_TEST_DATABASE_URL")):
        pytest.skip("Set FINSMART_TEST_DATABASE_URL to run PostgreSQL integration tests")
    engine = create_async_engine(database_url)
    with asyncio.Runner() as runner:
        connection = runner.run(engine.connect().start())
        transaction = runner.run(connection.begin().start())
        try:
            schema = f"test_{uuid4().hex}"
            runner.run(connection.execute(text(f'CREATE SCHEMA "{schema}"')))
            runner.run(connection.execute(text(f'SET LOCAL search_path TO "{schema}"')))
            config = Config("alembic.ini")
            runner.run(connection.run_sync(lambda sync: migrate(sync, config)))
            yield runner, connection
        finally:
            runner.run(transaction.rollback())
            runner.run(connection.close())
            runner.run(engine.dispose())


def migrate(connection, config: Config) -> None:
    config.attributes["connection"] = connection
    command.upgrade(config, "head")
