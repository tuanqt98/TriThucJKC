"""Run only inside a dedicated test DB; no upgrade/downgrade of application DBs."""

import json
import os
import subprocess
from pathlib import Path
from urllib.parse import urlsplit

import psycopg

url = os.environ.get("TEST_DATABASE_URL", "")
if not urlsplit(url).path.startswith("/jkc_test"):
    raise SystemExit(
        "Refuse: TEST_DATABASE_URL must name an isolated jkc_test database"
    )
env = {**os.environ, "DATABASE_URL": url}
steps = []
for direction, target in [
    ("upgrade", "head"),
    ("downgrade", "003"),
    ("upgrade", "head"),
    ("downgrade", "base"),
    ("upgrade", "head"),
]:
    subprocess.run(["alembic", direction, target], env=env, check=True)
    with psycopg.connect(url) as db:
        row = db.execute("SELECT version_num FROM alembic_version").fetchone()
    steps.append(
        {"direction": direction, "target": target, "actual": row[0] if row else "base"}
    )
    assert (row[0] if row else "base") == ({"head": "007"}.get(target, target))
output = {
    "result": "PASS",
    "steps": steps,
    "scope": "empty dedicated DEMO test database; baseline and Sprint 0.1 rollback/reapply",
}
Path("/evidence/migration-cycle.json").write_text(json.dumps(output, indent=2) + "\n")
print(json.dumps(output))
