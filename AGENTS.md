# AI CODING AGENT — TRI THỨC JKC

## Mục tiêu
Xây dựng MVP hệ thống quản trị tri thức nội bộ cho công ty in ấn JKC (50–200 nhân viên). Tài khoản nội bộ riêng, trưởng bộ phận duyệt bài chuyên môn, triển khai on-premise; Odoo version chưa rõ.

## Bắt buộc đọc theo thứ tự
1. `START_HERE.md` — trình tự và giới hạn.
2. `docs/TECHNICAL_DESIGN.md` — yêu cầu/kiến trúc.
3. `design/approved_screens/` — 8 mockup đã được người dùng duyệt (mỗi ảnh desktop + mobile).
4. `api/openapi.yaml` — API draft; refine trước khi triển khai.
5. `database/001_initial.sql` — schema baseline, kiểm tra và nâng cấp bằng migrations.
6. `deploy/compose.yml` — cấu hình staging, chưa production-ready.

## Quy tắc quan trọng
- Không mô tả starter là ứng dụng đã hoàn chỉnh; chưa có 8 màn hình hay auth thực.
- Không đổi mục đích hoặc tự ý loại bỏ 3 module ưu tiên: Nội quy, Sự cố/Tri thức, Đào tạo.
- Không hard-code API Odoo; tạo connector interface với mock/no-op adapter đến khi xác minh phiên bản/gói quyền.
- Bảo vệ quyền ở API/database/file/search; admin kỹ thuật không mặc nhiên có quyền xem tất cả nội dung bí mật.
- Phê duyệt bài chuyên môn theo phạm vi trưởng bộ phận; không tự duyệt bài của mình theo mặc định.
- Tài khoản riêng JKC; không lấy mật khẩu từ Odoo.
- Nội dung đã duyệt/ban hành cần version/audit, xác nhận đã đọc gắn với phiên bản.
- Không sao chép nguyên văn thông số xử lý lỗi in trong ảnh minh họa thành hướng dẫn vận hành chính thức. Mọi dữ liệu và ngày tháng trong ảnh chỉ là mẫu.
- Giao diện dùng tiếng Việt, hỗ trợ desktop và mobile, ưu tiên tra cứu nhanh ở xưởng.
- Không public cổng quản trị ra internet. Không commit `.env`, mật khẩu, khóa bí mật. Cấu hình TLS và backup trước production.

## Task đầu tiên (Sprint 0)
1. Audit starter: chạy lint/typecheck/build/migration; báo lỗi tồn tại.
2. Chuẩn hóa repo và Docker Compose local/staging, `.env.example` an toàn.
3. Triển khai authentication+sessions+RBAC cơ bản, test quyền API.
4. Tạo design system/component và layout responsive dựa trên 8 mockup, không dùng ảnh mockup làm giao diện thực.
5. Chuẩn hóa migrations, seed dữ liệu demo 5 công đoạn, API OpenAPI hoàn thiện cho chức năng có triển khai.
6. Tạo smoke tests, CI, README chạy local, lệnh health check.
7. Chốt checklist Sprint 0 và liệt kê P0 chưa hoàn thành.

## Định nghĩa hoàn thành
Code build/chạy được trong môi trường kiểm thử; test pass; UI desktop/mobile tương thích bản duyệt; backend có auth/RBAC thực và dữ liệu seed; không quảng bá chức năng chưa có; ghi rõ phần còn thiếu.
