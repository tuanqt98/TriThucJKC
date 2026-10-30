from pathlib import Path
from alembic import op

revision = "001"
down_revision = None


def upgrade():
    op.get_bind().exec_driver_sql(Path(__file__).with_name("001_initial.sql").read_text())


def downgrade():
    # Only application tables, in FK dependency order. Back up before destructive rollback.
    tables = """integration_jobs audit_logs notifications quiz_responses quiz_attempts
    lesson_progress course_assignments quiz_options quiz_questions lessons course_versions courses
    answers questions incident_occurrences incident_solutions incidents reading_acks reading_assignments
    approval_events approvals attachments content_acl content_tags content_processes""".split()
    for table in tables:
        op.execute(f"DROP TABLE {table}")
    op.execute("ALTER TABLE contents DROP CONSTRAINT fk_current_version")
    for table in "content_versions contents tags categories equipment production_processes sessions user_roles role_permissions permissions roles users departments".split():
        op.execute(f"DROP TABLE {table}")
    for name in ["approval_decision", "visibility_level", "content_state"]:
        op.execute(f"DROP TYPE {name}")
