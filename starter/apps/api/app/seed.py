from uuid import uuid5, NAMESPACE_URL
from psycopg.types.json import Jsonb
from app.config import settings
from app.db import connection
from app.security import hasher


def uid(name):
    return uuid5(NAMESPACE_URL, "jkc-demo/" + name)


def seed():
    if settings().app_env not in ("development", "test"):
        raise RuntimeError("Demo seed chỉ cho development/test.")
    password = settings().demo_password
    if len(password) < 12:
        raise RuntimeError("Đặt DEMO_PASSWORD tối thiểu 12 ký tự qua môi trường; không commit mật khẩu.")
    with connection() as conn:
        for code, name in [
            ("PREPRESS", "Thiết kế / Chế bản"),
            ("OFFSET", "In offset"),
            ("DIGITAL", "In kỹ thuật số"),
            ("FLEXO", "In flexo / Bao bì"),
            ("FINISHING", "Gia công sau in"),
        ]:
            conn.execute("INSERT INTO production_processes(id,code,name) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING", (uid(code), code, name))
        for code, name in [("PRODUCTION", "Sản xuất (DEMO)"), ("TECHNICAL", "Kỹ thuật (DEMO)")]:
            conn.execute("INSERT INTO departments(id,code,name) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING", (uid(code), code, name))
        for code, name in [("EMPLOYEE", "Nhân viên"), ("DEPARTMENT_HEAD", "Trưởng bộ phận"), ("TECH_ADMIN", "Quản trị kỹ thuật")]:
            conn.execute("INSERT INTO roles(id,code,name) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING", (uid(code), code, name))
        for username, role, dept, name in [
            ("employee", "EMPLOYEE", "PRODUCTION", "Nhân viên demo"),
            ("head", "DEPARTMENT_HEAD", "PRODUCTION", "Trưởng bộ phận demo"),
            ("other", "DEPARTMENT_HEAD", "TECHNICAL", "Bộ phận khác demo"),
            ("admin", "TECH_ADMIN", "TECHNICAL", "Quản trị kỹ thuật demo"),
        ]:
            conn.execute(
                """INSERT INTO users(id,employee_code,username,full_name,department_id,password_hash,must_change_password)
                VALUES (%s,%s,%s,%s,%s,%s,false) ON CONFLICT DO NOTHING""",
                (uid(username), "DEMO-" + username, username, name, uid(dept), hasher.hash(password)),
            )
            conn.execute(
                "INSERT INTO user_roles(id,user_id,role_id,scope_department_id) VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING",
                (uid(username + "role"), uid(username), uid(role), uid(dept) if role == "DEPARTMENT_HEAD" else None),
            )
        for code, kind, title, visibility in [
            ("doc", "DOCUMENT", "DEMO · Tài liệu giới thiệu cổng tri thức", "COMPANY"),
            ("article", "ARTICLE", "DEMO · Cách ghi nhận một bài học tại xưởng", "DEPARTMENT"),
            ("incident", "INCIDENT_GUIDE", "DEMO · Hồ sơ sự cố để thực hành tra cứu", "DEPARTMENT"),
            ("restricted", "ARTICLE", "DEMO · Nội dung giới hạn của tác giả", "RESTRICTED"),
            ("cross", "ARTICLE", "DEMO · Chia sẻ có chỉ định bộ phận", "CROSS_DEPARTMENT"),
        ]:
            conn.execute(
                """INSERT INTO contents(id,code,kind,title,owner_department_id,creator_id,visibility)
                VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                (uid(code), "DEMO-" + code, kind, title, uid("PRODUCTION"), uid("employee"), visibility),
            )
            conn.execute(
                """INSERT INTO content_versions(id,content_id,version_number,body,status,created_by,approved_by,approved_at)
                VALUES (%s,%s,1,%s,'APPROVED',%s,%s,now()) ON CONFLICT DO NOTHING""",
                (
                    uid(code + "v1"),
                    uid(code),
                    Jsonb(
                        {
                            "Mục đích": "Dữ liệu DEMO để thử giao diện và phân quyền; không phải tài liệu vận hành được JKC ban hành.",
                            "Nội dung": "Ghi nhận hiện tượng, bằng chứng và liên hệ người phụ trách. Thông số kỹ thuật phải được xác minh riêng.",
                        }
                    ),
                    uid("employee"),
                    uid("head"),
                ),
            )
            conn.execute("UPDATE contents SET current_published_version_id=%s WHERE id=%s", (uid(code + "v1"), uid(code)))
        for code in ["doc", "article", "incident", "restricted", "cross"]:
            conn.execute(
                "INSERT INTO content_processes(content_id,process_id) VALUES (%s,%s) ON CONFLICT DO NOTHING", (uid(code), uid("OFFSET"))
            )
        conn.execute(
            "INSERT INTO content_acl(content_id,department_id) VALUES (%s,%s) ON CONFLICT DO NOTHING", (uid("cross"), uid("TECHNICAL"))
        )
        conn.execute(
            "INSERT INTO courses(id,code,title,owner_department_id,created_by) VALUES (%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING",
            (uid("course"), "DEMO-COURSE", "DEMO · Làm quen Tri Thức JKC", uid("PRODUCTION"), uid("head")),
        )
        conn.execute(
            "INSERT INTO course_versions(id,course_id,version_number,status) VALUES (%s,%s,1,'APPROVED') ON CONFLICT DO NOTHING",
            (uid("coursev1"), uid("course")),
        )
        conn.execute(
            "INSERT INTO lessons(id,course_version_id,title,body,order_no) VALUES (%s,%s,%s,%s,1) ON CONFLICT DO NOTHING",
            (uid("lesson"), uid("coursev1"), "DEMO · Tra cứu và chia sẻ", Jsonb({"text": "Nội dung minh họa."})),
        )
        conn.execute(
            "INSERT INTO course_assignments(id,course_version_id,user_id) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
            (uid("assignment"), uid("coursev1"), uid("employee")),
        )
        conn.execute(
            "INSERT INTO incidents(id,code,title,process_id,reporter_id,severity,symptoms) VALUES (%s,'DEMO-INCIDENT','DEMO · Hồ sơ sự cố để thực hành tra cứu',%s,%s,'LOW','Tình huống giả lập; không phải hướng dẫn xử lý máy.') ON CONFLICT DO NOTHING",
            (uid("incident"), uid("OFFSET"), uid("employee")),
        )
        conn.execute(
            "INSERT INTO audit_logs(action,entity_type) SELECT 'DEMO_SEEDED','system' WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE action='DEMO_SEEDED')"
        )


if __name__ == "__main__":
    seed()
    print("Đã seed DEMO (idempotent; không ghi đè mật khẩu tài khoản đã có).")
