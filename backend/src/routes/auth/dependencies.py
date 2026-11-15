import secrets
from functools import lru_cache
from typing import Annotated

from argon2 import PasswordHasher
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.settings import get_auth_settings
from src.db.database import get_async_session
from src.db.models import User
from src.modules.auth.repositories import AuthRepository
from src.modules.auth.schemas import InvalidCredentialsError
from src.modules.auth.service import AuthService

bearer = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def get_password_hasher() -> PasswordHasher:
    return PasswordHasher()


@lru_cache(maxsize=1)
def get_dummy_password_hash() -> str:
    return get_password_hasher().hash(secrets.token_urlsafe(32))


def get_auth_service(session: Annotated[AsyncSession, Depends(get_async_session)]) -> AuthService:
    return AuthService(
        auth_repository=AuthRepository(session),
        auth_settings=get_auth_settings(),
        password_hasher=get_password_hasher(),
        dummy_password_hash=get_dummy_password_hash(),
    )


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> User:
    if credentials is None or len(credentials.credentials) > 4096:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Требуется Bearer-токен",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return await auth_service.current_user(credentials.credentials)
    except InvalidCredentialsError as err:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, str(err), headers={"WWW-Authenticate": "Bearer"}
        ) from err
