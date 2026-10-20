# ФинСмарт

Бэкенд, миграции, тесты и Python-конфигурация находятся в `backend/`.
Корень репозитория свободен для frontend и общей инфраструктуры.

## Запуск через Docker

Нужны Git и Docker с Compose v2. Из корня репозитория:

```bash
git clone --branch backend-week-1 https://github.com/MadissGIT/finsmart-project.git
cd finsmart-project
docker compose up --build --wait --wait-timeout 180
```

Compose поднимет PostgreSQL, применит миграции и запустит API.
Python, uv и PostgreSQL на компьютере не требуются.

- [Swagger UI](http://127.0.0.1:8000/docs).
- [Readiness](http://127.0.0.1:8000/api/v1/health/ready).
- [Категории](http://127.0.0.1:8000/api/v1/categories).

Локальный frontend `http://localhost:5173` разрешён в CORS по умолчанию.

Тесты:

```bash
docker compose run --build --rm test
```

[Подробная инструкция: настройки, остановка, логи и проверки](backend/README.md).
[Архитектура бэкенда](backend/docs/architecture.md).

## Короткие команды через just

Если установлен [just](https://just.systems/man/en/), из корня репозитория:

```bash
just up
just check
just logs
just down
```

`just check` запускает Ruff, проверку типов ty и тесты в Docker. Python на хосте
по-прежнему не нужен. Отдельно доступны `just lint`, `just typecheck`, `just test`
и `just migration-check`. Команда `just` выводит весь список.
