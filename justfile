# Доступные команды.
default:
    @just --list

# Собрать и запустить API и PostgreSQL.
up:
    docker compose up --build --wait --wait-timeout 180

# Остановить контейнеры, сохранив данные БД.
down:
    docker compose down

# Смотреть логи API и PostgreSQL.
logs:
    docker compose logs --follow api db

# Запустить все тесты с PostgreSQL.
test:
    docker compose run --build --rm test

# Проверить линтер и форматирование.
lint:
    docker compose run --build --rm test ruff check src tests
    docker compose run --rm test ruff format --check src tests

# Проверить типы через ty.
typecheck:
    docker compose run --build --rm test ty check src

# Запустить все проверки.
check: lint typecheck test

# Проверить соответствие БД моделям после запуска API.
migration-check:
    docker compose exec api alembic check
