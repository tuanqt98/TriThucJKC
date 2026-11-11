"""Isolated test-only migration rollback + backup/restore drill. Requires PostgreSQL CLI."""

import argparse
import json
import os
import subprocess
import tempfile
import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg
from psycopg import sql

parser = argparse.ArgumentParser()
parser.add_argument("--output", default="docs/reports/database-drill.json")
args = parser.parse_args()
source = os.environ["TEST_DATABASE_URL"]
url = urlsplit(source)
assert url.path.startswith("/jkc_test"), "Refuse: source database must start jkc_test"
name = "jkc_test_drill_" + uuid.uuid4().hex[:10]
admin = urlunsplit(url._replace(path="/postgres"))
target = urlunsplit(url._replace(path="/" + name))
root = Path(__file__).resolve().parents[1]
api_dir = root / "starter/apps/api"
python_bin = (
    str(root / ".venv/bin/python") if (root / ".venv/bin/python").exists() else "python"
)
env = {**os.environ, "DATABASE_URL": target}
with psycopg.connect(admin, autocommit=True) as conn:
    conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
try:
    for direction, revision in [
        ("upgrade", "head"),
        ("downgrade", "base"),
        ("upgrade", "head"),
    ]:
        subprocess.run(
            [python_bin, "-m", "alembic", direction, revision],
            cwd=api_dir,
            env=env,
            check=True,
        )
    with psycopg.connect(target) as conn:
        assert (
            conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
            == "007"
        )
    # Fresh target for restore; no shared application database is dropped.
    with psycopg.connect(admin, autocommit=True) as conn:
        conn.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(name)))
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
    with tempfile.TemporaryDirectory(prefix="jkc-restore-") as temp:
        dump = str(Path(temp) / "test.dump")
        subprocess.run(["pg_dump", "--dbname", source, "-Fc", "-f", dump], check=True)
        subprocess.run(
            ["pg_restore", "--dbname", target, "--exit-on-error", "--no-owner", dump],
            check=True,
        )
    counts = {}
    with psycopg.connect(source) as before, psycopg.connect(target) as after:
        for table in [
            "users",
            "contents",
            "content_versions",
            "audit_logs",
            "production_processes",
            "approvals",
            "sessions",
        ]:
            query = sql.SQL("SELECT count(*) FROM {}").format(sql.Identifier(table))
            a, b = (
                before.execute(query).fetchone()[0],
                after.execute(query).fetchone()[0],
            )
            assert a == b, table
            counts[table] = b
    output = {
        "migration": "upgrade → downgrade base → upgrade OK",
        "restore": "isolated pg_dump/pg_restore OK",
        "counts": counts,
        "source": "test database only",
        "postgres": subprocess.check_output(
            ["pg_dump", "--version"], text=True
        ).strip(),
    }
    (root / args.output).write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n"
    )
    print(json.dumps(output, ensure_ascii=False))
finally:
    with psycopg.connect(admin, autocommit=True) as conn:
        conn.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(name)))
