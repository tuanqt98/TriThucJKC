"""Operator-only, explicit HR grant. Never available through TECH_ADMIN HTTP APIs."""

import argparse
from psycopg.types.json import Jsonb
from app.db import connection


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", required=True)
    scope = parser.add_mutually_exclusive_group(required=True)
    scope.add_argument("--department-code")
    scope.add_argument("--company", action="store_true")
    parser.add_argument("--approval-reference", required=True)
    args = parser.parse_args()
    if len(args.approval_reference.strip()) < 12:
        parser.error("Supply a reviewable approval reference; no passwords or personal data")
    with connection() as db:
        if not db.execute(
            "SELECT pg_get_userbyid(relowner)=current_user AS owner FROM pg_class WHERE oid='user_roles'::regclass"
        ).fetchone()["owner"]:
            raise RuntimeError("Only the migrator/table owner can provision explicit HR grants")
        user = db.execute("SELECT id FROM users WHERE username=%s AND is_active", (args.username,)).fetchone()
        if not user:
            raise RuntimeError("Active account not found")
        department = None
        if args.department_code:
            row = db.execute("SELECT id FROM departments WHERE code=%s AND active", (args.department_code,)).fetchone()
            if not row:
                raise RuntimeError("Active department not found")
            department = row["id"]
        role = db.execute("SELECT id FROM roles WHERE code='HR'").fetchone()
        if not role:
            raise RuntimeError("Apply Sprint 1 migrations first")
        grant = db.execute(
            "INSERT INTO user_roles(user_id,role_id,scope_department_id) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING RETURNING id",
            (user["id"], role["id"], department),
        ).fetchone()
        if grant:
            db.execute(
                "INSERT INTO audit_logs(action,entity_type,entity_id,new_data) VALUES ('HR_GRANTED_BY_OPERATOR','user_role',%s,%s)",
                (
                    grant["id"],
                    Jsonb({"scope_department_id": str(department) if department else None, "approval_reference": args.approval_reference}),
                ),
            )
    print("Explicit HR grant recorded; no other account or role was changed.")


if __name__ == "__main__":
    main()
