# Контракты frontend и backend

Контракты сверены с backend в main после объединения PR 3.
Базовый адрес клиента — `/api/v1`. Денежные значения API сериализуются числами.
Типы сохраняют snake_case, чтобы соответствовать JSON сервера.

## Авторизация

- `POST /auth/register`: email, password, full_name. Пароль 10–128 символов,
  имя обязательно. Возвращает 201 и TokenResponse; существующий email — 409.
- `POST /auth/login`: email, password. Возвращает TokenResponse или 401.
- `POST /auth/refresh`: refresh_token. Токен используется однократно и заменяется новым.
- `GET /users/me`: Bearer access. Поля id, email, full_name, created_at.

TokenResponse содержит user_id, email, access_token, refresh_token, token_type=bearer.
Он не содержит full_name; профиль запрашивается отдельно.
Дата рождения и предпочтения анкеты не входят в RegisterRequest.
Токены и профиль проверяются перед использованием; локальные данные анкеты
не являются авторизацией. Старый демонстрационный ключ не даёт вход в API.

## Дашборд

`GET /analytics/budget?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD` требует Bearer.
Обе даты обязательны при явном фильтре и включены в результат; максимум 367 дней.
Frontend передаёт границы для любого пресета, не передаёт старый period=current_month.
Период в ответе сверяется с запрошенным.

Ответ включает:

- period.from и period.to;
- summary.total_income, total_expense, net_balance;
- budget_50_30_20.needs, wants, savings, каждый с amount, percent,
  target_percent, target_amount, deviation;
- by_categories с category_id, name, amount, percent;
- income_base, deficit_financing, unallocated_expense, budget_score.

net_balance — разница доходов и расходов за период, а не остаток банковского счёта.
Проценты могут быть больше 100 при перерасходе, баланс — отрицательным.
Frontend не пересчитывает серверную базу бюджета, не нормализует показанные доли
и не выдаёт budget_score за общий рейтинг финансового здоровья.
Для полос используется ограниченное визуальное заполнение; фактические значения
и отклонения остаются в подписях.

Основной endpoint `/analytics/budget` сохранён в ветке backend-week-3.
Новый `/analytics/dashboard` той ветки с diagnostics имеет другое ограничение
периода, 1–31 день, и не подменяет контракт budget. Его подключение — отдельная задача.

## Выписки

`POST /transactions/import-statement`: multipart/form-data с file и bank_hint
(auto, tinkoff, sber, vtb). Максимум 5 МБ, CSV/XLSX. Требует Bearer.
Frontend показывает total_parsed, imported_count, duplicates_skipped, skipped_rows.
recognition_rate не используется как измеренная точность категоризации.
Файл отправляется только после подтверждения импорта пользователем.

## Справочник и готовность

`GET /categories` и `GET /health/ready` публичные.
Категории проверяются по id, name и budget_group; OTHER разрешён.
Readiness 503 означает, что сервис пока не готов; HTML с 200 не считается успехом.

## Обработка состояния

401 защищённого запроса запускает единственное обновление refresh для всех
параллельных запросов. Повторный 401 завершает сессию. Смена аккаунта или выход
блокируют повтор старого запроса под новой сессией. Временная сетевая ошибка
refresh не удаляет действующую сессию сама по себе.

На смену периода создаётся новый запрос с AbortController. Отменённый ответ
не меняет интерфейс, суммы предыдущего диапазона скрываются сразу.
URL хранит period; для custom дополнительно from_date и to_date.
Пустой ответ, гость, загрузка и ошибка представлены отдельными состояниями.
