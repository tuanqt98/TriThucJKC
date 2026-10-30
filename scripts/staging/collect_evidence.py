"""Only health, image IDs and privilege facts. Never docker inspect environment/secrets."""

import argparse
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--project", default="jkc-s01")
parser.add_argument("--env-file", required=True)
parser.add_argument("--evidence-dir", default="docs/reports/sprint01")
args = parser.parse_args()
evidence = Path(args.evidence_dir)
evidence.mkdir(parents=True, exist_ok=True)
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
services = [
    json.loads(line)
    for line in subprocess.check_output(
        [*base, "ps", "--format", "json"], text=True
    ).splitlines()
]
summary = {}
for s in services:
    image_id = subprocess.check_output(
        ["docker", "inspect", s["ID"], "--format", "{{.Image}}"], text=True
    ).strip()
    summary[s["Service"]] = {
        "state": s["State"],
        "health": s["Health"],
        "ports": s["Ports"],
        "image_id": image_id,
    }
assert set(summary) == {"api", "web", "db", "clamav", "proxy"} and all(
    s["health"] == "healthy" for s in summary.values()
)
script = """import json
from app.db import connection
from app.files import ClamAVScanner
with connection() as c:
 role=c.execute("SELECT current_user AS role,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user").fetchone()
 role['owns_tables']=c.execute("SELECT count(*) n FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)").fetchone()['n']
 role['can_edit_score']=c.execute("SELECT has_table_privilege(current_user,'quiz_attempts','UPDATE') AS allowed").fetchone()['allowed']
 role['can_read_answer_key']=c.execute("SELECT has_column_privilege(current_user,'quiz_options','is_correct','SELECT') AS allowed").fetchone()['allowed']
 role['can_issue_reset']=c.execute("SELECT has_table_privilege(current_user,'password_resets','INSERT') AS allowed").fetchone()['allowed']
 role['unscoped_visible_contents']=c.execute('SELECT count(*) n FROM contents').fetchone()['n']
 tables=c.execute("SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public' AND rowsecurity ORDER BY tablename").fetchall()
 guards=c.execute("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('fixed_content','fixed_version','frozen_lessons','attempt_history','reading_history') ORDER BY tgname").fetchall()
 print(json.dumps({'role':role,'rls':tables,'guards':guards,'scanner':ClamAVScanner().status()}))
"""
facts = json.loads(
    subprocess.check_output(
        [*base, "exec", "-T", "api", "python", "-c", script], text=True
    )
)
assert not any(
    facts["role"][k]
    for k in [
        "rolsuper",
        "rolbypassrls",
        "rolcreaterole",
        "rolcreatedb",
        "owns_tables",
        "can_edit_score",
        "can_read_answer_key",
        "can_issue_reset",
        "unscoped_visible_contents",
    ]
)
assert len(facts["guards"]) == 5
(evidence / "infrastructure.json").write_text(
    json.dumps(
        {"project": args.project, "services": summary, **facts},
        ensure_ascii=False,
        indent=2,
    )
    + "\n"
)
print(
    "Infrastructure PASS: healthy services, internal-only API/DB, restricted runtime role, RLS guards and current scanner signatures."
)
