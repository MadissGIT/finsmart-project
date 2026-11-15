from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

import jwt
import pytest
from argon2 import PasswordHasher
from pydantic import SecretStr

from src.core.settings import AuthSettings
from src.modules.auth.repositories import AuthRepository
from src.modules.auth.schemas import InvalidCredentialsError
from src.modules.auth.service import AuthService


@pytest.mark.parametrize(
    "problem",
    [
        "expired",
        "wrong-issuer",
        "wrong-audience",
        "wrong-key",
        "missing-claim",
        "bad-subject",
        "wrong-algorithm",
    ],
)
def test_rejects_invalid_access_tokens(problem: str) -> None:
    secret = "x" * 64
    settings = AuthSettings(jwt_secret=SecretStr(secret))
    service = AuthService(AsyncMock(spec=AuthRepository), settings, PasswordHasher(), "unused")
    now = datetime.now(UTC)
    payload = {
        "sub": str(uuid4()),
        "jti": str(uuid4()),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=10),
        "aud": "finsmart-api",
        "iss": "finsmart",
    }
    key = secret
    algorithm = "HS256"
    if problem == "expired":
        payload["exp"] = now - timedelta(seconds=1)
    elif problem == "wrong-issuer":
        payload["iss"] = "attacker"
    elif problem == "wrong-audience":
        payload["aud"] = "another-api"
    elif problem == "wrong-key":
        key = "y" * 64
    elif problem == "missing-claim":
        del payload["exp"]
    elif problem == "bad-subject":
        payload["sub"] = "not-a-uuid"
    elif problem == "wrong-algorithm":
        algorithm = "HS512"
    token = jwt.encode(payload, key, algorithm=algorithm)
    with pytest.raises(InvalidCredentialsError):
        service.decode_token(token, "access")
