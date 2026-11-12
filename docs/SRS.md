# SRS — baseline truy vết Sprint 1

Dẫn xuất từ yêu cầu người dùng ngày 30/10/2026 và TECHNICAL_DESIGN; chưa là chữ ký nghiệm thu PO.

| ID | Acceptance criteria | Hiện trạng đầu Sprint 1 |
|---|---|---|
| SEC-01 | Session/CSRF/RBAC, không admin bypass ACL | Có; cần regression |
| SEC-02 | Runtime non-owner/RLS, file private/AV fail-closed | Có; cần chạy lại sau migration |
| OPS-01 | Staging HTTPS và restore độc lập kiểm checksum | Có; lỗi CI race CA đang sửa |
| OPS-02 | UAT thực địa/CA/DNS/VPN/firewall/backup độc lập/capacity | PO/IT chưa ký, blocker phát hành |
| DOC-01 | HR ban hành, không TECH_ADMIN; version/audit bất biến | Thiếu authoring/version workflow |
| DOC-02 | Giao đọc, đúng user/version, đọc/chưa đọc/quá hạn | ACK/API có; thiếu quản lý UI |
| KB-01 | Draft edit/request-changes/reject/resubmit; scope/no-self/stale | Chỉ draft/submit/approve |
| KB-02 | Phân loại 5 công đoạn, file ACL | Tra cứu có; thiếu authoring phân loại |
| INC-01 | Hồ sơ hiện tượng/điều kiện/nguyên nhân/phương án/kết quả | Mới có hướng dẫn đã duyệt |
| INC-02 | Tái diễn/idempotency, head scope xác minh không tự duyệt | Thiếu workflow |
| LMS-01 | Tạo phiên bản khóa/bài học/quiz, duyệt, giao user/dept | Player/chấm DB có; thiếu quản lý |
| LMS-02 | Không sửa bản ban hành; lịch sử điểm; 5 trạng thái | Bất biến có; thiếu trạng thái quản lý |
| UX-01 | 9 thiết kế responsive, mobile login hero và nút đỏ | 8 màn baseline có; login mới thiếu |
| QA-01 | Unit/integration/authorization/UI/migration/OpenAPI/Compose | Cần mở rộng và bằng chứng mới |
| INT-01 | Odoo no-op đến khi xác minh version/rights | Có, giữ nguyên |

## Ma trận sau triển khai — DEMO

| ID | Đã có / lỗi đã xử lý | Cần kiểm thử/xác nhận tiếp | Truy vết |
|---|---|---|---|
| SEC-01/02 | PASS kỹ thuật, runtime thật; không admin bypass, không raw score/key quyền mới | Security assessment thực địa | test_security, test_sprint01, test_workflows, test_sprint1_features |
| OPS-01 | PASS restore readiness, 41 bảng + files checksum, upgrade/downgrade 007 | Đích backup IT độc lập và lịch vận hành | sprint1/restore-verification.json, migration-cycle.json |
| OPS-02 | Chưa có chữ ký; NO-GO gate | PO/IT: toàn bộ checklist thực địa | UAT_SPRINT1_FIELD.md |
| DOC-01 | HR riêng; version/title/edit/review; không self approve/TECH_ADMIN | Danh sách HR/phạm vi và nội dung thật cần duyệt | workspace/contents; test_workflows; Playwright sprint1 |
| DOC-02 | Giao user/dept, deadline/status/history, ACK bản cũ giữ nguyên | HR/PO UAT đối tượng giao thực tế | workspace/reading; test_sprint1_features |
| KB-01/02 | Request-changes/reject/fork/edit/resubmit/process/filter, lock/revision | UX, nội dung ngành in do người phụ trách xác minh | migration 004/007, authoring.tsx, API/runtime/browser tests |
| INC-01/02 | Hồ sơ/propose/occur/verify, no self/out-of-scope/stale, history immutable | Nghiệp vụ xác minh và quy trình thật PO/head ký | migration 005/007, incident_records, incident-manager |
| LMS-01/02 | Authoring/approve/fork/assign/5 statuses; giữ grader/history | Duyệt bài/đáp án/threshold thật, policy giao học | migration 006, training_authoring, training-manager, tests |
| UX-01 | 9 designs đã đọc; login hero/đỏ + states; UI12 PASS | Đối chiếu thiết bị thật/UX sign-off, paging cho dữ liệu lớn | design/LOGIN_ASSET.md, sprint1/regression |
| QA-01 | Backend45 + UI12; lint/types/build/OpenAPI/Compose/actionlint/drill PASS local; CI code 3fc5e0c cả 3 job PASS | Trạng thái head bàn giao sau đó và UAT PO/IT | reports/SPRINT1_IMPLEMENTATION.md |
| INT-01 | Adapter no-op giữ nguyên | IT/Odoo admin xác minh version/edition/API rights | integrations/odoo.py |
