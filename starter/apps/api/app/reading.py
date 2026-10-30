from datetime import datetime
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Request
from psycopg.errors import RaiseException
from pydantic import BaseModel, ConfigDict
from app.db import database
from app.permissions import current_user, fail, READ_ACL, acl_params, approval_scopes
from app.schemas import Message

router = APIRouter(prefix="/api/v1", tags=["Reading"])


class ReadingTask(BaseModel):
    id: UUID
    content_id: UUID
    title: str
    version_id: UUID
    version_number: int
    due_at: Optional[datetime]
    acknowledged_at: Optional[datetime]
    is_current: bool


class AcknowledgeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version_id: UUID


class AssignInput(AcknowledgeInput):
    user_id: UUID
    due_at: Optional[datetime] = None


@router.get("/my/reading", response_model=list[ReadingTask])
def my_reading(user=Depends(current_user), conn=Depends(database)):
    return conn.execute(
        """SELECT a.id,c.id AS content_id,c.title,v.id AS version_id,v.version_number,a.due_at,k.acknowledged_at,
        (c.current_published_version_id=v.id) AS is_current
        FROM reading_assignments a JOIN content_versions v ON v.id=a.version_id JOIN contents c ON c.id=v.content_id
        LEFT JOIN reading_acks k ON k.assignment_id=a.id WHERE a.user_id=%(user)s AND c.kind='DOCUMENT'
        AND v.status='APPROVED' AND """
        + READ_ACL
        + " ORDER BY a.created_at DESC,a.id",
        acl_params(user),
    ).fetchall()


@router.post("/reading-assignments/{id}/acknowledge", response_model=Message)
def acknowledge(id: UUID, data: AcknowledgeInput, request: Request, user=Depends(current_user), conn=Depends(database)):
    try:
        conn.execute("SELECT jkc_ack_reading(%s,%s,%s)", (id, data.version_id, request.state.request_id))
    except RaiseException as exc:
        conn.rollback()
        if exc.diag.message_primary == "JKC_NOT_FOUND":
            fail(404, "RESOURCE_NOT_FOUND", "Không tìm thấy nhiệm vụ đọc của bạn.")
        if exc.diag.message_primary == "JKC_CONFLICT":
            fail(409, "VERSION_CONFLICT", "Phiên bản đã thay đổi hoặc chưa có hiệu lực. Vui lòng đọc bản hiện hành được giao.")
        raise
    return {"message": "Đã xác nhận đọc đúng phiên bản được giao."}


@router.post("/documents/{id}/reading-assignments", response_model=Message, status_code=201)
def assign(id: UUID, data: AssignInput, request: Request, user=Depends(current_user), conn=Depends(database)):
    recipient = conn.execute("SELECT id,department_id FROM users WHERE id=%s AND is_active", (data.user_id,)).fetchone()
    if not recipient or recipient["department_id"] not in approval_scopes(user):
        fail(403, "FORBIDDEN", "Chỉ được giao đọc cho nhân viên trong phạm vi bộ phận.")
    row = conn.execute(
        "SELECT c.id,c.current_published_version_id FROM contents c WHERE c.id=%(id)s AND c.kind='DOCUMENT' AND " + READ_ACL,
        {**acl_params(user), "id": id},
    ).fetchone()
    if not row:
        fail(404, "RESOURCE_NOT_FOUND", "Không tìm thấy nội quy được quyền xem.")
    if row["current_published_version_id"] != data.version_id:
        fail(409, "VERSION_CONFLICT", "Chỉ giao phiên bản đã ban hành hiện hành.")
    allowed = conn.execute("SELECT jkc_acl_for(%s,%s) AS allowed", (id, data.user_id)).fetchone()["allowed"]
    if not allowed:
        fail(403, "FORBIDDEN", "Người nhận không được quyền đọc tài liệu này.")
    inserted = conn.execute(
        "INSERT INTO reading_assignments(user_id,version_id,due_at) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING RETURNING id",
        (data.user_id, data.version_id, data.due_at),
    ).fetchone()
    if inserted:
        conn.execute(
            "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,request_id) VALUES (%s,'READ_ASSIGNED','reading_assignment',%s,%s)",
            (user["id"], inserted["id"], request.state.request_id),
        )
    return {"message": "Đã giao đọc phiên bản nội quy. Quyền ban hành không thay đổi."}
