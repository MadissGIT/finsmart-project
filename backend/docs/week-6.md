# Защита и демонстрация

## Запуск на чистой машине

Нужен Docker с Compose v2. В примерах используется локальный контекст
`default`. Для Docker Desktop можно указать `desktop-linux`.

```sh
just demo-up
just demo-seed
```

Без just выполните из корня репозитория:

```sh
docker --context default compose -p finsmart-demo -f compose.yaml -f compose.demo.yaml up --build --wait --wait-timeout 180 api web
docker --context default compose -p finsmart-demo -f compose.yaml -f compose.demo.yaml run --build --rm test python -m scripts.seed_demo
```

Стенд использует отдельный проект Compose и отдельный том PostgreSQL.
Откройте [ФинСмарт](http://127.0.0.1:5173/auth). Команда seed создаёт
нового синтетического пользователя через API и выдаёт его локальные данные
для входа. Сохраните строку из терминала для демонстрации. Повторный запуск
создаёт другой аккаунт, поэтому предыдущие данные сохраняются.

1. Войдите и откройте дашборд за текущий месяц. Ожидаются четыре операции
   из синтетической выписки и расходы в трёх категориях.
2. В «Аналитике» задайте лимит 30 000 ₽ для супермаркетов. Расход 27 000 ₽
   покажет 90% и предупреждение о пороге 80%. Лимит 27 000 ₽ покажет 100%.
3. Скачайте CSV за выбранный период. В диалоге «Печать / PDF» выберите
   сохранение в PDF. В обоих форматах будут доход, расход, баланс и категории.
4. Откройте копилку «Подушка безопасности» и проверьте взнос 6 000 ₽.
5. Откройте скидки по категориям расходов. Демонстрационный каталог использует
   сроки из ТЗ, актуальность реальных промокодов проверяется у партнёров.

`just demo-down` останавливает стенд и сохраняет том базы.

## API

[Swagger UI](http://127.0.0.1:8000/docs) и
[OpenAPI JSON](http://127.0.0.1:8000/openapi.json).

| Путь от /api/v1 | Назначение |
| --- | --- |
| POST /auth/register, /auth/login, /auth/refresh | Регистрация, вход и обновление JWT |
| GET/PATCH /users/me | Профиль и изменение имени |
| POST /transactions/import-statement | Импорт выписки |
| GET/POST /transactions | Список с фильтрами и ручной ввод |
| GET/PATCH/DELETE /transactions/{id} | Просмотр, изменение и удаление |
| GET /analytics/budget, /analytics/dashboard | Бюджет, диагностика и Health Score |
| GET /analytics/expenses/trend | Дневная и недельная динамика |
| GET/POST /goals | Список и создание копилок |
| POST /goals/{id}/deposit, GET /goals/{id}/contributions | Взнос и история |
| GET /discounts, /discounts/recommended | Каталог и рекомендации |
| GET /articles, /achievements | Статьи и достижения |
| GET /limits | Лимиты текущего месяца, расход и статус порога |
| PUT/DELETE /limits/{category_id} | Установить лимит с телом `{"amount": "30000.00"}` либо удалить его |

Доступ к данным пользователя защищён Bearer-токеном. Лимит хранится для
категории и применяется к каждому календарному месяцу. Статус расхода
пересчитывается при чтении, поэтому исправление операции сразу меняет показания.

[Архитектура](architecture-current.md) · [Релизный Compose](week-5.md).
