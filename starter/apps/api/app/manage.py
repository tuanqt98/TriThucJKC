"""Trusted server CLI. Verify employee identity out of band before handing over a reset token."""

import argparse
import secrets
from app.db import connection
from app.security import digest

parser = argparse.ArgumentParser()
parser.add_argument("command", choices=["reset-password"])
parser.add_argument("username")
args = parser.parse_args()
with connection() as conn:
    user = conn.execute("SELECT id FROM users WHERE username=%s AND is_active", (args.username,)).fetchone()
    if not user:
        raise SystemExit("Không tìm thấy tài khoản đang hoạt động.")
    token = secrets.token_urlsafe(48)
    conn.execute("UPDATE password_resets SET used_at=now() WHERE user_id=%s AND used_at IS NULL", (user["id"],))
    conn.execute(
        "INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES (%s,%s,now()+interval '15 minutes')", (user["id"], digest(token))
    )
    conn.execute("INSERT INTO audit_logs(action,entity_type,entity_id) VALUES ('RESET_ISSUED_BY_SERVER_OPERATOR','user',%s)", (user["id"],))
print(token)  # Intentional single display; transfer securely, never log/commit.
