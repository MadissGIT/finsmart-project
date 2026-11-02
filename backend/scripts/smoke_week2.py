"""Verify the running Compose API, authentication, import, and budgeting."""

from pathlib import Path
from uuid import uuid4

import httpx


def main() -> None:
    with httpx.Client(base_url="http://api:8000/api/v1/", timeout=15) as client:
        registration = client.post(
            "auth/register",
            json={
                "email": f"smoke-{uuid4().hex}@example.com",
                "password": "Local-ci-password-123!",
                "full_name": "CI smoke",
            },
        )
        registration.raise_for_status()
        credentials = registration.json()
        client.headers["Authorization"] = f"Bearer {credentials['access_token']}"
        content = Path("tests/fixtures/tbank.csv").read_bytes()
        imported = client.post(
            "transactions/import-statement", files={"file": ("tbank.csv", content)}
        )
        imported.raise_for_status()
        assert imported.json()["imported_count"] == 5
        repeated = client.post(
            "transactions/import-statement", files={"file": ("tbank.csv", content)}
        )
        repeated.raise_for_status()
        assert repeated.json()["duplicates_skipped"] == 5
        budget = client.get(
            "analytics/budget", params={"from_date": "2026-10-01", "to_date": "2026-10-31"}
        )
        budget.raise_for_status()
        assert budget.json()["summary"]["total_income"] == 100000
        assert budget.json()["summary"]["total_expense"] == 2349.5
        rotated = client.post("auth/refresh", json={"refresh_token": credentials["refresh_token"]})
        rotated.raise_for_status()
        assert (
            client.post(
                "auth/refresh", json={"refresh_token": credentials["refresh_token"]}
            ).status_code
            == 401
        )
        manual = client.post(
            "transactions",
            json={
                "amount": 250,
                "operation_type": "DEBIT",
                "category_id": 1,
                "transaction_date": "2026-11-02T12:00:00+03:00",
                "merchant_name": "SAMOKAT",
            },
        )
        manual.raise_for_status()
        transaction_url = f"transactions/{manual.json()['id']}"
        assert client.get(transaction_url).json()["amount"] == 250
        updated = client.patch(transaction_url, json={"amount": 300, "comment": "Smoke CRUD"})
        updated.raise_for_status()
        filtered = client.get(
            "transactions", params={"from_date": "2026-11-02", "to_date": "2026-11-02"}
        )
        filtered.raise_for_status()
        assert len(filtered.json()) == 1
        assert filtered.json()[0]["amount"] == 300
        assert client.delete(transaction_url).status_code == 204
        assert client.get(transaction_url).status_code == 404


if __name__ == "__main__":
    main()
