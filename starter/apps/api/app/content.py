import uuid
from fastapi import APIRouter, Depends, Query, Request
from psycopg.types.json import Jsonb
from app.db import database
from app.permissions import current_user, READ_ACL, acl_params, approval_scopes, fail, require_role
from app.schemas import (
    ContentPage,
    ContentView,
    DashboardView,
    LearningView,
    ApprovalView,
    OdooStatus,
    ArticleInput,
    DraftView,
    Message,
    DecisionInput,
    ProcessView,
)
from app.integrations.odoo import NoOpOdooAdapter

router = APIRouter(prefix="/api/v1", tags=["Knowledge"])
SELECT = """SELECT c.id,c.code,c.kind,coalesce(v.title,c.title) AS title,c.owner_department_id,d.name AS department_name,
    v.id AS version_id,v.version_number,v.body,v.status,v.created_at
    FROM contents c JOIN content_versions v ON v.id=c.current_published_version_id
    LEFT JOIN departments d ON d.id=c.owner_department_id"""
BASE = f"c.archived_at IS NULL AND v.status='APPROVED' AND {READ_ACL}"


def listing(conn, user, kind=None, q="", page=1, size=12, process_id=None):
    params = {
        **acl_params(user),
        "kind": kind,
        "process": process_id,
        "query": "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%",
        "limit": size,
        "offset": (page - 1) * size,
    }
    where = BASE + " AND (%(kind)s::text IS NULL OR c.kind=%(kind)s) AND coalesce(v.title,c.title) ILIKE %(query)s"
    where += " AND (%(process)s::uuid IS NULL OR v.process_id=%(process)s OR (v.process_id IS NULL AND EXISTS (SELECT 1 FROM content_processes cp WHERE cp.content_id=c.id AND cp.process_id=%(process)s)))"
    items = conn.execute(
        SELECT + " WHERE " + where + " ORDER BY v.created_at DESC,c.id LIMIT %(limit)s OFFSET %(offset)s", params
    ).fetchall()
    total = conn.execute(
        "SELECT count(*) AS n FROM contents c JOIN content_versions v ON v.id=c.current_published_version_id WHERE " + where, params
    ).fetchone()["n"]
    return {"items": items, "total": total, "page": page, "pageSize": size}


@router.get("/documents", response_model=ContentPage)
def documents(
    q: str = Query("", max_length=200),
    page: int = Query(1, ge=1),
    pageSize: int = Query(12, ge=1, le=100),
    processId: uuid.UUID = Query(None),
    user=Depends(current_user),
    conn=Depends(database),
):
    return listing(conn, user, "DOCUMENT", q, page, pageSize, processId)


@router.get("/articles", response_model=ContentPage)
def articles(
    q: str = Query("", max_length=200),
    page: int = Query(1, ge=1),
    pageSize: int = Query(12, ge=1, le=100),
    processId: uuid.UUID = Query(None),
    user=Depends(current_user),
    conn=Depends(database),
):
    return listing(conn, user, "ARTICLE", q, page, pageSize, processId)


@router.get("/incidents", response_model=ContentPage)
def incidents(
    q: str = Query("", max_length=200),
    page: int = Query(1, ge=1),
    pageSize: int = Query(12, ge=1, le=100),
    processId: uuid.UUID = Query(None),
    user=Depends(current_user),
    conn=Depends(database),
):
    return listing(conn, user, "INCIDENT_GUIDE", q, page, pageSize, processId)


@router.get("/search", response_model=ContentPage)
def search(
    q: str = Query("", max_length=200),
    page: int = Query(1, ge=1),
    pageSize: int = Query(12, ge=1, le=100),
    processId: uuid.UUID = Query(None),
    user=Depends(current_user),
    conn=Depends(database),
):
    return listing(conn, user, None, q, page, pageSize, processId)


def detail(conn, user, id, kind):
    row = conn.execute(
        SELECT + " WHERE " + BASE + " AND c.id=%(id)s AND c.kind=%(kind)s", {**acl_params(user), "id": id, "kind": kind}
    ).fetchone()
    if not row:
        fail(404, "RESOURCE_NOT_FOUND", "Nội dung không tồn tại hoặc bạn không có quyền xem.")
    return row


@router.get("/documents/{id}", response_model=ContentView)
def document(id: uuid.UUID, user=Depends(current_user), conn=Depends(database)):
    return detail(conn, user, id, "DOCUMENT")


@router.get("/articles/{id}", response_model=ContentView)
def article(id: uuid.UUID, user=Depends(current_user), conn=Depends(database)):
    return detail(conn, user, id, "ARTICLE")


@router.get("/incidents/{id}", response_model=ContentView)
def incident(id: uuid.UUID, user=Depends(current_user), conn=Depends(database)):
    # Sprint 0: approved incident knowledge; occurrence/verification workflow remains backlog.
    return detail(conn, user, id, "INCIDENT_GUIDE")


@router.get("/my/learning", response_model=list[LearningView], tags=["Learning"])
def learning(user=Depends(current_user), conn=Depends(database)):
    return conn.execute(
        """SELECT a.id,c.title,v.version_number,a.due_at,a.completed_at,jkc_training_status(a.id) AS status,
        (SELECT count(*) FROM lesson_progress p WHERE p.assignment_id=a.id) AS completed_lessons,
        (SELECT count(*) FROM lessons l WHERE l.course_version_id=v.id) AS total_lessons
        FROM course_assignments a JOIN course_versions v ON v.id=a.course_version_id
        JOIN courses c ON c.id=v.course_id WHERE a.user_id=%s AND v.status='APPROVED' ORDER BY a.due_at NULLS LAST,a.id""",
        (user["id"],),
    ).fetchall()


@router.get("/approvals", response_model=list[ApprovalView], tags=["Approvals"])
def approvals(user=Depends(current_user), conn=Depends(database)):
    scopes = approval_scopes(user)
    if not scopes:
        fail(403, "FORBIDDEN", "Chỉ trưởng bộ phận được phân công có quyền duyệt.")
    return conn.execute(
        """SELECT a.id,coalesce(v.title,c.title) AS title,u.full_name AS author,v.version_number,a.status,a.requested_at,v.body
        FROM approvals a JOIN content_versions v ON v.id=a.version_id JOIN contents c ON c.id=v.content_id
        JOIN users u ON u.id=c.creator_id WHERE a.assigned_department_id=ANY(%(scopes)s::uuid[])
        AND (a.assigned_user_id IS NULL OR a.assigned_user_id=%(user)s)
        AND c.creator_id<>%(user)s AND c.kind='ARTICLE' AND """
        + READ_ACL
        + """ ORDER BY a.requested_at DESC""",
        {**acl_params(user), "scopes": scopes},
    ).fetchall()


@router.get("/processes", response_model=list[ProcessView], tags=["Dashboard"])
def processes(user=Depends(current_user), conn=Depends(database)):
    return conn.execute(
        "SELECT id,code,name FROM production_processes ORDER BY CASE code WHEN 'OFFSET' THEN 1 WHEN 'FINISHING' THEN 2 WHEN 'PREPRESS' THEN 3 WHEN 'DIGITAL' THEN 4 ELSE 5 END"
    ).fetchall()


@router.get("/dashboard", response_model=DashboardView, tags=["Dashboard"])
def dashboard(user=Depends(current_user), conn=Depends(database)):
    return {
        "documents": listing(conn, user, "DOCUMENT")["total"],
        "articles": listing(conn, user, "ARTICLE")["total"],
        "incidents": listing(conn, user, "INCIDENT_GUIDE")["total"],
        "learning": len(learning(user, conn)),
        "pending_approvals": sum(a["status"] == "PENDING" for a in approvals(user, conn)) if approval_scopes(user) else 0,
        "processes": processes(user, conn),
        "featured": listing(conn, user, "ARTICLE", size=3)["items"],
    }


@router.get("/admin/integrations/odoo/status", response_model=OdooStatus, tags=["Integration"])
def odoo(user=Depends(current_user)):
    require_role(user, "TECH_ADMIN")
    return NoOpOdooAdapter().probe()


@router.post("/articles", response_model=DraftView, status_code=201)
def draft(data: ArticleInput, request: Request, user=Depends(current_user), conn=Depends(database)):
    if not user["department_id"]:
        fail(403, "FORBIDDEN", "Tài khoản chưa được gán bộ phận.")
    content_id, version_id = uuid.uuid4(), uuid.uuid4()
    conn.execute(
        "INSERT INTO contents(id,code,kind,title,creator_id,owner_department_id) VALUES (%s,%s,'ARTICLE',%s,%s,%s)",
        (content_id, "KB-" + str(content_id), data.title, user["id"], user["department_id"]),
    )
    conn.execute(
        "INSERT INTO content_versions(id,content_id,version_number,body,created_by) VALUES (%s,%s,1,%s,%s)",
        (version_id, content_id, Jsonb(data.body), user["id"]),
    )
    conn.execute(
        "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,request_id) VALUES (%s,'DRAFT_CREATED','content',%s,%s)",
        (user["id"], content_id, request.state.request_id),
    )
    return {"id": content_id, "version_id": version_id, "status": "DRAFT"}


@router.post("/articles/{id}/submit", response_model=Message)
def submit(id: uuid.UUID, request: Request, user=Depends(current_user), conn=Depends(database)):
    row = conn.execute(
        "SELECT c.*,v.id AS vid,v.status FROM contents c JOIN content_versions v ON v.content_id=c.id WHERE c.id=%s AND c.kind='ARTICLE' AND c.creator_id=%s ORDER BY v.version_number DESC LIMIT 1 FOR UPDATE OF c,v",
        (id, user["id"]),
    ).fetchone()
    if not row:
        fail(404, "RESOURCE_NOT_FOUND", "Không tìm thấy bản nháp của bạn.")
    if row["status"] != "DRAFT":
        fail(409, "VERSION_CONFLICT", "Bài viết đã được gửi hoặc không còn là bản nháp.")
    conn.execute("UPDATE content_versions SET status='PENDING' WHERE id=%s", (row["vid"],))
    conn.execute("INSERT INTO approvals(version_id,assigned_department_id) VALUES (%s,%s)", (row["vid"], row["owner_department_id"]))
    conn.execute(
        "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,request_id) VALUES (%s,'SUBMITTED','content',%s,%s)",
        (user["id"], id, request.state.request_id),
    )
    return {"message": "Đã gửi trưởng bộ phận phê duyệt."}


@router.post("/approvals/{id}/approve", response_model=Message, tags=["Approvals"])
def approve(id: uuid.UUID, data: DecisionInput, request: Request, user=Depends(current_user), conn=Depends(database)):
    row = conn.execute(
        """SELECT a.*,v.version_number,v.status AS version_status,c.id AS content_id,c.creator_id,c.kind
        FROM approvals a JOIN content_versions v ON v.id=a.version_id JOIN contents c ON c.id=v.content_id
        WHERE a.id=%(id)s AND """
        + READ_ACL
        + " FOR UPDATE OF a,v,c",
        {**acl_params(user), "id": id},
    ).fetchone()
    if not row:
        fail(404, "RESOURCE_NOT_FOUND", "Yêu cầu không tồn tại hoặc bạn không có quyền xem.")
    if (
        row["assigned_department_id"] not in approval_scopes(user)
        or row["creator_id"] == user["id"]
        or (row["assigned_user_id"] and row["assigned_user_id"] != user["id"])
        or row["kind"] != "ARTICLE"
    ):
        fail(403, "FORBIDDEN", "Không được tự duyệt hoặc duyệt ngoài phạm vi bộ phận.")
    if row["status"] != "PENDING" or row["version_status"] != "PENDING" or row["version_number"] != data.expectedVersion:
        fail(409, "VERSION_CONFLICT", "Phiên bản hoặc trạng thái đã thay đổi.")
    conn.execute(
        "UPDATE content_versions SET status='APPROVED',approved_by=%s,approved_at=now() WHERE id=%s", (user["id"], row["version_id"])
    )
    conn.execute("UPDATE contents SET current_published_version_id=%s WHERE id=%s", (row["version_id"], row["content_id"]))
    conn.execute(
        "UPDATE approvals SET status='APPROVED',decided_at=now(),decided_by=%s,remark=%s WHERE id=%s", (user["id"], data.remark, id)
    )
    conn.execute(
        "INSERT INTO approval_events(approval_id,actor_id,decision,remark) VALUES (%s,%s,'APPROVE',%s)", (id, user["id"], data.remark)
    )
    conn.execute(
        "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,request_id) VALUES (%s,'APPROVED','content',%s,%s)",
        (user["id"], row["content_id"], request.state.request_id),
    )
    return {"message": "Đã phê duyệt phiên bản bài viết."}
