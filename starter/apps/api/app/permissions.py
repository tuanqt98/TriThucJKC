import hmac
from fastapi import HTTPException, Request
from app.db import DB
from app.security import csrf_for, digest


def fail(status, code, message):
    raise HTTPException(status_code=status, detail={"code": code, "message": message})


def current_user(request: Request, conn=DB):
    token = request.cookies.get("jkc_session", "")
    row = conn.execute(
        """SELECT u.id,u.username,u.full_name,u.department_id,u.must_change_password
        FROM sessions s JOIN users u ON u.id=s.user_id
        WHERE s.session_hash=%s AND s.expires_at>now() AND s.revoked_at IS NULL AND u.is_active""",
        (digest(token),),
    ).fetchone()
    if not row:
        fail(401, "UNAUTHENTICATED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.")
    conn.execute("SELECT set_config('jkc.user_id',%s,true)", (str(row["id"]),))
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        if not hmac.compare_digest(request.headers.get("x-csrf-token", ""), csrf_for(token)):
            fail(403, "FORBIDDEN", "Mã CSRF không hợp lệ.")
    if row["must_change_password"] and request.url.path not in ("/api/v1/auth/me", "/api/v1/auth/password", "/api/v1/auth/logout"):
        fail(403, "PASSWORD_CHANGE_REQUIRED", "Vui lòng đổi mật khẩu trước khi tiếp tục.")
    row["roles"] = conn.execute(
        "SELECT r.code,ur.scope_department_id FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=%s", (row["id"],)
    ).fetchall()
    return row


def require_role(user, code):
    if not any(r["code"] == code for r in user["roles"]):
        fail(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.")


def approval_scopes(user):
    return [r["scope_department_id"] for r in user["roles"] if r["code"] == "DEPARTMENT_HEAD" and r["scope_department_id"]]


# Every content/search/count/detail query uses this predicate. Technical admins have no bypass.
READ_ACL = """(c.visibility='COMPANY'
 OR (c.visibility='DEPARTMENT' AND c.owner_department_id=%(department)s)
 OR (c.visibility='CROSS_DEPARTMENT' AND EXISTS (SELECT 1 FROM content_acl acl WHERE acl.content_id=c.id AND acl.department_id=%(department)s))
 OR (c.visibility='RESTRICTED' AND c.creator_id=%(user)s))"""


def acl_params(user):
    return {"department": user["department_id"], "user": user["id"]}
