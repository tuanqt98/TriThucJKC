from psycopg.types.json import Jsonb
from app.seed import uid


def seed_sprint01(conn):
    conn.execute(
        "INSERT INTO reading_assignments(id,user_id,version_id) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
        (uid("reading-docv1"), uid("employee"), uid("docv1")),
    )
    conn.execute(
        "INSERT INTO courses(id,code,title,owner_department_id,created_by) VALUES (%s,'DEMO-S01','DEMO · Học và kiểm tra Sprint 0.1',%s,%s) ON CONFLICT DO NOTHING",
        (uid("s01-course"), uid("PRODUCTION"), uid("head")),
    )
    created = conn.execute(
        "INSERT INTO course_versions(id,course_id,version_number,status,pass_score,max_attempts) VALUES (%s,%s,1,'DRAFT',70,3) ON CONFLICT DO NOTHING RETURNING id",
        (uid("s01-cv1"), uid("s01-course")),
    ).fetchone()
    if created:
        conn.execute(
            "INSERT INTO lessons(id,course_version_id,title,body,order_no) VALUES (%s,%s,%s,%s,1)",
            (
                uid("s01-lesson"),
                uid("s01-cv1"),
                "DEMO · Tra cứu đúng phiên bản",
                Jsonb(
                    {
                        "Nội dung": "Tài liệu DEMO dùng để kiểm thử. Đọc đúng phiên bản được giao; khi phát hiện rủi ro, ghi nhận bằng chứng và báo người phụ trách. Không tự sử dụng thông số chưa được xác minh."
                    }
                ),
            ),
        )
        for code, text, right, wrong in [
            (
                "q1",
                "Khi xác nhận đã đọc, hệ thống cần ghi nhận điều gì?",
                "Đúng phiên bản nội quy được giao",
                "Bất kỳ tài liệu nào có cùng tiêu đề",
            ),
            (
                "q2",
                "Kinh nghiệm xử lý chưa được xác minh cần được làm gì?",
                "Gửi người phụ trách xác minh trước khi áp dụng",
                "Tự coi là hướng dẫn vận hành chính thức",
            ),
        ]:
            conn.execute(
                "INSERT INTO quiz_questions(id,course_version_id,question,order_no) VALUES (%s,%s,%s,%s)",
                (uid("s01-" + code), uid("s01-cv1"), text, 1 if code == "q1" else 2),
            )
            for suffix, answer, correct in [("right", right, True), ("wrong", wrong, False)]:
                conn.execute(
                    "INSERT INTO quiz_options(id,question_id,answer_text,is_correct) VALUES (%s,%s,%s,%s)",
                    (uid("s01-" + code + "-" + suffix), uid("s01-" + code), answer, correct),
                )
        conn.execute("UPDATE course_versions SET status='APPROVED' WHERE id=%s", (uid("s01-cv1"),))
    conn.execute(
        "INSERT INTO course_assignments(id,course_version_id,user_id) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
        (uid("s01-assignment"), uid("s01-cv1"), uid("employee")),
    )
