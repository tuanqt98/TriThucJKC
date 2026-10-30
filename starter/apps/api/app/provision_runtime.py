"""Owner-only provisioning; runtime login is never made an owner or member of the migrator role."""

import os
import re
import psycopg
from psycopg import sql
from app.config import settings

READ = """alembic_version departments users roles permissions production_processes categories tags
contents content_versions content_acl content_processes content_tags approvals approval_events
attachments reading_assignments reading_acks courses course_versions lessons quiz_questions
course_assignments lesson_progress quiz_attempts quiz_responses user_roles sessions login_limits password_resets""".split()
INSERT = """contents content_versions approvals approval_events attachments reading_assignments reading_acks
lesson_progress quiz_attempts audit_logs users user_roles sessions login_limits""".split()
UPDATE = """contents content_versions approvals sessions login_limits password_resets""".split()


def provision(conn, username, password):
    if not re.fullmatch(r"jkc_[a-z0-9_]{1,40}", username) or len(password) < 20:
        raise ValueError("Runtime role phải bắt đầu jkc_, password tối thiểu 20 ký tự.")
    exists = conn.execute("SELECT 1 FROM pg_roles WHERE rolname=%s", (username,)).fetchone()
    if not exists:
        conn.execute(sql.SQL("CREATE ROLE {} LOGIN").format(sql.Identifier(username)))
    # Reject reuse of an owner/privileged role instead of silently altering it.
    owned = conn.execute("SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner WHERE r.rolname=%s LIMIT 1", (username,)).fetchone()
    memberships = conn.execute(
        "SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=%s", (username,)
    ).fetchone()
    if owned or memberships:
        raise ValueError("Refuse: runtime role đang sở hữu object hoặc có role membership.")
    conn.execute(
        sql.SQL("ALTER ROLE {} NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT PASSWORD {}").format(
            sql.Identifier(username), sql.Literal(password)
        )
    )
    conn.execute("REVOKE CREATE ON SCHEMA public FROM PUBLIC")
    conn.execute(sql.SQL("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {}").format(sql.Identifier(username)))
    conn.execute(sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(sql.Identifier(username)))
    for privilege, tables in [("SELECT", READ), ("INSERT", INSERT), ("UPDATE", UPDATE)]:
        conn.execute(
            sql.SQL("GRANT {} ON {} TO {}").format(
                sql.SQL(privilege), sql.SQL(",").join(map(sql.Identifier, tables)), sql.Identifier(username)
            )
        )
    conn.execute(sql.SQL("GRANT SELECT(id,question_id,answer_text) ON quiz_options TO {}").format(sql.Identifier(username)))
    conn.execute(sql.SQL("GRANT UPDATE(password_hash,must_change_password,token_version) ON users TO {}").format(sql.Identifier(username)))
    for signature in [
        "jkc_user()",
        "jkc_head(uuid)",
        "jkc_tech_admin()",
        "jkc_acl_for(uuid,uuid)",
        "jkc_review(uuid)",
        "jkc_version_read(uuid)",
        "jkc_assigned(uuid)",
        "jkc_submit_quiz(uuid,jsonb,text)",
        "jkc_ack_reading(uuid,uuid,text)",
        "jkc_lock_assignment(uuid)",
        "jkc_hr(uuid,boolean)",
        "jkc_content_workflow(text,jsonb,text)",
        "jkc_content_workspace()",
        "jkc_workspace_people()",
        "jkc_reading_manage(text,jsonb,text)",
        "jkc_incident_read(uuid)",
        "jkc_incident_workflow(text,jsonb,text)",
        "jkc_course_workspace()",
        "jkc_course_workflow(text,jsonb,text)",
        "jkc_training_status(uuid)",
        "jkc_training_progress()",
    ]:
        conn.execute(sql.SQL("REVOKE ALL ON FUNCTION {} FROM PUBLIC").format(sql.SQL(signature)))
        conn.execute(sql.SQL("GRANT EXECUTE ON FUNCTION {} TO {}").format(sql.SQL(signature), sql.Identifier(username)))


if __name__ == "__main__":
    with psycopg.connect(settings().database_url) as conn:
        provision(conn, os.environ["DB_RUNTIME_USER"], os.environ["DB_RUNTIME_PASSWORD"])
    print("Runtime role provisioned: explicit grants, no owner/superuser/BYPASSRLS.")
