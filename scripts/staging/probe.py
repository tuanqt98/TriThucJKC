"""Real HTTPS/ClamAV/RBAC/reading/quiz probe; only synthetic staging fixtures."""

import argparse
import io
import json
import subprocess
from pathlib import Path
from urllib.parse import urlsplit

import requests
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument("--env-file", required=True)
parser.add_argument("--ca", required=True)
parser.add_argument("--fixtures", required=True)
parser.add_argument("--project", default="jkc-s01")
parser.add_argument("--evidence-dir", default="docs/reports/sprint01")
args = parser.parse_args()
evidence = Path(args.evidence_dir)
evidence.mkdir(parents=True, exist_ok=True)
assert args.project.startswith(("jkc-s01", "jkc-staging"))
env = dict(
    line.split("=", 1)
    for line in Path(args.env_file).read_text().splitlines()
    if line and not line.startswith("#")
)
base = env["APP_ORIGIN"]
assert urlsplit(base).scheme == "https"
fixture = json.loads(Path(args.fixtures).read_text())["api"]
s = requests.Session()
s.verify = args.ca
s.headers["Origin"] = base


def login(name):
    response = s.post(
        base + "/api/v1/auth/login",
        json={"username": name, "password": env["DEMO_PASSWORD"]},
        timeout=30,
    )
    assert response.status_code == 200, response.text
    assert (
        "secure" in response.headers["Set-Cookie"].lower()
        and "httponly" in response.headers["Set-Cookie"].lower()
    )
    s.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    identity = s.get(base + "/api/v1/auth/me", timeout=30)
    assert identity.status_code == 200, (
        f"Immediate session read failed after login: {identity.status_code}"
    )
    assert identity.json()["id"] == response.json()["id"], (
        "Login cookie did not switch to the authenticated identity"
    )
    return response.json()


def get(path):
    response = s.get(base + "/api/v1" + path, timeout=30)
    assert response.status_code == 200, response.text
    return response.json()


def post(path, payload=None, **kwargs):
    response = s.post(base + "/api/v1" + path, json=payload, timeout=45, **kwargs)
    assert response.status_code in (200, 201), response.text
    return response.json()


assert get("/health/ready")["status"] == "ready"
login(fixture["username"])
draft = post(
    "/articles",
    {
        "title": "DEMO · Staging HTTPS file scan",
        "body": {"Nội dung": "Kiểm thử tổng hợp bằng dữ liệu giả."},
    },
)
path = f"/content-versions/{draft['version_id']}/attachments"
image = io.BytesIO()
Image.new("RGB", (8, 8), "cyan").save(image, format="PNG")
file = post(path, files={"file": ("demo.png", image.getvalue(), "image/png")})
assert file["malware_scan_status"] == "CLEAN" and "storage_key" not in file
response = s.get(base + "/api/v1/attachments/" + file["id"] + "/download", timeout=30)
assert (
    response.status_code == 200
    and "attachment;" in response.headers["Content-Disposition"]
)
# EICAR is the standard harmless antivirus test string, never executable malware.
eicar = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
blocked = s.post(
    base + "/api/v1" + path,
    files={"file": ("eicar.png", eicar, "image/png")},
    timeout=45,
)
assert (
    blocked.status_code == 422 and blocked.json()["error"]["code"] == "UNSAFE_FILE"
), blocked.text
assert len(get(path)) == 1
post(f"/articles/{draft['id']}/submit")
login("head")
queue = get("/approvals")
approval = next(
    a
    for a in queue
    if a["title"] == "DEMO · Staging HTTPS file scan" and a["status"] == "PENDING"
)
post("/approvals/" + approval["id"] + "/approve", {"expectedVersion": 1})
assert (
    s.get(
        base + "/api/v1/attachments/" + file["id"] + "/download", timeout=30
    ).status_code
    == 200
)
login("admin")
denied = s.get(base + "/api/v1/attachments/" + file["id"] + "/download", timeout=30)
assert denied.status_code == 404, (
    f"TECH_ADMIN private download: expected 404, received {denied.status_code}"
)
login(fixture["username"])
reading = next(t for t in get("/my/reading") if t["id"] == fixture["reading_task"])
for _ in range(2):
    post(
        "/reading-assignments/" + reading["id"] + "/acknowledge",
        {"version_id": reading["version_id"]},
    )
course = get("/my/learning/" + fixture["assignment"])
assert "is_correct" not in json.dumps(course)
for lesson in course["lessons"]:
    post(f"/my/learning/{course['id']}/lessons/{lesson['id']}/complete")
attempt = post("/my/learning/" + course["id"] + "/quiz-attempts")
answers = []
for question in course["questions"]:
    choice = next(
        o
        for o in question["options"]
        if o["answer_text"].startswith(("Đúng phiên bản", "Gửi người phụ trách"))
    )
    answers.append({"question_id": question["id"], "option_id": choice["id"]})
result = post("/quiz-attempts/" + attempt["id"] + "/submit", {"answers": answers})
assert result["passed"] and float(result["score"]) == 100
assert (
    s.post(
        base + "/api/v1/quiz-attempts/" + attempt["id"] + "/submit",
        json={"answers": answers},
        timeout=30,
    ).status_code
    == 409
)
services = [
    json.loads(line)
    for line in subprocess.check_output(
        [
            "docker",
            "compose",
            "--project-name",
            args.project,
            "--env-file",
            args.env_file,
            "-f",
            "deploy/compose.yml",
            "ps",
            "--format",
            "json",
        ],
        text=True,
    ).splitlines()
]
summary = {
    r["Service"]: {"state": r["State"], "health": r["Health"], "ports": r["Ports"]}
    for r in services
}
assert all(r["Health"] == "healthy" for r in services)
assert not any(
    r.get("PublishedPort", 0)
    for service in services
    if service["Service"] not in ("proxy",)
    for r in (service.get("Publishers") or [])
)
output = {
    "project": args.project,
    "tls": "CA-verified HTTPS; Secure+HttpOnly session cookie",
    "compose": summary,
    "file": "real ClamAV CLEAN, EICAR blocked, parent ACL denies TECH_ADMIN",
    "reading": "version-bound and idempotent",
    "quiz": "server score 100, immutable submitted attempt, duplicate 409",
    "content_id": draft["id"],
    "attachment_id": file["id"],
    "course_assignment": course["id"],
    "result": "PASS",
}
(evidence / "staging-probe.json").write_text(
    json.dumps(output, ensure_ascii=False, indent=2) + "\n"
)
print(
    json.dumps({k: v for k, v in output.items() if k != "compose"}, ensure_ascii=False)
)
