"""Post-merge review (not part of any PR): DATA-39B under concurrent requests."""

from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from app.main import create_app
from test_sprint01 import PREFIX, answers, finish_lesson, history, learner, owner, runtime_client, runtime_url, stale_attempt  # noqa: F401


def clone(base):
    token = base.cookies["jkc_session"]
    csrf = base.headers["X-CSRF-Token"]

    def call(method, path, **kw):
        with TestClient(create_app(), base_url="http://localhost:3000", headers={"Origin": "http://localhost:3000", "X-CSRF-Token": csrf}) as c:
            c.cookies.set("jkc_session", token, domain="localhost.local", path="/api")
            r = getattr(c, method)(path, **kw)
            return r.status_code, (r.json().get("error") or {}).get("code") if r.headers.get("content-type", "").startswith("application/json") else None, r.json()

    return call


def test_two_concurrent_submits_of_a_stale_attempt_are_both_refused(runtime_client, learner):
    aid = learner["assignment"]
    finish_lesson(runtime_client, learner)
    first = runtime_client.post(f"{PREFIX}/my/learning/{aid}/quiz-attempts").json()["id"]
    assert runtime_client.post(f"{PREFIX}/quiz-attempts/{first}/submit", json=answers(True)).status_code == 200
    stale = stale_attempt(aid)
    before = history(aid)
    call = clone(runtime_client)
    with ThreadPoolExecutor(max_workers=4) as pool:
        res = list(pool.map(lambda _: call("post", f"{PREFIX}/quiz-attempts/{stale}/submit", json=answers(True))[:2], range(4)))
    assert res == [(409, "QUIZ_ALREADY_PASSED")] * 4, res
    assert history(aid) == before


def test_pass_racing_with_start_never_opens_a_new_attempt(runtime_client, learner):
    aid = learner["assignment"]
    finish_lesson(runtime_client, learner)
    first = runtime_client.post(f"{PREFIX}/my/learning/{aid}/quiz-attempts").json()["id"]
    call = clone(runtime_client)
    jobs = [("post", f"{PREFIX}/quiz-attempts/{first}/submit", {"json": answers(True)})] + [("post", f"{PREFIX}/my/learning/{aid}/quiz-attempts", {})] * 5
    with ThreadPoolExecutor(max_workers=6) as pool:
        res = list(pool.map(lambda j: call(j[0], j[1], **j[2]), jobs))
    assert res[0][0] == 200 and res[0][2]["passed"] is True
    for status, code, body in res[1:]:
        # Before the pass commits: the same pending attempt is handed back. After: 409. Never a new attempt.
        assert (status == 200 and body["id"] == first) or (status == 409 and code == "QUIZ_ALREADY_PASSED"), (status, code)
    state = history(aid)
    assert len(state["attempts"]) == 1 and state["attempts"][0]["passed"] is True and state["audit"] == 1


def test_many_concurrent_submits_of_one_open_attempt_grade_once(runtime_client, learner):
    aid = learner["assignment"]
    finish_lesson(runtime_client, learner)
    first = runtime_client.post(f"{PREFIX}/my/learning/{aid}/quiz-attempts").json()["id"]
    call = clone(runtime_client)
    with ThreadPoolExecutor(max_workers=6) as pool:
        res = sorted(pool.map(lambda r: call("post", f"{PREFIX}/quiz-attempts/{first}/submit", json=answers(r))[:2], [True, False, True, False, True, True]))
    assert res[0] == (200, None) and all(s == 409 for s, _ in res[1:]), res
    state = history(aid)
    assert len([a for a in state["attempts"] if a["submitted_at"]]) == 1 and state["audit"] == 1 and state["responses"] == 2
