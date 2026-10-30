"""Pause writes for DB+file backup, or restore to EMPTY isolated staging project.
Never targets production: project names must begin jkc-s01 or jkc-staging.
"""

import argparse
import json
import os
import re
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("action", choices=["backup", "restore"])
parser.add_argument("--project", required=True)
parser.add_argument("--env-file", required=True)
parser.add_argument("--set", required=True, dest="backup_set")
args = parser.parse_args()
if not re.fullmatch(r"jkc-(s01|staging)[a-z0-9-]*", args.project) or not re.fullmatch(
    r"[A-Za-z0-9_-]+", args.backup_set
):
    parser.error(
        "Only explicit isolated staging project and safe backup set names are accepted"
    )
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
env = {**os.environ, "BACKUP_SET": args.backup_set}


def run(*command):
    subprocess.run([*base, *command], env=env, check=True)


if args.action == "backup":
    # Gracefully finish in-flight HTTP requests. No workers write to DB/files in this sprint.
    run("stop", "-t", "45", "proxy", "api", "web")
    try:
        run("--profile", "ops", "run", "--rm", "--no-deps", "backup")
    finally:
        run("start", "web", "api", "proxy")
else:
    volume = args.project + "_pg_data"
    exists = (
        subprocess.run(
            ["docker", "volume", "inspect", volume],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        ).returncode
        == 0
    )
    if exists:
        parser.error(
            "Refuse: restore project volume already exists. Use a new project name and new ports."
        )
    run("up", "-d", "--no-build", "--pull", "never", "db", "storage-init")
    run("--profile", "ops", "run", "--rm", "restore")
    run("up", "-d", "--no-build", "--pull", "never")
output = {
    "action": args.action,
    "project": args.project,
    "backup_set": args.backup_set,
    "result": "completed; verify health and compare data before acceptance",
}
Path("docs/reports/sprint01").mkdir(parents=True, exist_ok=True)
Path(f"docs/reports/sprint01/{args.action}-operation.json").write_text(
    json.dumps(output, indent=2) + "\n"
)
print(json.dumps(output))
