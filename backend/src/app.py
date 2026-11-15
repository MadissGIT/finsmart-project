from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.core.settings import get_auth_settings, get_project_settings
from src.db.database import get_async_engine
from src.routes.analytics.api import router as analytics_router
from src.routes.auth.api import router as auth_router
from src.routes.categories.api import router as categories_router
from src.routes.health import router as health_router
from src.routes.transactions.api import router as transactions_router


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
    get_auth_settings()
    yield
    if get_async_engine.cache_info().currsize:
        await get_async_engine().dispose()
        get_async_engine.cache_clear()


app = FastAPI(title="ФинСмарт API", version="0.2.0", lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exception: RequestValidationError) -> JSONResponse:
    # Request errors must not echo passwords, tokens, or raw statement fields.
    return JSONResponse(
        status_code=422,
        content={
            "detail": [
                {"loc": error["loc"], "msg": error["msg"], "type": error["type"]}
                for error in exception.errors()
            ],
        },
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_project_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(health_router, prefix="/api/v1")
app.include_router(categories_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(transactions_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
