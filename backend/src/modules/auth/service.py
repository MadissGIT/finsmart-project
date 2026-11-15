import hashlib
import hmac
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from pydantic import BaseModel, ValidationError
from starlette.concurrency import run_in_threadpool

from src.core.settings import AuthSettings
from src.db.models import RefreshSession, User
from src.modules.auth.repositories import AuthRepository
from src.modules.auth.schemas import (
    InvalidCredentialsError,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserAlreadyExistsError,
)


class TokenIdentity(BaseModel):
    sub: UUID
    jti: UUID
    type: str


class AuthService:
    def __init__(
        self,
        auth_repository: AuthRepository,
        auth_settings: AuthSettings,
        password_hasher: PasswordHasher,
        dummy_password_hash: str,
    ) -> None:
        self._auth_repository = auth_repository
        self._auth_settings = auth_settings
        self._password_hasher = password_hasher
        self._dummy_password_hash = dummy_password_hash

    async def register(self, request: RegisterRequest) -> TokenResponse:
        email = str(request.email).lower()
        if await self._auth_repository.get_by_email(email) is not None:
            raise UserAlreadyExistsError("Email уже зарегистрирован")
        password_hash = await run_in_threadpool(
            self._password_hasher.hash, request.password.get_secret_value()
        )
        user = User(
            id=uuid4(),
            email=email,
            hashed_password=password_hash,
            full_name=request.full_name.strip(),
        )
        await self._auth_repository.add_user(user)
        return await self._issue_tokens(user, None)

    async def login(self, request: LoginRequest) -> TokenResponse:
        user = await self._auth_repository.get_by_email(str(request.email).lower())
        try:
            await run_in_threadpool(
                self._password_hasher.verify,
                user.hashed_password if user is not None else self._dummy_password_hash,
                request.password.get_secret_value(),
            )
        except (VerificationError, InvalidHashError) as err:
            raise InvalidCredentialsError("Неверный email или пароль") from err
        if user is None:
            raise InvalidCredentialsError("Неверный email или пароль")
        return await self._issue_tokens(user, None)

    def decode_token(self, token: str, token_type: str) -> TokenIdentity:
        try:
            payload = jwt.decode(
                token,
                self._auth_settings.jwt_secret.get_secret_value(),
                algorithms=["HS256"],
                audience="finsmart-api",
                issuer="finsmart",
                options={"require": ["exp", "iat", "sub", "jti", "type", "iss", "aud"]},
            )
            identity = TokenIdentity.model_validate(payload)
            if identity.type != token_type:
                raise InvalidCredentialsError("Неверный тип токена")
            return identity
        except (jwt.InvalidTokenError, ValidationError) as err:
            raise InvalidCredentialsError("Недействительный токен") from err

    async def current_user(self, token: str) -> User:
        identity = self.decode_token(token, "access")
        if (user := await self._auth_repository.get_user(identity.sub)) is None:
            raise InvalidCredentialsError("Пользователь не найден")
        return user

    async def refresh(self, token: str) -> TokenResponse:
        identity = self.decode_token(token, "refresh")
        session = await self._auth_repository.get_refresh_session(identity.jti)
        if (
            session is None
            or session.user_id != identity.sub
            or not hmac.compare_digest(
                session.token_hash,
                hashlib.sha256(token.encode()).hexdigest(),
            )
            or session.expires_at <= datetime.now(UTC)
        ):
            raise InvalidCredentialsError("Сессия истекла или токен уже использован")
        if (user := await self._auth_repository.get_user(identity.sub)) is None:
            raise InvalidCredentialsError("Пользователь не найден")
        return await self._issue_tokens(user, session)

    async def _issue_tokens(self, user: User, old_session: RefreshSession | None) -> TokenResponse:
        now = datetime.now(UTC)
        expires_at = now + timedelta(days=self._auth_settings.refresh_token_days)
        session_id = uuid4()
        common = {"sub": str(user.id), "iat": now, "iss": "finsmart", "aud": "finsmart-api"}
        secret = self._auth_settings.jwt_secret.get_secret_value()
        access = jwt.encode(
            {
                **common,
                "jti": str(uuid4()),
                "type": "access",
                "exp": now + timedelta(minutes=self._auth_settings.access_token_minutes),
            },
            secret,
            algorithm="HS256",
        )
        refresh = jwt.encode(
            {
                **common,
                "jti": str(session_id),
                "type": "refresh",
                "exp": expires_at,
            },
            secret,
            algorithm="HS256",
        )
        await self._auth_repository.save_session(
            RefreshSession(
                id=session_id,
                user_id=user.id,
                token_hash=hashlib.sha256(refresh.encode()).hexdigest(),
                expires_at=expires_at,
            ),
            old_session,
        )
        return TokenResponse(
            user_id=user.id, email=user.email, access_token=access, refresh_token=refresh
        )
