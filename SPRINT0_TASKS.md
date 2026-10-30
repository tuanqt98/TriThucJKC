# SPRINT 0 — KẾ HOẠCH CHO AI AGENT

## Giai đoạn 0A: Audit (bắt buộc trước sửa code)
- [x] Đọc `AGENTS.md`, `docs/TECHNICAL_DESIGN.md`, 8 mẫu ảnh.
- [x] Kiểm tra `database/001_initial.sql`, ràng buộc/PK/FK, migrations cần thiết.
- [x] Kiểm tra OpenAPI có khớp schema database và endpoint thực tế.
- [x] Kiểm tra Docker Compose / Caddy, health/readiness, xử lý secret.
- [x] Báo danh sách lỗi và hạng mục chưa có.

## Giai đoạn 0B: Nền tảng chạy được
- [x] Chuẩn hóa cấu trúc mono-repo, package/lock files và scripts.
- [x] Backend: app factory/router, settings, DB session, migrations, healthcheck.
- [x] Frontend: layout chung, sidebar desktop, bottom navigation mobile, responsive.
- [x] Tạo design tokens (navy, accent CMYK, typography, spacing) và component dùng chung.
- [x] Tạo routes/placeholders 8 màn hình theo ảnh, kết nối dữ liệu demo có kiểm soát.
- [x] Auth: tạo tài khoản, băm mật khẩu, session cookie an toàn, logout, reset workflow.
- [x] RBAC: kiểm tra quyền backend, scope bộ phận, negative tests.
- [x] Seed tối thiểu: 5 công đoạn, vai trò, bài tri thức/sự cố/tài liệu/khóa học DEMO (không dùng thông tin sản xuất nhạy cảm thật).
- [x] API contract cập nhật từ code và bổ sung test.
- [x] Docker Compose dev/staging: chạy frontend + API + DB, giao tiếp nội bộ (local staging Sprint 0.1).

## Giai đoạn 0C: Nghiệm thu
- [x] Build frontend, kiểm tra TypeScript, lint.
- [x] Chạy backend test và API smoke test.
- [x] Database migration apply sạch trên DB trống; có hướng rollback.
- [x] Kiểm tra 401/403 cho API và file, không leak dữ liệu khi search (bao gồm 404 cho resource ngoài ACL).
- [x] Kiểm tra desktop/mobile với 8 routes (placeholder được gắn nhãn rõ nếu chưa hoàn thiện).
- [x] Backup/restore diễn tập ở staging local; lưu kết quả DB + file, chưa phải đích lưu độc lập của IT.
- [x] Viết hướng dẫn dev, deploy staging và danh sách hạn chế.

## Điều kiện chuyển Sprint 1
Có repo chạy được, tài khoản nội bộ và RBAC kiểm chứng được, 8 tuyến UI responsive có component nền tảng, dữ liệu demo, DB migrations, API baseline, Docker staging và checklist UAT Sprint 0 được PO duyệt.

## Kết quả Sprint 0 ban đầu (lịch sử, trước Sprint 0.1)

Đánh dấu trên phản ánh nền tảng đã code/test; không thay PO sign-off. Xem `docs/reports/SPRINT0_IMPLEMENTATION.md` để biết giới hạn từng mục.

- Compose local/staging: config pass, chưa xác nhận full-stack container health do pull image chưa hoàn tất.
- API 401/403, ACL search/detail/count và deny-all file routes có test; chưa có upload/download thật để nghiệm thu file ACL.
- Rollback + restore drill đã pass trên PostgreSQL 16 database test cô lập; chưa diễn tập staging/backup file thật.
- 8 route có layout responsive và API/demo; LMS là danh sách tiến độ, chi tiết sự cố là guide được duyệt. Chưa phải 8 workflow nghiệp vụ hoàn chỉnh.
- CI đã khai báo; chưa chạy trên GitHub vì workspace chưa có Git/remote.
- Sprint 0 exit gate còn mở: PO/UX, workshop, IT/TLS/backup, Odoo POC, runtime DB role/RLS và staging UAT.

## Sprint 0.1 — kết quả kỹ thuật và exit gate

- [x] Full Compose local staging: Caddy HTTPS, web, API, PG17, ClamAV healthy; migrate/storage-init one-shot thành công.
- [x] CA-verified HTTPS + Secure cookie; backup DB/private files/checksum và restore sang volume rỗng, so 22 bảng/lịch sử/file.
- [x] Runtime role không owner/superuser/BYPASSRLS; RLS/grants/SECURITY DEFINER và raw-DB negative tests.
- [x] Upload/download PNG/JPEG/PDF tĩnh, ClamAV thật fail-closed, CLEAN + parent ACL + checksum.
- [x] Reading assignments/ACK đúng version, idempotent, không overwrite lịch sử; UI xác nhận.
- [x] Lesson/quiz server grading, max attempts/concurrency, version/score snapshot và immutable history; UI học/kiểm tra.
- [x] Regression/backend/container, desktop/mobile automated UAT, OpenAPI/lint/build, bằng chứng trong docs/reports/sprint01.
- [ ] PO/key users ký UAT trên thiết bị xưởng thật; không dùng automated PASS thay chữ ký.
- [ ] IT DNS/VPN/firewall/trust CA thiết bị thật, đích backup độc lập/scheduler/retention/RPO-RTO, cập nhật signatures và release pinning.
- [ ] Chốt quyền ban hành nội quy, cấp tài khoản/role và backlog/acceptance Sprint 1; Odoo giữ no-op cho tới POC.

Trạng thái chi tiết: [báo cáo Sprint 0.1](docs/reports/sprint01/REPORT.md). **NO-GO để đóng Sprint 0/chuyển Sprint 1 chính thức khi các P0 phê duyệt/thực địa còn mở.** Không production, không dữ liệu nhân viên thật.
