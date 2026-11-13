"""UI-06: DEMO incident guide fixtures stay inside the DEMO namespace and the existing guide ACL applies."""
# ruff: noqa: F811

import pytest
from app import seed_incident_guides as guides
from test_sprint01 import owner, signin, runtime_url, runtime_client  # noqa: F401

PREFIX = "/api/v1"


@pytest.fixture(scope="module", autouse=True)
def archive_synthetic_content_after_tests():
    with owner() as conn:
        existing = [r["id"] for r in conn.execute("SELECT id FROM contents").fetchall()]
    yield
    with owner() as conn:
        conn.execute("UPDATE contents SET archived_at=now() WHERE NOT (id=ANY(%s::uuid[]))", (existing,))


@pytest.fixture()
def demo_namespace(monkeypatch):
    # Other suites create non-DEMO synthetic accounts in the shared test DB; the namespace guard itself is
    # covered by test_refuses_when_database_has_non_demo_accounts below. The env check still runs.
    real = guides.guard

    def env_only(conn):
        if guides.settings().app_env not in ("development", "test"):
            real(conn)

    monkeypatch.setattr(guides, "guard", env_only)
    # The seed container runs as the owner role; runtime_client points the app at the RLS runtime role.
    monkeypatch.setattr(guides, "connection", owner)


def test_drafts_are_invisible_until_published_and_acl_applies(runtime_client, demo_namespace):
    c = runtime_client
    drafted = guides.draft()
    for user in ["employee", "head", "other", "admin"]:
        signin(c, user)
        for key in ["main", "plain", "related", "technical", "draft"]:
            assert c.get(f"{PREFIX}/incidents/{drafted[key]['id']}").status_code == 404, (user, key)
    published = guides.publish([drafted[k]["id"] for k in ["main", "related", "technical"]])
    assert len(published) == 3
    visible = {"employee": {"main", "related"}, "head": {"main", "related"}, "other": {"technical"}, "admin": {"technical"}}
    for user, keys in visible.items():
        signin(c, user)
        for key in ["main", "related", "technical", "draft", "plain"]:
            res = c.get(f"{PREFIX}/incidents/{drafted[key]['id']}")
            assert res.status_code == (200 if key in keys else 404), (user, key)
            if key in keys:
                body = res.json()
                assert body["kind"] == "INCIDENT_GUIDE" and body["approver_name"] and body["process_name"]
        found = {i["id"] for i in c.get(PREFIX + "/incidents", params={"q": drafted["token"], "pageSize": 100}).json()["items"]}
        assert found == {drafted[k]["id"] for k in keys}, user
    signin(c, "head")
    assert c.get(f"{PREFIX}/incidents/{drafted['main']['id']}").json()["approver_name"] == c.get(PREFIX + "/auth/me").json()["full_name"]


def test_publish_only_touches_unpublished_demo_ui06_drafts(demo_namespace):
    drafted = guides.draft()
    guides.publish([drafted["main"]["id"]])
    with pytest.raises(RuntimeError):
        guides.publish([drafted["main"]["id"]])  # already published
    with owner() as conn:
        seeded = conn.execute("SELECT id FROM contents WHERE code='DEMO-incident'").fetchone()
    if seeded:
        with pytest.raises(RuntimeError):
            guides.publish([str(seeded["id"])])  # not a DEMO-UI06 draft


def test_refuses_outside_development_or_test(monkeypatch):
    monkeypatch.setattr(guides.settings(), "app_env", "staging")
    with pytest.raises(RuntimeError):
        guides.draft()
    with pytest.raises(RuntimeError):
        guides.publish([])


def test_refuses_when_database_has_non_demo_accounts():
    from uuid import uuid4
    from app.seed import uid

    user = uuid4()
    with owner() as conn:
        conn.execute(
            "INSERT INTO users(id,employee_code,username,full_name,department_id,password_hash) VALUES (%s,%s,%s,%s,%s,'x')",
            (user, "REAL-" + user.hex[:8], "real" + user.hex[:8], "Không phải DEMO", uid("PRODUCTION")),
        )
    try:
        with pytest.raises(RuntimeError):
            guides.draft()
    finally:
        with owner() as conn:
            conn.execute("DELETE FROM users WHERE id=%s", (user,))
