# ФинСмарт Backend

Foundation первой недели: FastAPI, PostgreSQL, типизированные модели SQLAlchemy,
Alembic и категоризация операций по справочнику из проектной документации.

## Локальное развёртывание

Инструкция для macOS, Linux или Windows с WSL/Bash. API запускается на хосте,
PostgreSQL 16 — в локальном Docker. Вместо Docker можно использовать уже
установленный PostgreSQL 14+: создайте пользователя и пустую БД, затем укажите
их адрес в `FINSMART_DATABASE_URL`.

### 1. Подготовьте инструменты

Установите Git, [uv](https://docs.astral.sh/uv/getting-started/installation/)
и Docker Desktop либо Docker Engine. Запустите локальный Docker.
Все команды Docker ниже явно используют локальный контекст `default`.
Если Docker Desktop использует `desktop-linux`, замените `default` на
`desktop-linux` в командах. Доступные контексты: `docker context ls`.

Проверьте инструменты и установите Python 3.13 через uv:

```bash
git --version
uv --version
docker --context default info
uv python install 3.13
```

### 2. Скачайте проект и установите зависимости

```bash
git clone --branch backend-week-1 https://github.com/MadissGIT/finsmart-project.git
cd finsmart-project
uv sync --locked
```

Если проект уже скачан, откройте терминал в его корне и выполните
`uv sync --locked`. uv создаст `.venv` и установит версии из `uv.lock`;
активировать окружение вручную не нужно.

### 3. Запустите PostgreSQL

Первый запуск:

```bash
docker --context default run --detach \
  --name finsmart-postgres \
  --publish 127.0.0.1:5433:5432 \
  --env POSTGRES_USER=finsmart \
  --env POSTGRES_PASSWORD=finsmart_local \
  --env POSTGRES_DB=finsmart \
  --volume finsmart-pgdata:/var/lib/postgresql/data \
  postgres:16
```

Здесь `finsmart_local` — пример пароля для локальной разработки. БД доступна
на `127.0.0.1:5433`; данные сохраняются в Docker volume `finsmart-pgdata`.

Дождитесь готовности БД:

```bash
docker --context default exec finsmart-postgres pg_isready -U finsmart -d finsmart
```

Ожидаемый результат — `accepting connections`. Если БД ещё запускается,
повторите проверку через несколько секунд. Логи:
`docker --context default logs finsmart-postgres`.

### 4. Настройте подключение и примените миграции

В корне проекта, в том же терминале, где будете запускать API:

```bash
export FINSMART_DATABASE_URL='postgresql+asyncpg://finsmart:finsmart_local@127.0.0.1:5433/finsmart'
uv run alembic upgrade head
uv run alembic check
```

Миграция создаст таблицы и загрузит 11 категорий и 38 правил категоризации.
Приложение не создаёт схему при старте. `alembic check` должен сообщить
`No new upgrade operations detected.`

Настройки читаются из окружения. `.env` автоматически не загружается.
При открытии нового терминала повторите `export FINSMART_DATABASE_URL=...`.
Если используете свою БД, замените URL; специальные символы в пароле должны
быть URL-encoded.

### 5. Запустите API

```bash
uv run uvicorn src.app:app --reload --host 127.0.0.1 --port 8000
```

Откройте [Swagger UI](http://127.0.0.1:8000/docs) для выполнения запросов.
[OpenAPI JSON](http://127.0.0.1:8000/openapi.json) содержит контракты маршрутов.

В другом терминале проверьте запуск:

```bash
curl --fail http://127.0.0.1:8000/api/v1/health/live
curl --fail http://127.0.0.1:8000/api/v1/health/ready
curl --fail http://127.0.0.1:8000/api/v1/categories
```

Обе health-проверки должны вернуть `{"status":"ok"}`, справочник — массив
из 11 категорий. Liveness проверяет процесс, readiness — доступ к БД и версию
миграций. Все три маршрута публичные и не возвращают пользовательские данные.
Регистрация, JWT, импорт, CRUD транзакций, аналитика, цели и скидки относятся
к следующим неделям; их маршруты пока не реализованы.

Если подключаете локальный frontend, перед запуском API задайте его origin:

```bash
export FINSMART_CORS_ORIGINS='["http://localhost:5173"]'
```

По умолчанию CORS закрыт. Origin должен точно совпадать с адресом frontend,
включая схему, хост и порт.

### Остановка и повторный запуск

Остановите API сочетанием `Ctrl+C`, затем остановите БД:

```bash
docker --context default stop finsmart-postgres
```

Для следующего запуска используйте существующий контейнер:

```bash
docker --context default start finsmart-postgres
export FINSMART_DATABASE_URL='postgresql+asyncpg://finsmart:finsmart_local@127.0.0.1:5433/finsmart'
uv run alembic upgrade head
uv run uvicorn src.app:app --reload --host 127.0.0.1 --port 8000
```

Повторять `docker run` не нужно; данные сохраняются между запусками.

### Частые проблемы

- Docker недоступен: запустите Docker Desktop/Engine и проверьте
  `docker --context default info`.
- Имя `finsmart-postgres` уже занято: используйте команду запуска
  `docker --context default start finsmart-postgres` для ранее созданного контейнера.
- Порт `5433` занят: выберите другой порт слева в `--publish`, затем измените
  порт в `FINSMART_DATABASE_URL`.
- Порт `8000` занят: запустите Uvicorn с `--port 8001` и используйте этот порт
  в адресе Swagger и командах curl.
- Readiness возвращает 503: проверьте готовность PostgreSQL, переменную
  `FINSMART_DATABASE_URL` и выполните `uv run alembic upgrade head`.
- Ошибка авторизации в БД: проверьте пользователя и пароль. Переменные
  `POSTGRES_*` при первом запуске инициализируют пустой volume; их изменение
  не меняет пароль в уже существующей БД.

## Проверки

```bash
uv run ruff check src tests
uv run ruff format --check src tests
uv run mypy src
uv run pytest
```

Интеграционные тесты создают отдельную случайную PostgreSQL-схему, применяют в ней
миграции и проверяют данные и ограничения. Для контейнера из инструкции выше
однократно создайте отдельную тестовую БД:

```bash
docker --context default exec finsmart-postgres createdb -U finsmart finsmart_test
```

Задайте подключение и запустите все тесты:

```bash
export FINSMART_TEST_DATABASE_URL='postgresql+asyncpg://finsmart:finsmart_local@127.0.0.1:5433/finsmart_test'
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
