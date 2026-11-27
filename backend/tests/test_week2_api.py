import asyncio
import csv
import io
import time
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
import pytest
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession

from src.app import app
from src.db.database import get_async_session
from src.db.models import Discount, RefreshSession, SupportTicket, Transaction, User, UserChallenge

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


def test_week3_goals_deposits_and_ownership(api_postgres) -> None:
    runner, client, _ = api_postgres

    async def scenario() -> None:
        owner = await register(client, "goal-owner@example.com")
        outsider = await register(client, "goal-outsider@example.com")
        owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}
        outsider_headers = {"Authorization": f"Bearer {outsider['access_token']}"}
        client.headers.update(owner_headers)
        base = "/api/v1/goals"
        today = datetime.now(UTC).date()
        payload = {
            "title": "Резерв",
            "target_amount": 10000,
            "deadline": (today + timedelta(days=60)).isoformat(),
            "icon": "shield",
        }
        assert (
            await client.post(base, json={**payload, "deadline": "2000-01-01"})
        ).status_code == 422
        response = await client.post(base, json=payload)
        assert response.status_code == 201, response.text
        created = response.json()
        goal_url = f"{base}/{created['id']}"
        assert created["icon"] == "shield"
        assert created["exceeds_half_income"] is True
        assert 4900 < created["monthly_payment_recommended"] < 5200
        for amount in [0, -1, 10001, "1.001"]:
            result = await client.post(
                f"{goal_url}/deposit", json={"amount": amount, "source": "free_money"}
            )
            assert result.status_code == 422
        assert (await client.get(goal_url, headers=outsider_headers)).status_code == 404
        assert (await client.delete(goal_url, headers=outsider_headers)).status_code == 404
        assert (await client.get(base, headers=outsider_headers)).json() == []
        result = await client.post(
            f"{goal_url}/deposit", json={"amount": 500, "source": "discount"}
        )
        assert result.status_code == 200, result.text
        deposit = result.json()
        assert deposit["current_amount"] == 500
        assert deposit["progress_percent"] == 5
        assert deposit["acceleration_days"] == 3
        assert deposit["monthly_payment_recommended"] < created["monthly_payment_recommended"]
        assert (await client.patch(goal_url, json={"target_amount": 499})).status_code == 422
        assert (await client.patch(goal_url, json={"title": "Резерв на отпуск"})).status_code == 200
        assert (await client.get(base)).json()[0]["current_amount"] == 500
        assert (await client.delete(goal_url)).status_code == 204
        assert (await client.get(base)).json() == []

    runner.run(scenario())


def test_week3_dashboard_integrates_activity_goals_and_diagnosis(api_postgres) -> None:
    runner, client, connection = api_postgres

    async def scenario() -> None:
        async with AsyncSession(bind=connection) as session:
            now = await session.scalar(select(func.now()))
        assert now is not None
        token = await register(client, "health@example.com")
        client.headers["Authorization"] = f"Bearer {token['access_token']}"
        today = now.astimezone(ZoneInfo("Europe/Moscow")).date()
        url = "/api/v1/analytics/dashboard"
        empty = (await client.get(url)).json()["diagnostics"]
        assert empty["indices"] == {"balance": 0, "budget": 0, "goals": 50, "regularity": 0}
        assert "FD-08" in empty["unavailable"]
        for category, operation, amount in [
            (10, "CREDIT", 10000),
            (1, "DEBIT", 5000),
            (5, "DEBIT", 3000),
        ]:
            response = await client.post(
                "/api/v1/transactions",
                json={
                    **MANUAL_TRANSACTION,
                    "category_id": category,
                    "operation_type": operation,
                    "amount": amount,
                    "transaction_date": now.isoformat(),
                },
            )
            assert response.status_code == 201, response.text
        created = await client.post(
            "/api/v1/goals",
            json={
                "title": "Резерв",
                "target_amount": 1000,
                "deadline": (today + timedelta(days=30)).isoformat(),
            },
        )
        goal_id = created.json()["id"]
        assert (
            await client.post(
                f"/api/v1/goals/{goal_id}/deposit", json={"amount": 100, "source": "free_money"}
            )
        ).status_code == 200
        response = await client.get(url)
        assert response.status_code == 200, response.text
        result = response.json()["diagnostics"]
        assert result["indices"] == {"balance": 100, "budget": 100, "goals": 100, "regularity": 35}
        assert result["health_score"] == 90
        assert "FD-10" in {alert["type"] for alert in result["alerts"]}
        assert (await client.get(url, params={"from_date": today.isoformat()})).status_code == 422
        evidence = {
            "idle_cash": {"since": (today - timedelta(days=60)).isoformat(), "amount": 1000}
        }
        verified = await client.post(url, json=evidence)
        assert verified.status_code == 200
        assert "FD-08" not in verified.json()["diagnostics"]["unavailable"]
        assert (await client.post(url, json={"idle_cash": {"amount": 1000}})).status_code == 422

    runner.run(scenario())


def test_week3_diagnosis_matches_only_relevant_unexpired_discounts(api_postgres) -> None:
    runner, client, connection = api_postgres

    async def scenario() -> None:
        token = await register(client, "diagnosis-discounts@example.com")
        client.headers["Authorization"] = f"Bearer {token['access_token']}"
        for category, direction, amount in [(10, "CREDIT", 10000), (1, "DEBIT", 4100)]:
            response = await client.post(
                "/api/v1/transactions",
                json={
                    **MANUAL_TRANSACTION,
                    "category_id": category,
                    "operation_type": direction,
                    "amount": amount,
                },
            )
            assert response.status_code == 201, response.text
        as_of = MANUAL_TRANSACTION["transaction_date"][:10]
        deadline = datetime.fromisoformat(as_of).date()
        async with AsyncSession(
            bind=connection, join_transaction_mode="create_savepoint"
        ) as session:
            await session.execute(update(Discount).values(valid_until=deadline - timedelta(days=1)))
            for category, name, expiry in [
                (1, "Магазин", deadline),
                (1, "Старая акция", deadline - timedelta(days=1)),
                (5, "Кофейня", deadline),
            ]:
                session.add(
                    Discount(
                        category_id=category,
                        partner_name=name,
                        title="Скидка 10%",
                        discount_percent=10,
                        affiliate_url="https://example.com",
                        valid_until=expiry,
                    )
                )
            await session.commit()
        response = await client.post(
            "/api/v1/analytics/dashboard",
            json={
                "from_date": as_of,
                "to_date": as_of,
                "idle_cash": {"since": "2026-08-01", "amount": 50000},
            },
        )
        assert response.status_code == 200, response.text
        alerts = {alert["type"]: alert for alert in response.json()["diagnostics"]["alerts"]}
        assert "FD-08" in alerts
        assert [offer["partner_name"] for offer in alerts["FD-06"]["discounts"]] == ["Магазин"]

    runner.run(scenario())


def test_week4_catalog_and_persistent_achievements(api_postgres) -> None:
    runner, client, connection = api_postgres

    async def scenario() -> None:
        articles = await client.get("/api/v1/articles")
        assert articles.status_code == 200
        assert len(articles.json()) == 10
        first = articles.json()[0]
        assert first["content_markdown"]
        assert first["action_checklist"]
        filtered = await client.get("/api/v1/articles", params={"tags": first["tags"][0]})
        assert all(first["tags"][0] in row["tags"] for row in filtered.json())
        assert (await client.get("/api/v1/articles/art-01")).json() == first
        assert (await client.get("/api/v1/articles/missing")).status_code == 404
        assert (await client.get("/api/v1/articles", params={"tags": "missing"})).json() == []
        offers = (await client.get("/api/v1/discounts")).json()
        assert offers
        assert any(row["is_demo"] for row in offers)
        assert any(not row["is_demo"] and row["affiliate_url"] for row in offers)
        filtered_offers = (await client.get("/api/v1/discounts?category_id=1")).json()
        assert all(row["category_id"] == 1 for row in filtered_offers)
        assert (await client.get("/api/v1/achievements")).status_code == 401
        tokens = await register(client, "badges@example.com")
        client.headers["Authorization"] = f"Bearer {tokens['access_token']}"
        initial = (await client.get("/api/v1/achievements")).json()
        assert len(initial["items"]) == 15
        assert initial["reward_points"] == 0
        content = (FIXTURES / "tbank.csv").read_bytes()
        for _ in range(2):
            result = await client.post(
                "/api/v1/transactions/import-statement", files={"file": ("a.csv", content)}
            )
            assert result.status_code == 200, result.text
        goal = await client.post(
            "/api/v1/goals",
            json={"title": "Резерв", "target_amount": 100, "deadline": "2099-12-31"},
        )
        assert goal.status_code == 201, goal.text
        goal_id = goal.json()["id"]
        deposited = await client.post(
            f"/api/v1/goals/{goal_id}/deposit", json={"amount": 100, "source": "free_money"}
        )
        assert deposited.status_code == 200, deposited.text
        earned = (await client.get("/api/v1/achievements")).json()
        assert earned["reward_points"] == 55
        game = (await client.post("/api/v1/gamification/progress")).json()
        assert game["reward_points"] == 55
        assert game["league"]["title"] == "Серебряная"
        assert {row["code"] for row in earned["items"] if row["unlocked"]} == {
            "BADGE_FIRST_IMPORT",
            "BADGE_PIGGY_CREATED",
            "BADGE_FIRST_DEPOSIT",
            "BADGE_GOAL_REACHED",
        }
        assert (await client.delete(f"/api/v1/goals/{goal_id}")).status_code == 204
        assert (await client.get("/api/v1/achievements")).json() == earned
        other = await register(client, "no-badges@example.com")
        result = await client.get(
            "/api/v1/achievements", headers={"Authorization": f"Bearer {other['access_token']}"}
        )
        assert result.json()["reward_points"] == 0

    runner.run(scenario())


def test_release_filters_trend_and_recommendations(api_postgres) -> None:
    runner, client, _ = api_postgres

    async def scenario() -> None:
        token = await register(client, "release@example.com")
        client.headers["Authorization"] = f"Bearer {token['access_token']}"
        profile = await client.patch("/api/v1/users/me", json={"full_name": "  Новое имя  "})
        assert profile.status_code == 200, profile.text
        assert (await client.get("/api/v1/users/me")).json()["full_name"] == "Новое имя"
        today = datetime.now(ZoneInfo("Europe/Moscow")).date()
        for category, amount in [(1, 500), (2, 400), (5, 300), (7, 200)]:
            created = await client.post(
                "/api/v1/transactions",
                json={
                    **MANUAL_TRANSACTION,
                    "category_id": category,
                    "amount": amount,
                    "transaction_date": f"{today}T12:00:00+03:00",
                    "merchant_name": "Касса 20%",
                },
            )
            assert created.status_code == 201, created.text
        endpoint = "/api/v1/transactions"
        filtered = await client.get(
            endpoint,
            params={
                "category_id": 2,
                "operation_type": "DEBIT",
                "q": "КАССА 20%",
            },
        )
        assert [row["amount"] for row in filtered.json()] == [400]
        assert (await client.get(endpoint, params={"q": "_"})).json() == []
        assert (await client.get(endpoint, params={"operation_type": "CREDIT"})).json() == []
        trend = await client.get(
            "/api/v1/analytics/expenses/trend",
            params={
                "from_date": str(today - timedelta(days=1)),
                "to_date": str(today),
            },
        )
        assert trend.status_code == 200, trend.text
        assert [point["amount"] for point in trend.json()] == [0, 1400]
        offers = await client.get("/api/v1/discounts/recommended")
        assert offers.status_code == 200, offers.text
        assert offers.json()["recommendation_basis"] == [
            "Супермаркеты",
            "Транспорт и авто",
            "Кафе и рестораны",
        ]
        assert {item["category_id"] for item in offers.json()["items"]} <= {1, 2, 5}
        outsider = await register(client, "release-foreign@example.com")
        headers = {"Authorization": f"Bearer {outsider['access_token']}"}
        assert (await client.get(endpoint, headers=headers)).json() == []
        assert (await client.get("/api/v1/discounts/recommended", headers=headers)).json() == {
            "recommendation_basis": [],
            "items": [],
        }

    runner.run(scenario())


def test_monthly_limits_boundaries_and_isolation(api_postgres) -> None:
    runner, client, _ = api_postgres

    async def scenario() -> None:
        endpoint = "/api/v1/limits"
        assert (await client.get(endpoint)).status_code == 401
        owner = await register(client, "limits@example.com")
        client.headers["Authorization"] = f"Bearer {owner['access_token']}"
        assert (await client.put(f"{endpoint}/1", json={"amount": 0})).status_code == 422
        assert (await client.put(f"{endpoint}/10", json={"amount": 100})).status_code == 422
        assert (await client.put(f"{endpoint}/1", json={"amount": "100.00"})).status_code == 204
        now = datetime.now(ZoneInfo("Europe/Moscow"))
        for amount, expected in [(79, "ok"), (1, "approaching"), (20, "reached")]:
            transaction = await client.post(
                "/api/v1/transactions",
                json={
                    **MANUAL_TRANSACTION,
                    "category_id": 1,
                    "amount": amount,
                    "transaction_date": now.isoformat(),
                },
            )
            assert transaction.status_code == 201, transaction.text
            response = await client.get(endpoint)
            assert response.status_code == 200, response.text
            assert response.json()[0]["status"] == expected
        previous = now.replace(day=1) - timedelta(days=1)
        for direction, timestamp in [("CREDIT", now), ("DEBIT", previous)]:
            transaction = await client.post(
                "/api/v1/transactions",
                json={
                    **MANUAL_TRANSACTION,
                    "category_id": 1,
                    "amount": 800,
                    "operation_type": direction,
                    "transaction_date": timestamp.isoformat(),
                },
            )
            assert transaction.status_code == 201, transaction.text
        assert (await client.get(endpoint)).json()[0]["spent"] == 100
        outsider = await register(client, "other-limits@example.com")
        other_headers = {"Authorization": f"Bearer {outsider['access_token']}"}
        assert (await client.get(endpoint, headers=other_headers)).json() == []
        assert (await client.delete(f"{endpoint}/1", headers=other_headers)).status_code == 204
        assert (await client.get(endpoint)).json()[0]["amount"] == 100
        assert (await client.delete(f"{endpoint}/1")).status_code == 204
        assert (await client.get(endpoint)).json() == []

    runner.run(scenario())


def test_optional_birth_date_is_validated_and_persisted(api_postgres) -> None:
    runner, client, _ = api_postgres

    async def scenario() -> None:
        registration = "/api/v1/auth/register"
        fields = {
            "email": "birthday@example.com",
            "password": "Test-password-123!",
            "full_name": "Demo",
        }
        for invalid_date in ("2001-02-29", "1899-12-31", "2999-01-01"):
            invalid = await client.post(registration, json={**fields, "birth_date": invalid_date})
            assert invalid.status_code == 422
        created = await client.post(registration, json={**fields, "birth_date": "2000-02-29"})
        assert created.status_code == 201, created.text
        without_date = await register(client, "no-birthday@example.com")
        for access_token, expected in [
            (created.json()["access_token"], "2000-02-29"),
            (without_date["access_token"], None),
        ]:
            profile = await client.get(
                "/api/v1/users/me", headers={"Authorization": f"Bearer {access_token}"}
            )
            assert profile.status_code == 200
            assert profile.json()["birth_date"] == expected

    runner.run(scenario())


def test_challenge_progress_respects_start_deadline_and_account(api_postgres) -> None:
    runner, client, connection = api_postgres

    async def scenario() -> None:
        tokens = await register(client, "challenges@example.com")
        client.headers["Authorization"] = f"Bearer {tokens['access_token']}"
        route = "/api/v1/gamification"
        now = datetime.now(UTC)
        assert (await client.post(f"{route}/challenges/nonexistent")).status_code == 404
        for code in ("three-days", "savings-in-motion"):
            assert (await client.post(f"{route}/challenges/{code}")).status_code == 204
        await connection.execute(update(UserChallenge).values(started_at=now - timedelta(days=8)))
        for days_ago in (9, 6, 6, 4, 2, 0):
            response = await client.post("/api/v1/transactions", json=MANUAL_TRANSACTION)
            assert response.status_code == 201, response.text
            await connection.execute(
                update(Transaction)
                .where(Transaction.id == response.json()["id"])
                .values(created_at=now - timedelta(days=days_ago))
            )
        goal = await client.post(
            "/api/v1/goals",
            json={"title": "Копилка", "target_amount": 3000, "deadline": "2099-12-31"},
        )
        goal_id = goal.json()["id"]
        for amount in (800, 200):
            deposit = await client.post(
                f"/api/v1/goals/{goal_id}/deposit", json={"amount": amount, "source": "free_money"}
            )
            assert deposit.status_code == 200, deposit.text
        assert (await client.post(f"{route}/challenges/three-days")).status_code == 204
        progress = (await client.post(f"{route}/progress")).json()
        rows = {challenge["code"]: challenge for challenge in progress["challenges"]}
        assert rows["three-days"]["status"] == "completed"
        assert rows["three-days"]["current"] == 3
        assert rows["savings-in-motion"]["current"] == 1000
        assert rows["savings-in-motion"]["status"] == "completed"
        assert rows["five-expenses"]["status"] == "available"
        assert (await client.post(f"{route}/progress")).json() == progress
        outsider = await register(client, "other-challenges@example.com")
        outside = await client.post(
            f"{route}/progress", headers={"Authorization": f"Bearer {outsider['access_token']}"}
        )
        assert outside.status_code == 200
        assert all(row["status"] == "available" for row in outside.json()["challenges"])

    runner.run(scenario())


def test_support_welcome_and_discount_savings(api_postgres) -> None:
    runner, client, connection = api_postgres

    async def scenario() -> None:
        registered = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "welcome-support@example.com",
                "password": "Test-password-123!",
                "full_name": "Тест",
                "welcome": True,
            },
        )
        assert registered.status_code == 201
        client.headers["Authorization"] = f"Bearer {registered.json()['access_token']}"
        game_endpoint = "/api/v1/gamification/progress"
        assert (await client.post(game_endpoint)).json()["welcome_stage"] == "first_transaction"
        ticket_endpoint = "/api/v1/support/tickets"
        ticket_data = {"request_id": "9148851f-5981-4dd1-83ec-371a0659e863", "message": "Проверка"}
        attachment = {"attachment": ("test.pdf", b"%PDF-1.4\n", "application/pdf")}
        created = await client.post(ticket_endpoint, data=ticket_data, files=attachment)
        assert created.status_code == 201
        assert (
            await client.post(ticket_endpoint, data=ticket_data, files=attachment)
        ).json() == created.json()
        saved_ticket = (
            await connection.execute(select(SupportTicket.message, SupportTicket.attachment))
        ).one()
        assert saved_ticket == ("Проверка", b"%PDF-1.4\n")
        rejected = await client.post(
            ticket_endpoint,
            data=ticket_data,
            files={"attachment": ("test.pdf", b"fake", "application/pdf")},
        )
        assert rejected.status_code == 422

        response = await client.post(
            "/api/v1/transactions", json={**MANUAL_TRANSACTION, "amount": 800}
        )
        assert response.status_code == 201, response.text
        id_ = response.json()["id"]
        assert (await client.post(game_endpoint)).json()["welcome_stage"] == "completed"
        goal_response = await client.post(
            "/api/v1/goals",
            json={"title": "Резерв", "target_amount": 1000, "deadline": "2099-12-31"},
        )
        goal_id = goal_response.json()["id"]
        goal_endpoint = f"/api/v1/goals/{goal_id}"
        expense_endpoint = f"/api/v1/transactions/{id_}"
        savings_endpoint = expense_endpoint + "/discount-savings"
        savings = {"goal_id": goal_id, "original_amount": 1000}
        for _ in range(2):
            result = await client.put(savings_endpoint, json=savings)
            assert result.status_code == 200, result.text
            assert result.json()["amount"] == 200
        assert (await client.get(goal_endpoint)).json()["current_amount"] == 200
        assert (await client.get(expense_endpoint)).json()["amount"] == 800
        linked = (await client.get(expense_endpoint)).json()["discount_savings"]
        assert linked == {"goal_id": goal_id, "amount": 200}
        assert (
            await client.put(savings_endpoint, json={**savings, "original_amount": 1001})
        ).status_code == 409
        assert (await client.patch(expense_endpoint, json={"amount": 801})).status_code == 422
        outsider = await register(client, "discount-foreign@example.com")
        headers = {"Authorization": f"Bearer {outsider['access_token']}"}
        assert (
            await client.put(savings_endpoint, headers=headers, json=savings)
        ).status_code == 404
        assert (await client.delete(savings_endpoint)).status_code == 204
        assert (await client.get(goal_endpoint)).json()["current_amount"] == 0
        assert (await client.put(savings_endpoint, json=savings)).status_code == 200
        assert (await client.delete(expense_endpoint)).status_code == 204
        assert (await client.get(goal_endpoint)).json()["current_amount"] == 0
        assert (await client.post(game_endpoint)).json()["welcome_stage"] == "completed"

    runner.run(scenario())


def test_admin_permissions_catalog_and_activity(api_postgres) -> None:
    runner, client, connection = api_postgres

    async def scenario() -> None:
        account = await register(client, "admin-check@example.com")
        member = await register(client, "member-check@example.com")
        moderator = await register(client, "moderator-check@example.com")
        await connection.execute(
            update(User).where(User.email == "admin-check@example.com").values(role="admin")
        )
        await connection.execute(
            update(User).where(User.email == "moderator-check@example.com").values(role="moderator")
        )
        admin = {"Authorization": f"Bearer {account['access_token']}"}
        user = {"Authorization": f"Bearer {member['access_token']}"}
        staff = {"Authorization": f"Bearer {moderator['access_token']}"}
        root = "/api/v1/admin"
        for endpoint in (
            "analytics",
            "users",
            "categories",
            "discounts",
            "articles",
            "badges",
            "tickets",
        ):
            assert (await client.get(f"{root}/{endpoint}")).status_code == 401
            assert (await client.get(f"{root}/{endpoint}", headers=user)).status_code == 403
        assert (await client.get(root + "/users", headers=staff)).status_code == 403
        assert (await client.get(root + "/discounts", headers=staff)).status_code == 200

        category = {"name": "Тестовая ветка", "budget_group": "NEEDS", "keywords": ["test keyword"]}
        response = await client.post(root + "/categories", json=category, headers=admin)
        assert response.status_code == 201, response.text
        parent = response.json()["id"]
        child = {**category, "name": "Подкатегория", "parent_id": parent, "keywords": []}
        response = await client.post(root + "/categories", json=child, headers=admin)
        assert response.status_code == 201, response.text
        child_id = response.json()["id"]
        invalid = await client.put(
            f"{root}/categories/{parent}", json={**category, "parent_id": child_id}, headers=admin
        )
        assert invalid.status_code == 422
        listed = (await client.get(root + "/categories", headers=admin)).json()
        assert any(row["id"] == parent and row["keywords"] == ["test keyword"] for row in listed)

        discount = {
            "title": "Тестовая акция",
            "partner_name": "Магазин",
            "category_id": child_id,
            "valid_until": "2099-12-31",
            "original_price": 100,
            "sale_price": 85,
        }
        response = await client.post(root + "/discounts", json=discount, headers=staff)
        assert response.status_code == 201, response.text
        offer_id = response.json()["id"]
        offer_path = f"{root}/discounts/{offer_id}"
        public_offers = f"/api/v1/discounts?category_id={child_id}"
        assert (await client.get(public_offers)).json() == []
        published = await client.put(
            offer_path,
            json={**discount, "status": "published", "promocode": "TEST15"},
            headers=staff,
        )
        assert published.status_code == 200, published.text
        [offer] = (await client.get(public_offers)).json()
        assert offer["promocode"] == "TEST15"
        assert offer["original_price"] == 100
        assert offer["sale_price"] == 85
        await client.put(offer_path, json={**discount, "status": "hidden"}, headers=staff)
        assert (await client.get(public_offers)).json() == []
        await client.put(
            offer_path,
            json={**discount, "status": "published", "valid_until": "2000-01-01"},
            headers=staff,
        )
        assert (await client.get(public_offers)).json() == []

        article = {
            "title": "Тестовая статья",
            "category": "Бюджет",
            "read_time_min": 3,
            "summary": "Краткое описание",
            "content_markdown": "Содержание",
            "tags": ["Бюджет"],
        }
        response = await client.post(root + "/articles", json=article, headers=staff)
        assert response.status_code == 201, response.text
        article_id = response.json()["id"]
        public_article = f"/api/v1/articles/{article_id}"
        assert (await client.get(public_article)).status_code == 404
        published = await client.put(
            f"{root}/articles/{article_id}",
            json={**article, "title": "Опубликованная статья", "status": "published"},
            headers=staff,
        )
        assert published.status_code == 200, published.text
        assert (await client.get(public_article)).json()["title"] == "Опубликованная статья"

        new_badge = {
            "title": "Первый расход",
            "level": "Бронза",
            "icon": "🏅",
            "condition": "1 расход",
            "points": 7,
            "metric": "expenses",
            "target": 1,
            "enabled": True,
        }
        response = await client.post(
            root + "/badges", json={**new_badge, "code": "TEST_FIRST_EXPENSE"}, headers=staff
        )
        assert response.status_code == 201, response.text
        assert (
            await client.post("/api/v1/transactions", headers=user, json=MANUAL_TRANSACTION)
        ).status_code == 201
        for points in (7, 99):
            updated = await client.put(
                root + "/badges/TEST_FIRST_EXPENSE",
                json={**new_badge, "points": points},
                headers=staff,
            )
            assert updated.status_code == 200, updated.text
            progress = (await client.post("/api/v1/gamification/progress", headers=user)).json()
            earned = next(row for row in progress["items"] if row["code"] == "TEST_FIRST_EXPENSE")
            assert earned["unlocked"] and earned["points"] == 7

        preexisting = (await client.get(root + "/analytics", headers=admin)).json()
        assert preexisting["imports"] == 0 and preexisting["recognition_percent"] is None
        imported = await client.post(
            "/api/v1/transactions/import-statement",
            headers=user,
            files={"file": ("a.csv", (FIXTURES / "tbank.csv").read_bytes())},
        )
        assert imported.status_code == 200
        summary = (await client.get(root + "/analytics", headers=admin)).json()
        assert summary["imports"] == 1
        assert summary["recognition_percent"] == round(imported.json()["recognition_rate"] * 100, 1)
        [account_summary] = (await client.get(root + "/users?q=member-check", headers=admin)).json()
        assert account_summary["imports"] == 1 and account_summary["operations"] > 0
        assert account_summary["last_activity"]
        assert (
            not {"hashed_password", "birth_date", "merchant_name", "amount"}
            & account_summary.keys()
        )

        block = f"{root}/users/{member['user_id']}/block"
        assert (await client.put(block, json={"blocked": True}, headers=staff)).status_code == 403
        assert (await client.put(block, json={"blocked": True}, headers=admin)).status_code == 204
        assert (await client.get("/api/v1/users/me", headers=user)).status_code == 401
        assert (await client.put(block, json={"blocked": False}, headers=admin)).status_code == 204
        assert (await client.get("/api/v1/users/me", headers=user)).status_code == 401
        refresh = await client.post(
            "/api/v1/auth/refresh", json={"refresh_token": member["refresh_token"]}
        )
        assert refresh.status_code == 401
        login = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "member-check@example.com",
                "password": "Test-password-123!",
            },
        )
        assert login.status_code == 200

    runner.run(scenario())


def test_support_response_is_visible_only_to_its_owner(api_postgres) -> None:
    runner, client, connection = api_postgres

    async def scenario() -> None:
        staff = await register(client, "staff-ticket@example.com")
        owner = await register(client, "owner-ticket@example.com")
        other = await register(client, "other-ticket@example.com")
        await connection.execute(
            update(User).where(User.email == "staff-ticket@example.com").values(role="moderator")
        )
        auth = {"Authorization": f"Bearer {staff['access_token']}"}
        owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}
        outsider = {"Authorization": f"Bearer {other['access_token']}"}
        response = await client.post(
            "/api/v1/support/tickets",
            headers=owner_headers,
            data={"request_id": "9148851f-5981-4dd1-83ec-371a0659e863", "message": "Вопрос"},
            files={"attachment": ("test.pdf", b"%PDF-1.4\n", "application/pdf")},
        )
        assert response.status_code == 201
        ticket_id = response.json()["id"]
        admin_ticket = f"/api/v1/admin/tickets/{ticket_id}"
        assert (await client.get(admin_ticket + "/attachment", headers=outsider)).status_code == 403
        attachment = await client.get(admin_ticket + "/attachment", headers=auth)
        assert attachment.content == b"%PDF-1.4\n" and attachment.headers[
            "content-disposition"
        ].startswith("attachment;")
        response = await client.put(
            admin_ticket, headers=auth, json={"status": "answered", "reply": "Ответ"}
        )
        assert response.status_code == 204, response.text
        tickets = (await client.get("/api/v1/support/tickets", headers=owner_headers)).json()
        assert [(row["id"], row["reply"]) for row in tickets] == [(ticket_id, "Ответ")]
        assert (await client.get("/api/v1/support/tickets", headers=outsider)).json() == []

    runner.run(scenario())
