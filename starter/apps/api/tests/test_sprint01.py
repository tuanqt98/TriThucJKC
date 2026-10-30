import io
import os
import secrets
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4
import psycopg
from psycopg import sql
from psycopg.rows import dict_row
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pypdf import PdfWriter
from app.config import settings
from app.files import scanner, ClamAVScanner
from app.main import create_app
from app.provision_runtime import provision
from app.security import hasher
from app.seed import uid

PREFIX = "/api/v1"
PASSWORD = "test-only-password-123"


@contextmanager
def owner():
    with psycopg.connect(os.environ["TEST_DATABASE_URL"], row_factory=dict_row) as conn:
        yield conn


@pytest.fixture(scope="module", autouse=True)
def archive_synthetic_content_after_tests():
    # Keep append-only audit/version evidence while isolating repeat regression runs.
    with owner() as conn:
        existing = [r["id"] for r in conn.execute("SELECT id FROM contents").fetchall()]
    yield
    with owner() as conn:
        conn.execute("UPDATE contents SET archived_at=now() WHERE NOT (id=ANY(%s::uuid[]))", (existing,))


@pytest.fixture(scope="module")
def runtime_url():
    role = "jkc_test_" + secrets.token_hex(5)
    password = secrets.token_urlsafe(30)
    with owner() as conn:
        provision(conn, role, password)
    url = urlsplit(os.environ["TEST_DATABASE_URL"])
    netloc = f"{role}:{password}@{url.hostname}:{url.port or 5432}"
    yield urlunsplit(url._replace(netloc=netloc))
    with owner() as conn:
        conn.execute(sql.SQL("DROP OWNED BY {}").format(sql.Identifier(role)))
        conn.execute(sql.SQL("DROP ROLE {}").format(sql.Identifier(role)))


@pytest.fixture()
def runtime_client(runtime_url, monkeypatch, tmp_path):
    monkeypatch.setattr(settings(), "database_url", runtime_url)
    monkeypatch.setattr(settings(), "require_runtime_role", True)
    monkeypatch.setattr(settings(), "file_storage_path", tmp_path)
    with TestClient(create_app(), base_url="http://localhost:3000", headers={"Origin": "http://localhost:3000"}) as client:
        yield client


def signin(client, name="employee"):
    response = client.post(PREFIX + "/auth/login", json={"username": name, "password": PASSWORD})
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    return response.json()


@pytest.fixture()
def learner(runtime_client):
    user = uuid4()
    name = "s01-" + secrets.token_hex(5)
    task = uuid4()
    assignment = uuid4()
    with owner() as conn:
        conn.execute(
            "INSERT INTO users(id,employee_code,username,full_name,department_id,password_hash,must_change_password) VALUES (%s,%s,%s,%s,%s,%s,false)",
            (user, name, name, "DEMO · Học viên test", uid("PRODUCTION"), hasher.hash(PASSWORD)),
        )
        conn.execute("INSERT INTO user_roles(user_id,role_id) VALUES (%s,%s)", (user, uid("EMPLOYEE")))
        conn.execute("INSERT INTO reading_assignments(id,user_id,version_id) VALUES (%s,%s,%s)", (task, user, uid("docv1")))
        conn.execute("INSERT INTO course_assignments(id,user_id,course_version_id) VALUES (%s,%s,%s)", (assignment, user, uid("s01-cv1")))
    signin(runtime_client, name)
    return {"id": user, "name": name, "task": task, "assignment": assignment}


def test_runtime_db_denies_unscoped_content_and_answer_keys(runtime_url):
    with psycopg.connect(runtime_url, row_factory=dict_row) as conn:
        role = conn.execute("SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user").fetchone()
        assert not role["rolsuper"] and not role["rolbypassrls"]
        assert conn.execute("SELECT count(*) n FROM contents").fetchone()["n"] == 0
        conn.execute("SELECT set_config('jkc.user_id',%s,true)", (str(uid("admin")),))
        assert conn.execute("SELECT count(*) n FROM contents WHERE id=%s", (uid("restricted"),)).fetchone()["n"] == 0
        assert conn.execute("SELECT count(*) n FROM content_versions WHERE id=%s", (uid("restrictedv1"),)).fetchone()["n"] == 0
        assert conn.execute("SELECT count(*) n FROM quiz_attempts").fetchone()["n"] == 0
        assert not conn.execute("SELECT has_table_privilege(current_user,'password_resets','INSERT')").fetchone()["has_table_privilege"]
    for query in [
        "SELECT is_correct FROM quiz_options",
        "DELETE FROM audit_logs",
        "TRUNCATE contents CASCADE",
        "ALTER TABLE contents DISABLE ROW LEVEL SECURITY",
        "UPDATE quiz_attempts SET score=100",
    ]:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with psycopg.connect(runtime_url) as conn:
                conn.execute(query)


def test_runtime_regression_and_privileged_user_creation(runtime_client):
    signin(runtime_client)
    assert runtime_client.get(PREFIX + "/health/ready").status_code == 200
    assert runtime_client.get(PREFIX + "/dashboard").status_code == 200
    assert runtime_client.get(PREFIX + "/search", params={"q": "DEMO"}).status_code == 200
    signin(runtime_client, "admin")
    name = "create-" + secrets.token_hex(4)
    response = runtime_client.post(
        PREFIX + "/users",
        json={
            "username": name,
            "employee_code": name,
            "full_name": "DEMO · Tạo user",
            "department_id": str(uid("PRODUCTION")),
            "password": PASSWORD,
        },
    )
    assert response.status_code == 201, response.text
    assert signin(runtime_client, name)["must_change_password"]
    assert runtime_client.get(PREFIX + "/dashboard").status_code == 403
    changed = runtime_client.post(PREFIX + "/auth/password", json={"current_password": PASSWORD, "new_password": PASSWORD + "-changed"})
    assert changed.status_code == 200, changed.text
    assert runtime_client.get(PREFIX + "/auth/me").status_code == 401
    signed = runtime_client.post(PREFIX + "/auth/login", json={"username": name, "password": PASSWORD + "-changed"})
    assert signed.status_code == 200 and not signed.json()["must_change_password"]


def test_reading_idempotent_owner_and_version(runtime_client, learner):
    client = runtime_client
    task = learner["task"]
    tasks = client.get(PREFIX + "/my/reading").json()
    assert any(t["id"] == str(task) for t in tasks)
    assert client.post(f"{PREFIX}/reading-assignments/{task}/acknowledge", json={"version_id": str(uid("articlev1"))}).status_code == 409
    payload = {"version_id": str(uid("docv1"))}
    for _ in range(2):
        assert client.post(f"{PREFIX}/reading-assignments/{task}/acknowledge", json=payload).status_code == 200
    with owner() as conn:
        assert conn.execute("SELECT count(*) n FROM reading_acks WHERE assignment_id=%s", (task,)).fetchone()["n"] == 1
        assert (
            conn.execute("SELECT count(*) n FROM audit_logs WHERE entity_id=%s AND action='READ_ACKNOWLEDGED'", (task,)).fetchone()["n"]
            == 1
        )
    signin(client, "admin")
    assert client.post(f"{PREFIX}/reading-assignments/{task}/acknowledge", json=payload).status_code == 404


def test_reading_reissue_preserves_history_and_denies_stale(runtime_client, learner):
    user = learner["id"]
    content, old, new = uuid4(), uuid4(), uuid4()
    first, second = uuid4(), uuid4()
    with owner() as conn:
        conn.execute(
            "INSERT INTO contents(id,code,kind,title,creator_id,visibility) VALUES (%s,%s,'DOCUMENT','DEMO · Phiên bản nội quy',%s,'COMPANY')",
            (content, str(content), uid("head")),
        )
        for vid, num in [(old, 1), (new, 2)]:
            conn.execute(
                "INSERT INTO content_versions(id,content_id,version_number,body,status,created_by) VALUES (%s,%s,%s,'{}','APPROVED',%s)",
                (vid, content, num, uid("head")),
            )
        conn.execute("UPDATE contents SET current_published_version_id=%s WHERE id=%s", (old, content))
        conn.execute("INSERT INTO reading_assignments(id,user_id,version_id) VALUES (%s,%s,%s)", (first, user, old))
    assert runtime_client.post(f"{PREFIX}/reading-assignments/{first}/acknowledge", json={"version_id": str(old)}).status_code == 200
    with owner() as conn:
        conn.execute("UPDATE contents SET current_published_version_id=%s WHERE id=%s", (new, content))
        conn.execute("INSERT INTO reading_assignments(id,user_id,version_id) VALUES (%s,%s,%s)", (second, user, new))
    assert runtime_client.post(f"{PREFIX}/reading-assignments/{first}/acknowledge", json={"version_id": str(old)}).status_code == 409
    assert runtime_client.post(f"{PREFIX}/reading-assignments/{second}/acknowledge", json={"version_id": str(new)}).status_code == 200
    with owner() as conn:
        assert conn.execute("SELECT count(*) n FROM reading_acks WHERE assignment_id=ANY(%s)", ([first, second],)).fetchone()["n"] == 2


def test_head_can_assign_only_scoped_reading(runtime_client, learner):
    signin(runtime_client, "head")
    result = runtime_client.post(
        f"{PREFIX}/documents/{uid('doc')}/reading-assignments", json={"user_id": str(learner["id"]), "version_id": str(uid("docv1"))}
    )
    assert result.status_code == 201, result.text
    signin(runtime_client, "other")
    assert (
        runtime_client.post(
            f"{PREFIX}/documents/{uid('doc')}/reading-assignments", json={"user_id": str(learner["id"]), "version_id": str(uid("docv1"))}
        ).status_code
        == 403
    )


def finish_lesson(client, learner):
    response = client.post(f"{PREFIX}/my/learning/{learner['assignment']}/lessons/{uid('s01-lesson')}/complete")
    assert response.status_code == 200, response.text


def answers(right=True):
    return {
        "answers": [
            {"question_id": str(uid("s01-" + q)), "option_id": str(uid("s01-" + q + ("-right" if right else "-wrong")))}
            for q in ["q1", "q2"]
        ]
    }


def test_quiz_grades_server_history_and_limit(runtime_client, learner):
    client = runtime_client
    aid = learner["assignment"]
    path = f"{PREFIX}/my/learning/{aid}"
    before = client.get(path)
    assert before.status_code == 200, before.text
    assert "is_correct" not in before.text and "right" not in before.text
    assert client.post(path + "/quiz-attempts").status_code == 409
    finish_lesson(client, learner)
    for index, right in enumerate([False, True, False], 1):
        attempt = client.post(path + "/quiz-attempts")
        assert attempt.status_code == 200, attempt.text
        assert client.post(path + "/quiz-attempts").json()["id"] == attempt.json()["id"]
        target = f"{PREFIX}/quiz-attempts/{attempt.json()['id']}/submit"
        assert client.post(target, json={**answers(right), "score": 100}).status_code == 422
        invalid = answers(right)
        invalid["answers"][1]["option_id"] = invalid["answers"][0]["option_id"]
        assert client.post(target, json=invalid).status_code == 422
        result = client.post(target, json=answers(right))
        assert result.status_code == 200, result.text
        assert float(result.json()["score"]) == (100 if right else 0)
        assert result.json()["passed"] == right
        assert client.post(target, json=answers(right)).status_code == 409
    assert client.post(path + "/quiz-attempts").status_code == 409
    detail = client.get(path).json()
    assert len(detail["attempts"]) == 3
    assert detail["completed_at"] and detail["attempts"][1]["pass_score_snapshot"] == "70.00"
    signin(client, "admin")
    assert client.get(path).status_code == 404
    assert client.post(target, json=answers(True)).status_code == 404
    with pytest.raises(psycopg.errors.RaiseException, match="immutable"):
        with owner() as conn:
            conn.execute("UPDATE quiz_attempts SET score=100 WHERE assignment_id=%s", (aid,))
    with pytest.raises(psycopg.errors.RaiseException, match="immutable"):
        with owner() as conn:
            conn.execute("UPDATE quiz_options SET answer_text='changed' WHERE id=%s", (uid("s01-q1-right"),))


def test_concurrent_quiz_submit_one_history(runtime_client, learner, runtime_url):
    finish_lesson(runtime_client, learner)
    attempt = runtime_client.post(f"{PREFIX}/my/learning/{learner['assignment']}/quiz-attempts").json()["id"]
    token = runtime_client.cookies["jkc_session"]
    csrf = runtime_client.headers["X-CSRF-Token"]

    def submit():
        with TestClient(
            create_app(), base_url="http://localhost:3000", headers={"Origin": "http://localhost:3000", "X-CSRF-Token": csrf}
        ) as client:
            client.cookies.set("jkc_session", token, domain="localhost.local", path="/api")
            return client.post(f"{PREFIX}/quiz-attempts/{attempt}/submit", json=answers(True)).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: submit(), range(2)))
    assert sorted(results) == [200, 409]
    with owner() as conn:
        assert conn.execute("SELECT count(*) n FROM quiz_responses WHERE attempt_id=%s", (attempt,)).fetchone()["n"] == 2


class CleanScanner:
    def scan(self, data):
        return True


def png():
    data = io.BytesIO()
    Image.new("RGB", (4, 4), "blue").save(data, format="PNG")
    return data.getvalue()


def create_draft(client):
    result = client.post(PREFIX + "/articles", json={"title": "DEMO · Tệp đính kèm riêng tư", "body": {"text": "Dữ liệu kiểm thử."}})
    assert result.status_code == 201, result.text
    return result.json()


def test_file_parent_acl_lifecycle_and_integrity(runtime_client, learner):
    client = runtime_client
    client.app.dependency_overrides[scanner] = lambda: CleanScanner()
    draft = create_draft(client)
    path = f"{PREFIX}/content-versions/{draft['version_id']}/attachments"
    result = client.post(path, files={"file": ("minh-hoa.png", png(), "image/png")})
    assert result.status_code == 201, result.text
    assert "storage_key" not in result.text
    file = result.json()
    download = f"{PREFIX}/attachments/{file['id']}/download"
    assert client.get(download).status_code == 200
    assert "attachment;" in client.get(download).headers["content-disposition"]
    assert client.get("/files/" + file["filename"]).status_code == 404
    signin(client, "head")
    assert client.get(download).status_code == 404
    signin(client, learner["name"])
    assert client.post(f"{PREFIX}/articles/{draft['id']}/submit").status_code == 200
    assert client.post(path, files={"file": ("late.png", png(), "image/png")}).status_code == 403
    signin(client, "head")
    assert client.get(download).status_code == 200
    with owner() as conn:
        approval = conn.execute("SELECT id FROM approvals WHERE version_id=%s", (draft["version_id"],)).fetchone()["id"]
    response = client.post(f"{PREFIX}/approvals/{approval}/approve", json={"expectedVersion": 1})
    assert response.status_code == 200, response.text
    signin(client, "admin")
    assert client.get(download).status_code == 404
    signin(client, learner["name"])
    with owner() as conn:
        row = conn.execute("SELECT storage_key FROM attachments WHERE id=%s", (file["id"],)).fetchone()
        conn.execute("UPDATE attachments SET malware_scan_status='PENDING' WHERE id=%s", (file["id"],))
    assert client.get(download).status_code == 409
    with owner() as conn:
        conn.execute("UPDATE attachments SET malware_scan_status='CLEAN' WHERE id=%s", (file["id"],))
    (settings().file_storage_path / row["storage_key"]).write_bytes(b"corrupt")
    assert client.get(download).status_code == 503


def test_upload_rejects_type_path_active_pdf_size_and_scanner_failure(runtime_client, learner, monkeypatch):
    client = runtime_client
    client.app.dependency_overrides[scanner] = lambda: CleanScanner()
    draft = create_draft(client)
    path = f"{PREFIX}/content-versions/{draft['version_id']}/attachments"
    for name, data, mime in [
        ("bad.html", png(), "text/html"),
        ("../bad.png", png(), "image/png"),
        ("fake.png", b"not-image", "image/png"),
        ("wrong.jpg", png(), "image/jpeg"),
    ]:
        assert client.post(path, files={"file": (name, data, mime)}).status_code == 422
    import base64

    broken = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=")
    assert client.post(path, files={"file": ("broken.png", broken, "image/png")}).status_code == 422
    pdf = PdfWriter()
    pdf.add_blank_page(width=100, height=100)
    pdf.add_js('app.alert("test")')
    data = io.BytesIO()
    pdf.write(data)
    assert client.post(path, files={"file": ("active.pdf", data.getvalue(), "application/pdf")}).status_code == 422
    pdf = PdfWriter()
    pdf.add_blank_page(width=100, height=100)
    data = io.BytesIO()
    pdf.write(data)
    assert client.post(path, files={"file": ("static.pdf", data.getvalue(), "application/pdf")}).status_code == 201
    monkeypatch.setattr(settings(), "max_upload_bytes", 1024)
    assert client.post(path, files={"file": ("large.png", b"x" * 2048, "image/png")}).status_code == 413

    class Infected:
        def scan(self, data):
            return False

    client.app.dependency_overrides[scanner] = lambda: Infected()
    assert client.post(path, files={"file": ("infected.png", png(), "image/png")}).status_code == 422
    client.app.dependency_overrides.pop(scanner)
    monkeypatch.setattr(settings(), "clamav_port", 1)
    assert client.post(path, files={"file": ("safe.png", png(), "image/png")}).status_code == 503
    assert ClamAVScanner is not None


def test_unauthenticated_new_routes(client):
    for path in ["/my/reading", f"/my/learning/{uuid4()}", f"/content-versions/{uuid4()}/attachments", f"/attachments/{uuid4()}/download"]:
        assert client.get(PREFIX + path).status_code == 401


def test_file_restricted_has_no_admin_or_head_bypass(runtime_client, learner):
    client = runtime_client
    content, version = uuid4(), uuid4()
    with owner() as conn:
        conn.execute(
            "INSERT INTO contents(id,code,kind,title,creator_id,owner_department_id,visibility) VALUES (%s,%s,'ARTICLE','DEMO · Tệp giới hạn',%s,%s,'RESTRICTED')",
            (content, str(content), learner["id"], uid("PRODUCTION")),
        )
        conn.execute(
            "INSERT INTO content_versions(id,content_id,version_number,body,created_by) VALUES (%s,%s,1,'{}',%s)",
            (version, content, learner["id"]),
        )
    client.app.dependency_overrides[scanner] = lambda: CleanScanner()
    response = client.post(f"{PREFIX}/content-versions/{version}/attachments", files={"file": ("private.png", png(), "image/png")})
    assert response.status_code == 201, response.text
    file = response.json()["id"]
    for username in ["admin", "head", "other"]:
        signin(client, username)
        assert client.get(f"{PREFIX}/attachments/{file}/download").status_code == 404
        assert client.get(f"{PREFIX}/content-versions/{version}/attachments").status_code == 404
    signin(client, learner["name"])
    assert client.get(f"{PREFIX}/attachments/{file}/download").status_code == 200


def test_runtime_cannot_rewrite_scope_or_quiz_history(runtime_client, learner, runtime_url):
    draft = create_draft(runtime_client)
    with pytest.raises(psycopg.errors.RaiseException, match="immutable"):
        with psycopg.connect(runtime_url) as conn:
            conn.execute("SELECT set_config('jkc.user_id',%s,true)", (str(learner["id"]),))
            conn.execute("UPDATE contents SET visibility='COMPANY' WHERE id=%s", (draft["id"],))
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        with psycopg.connect(runtime_url) as conn:
            conn.execute("SELECT set_config('jkc.user_id',%s,true)", (str(learner["id"]),))
            conn.execute("UPDATE course_assignments SET completed_at=now() WHERE id=%s", (learner["assignment"],))


def test_published_course_structure_cannot_grow_silently():
    with pytest.raises(psycopg.errors.RaiseException, match="immutable"):
        with owner() as conn:
            conn.execute(
                "INSERT INTO quiz_questions(course_version_id,question,order_no) VALUES (%s,'DEMO · Thêm câu hỏi vào phiên bản cũ',99)",
                (uid("s01-cv1"),),
            )


def test_storage_readiness_is_503_when_missing(runtime_client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings(), "require_file_storage", True)
    monkeypatch.setattr(settings(), "file_storage_path", tmp_path / "missing")
    result = runtime_client.get(PREFIX + "/health/ready")
    assert result.status_code == 503
    assert result.json()["error"]["code"] == "STORAGE_NOT_READY"


def test_stale_or_invalid_antivirus_signatures_fail_closed(monkeypatch):
    from fastapi import HTTPException

    class Socket:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def sendall(self, data):
            pass

        def recv(self, count):
            return b"ClamAV 1.5/1/Mon Jan 01 00:00:00 2001\0"

    monkeypatch.setattr("app.files.socket.create_connection", lambda *args, **kwargs: Socket())
    with pytest.raises(HTTPException) as error:
        ClamAVScanner().scan(png())
    assert error.value.status_code == 503


def test_uat_seeding_refuses_non_demo_accounts():
    from app.seed_uat import seed_uat

    marker = uuid4()
    with owner() as conn:
        conn.execute(
            "INSERT INTO users(id,employee_code,username,full_name,password_hash) VALUES (%s,%s,%s,%s,%s)",
            (
                marker,
                "GUARD-ONLY-" + str(marker),
                "guard-" + secrets.token_hex(4),
                "DEMO · Tài khoản giả kiểm tra guard",
                hasher.hash(PASSWORD),
            ),
        )
    try:
        with pytest.raises(RuntimeError, match="outside the synthetic DEMO namespace"):
            seed_uat()
    finally:
        with owner() as conn:
            conn.execute("DELETE FROM users WHERE id=%s", (marker,))
