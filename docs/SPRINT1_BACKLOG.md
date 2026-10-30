# Sprint 1 backlog

Xem [SRS](SRS.md) và [báo cáo](reports/SPRINT1_IMPLEMENTATION.md). Nội quy, Tri thức/Sự cố và Đào tạo có ưu tiên ngang nhau.

- [x] OPS-01 kỹ thuật: race restore CA sửa, CI baseline đã xanh; local drill mới 41 bảng/files PASS.
- [x] DOC-01/02 kỹ thuật: HR explicit scope, authoring/version/review/assign/status UI; ACK bất biến theo phiên bản.
- [x] KB-01/02 kỹ thuật: yêu cầu sửa, từ chối, sửa draft/gửi lại, concurrency/audit/công đoạn.
- [x] INC-01/02 kỹ thuật: hồ sơ/tái diễn/xác minh theo scope; stale guards và history.
- [x] LMS-01/02 kỹ thuật: authoring/version/giao học/trạng thái; giữ quiz DB.
- [x] UX-01/QA-01 tự động local: login mới, states, regression desktop/mobile, backend43/UI12 PASS; không thay UX sign-off.
- BLOCKED OPS-02: PO/IT thực hiện UAT/CA/network/capacity và backup đích độc lập; không đánh dấu tự động PASS.
- BLOCKED INT-01: IT/Odoo admin xác minh version/edition/quyền API; giữ adapter no-op.
- PENDING: danh sách tài khoản HR và scope, policy máy chung/reset, người chịu trách nhiệm nội dung/khóa học thật; không tự cấp tài khoản thực.
- PENDING: workflow CI final feature commit; xem Actions, không suy ra pass từ report local.
- P1 cần PO chốt: notifications/Q&A/analytics, rich text editor, paging màn quản lý, storage GC/parser worker; load/pentest thực địa.

Đánh dấu x chỉ là kỹ thuật DEMO theo bằng chứng, chưa đóng gate Sprint 0.1 hay nghiệm thu Sprint 1. Kết luận phát hành vẫn NO-GO khi P0 thực địa chưa có chữ ký.
