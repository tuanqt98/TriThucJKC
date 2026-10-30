# Sprint 0.1 — phạm vi và exit gate

Giữ nguyên auth, layout và adapter Odoo. Chỉ dùng dữ liệu DEMO. Không production.

1. Compose staging cô lập: DB + migrator + runtime API + web + Caddy HTTPS + ClamAV; health/readiness, không lộ DB/API/admin; không đụng stack đang chạy.
2. Backup nhất quán khi dừng ghi: DB + file + checksum; restore sang stack/volume mới, không restore đè; giữ CA/secrets ngoài artifact public.
3. Migration 003: runtime role không owner/superuser/BYPASSRLS; RLS nội dung/phiên bản/attachments/reading/LMS, grant cột không lộ đáp án; API và DB negative tests.
4. Upload PNG/JPEG/PDF giới hạn kích thước, kiểm tra cấu trúc, chống active content, ClamAV fail-closed; lưu private, download ACL + CLEAN + checksum; không public storage path.
5. Reading assignment theo content_version, acknowledge idempotent, không giả user/version, bảo tồn lịch sử và từ chối phiên bản lỗi thời.
6. Quiz theo assignment/course_version: lessons, giới hạn lần, đáp án không trả client, grading server, transaction/concurrency, lịch sử bất biến.
7. Regression và UAT tự động desktop/mobile. PO/IT ký nghiệm thu trên thiết bị/mạng thật vẫn là gate riêng.

Go/No-Go dựa trên bằng chứng, không suy diễn chữ ký UAT hoặc triển khai thực địa.
