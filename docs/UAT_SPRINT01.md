# UAT Sprint 0.1 — DEMO

Automated acceptance đã pass, **chưa có PO/IT ký nghiệm thu thực địa**. Không dùng nhân viên/dữ liệu thật. Chỉ test trên project cô lập, accounts tổng hợp; runner seed UAT mới từ chối DB có tài khoản ngoài namespace DEMO/uat_.

| Ca | Kỳ vọng | Tự động | Nghiệm thu người dùng/IT |
|---|---|---|---|
| Login/force-change/logout/session | Cookie Secure/HttpOnly; 401 khi session hết/revoke; password độc lập Odoo | PASS backend + browser | Chờ chính sách thiết bị dùng chung/reset |
| 8 route/layout | Desktop/mobile không tràn ngang, nhãn tiếng Việt, loading/error/permission states rõ | PASS Chromium 1440/390 px | Chờ thiết bị xưởng/điện thoại thật |
| HTTPS | Chain hợp lệ với CA được cấp, HTTP redirect, API/DB không public | PASS Python/curl với CA riêng | Chờ DNS/VPN/firewall và trust CA qua IT |
| Nội quy đúng version | Xác nhận đúng assignment/version; gửi lại không tạo ACK trùng; sai/stale version 409; lịch sử cũ giữ lại | PASS | Chờ policy ban hành, đối tượng giao đọc, due date |
| Upload/download | PNG/JPEG/PDF tĩnh; >10MB/định dạng sai/CRC lỗi/active PDF/EICAR bị chặn; CLEAN + đúng ACL mới download | PASS backend + AV thật + browser | Chờ loại file/dung lượng được JKC duyệt |
| Confidentiality | TECH_ADMIN không xem/tải bí mật, head sai scope không duyệt, client không giả user/điểm/version | PASS API + raw runtime DB | Chờ ma trận vai trò chính thức |
| Học/quiz | Hoàn thành lesson, đúng tập câu hỏi/options, score server, max attempts, duplicate/concurrent submit, immutable history theo course_version | PASS | Chờ nội dung/tiêu chí đào tạo nghiệp vụ |
| Backup/restore | Pause writes, DB+files checksum, restore volume mới, 22 bảng khớp fingerprint, file/ACK/quiz còn | PASS local staging | Chờ đích lưu độc lập, scheduler/retention/RPO/RTO |

Chạy lại tự động theo README/runbook. Chromium dùng ignoreHTTPSErrors riêng cho local CA trong test; chứng cứ TLS thật là probe CA-verified, không suy ra điện thoại đã trust CA. Không ghi chữ PASS thực địa thay PO/IT.

Khi nghiệm thu thực địa cần ghi: người phụ trách/role, ngày, thiết bị/OS/browser/mạng, ca pass/fail, bằng chứng, lỗi cần sửa và chữ ký PO/IT. Hiện tất cả trường ký xác nhận là **PENDING**.

Điều kiện chốt Go Sprint 1: PO/IT xác nhận P0 còn lại hoặc có owner/mitigation và chấp thuận scope Sprint 1; không dùng Go Sprint 1 để suy ra Go production. Hiện đề xuất **NO-GO để đóng exit gate** khi chưa có các xác nhận đó.
