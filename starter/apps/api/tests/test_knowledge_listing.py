"""UI-05: read-only display fields on content listings must not widen ACL."""

from app.seed import uid

PREFIX = "/api/v1"


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
