#!/usr/bin/env bash
set -u
W=<scratchpad>/wt-p0
R=/Users/quoctuan8386/Documents/JKC_AI_AGENT_PROJECT
U=postgresql://jkc:review-only@127.0.0.1:55433/jkc_test_review
psqlr() { docker exec -i jkc-review-pg17 psql -U jkc -d jkc_test_review -tA "$@"; }
docker exec jkc-review-pg17 psql -U jkc -d postgres -qc "DROP DATABASE IF EXISTS jkc_test_review WITH (FORCE)" -c "CREATE DATABASE jkc_test_review"
docker exec jkc-review-pg17 pg_restore -U jkc -d jkc_test_review --no-owner --exit-on-error /tmp/r.dump
probe() {
  psqlr -c "SELECT 'history md5 '||md5(string_agg(id::text||coalesce(score::text,'')||coalesce(submitted_at::text,''),',' ORDER BY id))||' · attempts '||count(*) FROM quiz_attempts"
  psqlr 2>&1 <<'SQL' | grep -E "submit stale|NO ERROR"
DO $$ DECLARE s uuid; u uuid; BEGIN
 SELECT o.id, ca.user_id INTO s,u FROM quiz_attempts o JOIN course_assignments ca ON ca.id=o.assignment_id
  WHERE o.submitted_at IS NULL AND EXISTS(SELECT 1 FROM quiz_attempts p WHERE p.assignment_id=o.assignment_id AND p.passed) ORDER BY o.id LIMIT 1;
 PERFORM set_config('jkc.user_id', u::text, true);
 BEGIN PERFORM * FROM jkc_submit_quiz(s, '[]'::jsonb, 'review'); RAISE NOTICE 'NO ERROR';
 EXCEPTION WHEN raise_exception THEN RAISE NOTICE 'submit stale -> %', SQLERRM; END;
END $$;
SQL
}
cd $W/starter/apps/api
echo "== bản sao staging, revision $(psqlr -c 'SELECT version_num FROM alembic_version')"; probe
echo "== alembic upgrade head"; DATABASE_URL=$U $R/.venv/bin/python -m alembic upgrade head >/dev/null 2>&1; echo "revision $(psqlr -c 'SELECT version_num FROM alembic_version')"; probe
echo "== alembic downgrade 007 (rollback)"; DATABASE_URL=$U $R/.venv/bin/python -m alembic downgrade 007 >/dev/null 2>&1; echo "revision $(psqlr -c 'SELECT version_num FROM alembic_version')"; probe
echo "== alembic upgrade head (áp lại)"; DATABASE_URL=$U $R/.venv/bin/python -m alembic upgrade head >/dev/null 2>&1; echo "revision $(psqlr -c 'SELECT version_num FROM alembic_version')"; probe
