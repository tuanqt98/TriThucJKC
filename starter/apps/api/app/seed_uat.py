"""Fresh synthetic accounts for isolated staging acceptance runs; never real employees."""

import json
import os
import secrets
from uuid import uuid4
from app.config import settings
from app.db import connection
from app.security import hasher
from app.seed import uid


def seed_uat(include_sprint1=False):
    if settings().app_env not in ("development", "test") or len(settings().demo_password) < 12:
        raise RuntimeError("UAT fixtures require development/test and an explicit demo password.")
    result = {}
    with connection() as conn:
        if conn.execute("SELECT 1 FROM users WHERE NOT (employee_code LIKE 'DEMO-%' OR left(username::text,4)='uat_') LIMIT 1").fetchone():
            raise RuntimeError("Refuse UAT fixture creation: database contains accounts outside the synthetic DEMO namespace.")
        for device in ["api", "desktop", "mobile"]:
            user, task, assignment = uuid4(), uuid4(), uuid4()
            name = "uat_" + device + "_" + secrets.token_hex(4)
            conn.execute(
                "INSERT INTO users(id,employee_code,username,full_name,department_id,password_hash,must_change_password) VALUES (%s,%s,%s,%s,%s,%s,false)",
                (user, name, name, "DEMO · UAT " + device, uid("PRODUCTION"), hasher.hash(settings().demo_password)),
            )
            conn.execute("INSERT INTO user_roles(user_id,role_id) VALUES (%s,%s)", (user, uid("EMPLOYEE")))
            conn.execute("INSERT INTO reading_assignments(id,user_id,version_id) VALUES (%s,%s,%s)", (task, user, uid("docv1")))
            conn.execute(
                "INSERT INTO course_assignments(id,user_id,course_version_id) VALUES (%s,%s,%s)", (assignment, user, uid("s01-cv1"))
            )
            result[device] = {"username": name, "user_id": str(user), "reading_task": str(task), "assignment": str(assignment)}
        if include_sprint1:
            # Explicit synthetic HR fixture only; no existing account gains HR.
            hr_id = uuid4()
            hr_name = "uat_hr_" + secrets.token_hex(4)
            conn.execute(
                "INSERT INTO users(id,employee_code,username,full_name,department_id,password_hash,must_change_password) VALUES (%s,%s,%s,%s,%s,%s,false)",
                (hr_id, hr_name, hr_name, "DEMO · HR UAT", uid("PRODUCTION"), hasher.hash(settings().demo_password)),
            )
            conn.execute("INSERT INTO user_roles(user_id,role_id) SELECT %s,id FROM roles WHERE code='HR'", (hr_id,))
            result["hr"] = {"username": hr_name, "user_id": str(hr_id)}
        conn.execute("INSERT INTO audit_logs(action,entity_type) VALUES ('SYNTHETIC_UAT_SEEDED','test_fixture')")
    return result


if __name__ == "__main__":
    print(json.dumps(seed_uat(include_sprint1=os.environ.get("UAT_SPRINT1") == "true")))
