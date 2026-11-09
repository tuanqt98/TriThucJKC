"""UI-05: read-only display fields and accent-insensitive search on content listings must not widen ACL."""
# ruff: noqa: F811

from uuid import uuid4
import pytest
from app.seed import uid
from test_sprint01 import owner, signin, runtime_url, runtime_client  # noqa: F401

PREFIX = "/api/v1"


@pytest.fixture(scope="module", autouse=True)
def archive_synthetic_content_after_tests():
    # Same isolation as test_sprint01: keep audit/version history, archive only content created here.
    with owner() as conn:
        existing = [r["id"] for r in conn.execute("SELECT id FROM contents").fetchall()]
    yield
    with owner() as conn:
        conn.execute("UPDATE contents SET archived_at=now() WHERE NOT (id=ANY(%s::uuid[]))", (existing,))


def test_display_fields_on_listing_search_and_detail(client, login):
    login("employee")
    page = client.get(PREFIX + "/articles", params={"q": "DEMO", "pageSize": 100}).json()
    items = {i["id"]: i for i in page["items"]}
    article = items[str(uid("article"))]
    # Seed links the article to OFFSET only through the legacy content_processes table.
    assert article["process_id"] == str(uid("OFFSET"))
    assert article["process_name"] == "In offset"
    assert article["author_name"]
    assert article["approved_at"]
    detail = client.get(f"{PREFIX}/articles/{uid('article')}").json()
    for key in ("process_id", "process_name", "author_name", "approved_at"):
        assert detail[key] == article[key]
    found = client.get(PREFIX + "/search", params={"q": "DEMO", "pageSize": 100}).json()
    assert {i["id"]: i["process_name"] for i in found["items"]}[str(uid("incident"))] == "In offset"


def test_process_filter_matches_displayed_process(client, login):
    login("employee")
    offset = str(uid("OFFSET"))
    page = client.get(PREFIX + "/articles", params={"processId": offset, "pageSize": 100}).json()
    assert page["total"] == len(page["items"]) >= 1
    assert all(i["process_id"] == offset for i in page["items"])


def test_display_fields_do_not_change_visibility(client, login):
    # Same visible sets as test_acl_search_count_detail; the extra joins must not add rows.
    expected = {"admin": {"doc", "cross"}, "employee": {"doc", "article", "incident", "restricted"}, "head": {"doc", "article", "incident"}}
    for username, visible in expected.items():
        client.cookies.clear()
        login(username)
        result = client.get(PREFIX + "/search", params={"q": "DEMO", "pageSize": 100}).json()
        seeded = {str(uid(code)) for code in ["doc", "article", "incident", "restricted", "cross"]}
        ids = {i["id"] for i in result["items"]} & seeded
        assert ids == {str(uid(code)) for code in visible}
        assert len({i["id"] for i in result["items"]}) == len(result["items"])


# --- UI-05 round 2: accent-insensitive title/body search must not widen visibility ----------------------------

W = "/api/v1/workspace/contents"


def _version(row):
    return {"content_id": row["id"], "version_id": row["version_id"], "revision": row["revision"]}


def _publish(c, title, body):
    signin(c)
    draft = c.post(W, json={"kind": "ARTICLE", "title": title, "body": body, "visibility": "DEPARTMENT", "process_id": str(uid("FLEXO"))})
    assert draft.status_code == 201, draft.text
    pending = c.post(W + "/submit", json=_version(draft.json())).json()
    signin(c, "head")
    approved = c.post(W + "/approve", json=_version(pending))
    assert approved.status_code == 200, approved.text
    return approved.json()


NFD_PHRASE = "l\u00ea\u0323ch ma\u0300u ba\u0302\u0301t thu\u031bo\u031b\u0300ng"  # decomposed input (some keyboards)


@pytest.mark.parametrize(
    "phrase",
    ["lệch màu bất thường", "lech mau bat thuong", "LỆCH MÀU BẤT THƯỜNG", "LECH MAU BAT THUONG", NFD_PHRASE],
)
def test_title_search_ignores_accents_and_case(runtime_client, phrase):
    c = runtime_client
    token = uuid4().hex[:10]
    row = _publish(c, f"DEMO · Lệch màu bất thường {token}", {"text": "Nội dung DEMO"})
    signin(c)
    found = c.get(PREFIX + "/articles", params={"q": f"{phrase} {token}", "pageSize": 100}).json()
    assert [i["id"] for i in found["items"]] == [row["id"]]
    assert found["total"] == 1


def test_words_match_anywhere_in_title_or_body(runtime_client):
    c = runtime_client
    token = uuid4().hex[:10]
    row = _publish(c, f"DEMO · Lệch màu bất thường {token}", {"Bối cảnh": "Ca in đêm trên máy flexo"})
    signin(c)
    for q in [f"{token} lech", f"mau {token} flexo", f"FLEXO   đêm {token}"]:
        assert [i["id"] for i in c.get(PREFIX + "/search", params={"q": q}).json()["items"]] == [row["id"]], q
    # Every word must match: one unknown word excludes the article.
    assert c.get(PREFIX + "/search", params={"q": f"{token} khongco{token}"}).json()["total"] == 0


def test_body_search_is_accent_insensitive_but_only_published_and_in_scope(runtime_client):
    c = runtime_client
    token = uuid4().hex[:10]
    row = _publish(c, f"DEMO · Bài tìm nội dung {token}", {"Cách xử lý": f"Ghi nhận đường bế lệch {token}"})
    # Author's newer draft carries a secret phrase: it must never be searchable (only the published version is).
    signin(c)
    fork = c.post(W + "/fork", json={**_version(row), "remark": ""})
    assert fork.status_code == 200, fork.text
    saved = c.put(W, json={**_version(fork.json()), "body": {"text": f"bimatbannhap {token}"}, "process_id": str(uid("FLEXO"))})
    assert saved.status_code == 200, saved.text
    for user, visible in [("employee", True), ("head", True), ("other", False), ("admin", False)]:
        signin(c, user)
        hit = c.get(PREFIX + "/search", params={"q": f"duong be lech {token}", "pageSize": 100}).json()
        assert ([i["id"] for i in hit["items"]] == [row["id"]]) is visible, user
        assert hit["total"] == (1 if visible else 0), user
        secret = c.get(PREFIX + "/search", params={"q": f"bimatbannhap {token}", "pageSize": 100}).json()
        assert secret["total"] == 0 and secret["items"] == [], user


def test_pending_and_out_of_scope_bodies_are_not_searchable(runtime_client):
    c = runtime_client
    token = uuid4().hex[:10]
    signin(c)
    draft = c.post(
        W,
        json={
            "kind": "ARTICLE",
            "title": f"DEMO · Chờ duyệt {token}",
            "body": {"text": f"noidungcho {token}"},
            "visibility": "DEPARTMENT",
            "process_id": str(uid("OFFSET")),
        },
    )
    assert c.post(W + "/submit", json=_version(draft.json())).status_code == 200
    for user in ["employee", "head", "other", "admin"]:
        signin(c, user)
        assert c.get(PREFIX + "/search", params={"q": token}).json()["total"] == 0, user


def test_wildcards_stay_literal_after_folding(client, login):
    login("employee")
    assert client.get(PREFIX + "/search", params={"q": "%", "pageSize": 1}).json()["total"] == 0
    assert client.get(PREFIX + "/search", params={"q": "_", "pageSize": 1}).json()["total"] == 0
