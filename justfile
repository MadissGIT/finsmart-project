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
    docker compose run --build --rm test ruff check src tests scripts
    docker compose run --rm test ruff format --check src tests scripts

# Проверить типы через ty.
typecheck:
    docker compose run --build --rm test ty check src scripts

# Запустить все проверки.
check: lint typecheck test

# Проверить соответствие БД моделям после запуска API.
migration-check:
    docker compose exec api alembic check

# Запустить веб-интерфейс, API и отдельную базу для демонстрации.
demo-up context="default":
    docker --context {{context}} compose -p finsmart-demo -f compose.yaml -f compose.demo.yaml up --build --wait --wait-timeout 180 api web

# Создать новую учебную учётную запись с синтетическими данными.
demo-seed context="default":
    docker --context {{context}} compose -p finsmart-demo -f compose.yaml -f compose.demo.yaml run --build --rm test python -m scripts.seed_demo

# Остановить демонстрационный стенд, сохранив его данные.
demo-down context="default":
    docker --context {{context}} compose -p finsmart-demo -f compose.yaml -f compose.demo.yaml down
