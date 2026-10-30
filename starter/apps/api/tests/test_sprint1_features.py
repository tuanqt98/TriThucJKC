"""Authorization, immutable history and concurrency for the three Sprint 1 modules."""

# ruff: noqa: F811
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
import psycopg
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.seed import uid
from test_sprint01 import owner, signin, runtime_url, runtime_client  # noqa: F401
from test_workflows import create, version

B = "/api/v1/workspace"


@pytest.fixture(autouse=True)
def isolate():
    with owner() as db:
        existing = [r["id"] for r in db.execute("SELECT id FROM contents")]
        db.execute("DELETE FROM login_limits")
    yield
    with owner() as db:
        db.execute("UPDATE contents SET archived_at=now() WHERE NOT(id=ANY(%s::uuid[]))", (existing,))


def test_reading_bulk_scope_history_and_status(runtime_client):
    c = runtime_client
    signin(c)
    doc = create(c, "DOCUMENT")
    with owner() as db:
        db.execute(
            "UPDATE content_versions SET status='APPROVED',approved_by=%s,approved_at=now() WHERE id=%s", (uid("head"), doc["version_id"])
        )
        db.execute("UPDATE contents SET current_published_version_id=%s WHERE id=%s", (doc["version_id"], doc["id"]))
    signin(c, "head")
    people = c.get(B + "/people").json()
    assert str(uid("employee")) in [p["id"] for p in people]
    assert str(uid("other")) not in [p["id"] for p in people]
    data = {
        "content_id": doc["id"],
        "version_id": doc["version_id"],
        "department_id": str(uid("PRODUCTION")),
        "due_at": "2020-01-01T00:00:00Z",
    }
    for _ in range(2):
        r = c.post(B + "/reading", json=data)
        assert r.status_code == 201, r.text
    tasks = [t for t in c.get(B + "/reading").json() if t["user_id"] == str(uid("employee")) and t["content_id"] == doc["id"]]
    assert len(tasks) == 1 and tasks[0]["status"] == "OVERDUE"
    assert c.post(B + "/reading", json={**data, "department_id": str(uid("TECHNICAL"))}).status_code == 403
    assert c.post(B + "/reading", json={**data, "version_id": str(uuid4())}).status_code == 409
    signin(c)
    assert c.get(B + "/reading").json() == []
    assert c.post(B + "/reading", json=data).status_code == 403
    r = c.post(f"/api/v1/reading-assignments/{tasks[0]['id']}/acknowledge", json={"version_id": doc["version_id"]})
    assert r.status_code == 200, r.text
    signin(c, "head")
    assert next(t for t in c.get(B + "/reading").json() if t["id"] == tasks[0]["id"])["status"] == "READ"


def test_concurrent_draft_save_has_one_winner(runtime_client):
    c = runtime_client
    user = signin(c)
    row = create(c)
    token = c.cookies.get("jkc_session")

    def save(n):
        with TestClient(
            create_app(), base_url="http://localhost:3000", headers={"Origin": "http://localhost:3000", "X-CSRF-Token": user["csrf_token"]}
        ) as parallel:
            parallel.cookies.set("jkc_session", token, domain="localhost.local", path="/api")
            return parallel.put(B + "/contents", json={**version(row), "body": {"text": str(n)}}).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(save, range(2))) == [200, 409]


def test_definer_rejects_null_revision_and_runtime_cannot_grant_hr(runtime_client, runtime_url):
    import json

    c = runtime_client
    signin(c)
    row = create(c)
    with pytest.raises(psycopg.errors.RaiseException, match="JKC_CONFLICT"):
        with psycopg.connect(runtime_url) as db:
            db.execute("SELECT set_config('jkc.user_id',%s,true)", (str(uid("employee")),))
            db.execute(
                "SELECT jkc_content_workflow('save',%s::jsonb,'test')",
                (json.dumps({"content_id": row["id"], "version_id": row["version_id"], "body": {"text": "bypass"}}),),
            )
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        with psycopg.connect(runtime_url) as db:
            db.execute("SELECT set_config('jkc.user_id',%s,true)", (str(uid("admin")),))
            db.execute("INSERT INTO user_roles(user_id,role_id) SELECT %s,id FROM roles WHERE code='HR'", (uid("admin"),))


def test_incident_recurrence_scope_and_verification(runtime_client):
    c = runtime_client
    signin(c)
    data = {
        "title": "DEMO — Hồ sơ kiểm thử",
        "process_id": str(uid("OFFSET")),
        "severity": "LOW",
        "symptoms": "Mẫu giả lập cần xác minh",
        "conditions": {"material": "DEMO"},
    }
    r = c.post(B + "/incidents", json=data)
    assert r.status_code == 201, r.text
    incident = r.json()
    recurrence = {"incident_id": incident["id"], "request_key": str(uuid4()), "note": "Tôi gặp tình huống mẫu", "outcome": "Chờ xác minh"}
    a = c.post(B + "/incidents/occurrences", json=recurrence)
    b = c.post(B + "/incidents/occurrences", json=recurrence)
    assert a.status_code == b.status_code == 201 and a.json()["occurrence_id"] == b.json()["occurrence_id"]
    solution = c.post(
        B + "/incidents/solutions",
        json={
            "incident_id": incident["id"],
            "cause": "Giả thuyết DEMO",
            "steps": ["Ghi nhận bằng chứng để người phụ trách xem xét"],
            "outcome": "Kết quả thử nghiệm DEMO",
        },
    )
    assert solution.status_code == 201, solution.text
    verify = {
        "incident_revision": incident["revision"],
        "incident_id": incident["id"],
        "solution_id": solution.json()["solution_id"],
        "revision": 1,
        "verified_cause": "Kết luận trong bài test, không áp dụng thực tế",
    }
    assert c.post(B + "/incidents/verify", json=verify).status_code == 403
    updated = c.put(B + "/incidents", json={**data, "symptoms": "Cập nhật bằng chứng DEMO", "incident_id": incident["id"], "revision": 1})
    assert updated.status_code == 200, updated.text
    signin(c, "admin")
    assert incident["id"] not in [r["id"] for r in c.get(B + "/incidents").json()]
    assert c.post(B + "/incidents/verify", json=verify).status_code == 404
    signin(c, "head")
    assert c.post(B + "/incidents/verify", json=verify).status_code == 409
    verify["incident_revision"] = updated.json()["revision"]
    r = c.post(B + "/incidents/verify", json=verify)
    assert r.status_code == 200, r.text
    assert c.post(B + "/incidents/verify", json=verify).status_code == 409
    signin(c)
    assert c.put(B + "/incidents", json={**data, "incident_id": incident["id"], "revision": 1}).status_code == 409
    detail = next(r for r in c.get(B + "/incidents").json() if r["id"] == incident["id"])
    assert len(detail["occurrences"]) == 1 and detail["solutions"][0]["status"] == "VERIFIED"
    with pytest.raises(psycopg.errors.RaiseException, match="immutable"):
        with owner() as db:
            db.execute("UPDATE incident_solutions SET outcome='tamper' WHERE id=%s", (verify["solution_id"],))


def test_course_authoring_assignment_new_version_and_grading(runtime_client):
    c = runtime_client
    signin(c)
    r = c.post(B + "/courses", json={"title": "DEMO — Kiểm thử tác giả khóa học"})
    assert r.status_code == 201, r.text
    course = r.json()

    def ident(row):
        return {"course_id": row["id"], "version_id": row["version_id"], "revision": row["revision"]}

    structure = {
        "pass_score": 70,
        "max_attempts": 1,
        "lessons": [{"title": "Bài học DEMO", "body": {"text": "Luôn xác minh trước áp dụng"}}],
        "questions": [
            {
                "question": "Nội dung DEMO có dùng làm quy trình chính thức không?",
                "options": [
                    {"answer_text": "Không, cần công ty xác nhận", "is_correct": True},
                    {"answer_text": "Dùng ngay", "is_correct": False},
                ],
            }
        ],
    }
    r = c.put(B + "/courses", json={**ident(course), **structure})
    assert r.status_code == 200, r.text
    saved = r.json()
    assert c.put(B + "/courses", json={**ident(course), **structure}).status_code == 409
    pending = c.post(B + "/courses/submit", json=ident(saved)).json()
    assert c.post(B + "/courses/approve", json=ident(pending)).status_code == 403
    signin(c, "other")
    assert c.post(B + "/courses/approve", json=ident(pending)).status_code == 404
    signin(c, "head")
    r = c.post(B + "/courses/approve", json=ident(pending))
    assert r.status_code == 200, r.text
    approved = r.json()
    assert c.post(B + "/courses/assign", json={**ident(approved), "user_id": str(uid("other"))}).status_code == 403
    assert c.post(B + "/courses/assign", json={**ident(approved), "user_id": str(uid("employee"))}).status_code == 201
    signin(c)
    assert c.put(B + "/courses", json={**ident(approved), **structure}).status_code == 409
    workspace = next(v for v in c.get(B + "/courses").json() if v["version_id"] == approved["version_id"])
    assert workspace["questions"] == []
    assignments = c.get("/api/v1/my/learning").json()
    a = next(a for a in assignments if a["title"] == "DEMO — Kiểm thử tác giả khóa học")
    assert a["status"] == "NOT_STARTED"
    detail = c.get("/api/v1/my/learning/" + a["id"]).json()
    assert all("is_correct" not in o for q in detail["questions"] for o in q["options"])
    assert c.post(f"/api/v1/my/learning/{a['id']}/lessons/{detail['lessons'][0]['id']}/complete").status_code == 200
    attempt = c.post(f"/api/v1/my/learning/{a['id']}/quiz-attempts").json()["id"]
    q = detail["questions"][0]
    wrong = next(o for o in q["options"] if o["answer_text"] == "Dùng ngay")
    r = c.post(f"/api/v1/quiz-attempts/{attempt}/submit", json={"answers": [{"question_id": q["id"], "option_id": wrong["id"]}]})
    assert r.status_code == 200 and float(r.json()["score"]) == 0
    assert next(x for x in c.get("/api/v1/my/learning").json() if x["id"] == a["id"])["status"] == "FAILED"
    new = c.post(B + "/courses/fork", json=ident(approved))
    assert new.status_code == 200 and new.json()["version_number"] == 2
    assert len(next(v for v in c.get(B + "/courses").json() if v["version_id"] == new.json()["version_id"])["questions"]) == 1
    with owner() as db:
        assert db.execute("SELECT score FROM quiz_attempts WHERE id=%s", (attempt,)).fetchone()["score"] == 0
    signin(c, "admin")
    assert approved["id"] not in [v["id"] for v in c.get(B + "/courses").json()]
