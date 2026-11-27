from datetime import datetime
from pathlib import PurePosixPath
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_async_session
from src.db.models import SupportTicket, User
from src.routes.auth.dependencies import get_current_user

router = APIRouter(prefix="/support", tags=["Support"])
MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024
ATTACHMENT_FORMATS = {
    "application/pdf": (b"%PDF-", {".pdf"}),
    "image/jpeg": (b"\xff\xd8\xff", {".jpg", ".jpeg"}),
    "image/png": (b"\x89PNG\r\n\x1a\n", {".png"}),
}


class TicketCreated(BaseModel):
    id: UUID
    status: Literal["open"] = "open"


@router.post("/tickets", status_code=201)
async def create_ticket(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
    request_id: Annotated[UUID, Form()],
    message: Annotated[str, Form(min_length=1, max_length=4000)],
    attachment: UploadFile | None = None,
) -> TicketCreated:
    message = message.strip()
    if not message:
        raise HTTPException(422, "Опишите вопрос или проблему")
    filename = None
    file_type = None
    content = None
    if attachment is not None:
        filename = PurePosixPath((attachment.filename or "").replace("\\", "/")).name
        file_type = attachment.content_type or ""
        format_spec = ATTACHMENT_FORMATS.get(file_type)
        if not format_spec or PurePosixPath(filename).suffix.lower() not in format_spec[1]:
            raise HTTPException(415, "Прикрепите файл PDF, PNG или JPEG")
        content = await attachment.read(MAX_ATTACHMENT_BYTES + 1)
        if len(content) > MAX_ATTACHMENT_BYTES:
            raise HTTPException(413, "Максимальный размер файла — 2 МБ")
        if not content.startswith(format_spec[0]) or len(filename) > 255 or "\x00" in filename:
            raise HTTPException(422, "Не удалось прочитать вложение")

    inserted = await session.scalar(
        insert(SupportTicket)
        .values(
            user_id=user.id,
            request_id=request_id,
            message=message,
            attachment_name=filename,
            attachment_type=file_type,
            attachment=content,
        )
        .on_conflict_do_nothing(index_elements=["user_id", "request_id"])
        .returning(SupportTicket.id)
    )
    if inserted is None:
        inserted = await session.scalar(
            select(SupportTicket.id).where(
                SupportTicket.user_id == user.id, SupportTicket.request_id == request_id
            )
        )
    await session.commit()
    assert inserted is not None
    return TicketCreated(id=inserted)


class PersonalTicket(BaseModel):
    id: UUID
    message: str
    status: Literal["open", "answered", "closed"]
    reply: str | None
    created_at: datetime


@router.get("/tickets")
async def own_tickets(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> list[PersonalTicket]:
    rows = await session.execute(
        select(
            SupportTicket.id,
            SupportTicket.message,
            SupportTicket.status,
            SupportTicket.reply,
            SupportTicket.created_at,
        )
        .where(SupportTicket.user_id == user.id)
        .order_by(SupportTicket.created_at.desc(), SupportTicket.id)
        .limit(30)
    )
    return [PersonalTicket.model_validate(row) for row in rows.mappings()]
