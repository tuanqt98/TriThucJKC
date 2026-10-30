from alembic import op

revision = "002"
down_revision = "001"


def upgrade():
    op.execute("""
    CREATE UNIQUE INDEX uq_user_roles_scope ON user_roles(user_id, role_id, COALESCE(scope_department_id, '00000000-0000-0000-0000-000000000000'::uuid));
    CREATE INDEX idx_sessions_user ON sessions(user_id, expires_at);
    CREATE TABLE login_limits (key text PRIMARY KEY, failures integer NOT NULL DEFAULT 0, window_start timestamptz NOT NULL DEFAULT now());
    CREATE TABLE password_resets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), token_hash text UNIQUE NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz);
    CREATE FUNCTION check_published_version() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.current_published_version_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM content_versions WHERE id=NEW.current_published_version_id AND content_id=NEW.id AND status='APPROVED'
      ) THEN RAISE EXCEPTION 'Published version must be approved and belong to content'; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER published_version_guard BEFORE INSERT OR UPDATE ON contents FOR EACH ROW EXECUTE FUNCTION check_published_version();
    CREATE FUNCTION immutable_published_version() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.status='APPROVED' THEN RAISE EXCEPTION 'Approved versions are immutable; create a new version'; END IF;
      IF TG_OP='DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER version_guard BEFORE UPDATE OR DELETE ON content_versions FOR EACH ROW EXECUTE FUNCTION immutable_published_version();
    CREATE FUNCTION immutable_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Audit records are append-only'; END $$;
    CREATE TRIGGER audit_guard BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION immutable_audit();
    """)


def downgrade():
    op.execute("""DROP TRIGGER audit_guard ON audit_logs; DROP FUNCTION immutable_audit();
    DROP TRIGGER version_guard ON content_versions; DROP FUNCTION immutable_published_version();
    DROP TRIGGER published_version_guard ON contents; DROP FUNCTION check_published_version();
    DROP TABLE password_resets; DROP TABLE login_limits;
    DROP INDEX idx_sessions_user; DROP INDEX uq_user_roles_scope;""")
