"""A successful response must never publish credentials before their DB commit."""

# ruff: noqa: F811
import asyncio
import json
import time
from contextlib import contextmanager
from http.cookies import SimpleCookie
import psycopg
import pytest
from app import db
from app.main import create_app
from app.security import digest
from app.seed import uid
from test_sprint01 import owner, runtime_url, runtime_client  # noqa: F401


@pytest.mark.parametrize("commit_failure", [False, True], ids=["committed-before-cookie", "rollback-before-error"])
def test_login_session_is_committed_before_response_start(runtime_client, monkeypatch, commit_failure):
    original = db.connection
    with owner() as conn:
        before = conn.execute("SELECT count(*) n FROM sessions WHERE user_id=%s", (uid("employee"),)).fetchone()["n"]

    @contextmanager
    def delayed_commit():
        with original() as conn:
            yield conn
            # Deliberately widen the scheduling window; never sleep in app code.
            time.sleep(0.15)
            if commit_failure:
                raise psycopg.OperationalError("Simulated commit failure; must not publish a success cookie")

    monkeypatch.setattr(db, "connection", delayed_commit)
    payload = json.dumps({"username": "employee", "password": "test-only-password-123"}).encode()
    visible = []

    async def exercise():
        received = False

        async def receive():
            nonlocal received
            if not received:
                received = True
                return {"type": "http.request", "body": payload, "more_body": False}
            await asyncio.Event().wait()

        async def send(message):
            if message["type"] != "http.response.start":
                return
            assert message["status"] == (503 if commit_failure else 200)
            cookies = SimpleCookie()
            for key, value in message["headers"]:
                if key.lower() == b"set-cookie":
                    cookies.load(value.decode())
            if commit_failure:
                assert "jkc_session" not in cookies
                visible.append(False)
                return
            token = cookies["jkc_session"].value
            # Independent connection at the actual ASGI start event, unlike
            # TestClient which waits for request-scoped cleanup before returning.
            with owner() as conn:
                visible.append(bool(conn.execute("SELECT 1 FROM sessions WHERE session_hash=%s", (digest(token),)).fetchone()))

        await create_app()(
            {
                "type": "http",
                "asgi": {"version": "3.0", "spec_version": "2.4"},
                "http_version": "1.1",
                "method": "POST",
                "scheme": "http",
                "path": "/api/v1/auth/login",
                "raw_path": b"/api/v1/auth/login",
                "query_string": b"",
                "root_path": "",
                "headers": [
                    (b"host", b"localhost:3000"),
                    (b"origin", b"http://localhost:3000"),
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(payload)).encode()),
                ],
                "client": ("commit-boundary", 12345),
                "server": ("localhost", 3000),
            },
            receive,
            send,
        )

    asyncio.run(exercise())
    assert visible == [not commit_failure], "Session cookie escaped before the session INSERT committed"
    with owner() as conn:
        after = conn.execute("SELECT count(*) n FROM sessions WHERE user_id=%s", (uid("employee"),)).fetchone()["n"]
    assert after == before + (0 if commit_failure else 1)
