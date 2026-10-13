# ФинСмарт Backend

Foundation первой недели: FastAPI, PostgreSQL, типизированные модели SQLAlchemy,
Alembic и категоризация операций по справочнику из проектной документации.

## Запуск

Нужны Python 3.13, uv и PostgreSQL 14+.

```bash
uv sync --locked
export FINSMART_DATABASE_URL='postgresql+asyncpg://USER:PASSWORD@HOST:5432/DATABASE'
uv run alembic upgrade head
uv run uvicorn src.app:app --reload
```

Параметры подключения задаются через окружение. Приложение не создаёт таблицы при
старте: сначала примените миграции к своей локальной БД. Для специальных символов
в пароле используйте URL encoding. Не сохраняйте реальные credentials в Git.

Документация: `http://localhost:8000/docs`, OpenAPI: `/openapi.json`.

- `GET /api/v1/health/live` — процесс работает, без обращения к БД.
- `GET /api/v1/health/ready` — соединение с БД и актуальная версия миграций; иначе 503.
- `GET /api/v1/categories` — системный справочник категорий.

Все три маршрута публичные и не возвращают пользовательские данные.
Регистрация, JWT, импорт, CRUD транзакций, аналитика, цели и скидки относятся
к следующим неделям; их маршруты пока не реализованы.

## Проверки

```bash
uv run ruff check src tests
uv run ruff format --check src tests
uv run mypy src
uv run pytest
```

Интеграционные тесты создают отдельную случайную PostgreSQL-схему, применяют в ней
миграции и проверяют данные и ограничения. Укажите URL **локальной тестовой** БД:

```bash
export FINSMART_TEST_DATABASE_URL='postgresql+asyncpg://USER:PASSWORD@HOST:5432/TEST_DATABASE'
uv run pytest
```

Без этой переменной PostgreSQL-тесты явно пропускаются. CI запускает их на
отдельном PostgreSQL service. Проверка соответствия моделей миграции:
`uv run alembic check` после применения миграций к локальной БД.

## Структура

- `src/core` — конфигурация окружения.
- `src/db` — async engine, сессии и модели данных.
- `src/migrations` — версия схемы и фиксированный seed первой недели.
- `src/modules/categorization` — сервис и репозиторий правил, без HTTP-зависимостей.
- `src/routes/categories` — DTO, DI, репозиторий и HTTP-маршруты справочника.
- `tests` — unit, API и PostgreSQL integration tests.

Решения по модели данных, порядку правил и границам недели:
[архитектура](docs/architecture.md).
