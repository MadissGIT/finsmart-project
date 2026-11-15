from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import RefreshSession, User
from src.modules.auth.schemas import UserAlreadyExistsError


class AuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_email(self, email: str) -> User | None:
        result = await self._session.scalars(select(User).where(User.email == email))
        return result.one_or_none()

    async def get_user(self, user_id: UUID) -> User | None:
        return await self._session.get(User, user_id)

    async def add_user(self, user: User) -> None:
        self._session.add(user)
        try:
            await self._session.flush()
        except IntegrityError as err:
            await self._session.rollback()
            raise UserAlreadyExistsError("Email уже зарегистрирован") from err

    async def get_refresh_session(self, session_id: UUID) -> RefreshSession | None:
        result = await self._session.scalars(
            select(RefreshSession)
            .where(
                RefreshSession.id == session_id,
            )
            .with_for_update()
        )
        return result.one_or_none()

    async def save_session(
        self, new_session: RefreshSession, old_session: RefreshSession | None
    ) -> None:
        if old_session is not None:
            await self._session.delete(old_session)
        self._session.add(new_session)
        await self._session.commit()
