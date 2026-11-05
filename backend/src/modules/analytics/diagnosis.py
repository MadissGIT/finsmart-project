import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from src.db.models import BudgetGroup, OperationType, Transaction
from src.modules.analytics.schemas import (
    BudgetDashboard,
    DiagnosticAlert,
    HealthIndices,
    IdleCash,
)

D = Decimal
ZERO = D(0)
RIDE = re.compile(
    r"такси|каршеринг|яндекс[ ._-]*go|yandex[ ._-]*(?:go|taxi)|ситимобил|citymobil|uber|"
    r"делимобиль|belkacar|youdrive",
    re.I,
)
MARKETPLACE = re.compile(
    r"\b(?:ozon|озон|wildberries|вайлдберриз|aliexpress|алиэкспресс|вб|wb)\b", re.I
)


def health_score(
    income: Decimal,
    expense: Decimal,
    wants: Decimal,
    planned: Decimal,
    deposited: Decimal,
    active_weeks: int,
    manual_entries: int,
) -> tuple[int, HealthIndices, str, str]:
    balance = min(D(100), max(ZERO, (income - expense) / income * 500)) if income else ZERO
    budget = min(D(100), max(ZERO, (D("0.50") - wants / income) * 500)) if income else ZERO
    goals = min(D(100), deposited / planned * 100) if planned else D(50)
    regularity = D(min(100, active_weeks * 20 + manual_entries * 5))
    total = balance * D(".35") + budget * D(".25") + goals * D(".25") + regularity * D(".15")
    score = int(total.to_integral_value(rounding=ROUND_HALF_UP))
    if score < 40:
        status, color = "Критическое состояние", "#EF4444"
    elif score < 65:
        status, color = "Зона финансового риска", "#F59E0B"
    elif score < 85:
        status, color = "Стабильное здоровье", "#3B82F6"
    else:
        status, color = "Финансовый эталон", "#10B981"
    return (
        score,
        HealthIndices(balance=balance, budget=budget, goals=goals, regularity=regularity),
        status,
        color,
    )


def diagnose(
    budget: BudgetDashboard,
    rows: list[tuple[Transaction, BudgetGroup]],
    start: datetime,
    end: datetime,
    previous_start: datetime,
    financial_timezone: ZoneInfo,
    as_of: date,
    active_goals: int,
    goals_on_track: bool,
    idle_cash: IdleCash | None,
) -> list[DiagnosticAlert]:
    alerts = []
    income = budget.summary.total_income
    expense = budget.summary.total_expense
    wants = budget.budget_50_30_20.wants.amount
    savings = budget.budget_50_30_20.savings.amount
    current = [
        row
        for row, _ in rows
        if start <= row.transaction_date < end and row.operation_type is OperationType.DEBIT
    ]

    if income and wants > income * D(".45") and savings < income * D(".05"):
        alerts.append(
            DiagnosticAlert(
                type="FD-01",
                category="Желания",
                title="Импульсивный спендер",
                message=f"Желания: {wants / income:.0%}. Накопления: {savings / income:.0%}.",
                recommendation=(
                    "Установите недельный лимит на покупки и развлечения. "
                    "Подождите сутки перед покупкой. Сэкономленное внесите в копилку."
                ),
            )
        )

    subscriptions: dict[tuple[str, Decimal], set[date]] = defaultdict(set)
    for row, _ in rows:
        if row.category_id == 6 and row.operation_type is OperationType.DEBIT:
            subscriptions[(row.merchant_name, row.amount)].add(
                row.transaction_date.astimezone(financial_timezone).date()
            )
    recurring = []
    for (_, amount), dates in subscriptions.items():
        ordered = sorted(dates)
        if (
            ordered
            and ordered[-1] >= start.astimezone(financial_timezone).date()
            and any(28 <= (ordered[-1] - earlier).days <= 31 for earlier in ordered[:-1])
        ):
            recurring.append(amount)
    recurring_total = sum(recurring, ZERO)
    if len(recurring) >= 4 and recurring_total > 1500:
        alerts.append(
            DiagnosticAlert(
                type="FD-02",
                category="Подписки",
                title="Подписочный накопитель",
                message=f"Подписок: {len(recurring)}. Всего: {recurring_total:.2f} ₽ в месяц.",
                recommendation="Проверьте подписки и отключите неиспользуемые или дублирующие.",
                potential_saving=min(D(1500), recurring_total),
            )
        )

    coffee = [row.amount for row in current if row.category_id == 5 and 150 <= row.amount <= 400]
    coffee_total = sum(coffee, ZERO)
    if len(coffee) > 20 and coffee_total > 4500:
        share = f" Это {coffee_total / income:.0%} дохода." if income else ""
        alerts.append(
            DiagnosticAlert(
                type="FD-03",
                category="Кафе",
                title="Эффект латте",
                message=f"Мелкие покупки в кафе: {len(coffee)} на {coffee_total:.2f} ₽.{share}",
                recommendation="Покупайте кофе до двух раз в неделю или проверьте акции.",
            )
        )

    ride = sum(
        (r.amount for r in current if r.category_id == 2 and RIDE.search(r.merchant_name)), ZERO
    )
    previous_ride = sum(
        (
            r.amount
            for r, _ in rows
            if previous_start <= r.transaction_date < start
            and r.operation_type is OperationType.DEBIT
            and r.category_id == 2
            and RIDE.search(r.merchant_name)
        ),
        ZERO,
    )
    if expense and previous_ride and ride > expense * D(".15") and ride > previous_ride * D("1.20"):
        alerts.append(
            DiagnosticAlert(
                type="FD-04",
                category="Транспорт",
                title="Такси-зависимость",
                message=f"Такси и каршеринг: {ride:.2f} ₽, рост — {ride / previous_ride - 1:.0%}.",
                recommendation="Замените 30 % коротких поездок автобусом или прогулкой.",
                potential_saving=(ride * D(".30")).quantize(D(".01")),
            )
        )

    if expense > income or (income and income - expense < income * D(".03")):
        alerts.append(
            DiagnosticAlert(
                type="FD-05",
                category="Баланс",
                title="Дефицитная спираль",
                message=f"Остаток за период — {income - expense:.2f} ₽.",
                recommendation="Отложите необязательные покупки до оплаты счетов.",
            )
        )

    grocery = sum((row.amount for row in current if row.category_id == 1), ZERO)
    if income and grocery > income * D(".40"):
        alerts.append(
            DiagnosticAlert(
                type="FD-06",
                category="Супермаркеты",
                title="Продуктовый шторм",
                message=f"На продукты ушло {grocery / income:.0%} дохода ({grocery:.2f} ₽).",
                recommendation="Составьте список продуктов и сравните цены и акции перед покупкой.",
                potential_saving=(grocery * D(".15")).quantize(D(".01")),
            )
        )

    last_salary = None
    payday_spend = ZERO
    for row, group in rows:
        if row.operation_type is OperationType.CREDIT and group is BudgetGroup.INCOME:
            last_salary = row.transaction_date
        elif (
            last_salary is not None
            and start <= row.transaction_date < end
            and row.operation_type is OperationType.DEBIT
            and group is BudgetGroup.WANTS
            and row.transaction_date - last_salary <= timedelta(hours=72)
        ):
            payday_spend += row.amount
    if wants and payday_spend >= wants * D(".35"):
        alerts.append(
            DiagnosticAlert(
                type="FD-07",
                category="Желания",
                title="Синдром зарплатного дня",
                message=(
                    f"{payday_spend / wants:.0%} трат на желания приходится на "
                    "первые 72 часа после поступления дохода."
                ),
                recommendation="Запланируйте взнос в копилку в день получения зарплаты.",
            )
        )

    if (
        income
        and savings > income * D(".30")
        and active_goals == 0
        and idle_cash is not None
        and (as_of - idle_cash.since).days >= 60
    ):
        alerts.append(
            DiagnosticAlert(
                type="FD-08",
                category="Сбережения",
                title="Инфляционный застой",
                message=f"{idle_cash.amount:.2f} ₽ на счёте без процентов уже 60 дней или дольше.",
                recommendation="Создайте копилку для резерва и сравните условия хранения.",
            )
        )

    orders = [row.amount for row in current if MARKETPLACE.search(row.merchant_name)]
    order_total = sum(orders, ZERO)
    if len(orders) > 8 and order_total > 12000 and order_total < len(orders) * 1500:
        alerts.append(
            DiagnosticAlert(
                type="FD-09",
                category="Маркетплейсы",
                title="Шопоголик маркетплейсов",
                message=f"{len(orders)} покупок на маркетплейсах на {order_total:.2f} ₽.",
                recommendation="Оставьте товары в корзине на три дня перед оплатой.",
            )
        )

    allocations = budget.budget_50_30_20
    if (
        income
        and expense <= income
        and goals_on_track
        and all(
            abs(value.amount / income - target) <= D(".05")
            for value, target in (
                (allocations.needs, D(".50")),
                (allocations.wants, D(".30")),
                (allocations.savings, D(".20")),
            )
        )
    ):
        alerts.append(
            DiagnosticAlert(
                type="FD-10",
                category="Баланс",
                title="Финансовый дзен",
                badge="financial_zen",
                message="Бюджет соответствует 50/30/20, взносы в копилки идут по плану.",
                recommendation="Сохраняйте текущий темп.",
            )
        )
    return alerts
