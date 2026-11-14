"""UI-06 DEMO fixtures: approved incident solution guides (kind INCIDENT_GUIDE) for review and E2E tests.

The authoring workflow (jkc_content_workflow) only creates DOCUMENT/ARTICLE, so INCIDENT_GUIDE content can
only come from seed data today (the base seed does the same). Two steps keep files on the real path:

    python -m app.seed_incident_guides draft            -> DRAFT versions, prints JSON ids
    (author uploads attachments through POST /content-versions/{id}/attachments: scan + normalisation)
    python -m app.seed_incident_guides publish <id>...  -> APPROVED by the department head, made current

Refuses outside development/test, outside the synthetic DEMO namespace, and only touches DEMO-UI06-* drafts.
Texts are generic DEMO; no operating parameters (AGENTS.md).
"""

import json
import secrets
import sys
from uuid import uuid4
from psycopg.types.json import Jsonb
from app.db import connection
from app.demo_guard import require_demo_database
from app.seed import uid

PREFIX = "DEMO-UI06-"
NOTE = "DEMO · Nội dung minh họa để duyệt giao diện; thông số vận hành phải lấy từ tài liệu chính thức của JKC."

GUIDES = {
    "main": {
        "dept": "PRODUCTION",
        "author": "employee",
        "approver": "head",
        "process": "FLEXO",
        "title": "DEMO · Lệch màu vùng nền đặc trên bao bì màng",
        "body": {
            "1. Hiện tượng": "Màu vùng nền đặc lệch so với mẫu đã duyệt, rõ nhất ở mảng màu đậm.\nẢnh: DEMO-hien-tuong.jpg",
            "2. Điều kiện xảy ra": "- Xuất hiện sau khi đổi lô vật tư\n- Ca đêm ghi nhận nhiều hơn ca ngày\n- Chỉ gặp ở một số mã sản phẩm DEMO",
            "3. Nguyên nhân nghi ngờ": "- Vật tư lô mới khác lô cũ\n- Trục truyền mực chưa được vệ sinh đúng chu kỳ\n- Hồ sơ màu áp dụng chưa đúng mã sản phẩm",
            "4. Các bước kiểm tra": "1. So sánh tờ in với mẫu đã duyệt dưới cùng điều kiện ánh sáng\n2. Kiểm tra nhãn lô vật tư\n3. Kiểm tra lịch vệ sinh trục\n4. Ghi ảnh và số lệnh sản xuất vào hồ sơ ca",
            "5. Giải pháp xử lý": "1. Tách lô vật tư nghi ngờ và báo trưởng ca\n2. Vệ sinh trục theo hướng dẫn kỹ thuật chính thức\n3. In thử, so mẫu và chỉ chạy tiếp khi trưởng ca đồng ý",
            "6. Kết quả sau xử lý": "Tờ in thử đạt so với mẫu đã duyệt; lô DEMO giao đúng hạn.\nẢnh: DEMO-sau-xu-ly.jpg",
            "7. Lưu ý phòng ngừa": "- Kiểm tra nhãn lô khi nhận vật tư\n- Giữ lịch vệ sinh trục theo ca",
            "8. Lưu ý an toàn": f"- Dừng máy trước khi vệ sinh trục\n- {NOTE}",
        },
    },
    "plain": {
        "dept": "PRODUCTION",
        "author": "employee",
        "approver": "head",
        "process": "OFFSET",
        "title": "DEMO · Ghi nhận tờ in bị bám bẩn (không có ảnh)",
        "body": {"1. Hiện tượng": "Tờ in có vết bẩn rải rác.", "2. Giải pháp xử lý": f"Báo trưởng ca và kiểm tra theo hướng dẫn. {NOTE}"},
    },
    "related": {
        "dept": "PRODUCTION",
        "author": "employee",
        "approver": "head",
        "process": "FLEXO",
        "title": "DEMO · Mực bám không đều sau khi đổi lô màng",
        "body": {"1. Hiện tượng": "Mực bám không đều ở vùng nền.", "2. Giải pháp xử lý": f"Tách lô màng nghi ngờ và báo trưởng ca. {NOTE}"},
    },
    "technical": {
        "dept": "TECHNICAL",
        "author": "admin",
        "approver": "other",
        "process": "FLEXO",
        "title": "DEMO · Hướng dẫn riêng của bộ phận Kỹ thuật",
        "body": {"1. Hiện tượng": "Chỉ bộ phận Kỹ thuật được xem.", "2. Giải pháp xử lý": NOTE},
    },
    "draft": {
        "dept": "PRODUCTION",
        "author": "employee",
        "approver": None,
        "process": "FLEXO",
        "title": "DEMO · Bản nháp hướng dẫn sự cố (không được hiển thị)",
        "body": {"1. Hiện tượng": "Bản nháp chưa duyệt.", "2. Giải pháp xử lý": NOTE},
    },
}


def guard(conn):
    require_demo_database(conn, "UI-06 DEMO guides")


def draft():
    token = secrets.token_hex(3)
    out = {"token": token}
    with connection() as conn:
        guard(conn)
        for key, g in GUIDES.items():
            cid, vid = uuid4(), uuid4()
            title = f"{g['title']} {token}"
            conn.execute(
                """INSERT INTO contents(id,code,kind,title,owner_department_id,creator_id,visibility)
                VALUES (%s,%s,'INCIDENT_GUIDE',%s,%s,%s,'DEPARTMENT')""",
                (cid, f"{PREFIX}{token.upper()}-{key.upper()}", title, uid(g["dept"]), uid(g["author"])),
            )
            conn.execute(
                """INSERT INTO content_versions(id,content_id,version_number,title,body,status,created_by,process_id)
                VALUES (%s,%s,1,%s,%s,'DRAFT',%s,%s)""",
                (vid, cid, title, Jsonb(g["body"]), uid(g["author"]), uid(g["process"])),
            )
            out[key] = {"id": str(cid), "version_id": str(vid), "title": title, "author": g["author"], "publish": bool(g["approver"])}
        conn.execute("INSERT INTO audit_logs(action,entity_type) VALUES ('SYNTHETIC_UI06_GUIDES_DRAFTED','test_fixture')")
    return out


def publish(ids):
    published = []
    with connection() as conn:
        guard(conn)
        for cid in ids:
            row = conn.execute(
                """SELECT c.id,c.code,c.owner_department_id,v.id AS vid FROM contents c JOIN content_versions v ON v.content_id=c.id
                WHERE c.id=%s AND c.kind='INCIDENT_GUIDE' AND c.code LIKE %s AND v.status='DRAFT' AND c.current_published_version_id IS NULL""",
                (cid, PREFIX + "%"),
            ).fetchone()
            if not row:
                raise RuntimeError(f"{cid}: not an unpublished DEMO-UI06 draft")
            approver = "other" if row["owner_department_id"] == uid("TECHNICAL") else "head"
            conn.execute(
                "UPDATE content_versions SET status='APPROVED',approved_by=%s,approved_at=now() WHERE id=%s", (uid(approver), row["vid"])
            )
            conn.execute("UPDATE contents SET current_published_version_id=%s WHERE id=%s", (row["vid"], row["id"]))
            published.append(str(row["id"]))
        conn.execute("INSERT INTO audit_logs(action,entity_type) VALUES ('SYNTHETIC_UI06_GUIDES_PUBLISHED','test_fixture')")
    return published


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "draft":
        print(json.dumps(draft()))
    elif command == "publish":
        print(json.dumps(publish(sys.argv[2:])))
    else:
        raise SystemExit("usage: python -m app.seed_incident_guides draft | publish <content_id>...")
