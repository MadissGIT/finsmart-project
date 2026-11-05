import csv
import io
import json
import sys
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo

import httpx
import pytest

from scripts import evaluate_categorization
from src.modules.statements.parser import StatementParser


@pytest.mark.parametrize("correct_predictions", [True, False])
def test_evaluator_reports_measured_accuracy_and_fails_below_threshold(
    tmp_path: Path, monkeypatch, capsys, correct_predictions: bool
) -> None:
    arguments = ["evaluate_categorization"]
    for bank in ["tbank", "sber", "vtb"]:
        fixture = Path(__file__).parent / "fixtures" / f"{bank}.csv"
        source = list(csv.reader(io.StringIO(fixture.read_text()), delimiter=";"))
        template = dict(zip(source[0], source[1], strict=True))
        if bank == "tbank":
            template["Сумма операции"] = "-100"
        stream = io.StringIO()
        writer = csv.writer(stream, delimiter=";")
        writer.writerow([*source[0], "expected_category_id"])
        for index in range(100):
            row = dict(template)
            amount_column = "Сумма в валюте счета" if bank == "sber" else "Сумма операции"
            row[amount_column] = str(-(index + 1) if bank == "tbank" else index + 1)
            writer.writerow([*[row[key] for key in source[0]], index % 8 + 1])
        path = tmp_path / f"{bank}.csv"
        path.write_text(stream.getvalue())
        arguments.extend([f"--{bank}", str(path)])
    user_id = uuid4()
    parser = StatementParser(ZoneInfo("Europe/Moscow"))

    def respond(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("auth/register"):
            return httpx.Response(201, json={"user_id": str(user_id), "access_token": "test"})
        assert request.headers["Authorization"] == "Bearer test"
        body = request.content
        filename = next(bank for bank in ["tbank", "sber", "vtb"] if f"{bank}.csv".encode() in body)
        content = (tmp_path / f"{filename}.csv").read_bytes()
        parsed = parser.parse(content=content, filename="a.csv", user_id=user_id, bank_hint=None)
        return httpx.Response(
            200,
            json={
                "imported_transactions": [
                    {
                        "external_id": item.external_id,
                        "category_id": index % 8 + 1 if correct_predictions else 11,
                    }
                    for index, item in enumerate(parsed.transactions)
                ]
            },
        )

    client = httpx.Client(base_url="http://test/api/v1/", transport=httpx.MockTransport(respond))
    monkeypatch.setattr(evaluate_categorization.httpx, "Client", lambda **kwargs: client)
    monkeypatch.setattr(sys, "argv", arguments)
    if correct_predictions:
        evaluate_categorization.main()
    else:
        with pytest.raises(SystemExit) as error:
            evaluate_categorization.main()
        assert error.value.code == 1
    report = json.loads(capsys.readouterr().out)
    assert report["overall"]["total"] == 300
    assert report["overall"]["accuracy"] == (1 if correct_predictions else 0)
    assert all(report[bank]["total"] == 100 for bank in ["TBANK", "SBER", "VTB"])
