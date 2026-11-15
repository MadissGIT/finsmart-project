import asyncio
import csv
import io
import time
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession

from src.app import app
from src.db.database import get_async_session
from src.db.models import RefreshSession, Transaction, User

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def api_postgres(
    postgres: tuple[asyncio.Runner, AsyncConnection],
) -> Iterator[tuple[asyncio.Runner, httpx.AsyncClient, AsyncConnection]]:
    runner, connection = postgres

    async def session_override():
        async with AsyncSession(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        ) as session:
            yield session

    app.dependency_overrides[get_async_session] = session_override
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
    runner.run(client.__aenter__())
    try:
        yield runner, client, connection
    finally:
        runner.run(client.aclose())
        app.dependency_overrides.clear()


async def register(client: httpx.AsyncClient, email: str) -> dict:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Test-password-123!",
            "full_name": "Test User",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_authentication_and_refresh_rotation(api_postgres) -> None:
    runner, client, connection = api_postgres

    async def scenario() -> None:
        tokens = await register(client, "USER@example.com")
        invalid = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "user@example.com",
                "password": "short",
            },
        )
        assert invalid.status_code == 422
        assert '"short"' not in invalid.text
        assert all("input" not in error for error in invalid.json()["detail"])
        access_headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        profile = await client.get("/api/v1/users/me", headers=access_headers)
        assert profile.status_code == 200
        assert profile.json()["email"] == "user@example.com"
        assert "hashed_password" not in profile.json()
        duplicate = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "user@example.com",
                "password": "Test-password-123!",
                "full_name": "Other",
            },
        )
        assert duplicate.status_code == 409
        login = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "user@example.com",
                "password": "Test-password-123!",
            },
        )
        assert login.status_code == 200
        for email in ["user@example.com", "unknown@example.com"]:
            failure = await client.post(
                "/api/v1/auth/login",
                json={
                    "email": email,
                    "password": "Wrong-password-123!",
                },
            )
            assert failure.status_code == 401
        assert (await client.get("/api/v1/users/me")).status_code == 401
        assert (
            await client.get(
                "/api/v1/users/me",
                headers={
                    "Authorization": f"Bearer {tokens['refresh_token']}",
                },
            )
        ).status_code == 401
        assert (
            await client.post(
                "/api/v1/auth/refresh",
                json={
                    "refresh_token": tokens["access_token"],
                },
            )
        ).status_code == 401
        rotated = await client.post(
            "/api/v1/auth/refresh",
            json={
                "refresh_token": tokens["refresh_token"],
            },
        )
        assert rotated.status_code == 200
        assert rotated.json()["refresh_token"] != tokens["refresh_token"]
        assert (
            await client.post(
                "/api/v1/auth/refresh",
                json={
                    "refresh_token": tokens["refresh_token"],
                },
            )
        ).status_code == 401
        async with AsyncSession(bind=connection) as session:
            user = await session.scalar(select(User))
            assert user.hashed_password.startswith("$argon2id$")
            assert user.hashed_password != "Test-password-123!"
            stored = list((await session.scalars(select(RefreshSession))).all())
            assert all(len(row.token_hash) == 64 for row in stored)
            assert all(row.token_hash != tokens["refresh_token"] for row in stored)

    runner.run(scenario())


def test_import_deduplication_rules_and_budget(api_postgres) -> None:
    runner, client, _ = api_postgres

    async def scenario() -> None:
        tokens = await register(client, "first@example.com")
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        other_tokens = await register(client, "second@example.com")
        other_headers = {"Authorization": f"Bearer {other_tokens['access_token']}"}
        content = (FIXTURES / "tbank.csv").read_bytes()
        result = await client.post(
            "/api/v1/transactions/import-statement",
            headers=headers,
            files={"file": ("a.csv", content)},
            data={"bank_hint": "tinkoff"},
        )
        assert result.status_code == 200, result.text
        data = result.json()
        assert data["imported_count"] == 5
        assert data["skipped_rows"] == 2
        assert data["recognition_rate"] == 1
        assert data["duplicates_skipped"] == 0
        assert data["imported_transactions"][0]["amount"] == 100000
        again = await client.post(
            "/api/v1/transactions/import-statement",
            headers=headers,
            files={"file": ("b.csv", content)},
        )
        assert again.json()["imported_count"] == 0
        assert again.json()["duplicates_skipped"] == 5
        other = await client.post(
            "/api/v1/transactions/import-statement",
            headers=other_headers,
            files={"file": ("b.csv", content)},
        )
        assert other.json()["imported_count"] == 5
        samokat = next(
            row for row in data["imported_transactions"] if row["merchant_name"] == "samokat"
        )
        assert samokat["raw_description"] == "OOO SAMOKAT"
        foreign = await client.patch(
            f"/api/v1/transactions/{samokat['id']}/category",
            headers=other_headers,
            json={"category_id": 5, "save_as_global_rule": True},
        )
        assert foreign.status_code == 404
        corrected = await client.patch(
            f"/api/v1/transactions/{samokat['id']}/category",
            headers=headers,
            json={"category_id": 5, "save_as_global_rule": True},
        )
        assert corrected.status_code == 200
        future = content.decode().splitlines()
        future_content = (future[0] + "\n" + future[2].replace("02.10.2026", "08.10.2026")).encode()
        imported = await client.post(
            "/api/v1/transactions/import-statement",
            headers=headers,
            files={"file": ("future.csv", future_content)},
        )
        assert imported.json()["imported_transactions"][0]["category_id"] == 5
        assert imported.json()["imported_transactions"][0]["confidence"] == 1
        budget = await client.get(
            "/api/v1/analytics/budget?from_date=2026-10-01&to_date=2026-10-31", headers=headers
        )
        assert budget.status_code == 200, budget.text
        dashboard = budget.json()
        assert dashboard["summary"]["total_income"] == 100000
        assert dashboard["summary"]["total_expense"] == 3600
        assert dashboard["budget_50_30_20"]["wants"]["amount"] == 3300
        assert dashboard["budget_50_30_20"]["needs"]["amount"] == 300
        assert dashboard["budget_50_30_20"]["savings"]["amount"] == 96400
        other_budget = await client.get(
            "/api/v1/analytics/budget?from_date=2026-10-01&to_date=2026-10-31",
            headers=other_headers,
        )
        assert other_budget.json()["summary"]["total_expense"] == 2349.5
        assert other_budget.json()["budget_50_30_20"]["wants"]["amount"] == 799
        listing = await client.get("/api/v1/transactions?limit=2", headers=headers)
        assert len(listing.json()) == 2

    runner.run(scenario())


def test_duplicates_inside_one_file(api_postgres) -> None:
    runner, client, _ = api_postgres

    async def scenario() -> None:
        tokens = await register(client, "duplicates@example.com")
        lines = (FIXTURES / "tbank.csv").read_text().splitlines()
        content = "\n".join([lines[0], lines[2], lines[2]]).encode()
        response = await client.post(
            "/api/v1/transactions/import-statement",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
            files={"file": ("duplicates.csv", content)},
        )
        assert response.status_code == 200
        assert response.json()["total_parsed"] == 2
        assert response.json()["imported_count"] == 1
        assert response.json()["duplicates_skipped"] == 1

    runner.run(scenario())


@pytest.mark.parametrize("bank", ["sber", "vtb"])
def test_other_banks_import(api_postgres, bank: str) -> None:
    runner, client, _ = api_postgres

    async def scenario() -> None:
        tokens = await register(client, "user@example.com")
        response = await client.post(
            "/api/v1/transactions/import-statement",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
            files={"file": ("a.csv", (FIXTURES / f"{bank}.csv").read_bytes())},
        )
        assert response.status_code == 200, response.text
        assert response.json()["imported_count"] == (3 if bank == "sber" else 2)
        if bank == "sber":
            bank_match = response.json()["imported_transactions"][1]
            assert bank_match["category_id"] == 5
            assert bank_match["confidence"] == 0.75

    runner.run(scenario())


def test_invalid_import_is_atomic_and_authenticated(api_postgres) -> None:
    runner, client, connection = api_postgres

    async def scenario() -> None:
        content = (FIXTURES / "tbank.csv").read_bytes()
        assert (
            await client.post(
                "/api/v1/transactions/import-statement", files={"file": ("x.csv", content)}
            )
        ).status_code == 401
        tokens = await register(client, "user@example.com")
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        bad = content.replace(b"-300.00", b"invalid")
        response = await client.post(
            "/api/v1/transactions/import-statement", headers=headers, files={"file": ("x.csv", bad)}
        )
        assert response.status_code == 422
        async with AsyncSession(bind=connection) as session:
            assert list((await session.scalars(select(Transaction))).all()) == []
        assert (await client.get("/api/v1/analytics/budget")).status_code == 401
        assert (
            await client.get("/api/v1/analytics/budget?from_date=2026-10-01", headers=headers)
        ).status_code == 422

    runner.run(scenario())


@pytest.mark.parametrize("bank", ["tbank", "sber", "vtb"])
def test_synthetic_100_rows_per_bank_cover_nine_categories(api_postgres, bank: str) -> None:
    runner, client, _ = api_postgres
    examples = [
        ("PYATEROCHKA", 1),
        ("Yandex Go", 2),
        ("МТС", 3),
        ("Аптека Живика", 4),
        ("Simple Coffee", 5),
        ("Steam", 6),
        ("Ozon", 7),
        ("Золотое Яблоко", 8),
        ("Накопительный вклад", 9),
    ]
    raw = list(csv.reader(io.StringIO((FIXTURES / f"{bank}.csv").read_text()), delimiter=";"))
    source = dict(zip(raw[0], raw[1], strict=True))
    rows = []
    expected = {}
    for index in range(100):
        merchant, category = examples[index % len(examples)]
        row = dict(source)
        amount = str(100 + index)
        if bank == "tbank":
            row.update(
                {"Сумма операции": "-" + amount, "Описание": merchant, "MCC": "", "Категория": ""}
            )
        elif bank == "sber":
            row.update(
                {"Сумма в валюте счета": amount, "Описание операции": merchant, "Категория": ""}
            )
        else:
            row.update({"Сумма операции": amount, "Детали операции": merchant})
        rows.append([row[key] for key in raw[0]])
        expected[100 + index] = category
    stream = io.StringIO()
    csv.writer(stream, delimiter=";").writerows([raw[0], *rows])

    async def scenario() -> None:
        token = await register(client, "synthetic@example.com")
        response = await client.post(
            "/api/v1/transactions/import-statement",
            headers={"Authorization": f"Bearer {token['access_token']}"},
            files={"file": ("synthetic.csv", stream.getvalue().encode())},
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["imported_count"] == 100
        assert {row["category_id"] for row in data["imported_transactions"]} == set(range(1, 10))
        assert all(
            row["category_id"] == expected[row["amount"]] for row in data["imported_transactions"]
        )

    runner.run(scenario())


def test_import_1000_rows_performance(api_postgres, record_property) -> None:
    runner, client, _ = api_postgres
    stream = io.StringIO()
    writer = csv.writer(stream, delimiter=";")
    writer.writerow(
        ["Дата операции", "Статус", "Сумма операции", "Валюта операции", "MCC", "Описание"]
    )
    start = datetime(2026, 10, 1, tzinfo=UTC)
    for index in range(1000):
        writer.writerow(
            [
                (start + timedelta(seconds=index)).strftime("%d.%m.%Y %H:%M:%S"),
                "OK",
                "-100.01",
                "RUB",
                "5411",
                "SAMOKAT",
            ]
        )

    async def scenario() -> None:
        token = await register(client, "performance@example.com")
        before = time.perf_counter()
        response = await client.post(
            "/api/v1/transactions/import-statement",
            headers={"Authorization": f"Bearer {token['access_token']}"},
            files={"file": ("1000.csv", stream.getvalue().encode())},
        )
        elapsed = time.perf_counter() - before
        record_property("import_1000_rows_seconds", elapsed)
        assert response.status_code == 200, response.text
        assert response.json()["imported_count"] == 1000
        assert elapsed < 3

    runner.run(scenario())


MANUAL_TRANSACTION = {
    "amount": 1250.50,
    "operation_type": "DEBIT",
    "category_id": 1,
    "transaction_date": "2026-10-02T12:00:00+03:00",
    "merchant_name": "OOO SAMOKAT",
    "comment": "Продукты",
    "mcc_code": "5411",
}


def test_manual_transaction_crud_updates_budget(api_postgres) -> None:
    runner, client, connection = api_postgres

    async def scenario() -> None:
        token = await register(client, "crud@example.com")
        client.headers["Authorization"] = f"Bearer {token['access_token']}"
        response = await client.post("/api/v1/transactions", json=MANUAL_TRANSACTION)
        assert response.status_code == 201, response.text
        created = response.json()
        assert created["merchant_name"] == "samokat"
        assert created["bank_source"] == "MANUAL"
        assert created["comment"] == "Продукты"
        assert created["mcc_code"] == "5411"
        assert created["confidence"] == 1
        assert not created["requires_review"]
        url = f"/api/v1/transactions/{created['id']}"
        assert (await client.get(url)).json() == created
        changed = await client.patch(
            url,
            json={
                "amount": 777.25,
                "operation_type": "CREDIT",
                "category_id": 10,
                "transaction_date": "2026-10-03T13:00:00+03:00",
                "merchant_name": "Зарплата",
                "comment": None,
                "mcc_code": None,
            },
        )
        assert changed.status_code == 200, changed.text
        data = changed.json()
        assert data["amount"] == 777.25
        assert data["operation_type"] == "CREDIT"
        assert data["category_id"] == 10
        assert data["category_name"] == "Зарплата и доходы"
        assert data["merchant_name"] == "зарплата"
        assert data["comment"] is None
        assert data["mcc_code"] is None
        assert data["transaction_date"] == "2026-10-03T10:00:00Z"
        budget_url = "/api/v1/analytics/budget?from_date=2026-10-01&to_date=2026-10-31"
        assert (await client.get(budget_url)).json()["summary"] == {
            "total_income": 777.25,
            "total_expense": 0,
            "net_balance": 777.25,
        }
        async with AsyncSession(bind=connection) as session:
            stored = await session.get(Transaction, created["id"])
            assert stored.import_hash is None
            assert stored.raw_description == "OOO SAMOKAT"
        deleted = await client.delete(url)
        assert deleted.status_code == 204
        assert deleted.content == b""
        assert (await client.get(url)).status_code == 404
        assert (await client.delete(url)).status_code == 404
        assert (await client.get("/api/v1/transactions")).json() == []
        assert (await client.get(budget_url)).json()["summary"]["total_income"] == 0

    runner.run(scenario())


def test_transaction_crud_requires_owner(api_postgres) -> None:
    runner, client, _ = api_postgres

    async def scenario() -> None:
        owner = await register(client, "owner@example.com")
        headers = {"Authorization": f"Bearer {owner['access_token']}"}
        created = await client.post(
            "/api/v1/transactions", headers=headers, json=MANUAL_TRANSACTION
        )
        url = f"/api/v1/transactions/{created.json()['id']}"
        for method, path, payload in [
            ("GET", url, None),
            ("PATCH", url, {"amount": 10}),
            ("DELETE", url, None),
            ("POST", "/api/v1/transactions", MANUAL_TRANSACTION),
        ]:
            response = await client.request(method, path, json=payload)
            assert response.status_code == 401
        other = await register(client, "outsider@example.com")
        client.headers["Authorization"] = f"Bearer {other['access_token']}"
        for method, payload in [("GET", None), ("PATCH", {"amount": 10}), ("DELETE", None)]:
            assert (await client.request(method, url, json=payload)).status_code == 404
        assert (await client.get("/api/v1/transactions")).json() == []
        assert (await client.get(url, headers=headers)).json()["amount"] == 1250.5

    runner.run(scenario())


def test_transaction_date_filters_use_inclusive_local_days(api_postgres) -> None:
    runner, client, _ = api_postgres

    async def scenario() -> None:
        token = await register(client, "dates@example.com")
        client.headers["Authorization"] = f"Bearer {token['access_token']}"
        for index, timestamp in enumerate(
            [
                "2026-10-01T20:59:59Z",
                "2026-10-01T21:00:00Z",
                "2026-10-02T20:59:59Z",
                "2026-10-02T21:00:00Z",
            ]
        ):
            response = await client.post(
                "/api/v1/transactions",
                json={**MANUAL_TRANSACTION, "transaction_date": timestamp, "amount": index + 1},
            )
            assert response.status_code == 201
        url = "/api/v1/transactions"
        day = {"from_date": "2026-10-02", "to_date": "2026-10-02"}
        assert [row["amount"] for row in (await client.get(url, params=day)).json()] == [3, 2]
        page = await client.get(url, params={**day, "limit": 1, "offset": 1})
        assert [row["amount"] for row in page.json()] == [2]
        assert len((await client.get(url, params={"from_date": "2026-10-02"})).json()) == 3
        assert len((await client.get(url, params={"to_date": "2026-10-02"})).json()) == 3
        for params in [
            {"from_date": "2026-10-03", "to_date": "2026-10-02"},
            {"from_date": "0001-01-01"},
            {"to_date": "9999-12-31"},
        ]:
            assert (await client.get(url, params=params)).status_code == 422

    runner.run(scenario())


def test_transaction_validation_rejects_invalid_changes_atomically(api_postgres) -> None:
    runner, client, _ = api_postgres

    async def scenario() -> None:
        token = await register(client, "validation@example.com")
        client.headers["Authorization"] = f"Bearer {token['access_token']}"
        created = (await client.post("/api/v1/transactions", json=MANUAL_TRANSACTION)).json()
        url = f"/api/v1/transactions/{created['id']}"
        invalid_fields = [
            {"amount": 0},
            {"amount": -1},
            {"amount": "1.001"},
            {"amount": "1000000000000"},
            {"transaction_date": "2026-10-02T12:00:00"},
            {"merchant_name": "   "},
            {"merchant_name": "OOO"},
            {"comment": "x" * 2001},
            {"mcc_code": "ABC1"},
            {"category_id": 9999},
            {"user_id": created["id"]},
        ]
        for fields in invalid_fields:
            assert (
                await client.post("/api/v1/transactions", json={**MANUAL_TRANSACTION, **fields})
            ).status_code == 422
            assert (await client.patch(url, json=fields)).status_code == 422
        for fields in [{}, {"amount": None}, {"category_id": None}, {"merchant_name": None}]:
            assert (await client.patch(url, json=fields)).status_code == 422
        assert (await client.get(url)).json() == created
        assert len((await client.get("/api/v1/transactions")).json()) == 1

    runner.run(scenario())


def test_editing_import_preserves_deduplication(api_postgres) -> None:
    runner, client, _ = api_postgres

    async def scenario() -> None:
        token = await register(client, "edited-import@example.com")
        client.headers["Authorization"] = f"Bearer {token['access_token']}"
        content = (FIXTURES / "tbank.csv").read_bytes()
        endpoint = "/api/v1/transactions/import-statement"
        imported = (await client.post(endpoint, files={"file": ("a.csv", content)})).json()
        transaction = imported["imported_transactions"][0]
        url = f"/api/v1/transactions/{transaction['id']}"
        changed = await client.patch(url, json={"amount": 25, "merchant_name": "Новый контрагент"})
        assert changed.status_code == 200
        repeated = (await client.post(endpoint, files={"file": ("a.csv", content)})).json()
        assert repeated["duplicates_skipped"] == 5
        assert repeated["imported_count"] == 0
        assert (await client.get(url)).json()["amount"] == 25

    runner.run(scenario())
