# TRI THỨC JKC — BẮT ĐẦU TẠI ĐÂY

Gói này dành cho AI coding agent như Codex, Claude Code, Cursor hoặc agent IDE khác.

## Sơ đồ thư mục
- `AGENTS.md`: chỉ dẫn cho AI agent (đọc đầu tiên).
- `design/approved_screens/`: 8 mockup UX đã duyệt, mỗi mockup có desktop/mobile.
- `docs/TECHNICAL_DESIGN.md`: kiến trúc, quy tắc và kế hoạch.
- `database/001_initial.sql`: schema PostgreSQL khởi điểm.
- `api/openapi.yaml`: OpenAPI draft.
- `starter/apps/web`: Next.js starter (CHƯA có 8 trang hoàn chỉnh).
- `starter/apps/api`: FastAPI starter (CHƯA có auth/RBAC/database wiring).
- `deploy`: Docker Compose staging và mẫu môi trường.
- `SPRINT0_TASKS.md`: hướng dẫn công việc cụ thể.

## Cách dùng
1. Tải ZIP, giải nén thư mục `JKC_AI_AGENT_PROJECT`.
2. Mở chính thư mục này bằng VS Code / Cursor / agent.
3. Giao agent yêu cầu: **Đọc AGENTS.md và START_HERE.md, audit project trước; triển khai Sprint 0 theo SPRINT0_TASKS.md, có test/build minh chứng.**
4. Chỉ triển khai trên máy dev/staging trước. Không đưa lên server thật khi chưa cấu hình chứng chỉ TLS, backup, secret, quyền tệp, kiểm thử bảo mật.

## Cần xác nhận với JKC
- Phiên bản, loại triển khai và gói Odoo, quyền API.
- Tên miền/DNS và cách truy cập mobile vào mạng nội bộ.
- Chính sách cấp tài khoản/reset mật khẩu, vai trò phê duyệt nội quy toàn công ty.
- Danh mục thiết bị, công đoạn và dữ liệu mẫu được duyệt.

## Giới hạn hiện tại
Đây là tài liệu kỹ thuật + source starter để agent xây dựng ứng dụng, không phải phần mềm đã hoàn thành hoặc được kiểm thử triển khai. Ngày/tên/nghiệp vụ trong mockup là dữ liệu minh họa.
