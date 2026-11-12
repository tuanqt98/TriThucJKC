import secrets
from datetime import timedelta
from fastapi import APIRouter, Depends, Request, Response
from psycopg.errors import UniqueViolation
from app.config import settings
from app.db import DB
from app.schemas import LoginInput, PasswordInput, ResetInput, UserInput, UserView, Message
from app.security import DUMMY_HASH, csrf_for, digest, hasher, verify
from app.permissions import current_user, fail, require_role

router = APIRouter(prefix="/api/v1", tags=["Identity"])


def user_view(user, token):
    return {**user, "csrf_token": csrf_for(token)}


def audit(conn, request, actor, action, entity=None):
    conn.execute(
        "INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, request_id) VALUES (%s,%s,%s,%s,%s)",
        (actor, action, "user", entity or actor, request.state.request_id),
    )


@router.post("/auth/login", response_model=UserView)
def login(data: LoginInput, request: Request, response: Response, conn=DB):
    username = data.username.strip().lower()
    keys = sorted([(digest("user:" + username), 5), (digest("ip:" + request.client.host), 20)])
    for key, limit in keys:
        conn.execute("INSERT INTO login_limits(key) VALUES (%s) ON CONFLICT DO NOTHING", (key,))
        row = conn.execute("SELECT * FROM login_limits WHERE key=%s FOR UPDATE", (key,)).fetchone()
        expired = conn.execute("SELECT %s < now() - interval '15 minutes' AS expired", (row["window_start"],)).fetchone()["expired"]
        if expired:
            conn.execute("UPDATE login_limits SET failures=0, window_start=now() WHERE key=%s", (key,))
        elif row["failures"] >= limit:
            fail(429, "RATE_LIMITED", "Quá nhiều lần đăng nhập. Vui lòng thử lại sau 15 phút.")
    user = conn.execute("SELECT * FROM users WHERE username=%s", (username,)).fetchone()
    valid = verify(user["password_hash"] if user else DUMMY_HASH, data.password)
    if not valid or not user or not user["is_active"]:
        for key, _ in keys:
            conn.execute("UPDATE login_limits SET failures=failures+1 WHERE key=%s", (key,))
        conn.commit()
        fail(401, "UNAUTHENTICATED", "Tài khoản hoặc mật khẩu không đúng.")
    conn.execute("SELECT set_config('jkc.user_id',%s,true)", (str(user["id"]),))
    conn.execute("UPDATE login_limits SET failures=0 WHERE key=%s", (digest("user:" + username),))
    token = secrets.token_urlsafe(48)
    conn.execute(
        "INSERT INTO sessions(user_id,session_hash,expires_at) VALUES (%s,%s,now()+%s)",
        (user["id"], digest(token), timedelta(hours=settings().session_hours)),
    )
    audit(conn, request, user["id"], "LOGIN")
    user["roles"] = conn.execute(
        "SELECT r.code,ur.scope_department_id FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE user_id=%s", (user["id"],)
    ).fetchall()
    response.set_cookie(
        "jkc_session",
        token,
        max_age=settings().session_hours * 3600,
        httponly=True,
        secure=settings().cookie_secure,
        samesite="lax",
        path="/api",
    )
    return user_view(user, token)


@router.get("/auth/me", response_model=UserView)
def me(request: Request, user=Depends(current_user)):
    return user_view(user, request.cookies["jkc_session"])


@router.post("/auth/logout", response_model=Message)
def logout(request: Request, response: Response, user=Depends(current_user), conn=DB):
    conn.execute("UPDATE sessions SET revoked_at=now() WHERE session_hash=%s", (digest(request.cookies["jkc_session"]),))
    audit(conn, request, user["id"], "LOGOUT")
    response.delete_cookie("jkc_session", path="/api", secure=settings().cookie_secure, httponly=True, samesite="lax")
    return {"message": "Đã đăng xuất."}


@router.post("/auth/password", response_model=Message)
def password(data: PasswordInput, request: Request, response: Response, user=Depends(current_user), conn=DB):
    row = conn.execute("SELECT password_hash FROM users WHERE id=%s FOR UPDATE", (user["id"],)).fetchone()
    if not verify(row["password_hash"], data.current_password):
        fail(400, "VALIDATION_ERROR", "Mật khẩu hiện tại không đúng.")
    conn.execute(
        "UPDATE users SET password_hash=%s,must_change_password=false,token_version=token_version+1 WHERE id=%s",
        (hasher.hash(data.new_password), user["id"]),
    )
    conn.execute("UPDATE sessions SET revoked_at=now() WHERE user_id=%s AND revoked_at IS NULL", (user["id"],))
    conn.execute("UPDATE password_resets SET used_at=now() WHERE user_id=%s AND used_at IS NULL", (user["id"],))
    audit(conn, request, user["id"], "PASSWORD_CHANGED")
    response.delete_cookie("jkc_session", path="/api")
    return {"message": "Đã đổi mật khẩu và thu hồi mọi phiên. Vui lòng đăng nhập lại."}


@router.post("/auth/reset", response_model=Message)
def reset(data: ResetInput, request: Request, conn=DB):
    row = conn.execute(
        "SELECT * FROM password_resets WHERE token_hash=%s AND used_at IS NULL AND expires_at>now() FOR UPDATE", (digest(data.token),)
    ).fetchone()
    if not row:
        fail(400, "VALIDATION_ERROR", "Liên kết không hợp lệ hoặc đã hết hạn.")
    conn.execute(
        "UPDATE users SET password_hash=%s,must_change_password=false,token_version=token_version+1 WHERE id=%s",
        (hasher.hash(data.new_password), row["user_id"]),
    )
    conn.execute("UPDATE password_resets SET used_at=now() WHERE user_id=%s AND used_at IS NULL", (row["user_id"],))
    conn.execute("UPDATE sessions SET revoked_at=now() WHERE user_id=%s", (row["user_id"],))
    conn.execute("SELECT set_config('jkc.user_id',%s,true)", (str(row["user_id"]),))
    audit(conn, request, row["user_id"], "PASSWORD_RESET")
    return {"message": "Đã đặt lại mật khẩu. Vui lòng đăng nhập."}


@router.post("/users", response_model=Message, status_code=201)
def create_user(data: UserInput, request: Request, user=Depends(current_user), conn=DB):
    require_role(user, "TECH_ADMIN")
    if not conn.execute("SELECT 1 FROM departments WHERE id=%s AND active", (data.department_id,)).fetchone():
        fail(422, "VALIDATION_ERROR", "Bộ phận không hợp lệ.")
    try:
        row = conn.execute(
            "INSERT INTO users(username,employee_code,full_name,department_id,password_hash) VALUES (%s,%s,%s,%s,%s) RETURNING id",
            (data.username, data.employee_code, data.full_name, data.department_id, hasher.hash(data.password)),
        ).fetchone()
        conn.execute("INSERT INTO user_roles(user_id,role_id) SELECT %s,id FROM roles WHERE code='EMPLOYEE'", (row["id"],))
        audit(conn, request, user["id"], "USER_CREATED", row["id"])
    except UniqueViolation:
        conn.rollback()
        fail(409, "VERSION_CONFLICT", "Tên đăng nhập hoặc mã nhân viên đã tồn tại.")
    return {"message": "Đã tạo tài khoản. Người dùng phải đổi mật khẩu lần đầu."}
