"""G-2 (PO 11/11/2026): every DEMO/UAT seed must refuse a production or real-data database.

Three independent checks, all before any write and inside the caller's transaction:
1. APP_ENV comes from the deployment (compose no longer forces it) and must be development/test/staging.
2. Database marker: IT sets ``ALTER DATABASE <db> SET jkc.environment = 'production'`` on production;
   it is read from the catalog as well as the session, so a wrong compose file, env var or a client-side
   override (PGOPTIONS / SET) cannot bypass it.
3. Namespace: the database may only contain synthetic accounts (employee code ``DEMO-*`` or username ``uat_*``).
"""

from app.config import settings

ALLOWED_ENVS = ("development", "test", "staging")
DB_MARKER = "jkc.environment"
NON_DEMO_ACCOUNT = "SELECT 1 FROM users WHERE NOT (employee_code LIKE 'DEMO-%' OR left(username::text,4)='uat_') LIMIT 1"


# G2-R1 (PO 14/11/2026): the session value (current_setting) can be overridden by the connecting client
# (PGOPTIONS, SET), so the marker is also read from the catalog: the database-wide and role-in-database
# settings stored by ALTER DATABASE / ALTER ROLE ... IN DATABASE, which a session cannot change.
# Any source saying "production" wins. pg_db_role_setting is readable without superuser.
MARKER_SOURCES = """SELECT current_setting(%(m)s, true) AS v
UNION ALL
SELECT substr(cfg, length(%(m)s) + 2) FROM pg_db_role_setting s, unnest(s.setconfig) cfg
 WHERE s.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database())
   AND s.setrole IN (0, (SELECT oid FROM pg_roles WHERE rolname = current_user))
   AND cfg LIKE %(m)s || '=%%'"""


def database_marker(conn):
    rows = conn.execute(MARKER_SOURCES, {"m": DB_MARKER}).fetchall()
    values = {((r["v"] if isinstance(r, dict) else r[0]) or "").strip().lower() for r in rows}
    return "production" if "production" in values else next((v for v in sorted(values) if v), "")


def require_demo_database(conn, what="DEMO seed"):
    env = settings().app_env
    if env not in ALLOWED_ENVS:
        raise RuntimeError(f"Refuse {what}: APP_ENV={env!r} is not development/test/staging.")
    if database_marker(conn) == "production":
        raise RuntimeError(f"Refuse {what}: database is marked {DB_MARKER}=production.")
    if conn.execute(NON_DEMO_ACCOUNT).fetchone():
        raise RuntimeError(f"Refuse {what}: database contains accounts outside the synthetic DEMO namespace.")
