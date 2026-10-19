# Контракты первой недели

Типы в `src/entities/*/model/types.ts` описаны по разделу 4 документа
«Проектная документация: Неделя 1 — Foundation и архитектура».
Имена полей сохраняют `snake_case`, чтобы DTO соответствовали JSON без неявного переименования.
UUID, календарные даты и ISO timestamps пока представлены строками, денежные суммы — числами,
как в примерах. TypeScript проверяет код при сборке и не валидирует JSON во время исполнения.

| Область | Типы |
| --- | --- |
| Auth и пользователь | `LoginRequest`, `RegisterRequest`, `AuthResponse`, `UserProfile` |
| Операции | `CreateTransactionRequest`, `Transaction`, `ImportedTransaction`, `ImportStatementResponse`, `UpdateCategoryRequest`, `UpdateCategoryResponse` |
| Аналитика | `DashboardResponse`, `DashboardSummary`, `BudgetAllocation`, `CategoryExpense`, `DiagnosticAlert` |
| Цели | `CreateGoalRequest`, `Goal`, `GoalDepositRequest`, `GoalDepositResponse` |
| Скидки | `Discount`, `RecommendedDiscountsResponse` |
| Справочник | `Category`, `BudgetGroup` — сверены с кодом `backend-week-1` |

## Особенности черновой спецификации

- Импорт возвращает дату в поле `date`, а ручное создание — в `transaction_date`.
  Для этих ответов оставлены разные типы. Унифицировать поля нужно после согласования с backend.
- В профиле ID называется `id`, в ответе авторизации — `user_id`.
- `accuracy_rate` и `confidence` — доли от 0 до 1. `percent`, `progress_percent`
  и `health_score` — значения от 0 до 100. Диапазоны пока не проверяются DTO.
- `DiagnosticAlert.type` и `GoalDepositRequest.source` оставлены строками:
  документ приводит примеры, но не закрытый список допустимых значений.
- В `BudgetGroup` учтено значение `OTHER` из фактического backend.
- В примере аналитики перечислены две категории на 30 900 ₽ при общем расходе 54 200 ₽.
  Адаптер графика добавляет остаток 23 300 ₽ как «Остальные категории», чтобы круг
  соответствовал полной сумме. Проценты категорий не используются как денежные суммы.
- Распределение 50/30/20 отображается как получено в примере API. Формула и база
  процентов требуют согласования с аналитиком: frontend не пересчитывает их от дохода.

## Подключение аналитики на следующем этапе

`src/entities/analytics/api.ts` содержит типизированный `getDashboard(signal?)`:
`GET /api/v1/analytics/dashboard?period=current_month`.
Он пока не вызывается страницами, потому что backend первой недели реализует
только health и categories. Перед заменой примера реальными данными нужно
подтвердить контракт, добавить загрузку/ошибку/пустое состояние и передать
`summary` и `diagnostics` в готовые виджеты, а `by_categories` — в `ExpenseChart`.
JWT подключать после согласования с разработчиком авторизации.
