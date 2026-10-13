from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from src.app import app
from src.core.settings import get_postgres_settings
from src.db.models import BudgetGroup, Category
from src.routes.categories.dependencies import get_category_repository
from src.routes.categories.repositories import CategoryRepository


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
    repository = AsyncMock(spec=CategoryRepository)
    repository.list_categories.return_value = [
        Category(id=1, name="Супермаркеты", budget_group=BudgetGroup.NEEDS),
    ]
    app.dependency_overrides[get_category_repository] = lambda: repository
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/categories")
        assert response.status_code == 200
        assert response.json() == [
            {"id": 1, "name": "Супермаркеты", "budget_group": "NEEDS"}
        ]
    finally:
        app.dependency_overrides.clear()


def test_readiness_without_database_configuration(monkeypatch) -> None:
    monkeypatch.delenv("FINSMART_DATABASE_URL", raising=False)
    get_postgres_settings.cache_clear()
    with TestClient(app) as client:
        response = client.get("/api/v1/health/ready")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}


def test_readiness_on_database_failure() -> None:
    with (
        patch(
            "src.routes.health.get_async_engine",
            side_effect=OperationalError("connect", {}, Exception("unavailable")),
        ),
        TestClient(app) as client,
    ):
        response = client.get("/api/v1/health/ready")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}


def test_cors_is_closed_by_default() -> None:
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
