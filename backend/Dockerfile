FROM python:3.13-slim-bookworm AS base

COPY --from=ghcr.io/astral-sh/uv:0.6.5 /uv /usr/local/bin/uv

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --locked --no-dev --no-install-project
COPY alembic.ini ./
COPY src ./src

FROM base AS development
RUN uv sync --locked --no-install-project
COPY tests ./tests
COPY scripts ./scripts
CMD ["pytest"]

FROM base AS runtime
RUN useradd --create-home --uid 10001 finsmart
USER finsmart
EXPOSE 8000
CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8000"]
