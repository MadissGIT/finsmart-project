from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from asyncpg.exceptions import InvalidCatalogNameError
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from src.app import app
from src.core.settings import get_postgres_settings
from src.db.models import BudgetGroup, Category
from src.modules.categorization.service import CategorizationService
from src.routes.categories.dependencies import get_categorization_service


def test_liveness_and_openapi_without_database() -> None:
    with TestClient(app) as client:
        assert client.get("/api/v1/health/live").json() == {"status": "ok"}
        schema = client.get("/openapi.json").json()
    assert "/api/v1/categories" in schema["paths"]
    assert schema["components"]["schemas"]["BudgetGroup"]["enum"] == [
        "NEEDS",
        "WANTS",
        "SAVINGS",
        "INCOME",
        "OTHER",
    ]


def test_categories_serialize_enum() -> None:
    service = AsyncMock(spec=CategorizationService)
    service.list_categories.return_value = [
        Category(id=1, name="Супермаркеты", budget_group=BudgetGroup.NEEDS),
    ]
    app.dependency_overrides[get_categorization_service] = lambda: service
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/categories")
        assert response.status_code == 200
        assert response.json() == [{"id": 1, "name": "Супермаркеты", "budget_group": "NEEDS"}]
        service.list_categories.assert_awaited_once_with()
    finally:
        app.dependency_overrides.clear()


def test_readiness_without_database_configuration(monkeypatch) -> None:
    monkeypatch.delenv("FINSMART_DATABASE_URL", raising=False)
    get_postgres_settings.cache_clear()
    with TestClient(app) as client:
        response = client.get("/api/v1/health/ready")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}


@pytest.mark.parametrize(
    "error",
    [
        OperationalError("connect", {}, Exception("unavailable")),
        InvalidCatalogNameError("Database does not exist"),
        ConnectionRefusedError("Connection refused"),
        TimeoutError("Connection timeout"),
    ],
)
def test_readiness_on_database_failure(error: Exception) -> None:
    with (
        patch(
            "src.routes.health.get_async_engine",
            side_effect=error,
        ),
        TestClient(app) as client,
    ):
        response = client.get("/api/v1/health/ready")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}


def test_cors_rejects_untrusted_origin() -> None:
    with TestClient(app) as client:
        response = client.options(
            "/api/v1/categories",
            headers={
                "Origin": "https://untrusted.example",
                "Access-Control-Request-Method": "GET",
            },
        )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize(
    ("revision", "expected_status"),
    [("0001_foundation", 200), ("outdated_revision", 503), (None, 503)],
)
def test_readiness_requires_current_migration(
    revision: str | None,
    expected_status: int,
) -> None:
    connection = AsyncMock()
    connection.scalar.return_value = revision
    engine = MagicMock()
    engine.connect.return_value.__aenter__.return_value = connection
    with (
        patch("src.routes.health.get_async_engine", return_value=engine),
        TestClient(app) as client,
    ):
        response = client.get("/api/v1/health/ready")
    assert response.status_code == expected_status


@pytest.mark.parametrize("method", ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
def test_local_frontend_preflight_allows_api_methods(method: str) -> None:
    with TestClient(app) as client:
        response = client.options(
            "/api/v1/categories",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": method,
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert method in response.headers["access-control-allow-methods"].split(", ")
