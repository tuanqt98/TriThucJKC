"""Sprint 1 authoring through actual restricted runtime connections."""
# ruff: noqa: F811

from uuid import uuid4
import pytest
import psycopg
from app.seed import uid
from app.files import scanner
from test_sprint01 import CleanScanner, png
from test_sprint01 import owner, signin, runtime_url, runtime_client  # noqa: F401

P = "/api/v1/workspace/contents"


@pytest.fixture(autouse=True)
def isolate_content():
    with owner() as conn:
        existing = [r["id"] for r in conn.execute("SELECT id FROM contents")]
        conn.execute("DELETE FROM login_limits")
    yield
    with owner() as conn:
        conn.execute("UPDATE contents SET archived_at=now() WHERE NOT(id=ANY(%s::uuid[]))", (existing,))


def version(row):
    return {"content_id": row["id"], "version_id": row["version_id"], "revision": row["revision"]}


def create(client, kind="ARTICLE", visibility="DEPARTMENT"):
    r = client.post(
        P,
        json={
            "kind": kind,
            "title": "DEMO test " + uuid4().hex,
            "body": {"text": "Không dùng vận hành"},
            "visibility": visibility,
            "process_id": str(uid("OFFSET")),
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


@pytest.mark.parametrize("decision,expected", [("request-changes", "CHANGES_REQUESTED"), ("reject", "REJECTED")])
def test_edit_stale_review_changes_resubmit_history(runtime_client, decision, expected):
    c = runtime_client
    signin(c)
    first = create(c)
    title = "DEMO · Tiêu đề phiên bản " + uuid4().hex
    r = c.put(P, json={**version(first), "title": title, "body": {"text": "Bản sửa"}, "process_id": str(uid("OFFSET"))})
    assert r.status_code == 200, r.text
    edited = r.json()
    assert c.put(P, json={**version(first), "body": {"text": "stale"}}).status_code == 409
    pending = c.post(P + "/submit", json=version(edited))
    assert pending.status_code == 200, pending.text
    pending = pending.json()
    assert c.post(P + "/approve", json=version(pending)).status_code == 403
    signin(c, "other")
    assert c.post(P + "/approve", json=version(pending)).status_code == 404
    signin(c, "head")
    assert c.post(P + "/" + decision, json=version(pending)).status_code == 422
    changed = c.post(P + "/" + decision, json={**version(pending), "remark": "Bổ sung bằng chứng"})
    assert changed.status_code == 200, changed.text
    signin(c)
    second = c.post(P + "/fork", json=version(changed.json()))
    assert second.status_code == 200, second.text
    assert second.json()["version_number"] == 2
    p2 = c.post(P + "/submit", json=version(second.json()))
    assert p2.status_code == 200, p2.text
    signin(c, "head")
    approved = c.post(P + "/approve", json=version(p2.json()))
    assert approved.status_code == 200, approved.text
    assert c.post(P + "/reject", json={**version(p2.json()), "remark": "late"}).status_code == 409
    with owner() as db:
        rows = db.execute("SELECT status,body FROM content_versions WHERE content_id=%s ORDER BY version_number", (first["id"],)).fetchall()
        assert [r["status"] for r in rows] == [expected, "APPROVED"]
        assert rows[0]["body"] == {"text": "Bản sửa"}
        assert (
            db.execute(
                "SELECT count(*) n FROM approval_events e JOIN approvals a ON a.id=e.approval_id JOIN content_versions v ON v.id=a.version_id WHERE v.content_id=%s",
                (first["id"],),
            ).fetchone()["n"]
            == 2
        )
    signin(c)
    new = c.post(P + "/fork", json=version(approved.json())).json()
    saved = c.put(P, json={**version(new), "title": "DEMO · Nháp đổi tên", "body": {"text": "Bản sau"}})
    assert saved.status_code == 200, saved.text
    assert c.get("/api/v1/articles/" + first["id"]).json()["title"] == title
    with pytest.raises(psycopg.errors.RaiseException, match="immutable"):
        with owner() as db:
            db.execute("UPDATE content_versions SET title='tamper' WHERE id=%s", (approved.json()["version_id"],))


def test_hr_only_publish_and_no_self_approval(runtime_client):
    c = runtime_client
    # HR is an explicit TEST grant to the scoped head; no runtime self-grant.
    with owner() as db:
        grant = db.execute(
            "INSERT INTO user_roles(user_id,role_id) SELECT %s,id FROM roles WHERE code='HR' RETURNING id", (uid("head"),)
        ).fetchone()["id"]
    try:
        signin(c)
        doc = create(c, "DOCUMENT")
        pending = c.post(P + "/submit", json=version(doc)).json()
        signin(c, "admin")
        assert c.post(P + "/approve", json=version(pending)).status_code == 404
        signin(c, "head")
        r = c.post(P + "/approve", json=version(pending))
        assert r.status_code == 200, r.text
        own = create(c, "DOCUMENT", "COMPANY")
        pending_own = c.post(P + "/submit", json=version(own)).json()
        assert c.post(P + "/approve", json=version(pending_own)).status_code == 403
        signin(c)
        assert c.post(P, json={"kind": "DOCUMENT", "title": "test", "body": {}, "visibility": "COMPANY"}).status_code == 403
    finally:
        with owner() as db:
            db.execute("DELETE FROM user_roles WHERE id=%s", (grant,))


def test_hr_reviewer_download_is_private_and_state_bound(runtime_client):
    c = runtime_client
    with owner() as db:
        grant = db.execute(
            "INSERT INTO user_roles(user_id,role_id,scope_department_id) SELECT %s,id,%s FROM roles WHERE code='HR' RETURNING id",
            (uid("head"), uid("PRODUCTION")),
        ).fetchone()["id"]
    c.app.dependency_overrides[scanner] = lambda: CleanScanner()
    try:
        signin(c)
        doc = create(c, "DOCUMENT")
        r = c.post(f"/api/v1/content-versions/{doc['version_id']}/attachments", files={"file": ("hr-demo.png", png(), "image/png")})
        assert r.status_code == 201, r.text
        path = f"/api/v1/attachments/{r.json()['id']}/download"
        signin(c, "head")
        assert c.get(path).status_code == 404
        assert c.post(P, json={"kind": "DOCUMENT", "title": "DEMO", "body": {}, "visibility": "COMPANY"}).status_code == 403
        signin(c)
        pending = c.post(P + "/submit", json=version(doc))
        assert pending.status_code == 200, pending.text
        signin(c, "head")
        assert c.get(path).status_code == 200
        signin(c, "admin")
        assert c.get(path).status_code == 404
        signin(c, "other")
        assert c.get(path).status_code == 404
    finally:
        c.app.dependency_overrides.pop(scanner)
        with owner() as db:
            db.execute("DELETE FROM user_roles WHERE id=%s", (grant,))
