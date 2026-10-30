"""Reproducible synthetic HTTPS acceptance run, including real ClamAV probe."""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--project", default="jkc-s01")
parser.add_argument("--env-file", required=True)
parser.add_argument("--ca", required=True)
args = parser.parse_args()
assert args.project.startswith(("jkc-s01", "jkc-staging"))
env = dict(
    line.split("=", 1)
    for line in Path(args.env_file).read_text().splitlines()
    if line and not line.startswith("#")
)
assert env["APP_ORIGIN"].startswith("https://")
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
subprocess.run(
    [
        *base,
        "up",
        "-d",
        "--no-build",
        "--pull",
        "never",
        "--wait",
        "--wait-timeout",
        "180",
    ],
    check=True,
)
fixtures = subprocess.check_output(
    [
        *base,
        "--profile",
        "demo",
        "run",
        "--rm",
        "--no-deps",
        "seed",
        "python",
        "-m",
        "app.seed_uat",
    ],
    text=True,
)
json.loads(fixtures)
fixture_path = Path(".local/uat01.json")
fixture_path.parent.mkdir(exist_ok=True)
fixture_path.write_text(fixtures)
fixture_path.chmod(0o600)
subprocess.run(
    [
        sys.executable,
        "scripts/staging/probe.py",
        "--project",
        args.project,
        "--env-file",
        args.env_file,
        "--ca",
        args.ca,
        "--fixtures",
        str(fixture_path),
    ],
    check=True,
)
result_path = Path(".local/ui-results.json").resolve()
runenv = {
    **os.environ,
    "UI_BASE_URL": env["APP_ORIGIN"],
    "UI_DEMO_PASSWORD": env["DEMO_PASSWORD"],
    "UI_TEST_LOCAL_CA": "true",
    "UI_UAT_FIXTURES": str(fixture_path.resolve()),
    "PLAYWRIGHT_JSON_OUTPUT_NAME": str(result_path),
}
subprocess.run(
    ["npm", "run", "test:ui", "--", "--reporter=list,json"],
    cwd="starter/apps/web",
    env=runenv,
    check=True,
)
report = json.loads(result_path.read_text())
stats = report["stats"]
assert stats["unexpected"] == 0 and stats["skipped"] == 0 and stats["expected"] == 8
output = {
    "result": "PASS",
    "expected": stats["expected"],
    "failed": stats["unexpected"],
    "skipped": stats["skipped"],
    "duration_ms": stats["duration"],
    "viewports": ["1440x1000", "390x844"],
    "transport": "HTTPS; independent Python probe verified CA chain; Chromium local-CA ignoreHTTPSErrors used only in automated fixtures",
    "human_uat_signoff": "PENDING; automated test is not PO/IT sign-off",
}
Path("docs/reports/sprint01/uat-results.json").write_text(
    json.dumps(output, ensure_ascii=False, indent=2) + "\n"
)
print(json.dumps(output, ensure_ascii=False))
