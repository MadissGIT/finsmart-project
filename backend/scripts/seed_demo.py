import csv
import io
import json
import os
import secrets
import sys
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx


def main() -> None:
    today = datetime.now(UTC).date()
    month_start = today.replace(day=1)
    email = f"demo-{uuid4().hex[:12]}@example.com"
    password = secrets.token_urlsafe(20)
    with httpx.Client(
        base_url=os.getenv("FINSMART_DEMO_API", "http://api:8000/api/v1/"), timeout=20
    ) as client:
        registration = client.post(
            "auth/register",
            json={"email": email, "password": password, "full_name": "Демо ФинСмарт"},
        )
        registration.raise_for_status()
        client.headers["Authorization"] = f"Bearer {registration.json()['access_token']}"
        output = io.StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow(
            ["Дата операции", "Статус", "Сумма операции", "Валюта операции", "MCC", "Описание"]
        )
        for amount, mcc, description in [
            ("60000.00", "", "Зарплата"),
            ("-27000.00", "5411", "Самокат"),
            ("-7800.00", "4121", "Яндекс Go"),
            ("-4600.00", "5812", "Додо Пицца"),
        ]:
            writer.writerow(
                [f"{month_start:%d.%m.%Y} 12:00:00", "OK", amount, "RUB", mcc, description]
            )
        imported = client.post(
            "transactions/import-statement",
            files={"file": ("demo-tbank.csv", output.getvalue().encode())},
        )
        imported.raise_for_status()
        if imported.json()["imported_count"] != 4:
            raise RuntimeError("Демо-выписка должна содержать четыре операции")
        goal = client.post(
            "goals",
            json={
                "title": "Подушка безопасности",
                "target_amount": 30000,
                "deadline": (today + timedelta(days=120)).isoformat(),
            },
        )
        goal.raise_for_status()
        deposit = client.post(
            f"goals/{goal.json()['id']}/deposit", json={"amount": 6000, "source": "free_money"}
        )
        deposit.raise_for_status()
        dashboard = client.get(
            "analytics/dashboard",
            params={"from_date": month_start.isoformat(), "to_date": today.isoformat()},
        )
        dashboard.raise_for_status()
        sys.stdout.write(
            json.dumps({"email": email, "password": password}, ensure_ascii=False) + "\n"
        )


if __name__ == "__main__":
    main()
