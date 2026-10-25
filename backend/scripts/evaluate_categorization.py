"""Evaluate analyst-labeled statements through the actual import endpoint."""

import argparse
import json
import secrets
import sys
from pathlib import Path
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

import httpx

from src.db.models import BankSource, OperationType
from src.modules.statements.parser import StatementParser


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", default="http://api:8000/api/v1")
    parser.add_argument("--timezone", default="Europe/Moscow")
    parser.add_argument("--tbank", type=Path, required=True)
    parser.add_argument("--sber", type=Path, required=True)
    parser.add_argument("--vtb", type=Path, required=True)
    arguments = parser.parse_args()
    statement_parser = StatementParser(ZoneInfo(arguments.timezone))
    report = {}
    expected_categories = set()
    # Each run uses a fresh isolated account, so previous evaluations cannot cause duplicates.
    with httpx.Client(base_url=arguments.api_url.rstrip("/") + "/", timeout=30) as client:
        registration = client.post(
            "auth/register",
            json={
                "email": f"evaluation-{uuid4().hex}@example.com",
                "password": secrets.token_urlsafe(24),
                "full_name": "Categorization evaluation",
            },
        )
        registration.raise_for_status()
        token = registration.json()
        client.headers["Authorization"] = f"Bearer {token['access_token']}"
        user_id = UUID(token["user_id"])
        for bank, path, hint in [
            (BankSource.TBANK, arguments.tbank, "tbank"),
            (BankSource.SBER, arguments.sber, "sber"),
            (BankSource.VTB, arguments.vtb, "vtb"),
        ]:
            content = path.read_bytes()
            normalized = statement_parser.parse(
                content=content,
                filename=path.name,
                user_id=user_id,
                bank_hint=bank,
            )
            rows = statement_parser.read_rows(content=content, filename=path.name)
            headers = [value.strip().lower() for value in rows[0]]
            if "expected_category_id" not in headers:
                raise SystemExit(f"{bank}: требуется колонка expected_category_id")
            if (
                normalized.skipped_rows
                or len(normalized.transactions) < 100
                or any(
                    item.operation_type is not OperationType.DEBIT
                    for item in normalized.transactions
                )
            ):
                raise SystemExit(f"{bank}: нужны минимум 100 выполненных ненулевых расходов")
            column = headers.index("expected_category_id")
            labels = [int(row[column]) for row in rows[1:]]
            expected = {
                item.external_id: category_id
                for item, category_id in zip(normalized.transactions, labels, strict=True)
            }
            if len(expected) != len(labels):
                raise SystemExit(f"{bank}: датасет содержит дубликаты")
            expected_categories.update(labels)
            response = client.post(
                "transactions/import-statement",
                data={"bank_hint": hint},
                files={"file": (path.name, content)},
            )
            response.raise_for_status()
            predicted = {
                item["external_id"]: item["category_id"]
                for item in response.json()["imported_transactions"]
            }
            if predicted.keys() != expected.keys():
                raise SystemExit(f"{bank}: число импортированных записей не совпало с датасетом")
            correct = sum(predicted[key] == value for key, value in expected.items())
            report[bank.value] = {
                "total": len(expected),
                "correct": correct,
                "accuracy": correct / len(expected),
            }
    if len(expected_categories) < 8:
        raise SystemExit("Датасет должен покрывать не менее 8 категорий")
    total = sum(item["total"] for item in report.values())
    correct = sum(item["correct"] for item in report.values())
    report["overall"] = {"total": total, "correct": correct, "accuracy": correct / total}
    sys.stdout.write(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    if any(item["accuracy"] < 0.8 for item in report.values()):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
