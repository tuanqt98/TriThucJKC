import os
import pytest
from fastapi.testclient import TestClient
from app.config import settings
from app.db import connection
from app.main import create_app
from app.seed import seed


@pytest.fixture(scope="session", autouse=True)
def test_db():
    url = os.environ.get("TEST_DATABASE_URL", "")
    if not url or not url.rsplit("/", 1)[-1].startswith("jkc_test"):
        raise RuntimeError("TEST_DATABASE_URL phải chỉ tới database riêng có tên bắt đầu jkc_test. Chạy migration trước.")
    os.environ["DATABASE_URL"] = url
    os.environ["COOKIE_SECURE"] = "false"
    os.environ["APP_ENV"] = "test"
    os.environ["DEMO_PASSWORD"] = "test-only-password-123"
    settings.cache_clear()
    seed()


@pytest.fixture()
def client():
    with connection() as conn:
        conn.execute("DELETE FROM login_limits")
    with TestClient(create_app(), base_url="http://localhost:3000", headers={"Origin": "http://localhost:3000"}) as client:
        yield client


@pytest.fixture()
def login(client):
    def perform(username="employee"):
        result = client.post("/api/v1/auth/login", json={"username": username, "password": "test-only-password-123"})
        assert result.status_code == 200, result.text
        client.headers["X-CSRF-Token"] = result.json()["csrf_token"]
        return result.json()

    return perform
