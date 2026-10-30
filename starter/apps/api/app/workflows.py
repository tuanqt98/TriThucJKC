"""Versioned authoring; scope and state transitions are enforced by DB functions."""

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Request
from psycopg.errors import RaiseException, ForeignKeyViolation
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field
from app.db import DB
from app.workspace_schemas import ContentWorkspace, VersionResult, PersonView, ReadingProgress
from app.permissions import current_user, fail

router = APIRouter(prefix="/api/v1/workspace", tags=["Authoring"])


class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CreateContent(StrictInput):
    kind: Literal["DOCUMENT", "ARTICLE"]
    title: str = Field(min_length=1, max_length=200)
    body: dict
    visibility: Literal["COMPANY", "DEPARTMENT"] = "DEPARTMENT"
    process_id: Optional[UUID] = None


class VersionInput(StrictInput):
    content_id: UUID
    version_id: UUID
    revision: int = Field(ge=1)


class SaveContent(VersionInput):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    body: dict
    process_id: Optional[UUID] = None


class ReviewContent(VersionInput):
    remark: str = Field(default="", max_length=4000)


def execute(conn, function, action, data, request):
    # Function names are constants supplied by route code, never user input.
    try:
        return conn.execute(
            f"SELECT {function}(%s,%s,%s) AS result", (action, Jsonb(data.model_dump(mode="json")), request.state.request_id)
        ).fetchone()["result"]
    except RaiseException as exc:
        code = exc.diag.message_primary
        conn.rollback()
        mapping = {
            "JKC_NOT_FOUND": (404, "RESOURCE_NOT_FOUND", "Không tìm thấy hoặc không có quyền truy cập."),
            "JKC_FORBIDDEN": (403, "FORBIDDEN", "Bạn không có quyền thực hiện trong phạm vi này."),
            "JKC_CONFLICT": (409, "VERSION_CONFLICT", "Phiên bản hoặc trạng thái đã thay đổi. Tải lại trước khi tiếp tục."),
            "JKC_INVALID": (422, "VALIDATION_ERROR", "Kiểm tra dữ liệu và lý do quyết định."),
        }
        if code in mapping:
            fail(*mapping[code])
        raise
    except ForeignKeyViolation:
        conn.rollback()
        fail(422, "VALIDATION_ERROR", "Đối tượng hoặc công đoạn không hợp lệ.")


@router.get("/contents", response_model=list[ContentWorkspace])
def contents(user=Depends(current_user), conn=DB):
    return conn.execute("SELECT jkc_content_workspace() AS items").fetchone()["items"]


@router.post("/contents", response_model=VersionResult, status_code=201)
def create(data: CreateContent, request: Request, user=Depends(current_user), conn=DB):
    return execute(conn, "jkc_content_workflow", "create", data, request)


@router.put("/contents", response_model=VersionResult)
def save(data: SaveContent, request: Request, user=Depends(current_user), conn=DB):
    return execute(conn, "jkc_content_workflow", "save", data, request)


@router.post("/contents/{action}", response_model=VersionResult)
def transition(
    action: Literal["fork", "submit", "approve", "request-changes", "reject"],
    data: ReviewContent,
    request: Request,
    user=Depends(current_user),
    conn=DB,
):
    return execute(conn, "jkc_content_workflow", action, data, request)


class AssignReading(StrictInput):
    content_id: UUID
    version_id: UUID
    user_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    due_at: Optional[datetime] = None


@router.get("/people", response_model=list[PersonView])
def people(user=Depends(current_user), conn=DB):
    return conn.execute("SELECT jkc_workspace_people() AS items").fetchone()["items"]


@router.get("/reading", response_model=list[ReadingProgress])
def reading(user=Depends(current_user), conn=DB):
    return conn.execute("SELECT jkc_reading_manage('list','{}',NULL) AS items").fetchone()["items"]


@router.post("/reading", response_model=dict, status_code=201)
def assign_reading(data: AssignReading, request: Request, user=Depends(current_user), conn=DB):
    if bool(data.user_id) == bool(data.department_id):
        fail(422, "VALIDATION_ERROR", "Chọn một nhân viên hoặc một bộ phận.")
    return execute(conn, "jkc_reading_manage", "assign", data, request)
