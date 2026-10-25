# ФинСмарт Backend

FastAPI, PostgreSQL, JWT-авторизация, импорт банковских выписок CSV/XLSX,
категоризация и аналитика бюджета 50/30/20.

## Локальный запуск через Docker

Нужны только Git и Docker Desktop либо Docker Engine с Compose v2.
Python, uv и PostgreSQL на компьютер устанавливать не нужно.

Запустите Docker и убедитесь, что выбран локальный контекст:

```bash
docker context ls
docker info
docker compose version
```

Если выбран удалённый контекст, переключитесь на локальный:
`docker context use desktop-linux` для Docker Desktop или
`docker context use default` для локального Docker Engine. Выберите имя,
которое присутствует в `docker context ls`.

### Первый запуск

```bash
git clone https://github.com/MadissGIT/finsmart-project.git
cd finsmart-project
docker compose up --build --wait --wait-timeout 180
```

Если проект уже скачан, выполните последнюю команду в его корне.
Она соберёт образ API из `backend/` с зависимостями из `backend/uv.lock`, запустит PostgreSQL 16,
дождётся готовности БД, применит миграции и запустит API. Команда завершится
после успешной проверки readiness; контейнеры продолжат работать в фоне.
Миграция загрузит 11 категорий и 47 правил категоризации.

- [Swagger UI](http://127.0.0.1:8000/docs) — документация и выполнение запросов.
- [Readiness](http://127.0.0.1:8000/api/v1/health/ready) — ожидается `{"status":"ok"}`.
- [Категории](http://127.0.0.1:8000/api/v1/categories) — массив из 11 категорий.
- [OpenAPI JSON](http://127.0.0.1:8000/openapi.json) — контракты API.

PostgreSQL доступен только контейнерам, его порт не публикуется на хост.
Локальные реквизиты заданы в `compose.yaml`. API опубликован на `127.0.0.1:8000`.
Данные сохраняются в Docker volume `postgres_data` между перезапусками.

Health и справочник категорий доступны публично. Импорт, операции, профиль и
бюджет требуют Bearer-токен: зарегистрируйтесь через `/api/v1/auth/register`
и вставьте полученный `access_token` в кнопку Authorize в Swagger.
[Подробности второй недели](docs/week-2.md).

Для сохранения сессий между перезапусками передайте `FINSMART_JWT_SECRET`
через окружение перед запуском Compose: случайную строку длиной от 32 символов.
Без этой переменной ключ генерируется на процесс, после перезапуска API
потребуется повторный вход. Для нескольких процессов нужен общий постоянный ключ.

### Логи, остановка и повторный запуск

```bash
docker compose ps
docker compose logs --follow api db
```

`Ctrl+C` завершает просмотр логов, контейнеры продолжают работать.

Остановить и удалить контейнеры, сохранив данные БД:

```bash
docker compose down
```

Повторно запустить или пересобрать после изменения кода:

```bash
docker compose up --build --wait --wait-timeout 180
```

При каждом запуске API применяет новые миграции перед стартом сервера.

### Проверки в Docker

При установленном `just` все проверки запускаются из корня: `just check`.
Отдельно: `just lint`, `just typecheck`, `just test`, `just migration-check`.
Эквивалентные команды Docker:

```bash
docker compose run --build --rm test
docker compose run --rm test ruff check src tests scripts
docker compose run --rm test ruff format --check src tests scripts
docker compose run --rm test ty check src scripts
docker compose exec api alembic check
```

Сервис `test` собирает отдельный образ с dev-зависимостями. В обычном образе API
их нет. Тесты запускаются с PostgreSQL: каждый интеграционный тест создаёт
временную схему в транзакции и откатывает её после завершения, не меняя
пользовательские данные. По умолчанию `docker compose up` сервис `test` не запускает.

CI проверяет код, сборку Docker-образов, полный запуск Compose, API,
миграции, тесты и перезапуск API с существующей БД.

### Настройки и частые проблемы

Если порт 8000 занят, задайте другой внешний порт перед запуском (Bash/zsh):

```bash
FINSMART_API_PORT=8001 docker compose up --build --wait --wait-timeout 180
```

Тогда Swagger будет доступен по адресу `http://127.0.0.1:8001/docs`.
Для последующих команд Compose используйте то же значение переменной.

Если подключаете локальный frontend, укажите его origin (Bash/zsh):

```bash
FINSMART_CORS_ORIGINS='["http://localhost:5173"]' docker compose up --build --wait --wait-timeout 180
```

По умолчанию разрешён frontend `http://localhost:5173` и все HTTP-методы.
Для другого frontend задайте его origin указанной переменной. Схема, хост и порт
должны совпадать; список из окружения заменяет значение по умолчанию.

Если контейнер не запустился или readiness возвращает 503, выполните
`docker compose ps --all` и `docker compose logs api db`. API не запустится,
если не удалось применить миграции. Проверьте, что Docker работает и имеет
доступ к Docker Hub и GHCR для загрузки образов.

Используются стандартные механизмы
[Docker Compose](https://docs.docker.com/compose/how-tos/startup-order/) и
[установки зависимостей uv в Docker](https://docs.astral.sh/uv/guides/integration/docker/).

## Структура backend/

Compose запускается из корня репозитория; пути ниже указаны относительно `backend/`.

- `src/core` — конфигурация окружения.
- `src/db` — async engine, сессии и модели данных.
- `src/migrations` — версия схемы и фиксированный seed первой недели.
- `src/modules/categorization` — сервис и репозиторий правил, без HTTP-зависимостей.
- `src/modules/statements` — CSV/XLSX, нормализация, импорт и исправление операций.
- `src/modules/auth` — пароли, JWT и refresh-сессии.
- `src/modules/analytics` — агрегаты и бюджет 50/30/20.
- `src/routes` — DTO, DI и тонкие HTTP-маршруты.
- Доступ к данным: router → service → repository.
- `scripts` — smoke-проверка API и оценка точности по размеченным выпискам.
- `tests` — unit, API и PostgreSQL integration tests.

Решения по модели данных, порядку правил и границам недели:
[архитектура](docs/architecture.md).
