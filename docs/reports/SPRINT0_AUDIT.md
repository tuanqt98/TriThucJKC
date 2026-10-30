# Sprint 0A — audit 30/10/2026

Đã đọc AGENTS, START_HERE, TECHNICAL_DESIGN, SPRINT0_TASKS, toàn bộ OpenAPI/SQL/Compose và xem 8 ảnh desktop/mobile.

- Source vẫn ở starter/apps; Next chỉ có trang giới thiệu. FastAPI chỉ có liveness.
- Chưa có auth, sessions, RBAC, DB wiring, seed, migrations, tests, CI.
- OpenAPI draft quảng bá nhiều endpoint chưa tồn tại, thiếu schema/validation/phân trang.
- SQL có PK/FK cơ bản, nhưng published-version FK chưa kiểm tra cùng content/status; audit chưa bất biến; user_roles NULL scope có thể trùng; cần index sessions và login throttling.
- Compose chỉ init DB lần đầu, không migration readiness. Proxy bind mọi interface; chưa có local config. TLS internal cần trust CA. Backup thủ công chưa restore drill.
- Audit lint thất bại: eslint chưa cài và chưa có config. Không có typecheck script/lockfile. Python hệ thống chưa có pytest. Compose config thiếu DB_PASSWORD (đúng fail-closed).
- Docker daemon socket bị sandbox từ chối. Có PostgreSQL 16 local; Compose đề xuất 17. Chưa xác nhận runtime Compose.
- Thư mục chưa là Git repository. Không tự tạo lịch sử Git hoặc commit.

Ưu tiên triển khai: PostgreSQL migration baseline giữ nguyên; auth/session/CSRF/throttling; role scope; API đọc có ACL; dashboard và 8 route responsive với placeholder ghi nhãn; adapter Odoo no-op. Nghiệp vụ LMS/file/approval đầy đủ và production exit gate phải báo riêng.
