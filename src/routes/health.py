import logging
from pathlib import Path
from typing import Literal

from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from src.db.database import get_async_engine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health", tags=["Health"])


@router.get("/live")
async def liveness() -> dict[str, Literal["ok"]]:
    return {"status": "ok"}


@router.get("/ready")
async def readiness() -> dict[str, Literal["ok"]]:
    # Configuration errors must produce an explicit unavailable response, too.
    try:
        engine = get_async_engine()
        async with engine.connect() as connection:
            revision = await connection.scalar(
                text("SELECT version_num FROM alembic_version")
            )
        config = Config()
        config.set_main_option(
            "script_location", str(Path(__file__).parents[1] / "migrations")
        )
        if revision != ScriptDirectory.from_config(config).get_current_head():
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE, "Database migrations pending"
            )
    except (SQLAlchemyError, OSError, ValidationError) as err:
        logger.warning("Database readiness check failed (%s)", type(err).__name__)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Database unavailable"
        ) from err
    return {"status": "ok"}
