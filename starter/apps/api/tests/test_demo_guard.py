"""G-2 (PO 11/11/2026): DEMO/UAT seeds must never write into a production or real-data database.

Each case runs on its own freshly migrated database so "refused" can be proven as "nothing was written".
"""

import os
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg
import pytest
from psycopg import sql
from psycopg.rows import dict_row

from app import demo_guard, seed_incident_guides
from app.config import settings
from app.seed import seed
from app.seed_uat import seed_uat

API = Path(__file__).resolve().parents[1]
ENTRYPOINTS = {"app.seed": seed, "app.seed_uat": seed_uat, "app.seed_incident_guides": seed_incident_guides.draft}


@pytest.fixture()
def fresh_db(monkeypatch):
    base = urlsplit(os.environ["TEST_DATABASE_URL"])
    name = "jkc_test_g2_" + uuid.uuid4().hex[:8]
    admin = urlunsplit(base._replace(path="/postgres"))
    url = urlunsplit(base._replace(path="/" + name))
    with psycopg.connect(admin, autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
    try:
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=API, env={**os.environ, "DATABASE_URL": url}, check=True)
        monkeypatch.setattr(settings(), "database_url", url)
        yield {"name": name, "url": url}
    finally:
        with psycopg.connect(admin, autocommit=True) as conn:
            conn.execute(sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(name)))


def snapshot(url):
    with psycopg.connect(url, row_factory=dict_row) as conn:
        return {
            t: conn.execute(sql.SQL("SELECT count(*) n FROM {}").format(sql.Identifier(t))).fetchone()["n"]
            for t in ["users", "departments", "production_processes", "contents", "content_versions", "courses", "audit_logs"]
        }


def mark_production(db, value="production"):
    with psycopg.connect(db["url"], autocommit=True) as conn:
        conn.execute(sql.SQL("ALTER DATABASE {} SET jkc.environment = {}").format(sql.Identifier(db["name"]), sql.Literal(value)))


def add_real_account(db):
    with psycopg.connect(db["url"]) as conn:
        dept = uuid.uuid4()
        conn.execute("INSERT INTO departments(id,code,name) VALUES (%s,'REAL-DEPT','Bộ phận thật')", (dept,))
        conn.execute(
            "INSERT INTO users(id,employee_code,username,full_name,department_id,password_hash) VALUES (%s,'NV0001','nv0001','Nhân viên thật',%s,'x')",
            (uuid.uuid4(), dept),
        )


def test_seed_works_on_an_empty_staging_database(fresh_db, monkeypatch):
    monkeypatch.setattr(settings(), "app_env", "staging")  # compose seed now inherits staging
    seed()
    after = snapshot(fresh_db["url"])
    assert after["users"] >= 4 and after["contents"] >= 5
    seed()  # idempotent on a DEMO-only database
    assert snapshot(fresh_db["url"]) == after


@pytest.mark.parametrize("env", ["production", "prod", "", "Staging "])
@pytest.mark.parametrize("entry", ENTRYPOINTS)
def test_refuses_outside_allowed_app_env_and_writes_nothing(fresh_db, monkeypatch, env, entry):
    monkeypatch.setattr(settings(), "app_env", env)
    before = snapshot(fresh_db["url"])
    with pytest.raises(RuntimeError, match="APP_ENV"):
        ENTRYPOINTS[entry]()
    assert snapshot(fresh_db["url"]) == before


@pytest.mark.parametrize("marker", ["production", "PRODUCTION", " Production "])
@pytest.mark.parametrize("entry", ENTRYPOINTS)
def test_refuses_database_marked_production_even_when_app_env_allows(fresh_db, monkeypatch, marker, entry):
    # Simulates the original G-2 risk: a compose file that claims development/staging pointed at production.
    monkeypatch.setattr(settings(), "app_env", "development")
    mark_production(fresh_db, marker)
    before = snapshot(fresh_db["url"])
    with pytest.raises(RuntimeError, match="jkc.environment=production"):
        ENTRYPOINTS[entry]()
    assert snapshot(fresh_db["url"]) == before


@pytest.mark.parametrize("entry", ENTRYPOINTS)
def test_refuses_database_with_real_accounts_and_writes_nothing(fresh_db, monkeypatch, entry):
    monkeypatch.setattr(settings(), "app_env", "staging")
    add_real_account(fresh_db)
    before = snapshot(fresh_db["url"])
    with pytest.raises(RuntimeError, match="outside the synthetic DEMO namespace"):
        ENTRYPOINTS[entry]()
    assert snapshot(fresh_db["url"]) == before
    with psycopg.connect(fresh_db["url"]) as conn:
        assert not conn.execute("SELECT 1 FROM users WHERE employee_code LIKE 'DEMO-%'").fetchone()


def test_other_marker_values_do_not_block_staging(fresh_db, monkeypatch):
    monkeypatch.setattr(settings(), "app_env", "staging")
    mark_production(fresh_db, "staging")
    assert demo_guard.database_marker(psycopg.connect(fresh_db["url"])) == "staging"
    seed()
    assert snapshot(fresh_db["url"])["users"] >= 4


def test_compose_seed_does_not_force_app_env():
    compose = API.parents[2] / "deploy" / "compose.yml"
    if not compose.exists():
        pytest.skip("deploy/ is not part of the API test image; checked in CI foundation instead")
    text = compose.read_text()
    seed_block = text.split("\n  seed:\n", 1)[1].split("\n  backup:\n", 1)[0]
    assert "APP_ENV" not in seed_block.replace("# G-2: APP_ENV", "")


# --- G2-R1 (PO 14/11/2026): a client-side override of the session value must not bypass the marker ---------


def role_marker(db, value):
    with psycopg.connect(db["url"], autocommit=True) as conn:
        role = conn.execute("SELECT current_user AS u").fetchone()[0]
        conn.execute(
            sql.SQL("ALTER ROLE {} IN DATABASE {} SET jkc.environment = {}").format(
                sql.Identifier(role), sql.Identifier(db["name"]), sql.Literal(value)
            )
        )


@pytest.mark.parametrize("entry", ENTRYPOINTS)
def test_pgoptions_override_does_not_bypass_production_marker(fresh_db, monkeypatch, entry):
    # Owner (superuser here) connects with PGOPTIONS rewriting the session value to "staging".
    monkeypatch.setattr(settings(), "app_env", "staging")
    mark_production(fresh_db)
    monkeypatch.setenv("PGOPTIONS", "-c jkc.environment=staging")
    with psycopg.connect(fresh_db["url"]) as conn:  # the override really applies to the session
        assert conn.execute("SELECT current_setting('jkc.environment', true)").fetchone()[0] == "staging"
    before = snapshot(fresh_db["url"])
    with pytest.raises(RuntimeError, match="jkc.environment=production"):
        ENTRYPOINTS[entry]()
    assert snapshot(fresh_db["url"]) == before
    with psycopg.connect(fresh_db["url"]) as conn:
        assert not conn.execute("SELECT 1 FROM users WHERE employee_code LIKE 'DEMO-%'").fetchone()


@pytest.mark.parametrize("entry", ENTRYPOINTS)
def test_role_in_database_marker_is_honoured(fresh_db, monkeypatch, entry):
    monkeypatch.setattr(settings(), "app_env", "development")
    role_marker(fresh_db, "production")
    monkeypatch.setenv("PGOPTIONS", "-c jkc.environment=development")
    before = snapshot(fresh_db["url"])
    with pytest.raises(RuntimeError, match="jkc.environment=production"):
        ENTRYPOINTS[entry]()
    assert snapshot(fresh_db["url"]) == before


def test_production_wins_over_a_conflicting_role_marker(fresh_db, monkeypatch):
    monkeypatch.setattr(settings(), "app_env", "staging")
    mark_production(fresh_db)
    role_marker(fresh_db, "staging")
    with psycopg.connect(fresh_db["url"]) as conn:
        assert demo_guard.database_marker(conn) == "production"
    with pytest.raises(RuntimeError, match="jkc.environment=production"):
        seed()
