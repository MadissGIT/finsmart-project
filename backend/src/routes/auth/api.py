from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.db.models import User
from src.modules.auth.schemas import (
    InvalidCredentialsError,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserAlreadyExistsError,
    UserResponse,
)
from src.modules.auth.service import AuthService
from src.routes.auth.dependencies import get_auth_service, get_current_user

router = APIRouter(tags=["Auth"])


@router.post("/auth/register", response_model=TokenResponse, status_code=201)
async def register(
    request: RegisterRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenResponse:
    try:
        return await auth_service.register(request)
    except UserAlreadyExistsError as err:
        raise HTTPException(status.HTTP_409_CONFLICT, str(err)) from err


@router.post("/auth/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenResponse:
    try:
        return await auth_service.login(request)
    except InvalidCredentialsError as err:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, str(err), headers={"WWW-Authenticate": "Bearer"}
        ) from err


@router.post("/auth/refresh", response_model=TokenResponse)
async def refresh(
    request: RefreshRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenResponse:
    try:
        return await auth_service.refresh(request.refresh_token)
    except InvalidCredentialsError as err:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, str(err), headers={"WWW-Authenticate": "Bearer"}
        ) from err


@router.get("/users/me", response_model=UserResponse)
async def profile(user: Annotated[User, Depends(get_current_user)]) -> UserResponse:
    return UserResponse.model_validate(user)
