"""G-2 (PO 11/11/2026): every DEMO/UAT seed must refuse a production or real-data database.

Three independent checks, all before any write and inside the caller's transaction:
1. APP_ENV comes from the deployment (compose no longer forces it) and must be development/test/staging.
2. Database marker: IT sets ``ALTER DATABASE <db> SET jkc.environment = 'production'`` on production;
   the marker lives in the database itself, so a wrong compose file or env var cannot bypass it.
3. Namespace: the database may only contain synthetic accounts (employee code ``DEMO-*`` or username ``uat_*``).
"""

from app.config import settings

ALLOWED_ENVS = ("development", "test", "staging")
DB_MARKER = "jkc.environment"
NON_DEMO_ACCOUNT = "SELECT 1 FROM users WHERE NOT (employee_code LIKE 'DEMO-%' OR left(username::text,4)='uat_') LIMIT 1"


def database_marker(conn):
    row = conn.execute("SELECT current_setting(%s, true) AS v", (DB_MARKER,)).fetchone()
    value = row["v"] if isinstance(row, dict) else row[0]
    return (value or "").strip().lower()


def require_demo_database(conn, what="DEMO seed"):
    env = settings().app_env
    if env not in ALLOWED_ENVS:
        raise RuntimeError(f"Refuse {what}: APP_ENV={env!r} is not development/test/staging.")
    if database_marker(conn) == "production":
        raise RuntimeError(f"Refuse {what}: database is marked {DB_MARKER}=production.")
    if conn.execute(NON_DEMO_ACCOUNT).fetchone():
        raise RuntimeError(f"Refuse {what}: database contains accounts outside the synthetic DEMO namespace.")
