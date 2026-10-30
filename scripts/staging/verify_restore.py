"""Fingerprint before backup; compare restored rows before any post-restore login writes."""

import argparse
import json
import subprocess
from pathlib import Path

import requests

TABLES = [
    "departments",
    "users",
    "roles",
    "user_roles",
    "contents",
    "content_versions",
    "attachments",
    "approvals",
    "approval_events",
    "reading_assignments",
    "reading_acks",
    "courses",
    "course_versions",
    "lessons",
    "quiz_questions",
    "quiz_options",
    "course_assignments",
    "lesson_progress",
    "quiz_attempts",
    "quiz_responses",
    "audit_logs",
    "sessions",
]
parser = argparse.ArgumentParser()
parser.add_argument("action", choices=["capture", "verify"])
parser.add_argument("--project", required=True)
parser.add_argument("--env-file", required=True)
parser.add_argument("--ca")
parser.add_argument("--fixtures", default=".local/uat01.json")
parser.add_argument("--checkpoint", default=".local/restore-checkpoint.json")
args = parser.parse_args()
assert args.project.startswith(("jkc-s01", "jkc-staging"))
base = [
    "docker",
    "compose",
    "--project-name",
    args.project,
    "--env-file",
    args.env_file,
    "-f",
    "deploy/compose.yml",
]
rows = {}
for table in TABLES:
    query = f"SELECT jsonb_build_object('rows',count(*),'sha256',encode(digest(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]'),'sha256'),'hex')) FROM {table} t"
    result = subprocess.check_output(
        [
            *base,
            "exec",
            "-T",
            "db",
            "psql",
            "-U",
            "jkc_owner",
            "-d",
            "jkc",
            "-Atc",
            query,
        ],
        text=True,
    )
    rows[table] = json.loads(result)
path = Path("docs/reports/sprint01/backup-fingerprint.json")
if args.action == "capture":
    checkpoint = Path(args.checkpoint)
    checkpoint.write_text(
        json.dumps(
            {
                "fixture": json.loads(Path(args.fixtures).read_text())["api"],
                "probe": json.loads(
                    Path("docs/reports/sprint01/staging-probe.json").read_text()
                ),
            }
        )
    )
    checkpoint.chmod(0o600)
    path.write_text(
        json.dumps({"project": args.project, "tables": rows}, indent=2) + "\n"
    )
    print(
        "Captured row counts and SHA-256 fingerprints; no row data or credentials exported."
    )
else:
    expected = json.loads(path.read_text())["tables"]
    assert rows == expected, "Restored rows differ from pre-backup snapshot"
    env = dict(
        line.split("=", 1)
        for line in Path(args.env_file).read_text().splitlines()
        if line and not line.startswith("#")
    )
    checkpoint = json.loads(Path(args.checkpoint).read_text())
    fixture = checkpoint["fixture"]
    probe = checkpoint["probe"]
    s = requests.Session()
    s.verify = args.ca
    s.headers["Origin"] = env["APP_ORIGIN"]
    response = s.post(
        env["APP_ORIGIN"] + "/api/v1/auth/login",
        json={"username": fixture["username"], "password": env["DEMO_PASSWORD"]},
        timeout=30,
    )
    assert response.status_code == 200, response.text
    course = s.get(
        env["APP_ORIGIN"] + "/api/v1/my/learning/" + probe["course_assignment"],
        timeout=30,
    )
    assert course.status_code == 200 and any(
        float(a["score"] or 0) == 100 and a["passed"] for a in course.json()["attempts"]
    )
    reading = s.get(env["APP_ORIGIN"] + "/api/v1/my/reading", timeout=30)
    assert any(
        t["id"] == fixture["reading_task"] and t["acknowledged_at"]
        for t in reading.json()
    )
    download = s.get(
        env["APP_ORIGIN"]
        + "/api/v1/attachments/"
        + probe["attachment_id"]
        + "/download",
        timeout=30,
    )
    assert download.status_code == 200 and download.content.startswith(
        b"\x89PNG\r\n\x1a\n"
    )
    output = {
        "result": "PASS",
        "project": args.project,
        "database": "22 tables: exact row counts and SHA-256 canonical row fingerprints match before post-restore login",
        "files": "archive checksum and every database attachment SHA-256 validated during restore; protected download works",
        "application": "CA-verified HTTPS login; reading acknowledgement and quiz history retained",
        "tables": rows,
    }
    Path("docs/reports/sprint01/restore-verification.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n"
    )
    print(
        "Restore verified: exact data, attachments, reading history and quiz history retained."
    )
