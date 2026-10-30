import secrets
from datetime import timedelta
import pytest
from app.db import connection
from app.seed import uid
from app.security import digest

PREFIX = "/api/v1"


def test_unauthenticated(client):
    for path in [
        "/auth/me",
        "/dashboard",
        "/documents",
        "/articles",
        "/incidents",
        "/search",
        "/my/learning",
        "/approvals",
        "/admin/integrations/odoo/status",
    ]:
        assert client.get(PREFIX + path).status_code == 401


def test_session_csrf_origin_logout(client, login):
    login()
    cookie = client.cookies["jkc_session"]
    with connection() as conn:
        assert conn.execute("SELECT 1 FROM sessions WHERE session_hash=%s", (digest(cookie),)).fetchone()
        assert not conn.execute("SELECT 1 FROM sessions WHERE session_hash=%s", (cookie,)).fetchone()
    client.headers.pop("X-CSRF-Token")
    assert client.post(PREFIX + "/auth/logout").status_code == 403
    client.headers["X-CSRF-Token"] = client.get(PREFIX + "/auth/me").json()["csrf_token"]
    assert client.post(PREFIX + "/auth/logout", headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.post(PREFIX + "/auth/logout").status_code == 200
    assert client.get(PREFIX + "/auth/me").status_code == 401


@pytest.mark.parametrize(
    "username,visible,hidden",
    [
        ("admin", ["doc", "cross"], ["article", "incident", "restricted"]),
        ("employee", ["doc", "article", "incident", "restricted"], ["cross"]),
        ("head", ["doc", "article", "incident"], ["restricted", "cross"]),
    ],
)
def test_acl_search_count_detail(client, login, username, visible, hidden):
    login(username)
    result = client.get(PREFIX + "/search", params={"q": "DEMO"}).json()
    ids = {i["id"] for i in result["items"]}
    assert result["total"] == len(visible)
    assert ids == {str(uid(code)) for code in visible}
    for code in hidden:
        kind = "documents" if code == "doc" else "incidents" if code == "incident" else "articles"
        assert client.get(f"{PREFIX}/{kind}/{uid(code)}").status_code == 404
    assert client.get(PREFIX + "/search", params={"q": "%", "pageSize": 1}).json()["total"] == 0


def test_role_and_scopes(client, login):
    login()
    assert client.get(PREFIX + "/approvals").status_code == 403
    assert client.get(PREFIX + "/admin/integrations/odoo/status").status_code == 403
    assert (
        client.post(
            PREFIX + "/users",
            json={
                "username": "new-user",
                "employee_code": "DEMO-NEW",
                "full_name": "Nhân viên thử",
                "department_id": str(uid("PRODUCTION")),
                "password": "long-password-123",
            },
        ).status_code
        == 403
    )
    login("admin")
    assert client.get(PREFIX + "/approvals").status_code == 403
    assert client.get(PREFIX + "/admin/integrations/odoo/status").json()["version"] is None
    assert client.get(PREFIX + "/my/learning").json() == []


def test_expired_revoked_inactive(client, login):
    login()
    with connection() as conn:
        conn.execute(
            "UPDATE sessions SET expires_at=now()-%s WHERE session_hash=%s", (timedelta(seconds=1), digest(client.cookies["jkc_session"]))
        )
    assert client.get(PREFIX + "/auth/me").status_code == 401
    login()
    with connection() as conn:
        conn.execute("UPDATE users SET is_active=false WHERE id=%s", (uid("employee"),))
    try:
        assert client.get(PREFIX + "/auth/me").status_code == 401
    finally:
        with connection() as conn:
            conn.execute("UPDATE users SET is_active=true WHERE id=%s", (uid("employee"),))


def test_rate_limit(client):
    for _ in range(5):
        assert client.post(PREFIX + "/auth/login", json={"username": "unknown", "password": "wrong"}).status_code == 401
    assert client.post(PREFIX + "/auth/login", json={"username": "unknown", "password": "wrong"}).status_code == 429


def test_approval_scope_self_conflict_and_audit(client, login):
    login("head")
    own = client.post(PREFIX + "/articles", json={"title": "Kiểm thử tự phê duyệt", "body": {"text": "DEMO"}}).json()
    assert client.post(f"{PREFIX}/articles/{own['id']}/submit").status_code == 200
    with connection() as conn:
        own_approval = conn.execute("SELECT id FROM approvals WHERE version_id=%s", (own["version_id"],)).fetchone()["id"]
    assert client.post(f"{PREFIX}/approvals/{own_approval}/approve", json={"expectedVersion": 1}).status_code == 403
    login("employee")
    draft = client.post(PREFIX + "/articles", json={"title": "Kiểm thử phạm vi phê duyệt", "body": {"text": "DEMO"}}).json()
    assert client.post(f"{PREFIX}/articles/{draft['id']}/submit").status_code == 200
    assert client.post(f"{PREFIX}/articles/{draft['id']}/submit").status_code == 409
    with connection() as conn:
        aid = conn.execute("SELECT id FROM approvals WHERE version_id=%s", (draft["version_id"],)).fetchone()["id"]
    assert client.post(f"{PREFIX}/approvals/{aid}/approve", json={"expectedVersion": 1}).status_code == 403
    login("other")
    assert client.post(f"{PREFIX}/approvals/{aid}/approve", json={"expectedVersion": 1}).status_code == 404
    login("head")
    assert client.post(f"{PREFIX}/approvals/{aid}/approve", json={"expectedVersion": 2}).status_code == 409
    assert client.post(f"{PREFIX}/approvals/{aid}/approve", json={"expectedVersion": 1}).status_code == 200
    assert client.post(f"{PREFIX}/approvals/{aid}/approve", json={"expectedVersion": 1}).status_code == 409
    with connection() as conn:
        assert conn.execute("SELECT count(*) n FROM approval_events WHERE approval_id=%s", (aid,)).fetchone()["n"] == 1
        assert (
            conn.execute("SELECT count(*) n FROM audit_logs WHERE action='APPROVED' AND entity_id=%s", (draft["id"],)).fetchone()["n"] == 1
        )


def test_reset_one_time_revoke(client, login):
    login("other")
    token = secrets.token_urlsafe(48)
    with connection() as conn:
        conn.execute(
            "INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES (%s,%s,now()+interval '1 minute')",
            (uid("other"), digest(token)),
        )
    # Keep test password unchanged so other tests stay independent.
    payload = {"token": token, "new_password": "test-only-password-123"}
    assert client.post(PREFIX + "/auth/reset", json=payload).status_code == 200
    assert client.post(PREFIX + "/auth/reset", json=payload).status_code == 400
    assert client.get(PREFIX + "/auth/me").status_code == 401


def test_no_files_are_public(client, login):
    assert client.get("/files/private.pdf").status_code == 404
    login("admin")
    assert client.get(PREFIX + "/attachments/" + str(uid("restricted"))).status_code == 404


def test_version_and_audit_database_guards():
    with pytest.raises(Exception, match="Published version"):
        with connection() as conn:
            conn.execute("UPDATE contents SET current_published_version_id=%s WHERE id=%s", (uid("docv1"), uid("article")))
    with pytest.raises(Exception, match="immutable"):
        with connection() as conn:
            conn.execute("UPDATE content_versions SET body='{}' WHERE id=%s", (uid("docv1"),))
    with pytest.raises(Exception, match="append-only"):
        with connection() as conn:
            conn.execute("DELETE FROM audit_logs WHERE action='DEMO_SEEDED'")


def test_create_user_forced_password_and_revoke(client, login):
    login("admin")
    name = "test-" + secrets.token_hex(5)
    payload = {
        "username": name,
        "employee_code": name,
        "full_name": "Nhân viên kiểm thử",
        "department_id": str(uid("PRODUCTION")),
        "password": "temporary-password-123",
    }
    assert client.post(PREFIX + "/users", json=payload).status_code == 201
    assert client.post(PREFIX + "/users", json=payload).status_code == 409
    response = client.post(PREFIX + "/auth/login", json={"username": name, "password": payload["password"]})
    assert response.status_code == 200
    assert response.json()["must_change_password"] is True
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    assert client.get(PREFIX + "/dashboard").status_code == 403
    assert (
        client.post(PREFIX + "/auth/password", json={"current_password": "incorrect", "new_password": "permanent-password-123"}).status_code
        == 400
    )
    assert (
        client.post(
            PREFIX + "/auth/password", json={"current_password": payload["password"], "new_password": "permanent-password-123"}
        ).status_code
        == 200
    )
    assert client.get(PREFIX + "/auth/me").status_code == 401
    response = client.post(PREFIX + "/auth/login", json={"username": name, "password": "permanent-password-123"})
    assert response.json()["must_change_password"] is False
    assert client.get(PREFIX + "/dashboard").status_code == 200


def test_invalid_payload_and_request_id(client):
    response = client.post(PREFIX + "/auth/login", json={"password": "secret-must-not-appear"})
    assert response.status_code == 422
    assert "secret-must-not-appear" not in response.text
    assert response.json()["error"]["requestId"] == response.headers["x-request-id"]


def test_health_and_secure_cookie_flags(client, login):
    from app.config import settings

    assert client.get(PREFIX + "/health/live").json()["status"] == "ok"
    assert client.get(PREFIX + "/health/ready").json()["status"] == "ready"
    settings().cookie_secure = True
    try:
        response = client.post(PREFIX + "/auth/login", json={"username": "employee", "password": "test-only-password-123"})
        cookie = response.headers["set-cookie"].lower()
        assert "secure" in cookie and "httponly" in cookie and "samesite=lax" in cookie and "path=/api" in cookie
    finally:
        settings().cookie_secure = False


def test_unavailable_database_is_503(client):
    from psycopg import OperationalError
    from app.db import database

    def unavailable():
        raise OperationalError("internal connection details must not leak")

    client.app.dependency_overrides[database] = unavailable
    try:
        response = client.get(PREFIX + "/health/ready")
        assert response.status_code == 503
        assert "internal connection details" not in response.text
    finally:
        client.app.dependency_overrides.clear()


def test_process_filter_has_same_acl_for_counts(client, login):
    login("admin")
    assert len(client.get(PREFIX + "/processes").json()) == 5
    assert client.get(PREFIX + "/search", params={"q": "DEMO", "processId": str(uid("OFFSET"))}).json()["total"] == 2
    assert client.get(PREFIX + "/search", params={"q": "DEMO", "processId": str(uid("FLEXO"))}).json()["total"] == 0
    assert client.get(PREFIX + "/articles", params={"processId": "not-a-uuid"}).status_code == 422


def test_contract_is_stable_and_has_csrf_headers(client):
    from openapi_spec_validator import validate_spec

    first = client.get(PREFIX + "/openapi.json").json()
    assert first == client.get(PREFIX + "/openapi.json").json()
    validate_spec(first)
    headers = {p["name"] for p in first["paths"][PREFIX + "/articles"]["post"]["parameters"]}
    assert headers == {"Origin", "X-CSRF-Token"}
