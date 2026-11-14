#!/usr/bin/env bash
set -u
cd <scratchpad>/wt-p0/starter/apps/api
U=postgresql://jkc:ci-test-only@127.0.0.1:55432/jkc_test_g2review
docker exec jkc-ui05b-pytest psql -U jkc -d postgres -qc "DROP DATABASE IF EXISTS jkc_test_g2review WITH (FORCE)" -c "CREATE DATABASE jkc_test_g2review"
DATABASE_URL=$U /Users/quoctuan8386/Documents/JKC_AI_AGENT_PROJECT/.venv/bin/python -m alembic upgrade head >/dev/null 2>&1
docker exec jkc-ui05b-pytest psql -U jkc -d postgres -qc "ALTER DATABASE jkc_test_g2review SET jkc.environment = 'production'"
count() { docker exec jkc-ui05b-pytest psql -U jkc -d jkc_test_g2review -tAc "SELECT count(*) FROM users WHERE employee_code LIKE 'DEMO-%'"; }
run() { DATABASE_URL=$U APP_ENV=staging COOKIE_SECURE=true APP_ORIGIN=https://review.invalid DEMO_PASSWORD=review-only-password "$@" /Users/quoctuan8386/Documents/JKC_AI_AGENT_PROJECT/.venv/bin/python -m app.seed 2>&1 | tail -1; echo "   DEMO users: $(count)"; }
echo "== DB đánh dấu production, owner (superuser) kết nối, APP_ENV=staging"
echo "-- 1. Chạy seed bình thường:"; run env
echo "-- 2. Ghi đè dấu cho phiên: PGOPTIONS='-c jkc.environment=staging':"; run env PGOPTIONS='-c jkc.environment=staging'
echo "-- dấu ở mức database (pg_db_role_setting):"; docker exec jkc-ui05b-pytest psql -U jkc -d jkc_test_g2review -tAc "SELECT array_to_string(setconfig, ',') FROM pg_db_role_setting WHERE setdatabase=(SELECT oid FROM pg_database WHERE datname=current_database()) AND setrole=0"
docker exec jkc-ui05b-pytest psql -U jkc -d postgres -qc "DROP DATABASE IF EXISTS jkc_test_g2review WITH (FORCE)"
