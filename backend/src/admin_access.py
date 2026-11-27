"""Assign an application role to an existing account from a trusted server console."""

import argparse
import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_async_engine
from src.db.models import User


async def assign(email: str, role: str) -> None:
    engine = get_async_engine()
    try:
        async with AsyncSession(engine) as session:
            user = await session.scalar(
                select(User).where(User.email == email.strip().lower()).with_for_update()
            )
            if user is None:
                raise SystemExit("Аккаунт с таким email не найден")
            if user.blocked_at is not None and role != "user":
                raise SystemExit("Сначала разблокируйте учетную запись")
            if user.role != role:
                user.role = role
                user.session_version += 1
                await session.commit()
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("email")
    parser.add_argument("--role", choices=("user", "moderator", "admin"), required=True)
    args = parser.parse_args()
    asyncio.run(assign(args.email, args.role))


if __name__ == "__main__":
    main()
