# TRI THỨC JKC — Technical Design v1.0
Ngày: 30/10/2026 · Trạng thái: Design baseline, chưa nghiệm thu thực địa

## 1. Quyết định đã chốt
- Quy mô 50–200 nhân viên, 5 công đoạn: thiết kế/chế bản, offset, kỹ thuật số, flexo/bao bì, gia công sau in.
- 8 màn hình duyệt: Dashboard; thư viện nội quy; chi tiết tài liệu; kho tri thức; chi tiết sự cố; tạo bài chia sẻ; khóa học của tôi; phê duyệt.
- Trưởng bộ phận duyệt nội dung chuyên môn thuộc bộ phận được giao. Không tự phê duyệt bài do chính mình tạo (mặc định). Quyền ban hành nội quy toàn công ty phải xác nhận riêng.
- Tài khoản JKC độc lập, mật khẩu không đồng bộ Odoo. Odoo phiên bản chưa rõ; tích hợp theo adapter và POC.
- Máy chủ nội bộ; truy cập di động chỉ qua Wi-Fi/VPN được cấp quyền.
- Hiện trạng chủ yếu truyền đạt kinh nghiệm: biểu mẫu ghi nhận bài học và upload ảnh là nghiệp vụ cốt lõi.

## 2. Kiến trúc & ADR
**ADR-001:** Modular monolith cho FastAPI, không microservices. Tầng: Router -> Auth/Permission -> Service/Unit of Work -> Repository -> PostgreSQL. Worker riêng cho thông báo, quét file, đồng bộ Odoo (đề xuất Celery/Redis khi triển khai; chưa có trong starter).
**ADR-002:** Next.js App Router, TypeScript; web dùng server-rendered route với client forms. API ở cùng origin qua reverse proxy `/api` để dùng secure session cookie.
**ADR-003:** PostgreSQL transaction cho chuyển trạng thái. Optimistic locking với `version_number`/trạng thái hiện hành; audit sự kiện bất biến.
**ADR-004:** Object storage S3-compatible tại mạng nội bộ (MinIO hoặc NAS có lớp ứng dụng). Starter chưa đóng gói storage do cần khảo sát disk, backup và bảo mật.
**ADR-005:** Odoo Adapter interface `probe()`, `fetch_employees(cursor)`, `fetch_departments(cursor)`; triển khai cụ thể chỉ sau POC.
**ADR-006:** Quản lý mật khẩu Argon2id, reset one-time token hết hạn, session ID ngẫu nhiên lưu hash; HttpOnly Secure SameSite cookies, bảo vệ CSRF, rate limit, revoke/logout. Tất cả truy cập kiểm tra backend.

### Sơ đồ triển khai
User Browser/PWA -> DNS nội bộ + TLS -> Caddy -> Next.js (SSR/UI) + FastAPI -> PostgreSQL + protected file storage; background worker -> Odoo Adapter; backup đến điểm lưu độc lập. Chỉ reverse proxy lộ cổng tới mạng người dùng. Không lộ cổng PostgreSQL/API nội bộ.

## 3. Hành vi và route cho 8 màn hình
| UI | Frontend path | API chính | Hành động/Trạng thái |
|---|---|---|---|
| UI-01 Dashboard | `/` | `/auth/me`, `/notifications`, `/my/learning` | Tìm kiếm; shortcut công đoạn; việc cần làm; loading/empty/error |
| UI-02 Nội quy | `/documents` | `GET /documents` | Lọc loại, bộ phận, hiệu lực; phân trang; quyền đọc |
| UI-03 Chi tiết | `/documents/[id]` | `GET /documents/{id}`, acknowledge | Xem phiên bản; tải file; xác nhận đúng phiên bản được giao |
| UI-04 Kho tri thức | `/knowledge` | `GET /articles`, `/search` | Từ khóa; lọc; xem trạng thái; không lộ bản chưa duyệt |
| UI-05 Chi tiết sự cố | `/incidents/[id]` | `/incidents/{id}`, `/occurrences` | Kiểm tra bằng chứng, mức xác minh; ghi nhận tái diễn |
| UI-06 Tạo bài | `/knowledge/new` | `POST /articles`, submit | Lưu nháp; validation; file; gửi duyệt; tránh gửi trùng |
| UI-07 Khóa học | `/learning` | `/my/learning`, quiz | Giao khóa theo phiên bản; xem tiến độ; kiểm tra |
| UI-08 Phê duyệt | `/approvals` | `/approvals`, approve/request-changes/reject | Chỉ người có quyền; lưu lý do; ngăn tự duyệt |

Cần bổ sung các route phụ: `/login`, `/admin/users`, `/questions`, `/notifications`, `/reports`; không phải trong bộ 8 màn hình đã duyệt nhưng có trong backlog MVP.

## 4. Design system và responsive
- Tokens đề xuất: navy `#173C65`, primary `#087BEA`, orange `#FF8C24`, danger `#E5484D`, success `#198754`, surface `#F6F8FC`.
- Spacing 4/8/12/16/24/32; radius 8/12/16; sidebar 240–264 px desktop; mobile navigation 5 tab; breakpoint mobile dưới 768 px, tablet 768–1023 px (cần kiểm thử thực tế).
- Thiết kế đầy đủ state: skeleton/loading, empty, search no result, permission denied, expired session, network unavailable, form unsaved warning, API conflict, file upload failure, and approval action pending.
- Accessibility: keyboard/focus state, label rõ, kích thước vùng bấm tối thiểu khoảng 44 CSS px, tương phản và thông báo trạng thái không chỉ dùng màu.
- Dữ liệu demo không được xem là nội quy thật hoặc hướng dẫn kỹ thuật máy được JKC phê duyệt.

## 5. Database
Xem `database/001_initial.sql` (PostgreSQL). Các nhóm chính: identity (departments/users/roles/permissions/sessions), knowledge (contents/content_versions/tags/ACL/attachments), approval, reading, incidents, questions, LMS, notifications, audit và integration.

Quy tắc dữ liệu:
- `contents.current_published_version_id` chỉ trỏ tới phiên bản `APPROVED` thuộc chính content, enforce bằng service transaction và test (có thể thêm trigger ở bản production).
- Nhiệm vụ đọc tham chiếu `content_versions.id`; phiên bản mới tạo assignment mới, không ghi đè xác nhận cũ.
- Phân quyền `COMPANY`/`CROSS_DEPARTMENT`/`DEPARTMENT`/`RESTRICTED`; cross-department dùng ACL danh sách bộ phận được chỉ định.
- File chỉ cho download sau khi kiểm tra quyền trên nội dung cha, và chỉ khi scan status `CLEAN`.
- Tất cả thay đổi trạng thái tạo `audit_logs` và `approval_events`. Không lưu mật khẩu, cookie, secrets trong audit.
- LMS lưu đúng course_version, lần làm, câu trả lời, không mất lịch sử khi phát hành khóa mới.
- `attachments` phiên bản SQL hiện gắn `content_version`; câu hỏi, bài học, sự cố riêng sẽ cần liên kết polymorphic an toàn hoặc bảng liên kết theo resource trong migration tiếp theo.
- Tìm kiếm: giai đoạn đầu PostgreSQL full-text Vietnamese cần đánh giá khả năng tokenizer; fallback `pg_trgm` và bộ lọc có ACL, không dùng search index bên ngoài nếu chưa kiểm soát quyền.

## 6. API
Xem `api/openapi.yaml` (OpenAPI 3.1 **contract phác thảo**). Định dạng `application/json`, UUID, thời gian UTC ISO-8601; pagination `page/pageSize`; API prefix `/api/v1`. Các error codes: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `RESOURCE_NOT_FOUND`, `VERSION_CONFLICT`, `RATE_LIMITED`, `INTEGRATION_UNAVAILABLE`. Request IDs trong log và lỗi. Chi tiết schemas của phần lớn endpoint cần bổ sung trong Sprint 0 refinement trước code production.
- `POST /articles`: draft; `POST /articles/{id}/submit`: tạo Approval; `POST /approvals/{id}/approve`: transaction kiểm quyền/phạm vi/khác tác giả/phiên bản, ghi audit.
- `POST /reading-assignments/{id}/acknowledge`: backend lấy user từ session và xác minh assignment/version.
- `POST /quiz-attempts/{id}/submit`: điểm tính phía server, client không được thấy đáp án đúng trước khi kết thúc.
- `GET /search`: chỉ đếm và trả kết quả được quyền thấy; tránh rò snippet và file metadata.
- `POST /admin/integrations/odoo/sync`: xếp hàng tác vụ, idempotent upsert, không xử lý sync dài trong HTTP request.

## 7. Cấu trúc source code mục tiêu
```
apps/
  web/
    app/(public)/login/page.tsx
    app/(app)/layout.tsx
    app/(app)/page.tsx
    app/(app)/documents/page.tsx
    app/(app)/documents/[id]/page.tsx
    app/(app)/knowledge/page.tsx
    app/(app)/knowledge/new/page.tsx
    app/(app)/incidents/[id]/page.tsx
    app/(app)/learning/page.tsx
    app/(app)/approvals/page.tsx
    components/{layout,ui,forms,knowledge,documents,incidents,learning,approvals}/
    lib/{api,auth,schemas,formatters}/
  api/
    app/main.py
    app/core/{config,security,permissions,db}.py
    app/modules/{identity,departments,documents,knowledge,incidents,qa,learning,approvals,notifications,search,integration}/
    app/integrations/odoo/{base,legacy_rpc,json2,mapper}.py
    alembic/versions/
    tests/{unit,integration,security}/
infra/{caddy,backup,monitoring}/
contracts/openapi.yaml
```
Starter cung cấp layout tối thiểu để chứng minh build/health; **không phải 8 màn hình đã code**.

## 8. Docker / On-Premise
- `deploy/compose.yml` và `deploy/Caddyfile` là starter triển khai để dev kiểm thử, KHÔNG phải môi trường production-ready.
- Thực hiện `cd deploy && cp .env.example .env` rồi thay secret, `docker compose up -d --build` trên host có Docker và DNS/chứng chỉ thích hợp.
- `tls internal` của Caddy dùng CA riêng; thiết bị phải tin cậy CA, không tự mặc định an toàn cho mọi điện thoại.
- `database/001_initial.sql` chỉ chạy khi volume DB mới khởi tạo; các thay đổi sau dùng Alembic migration, không sửa SQL đã chạy.
- Production cần: secrets vault, backup tự động + thử restore, storage + backup file, SMTP nội bộ, worker/queue, health readiness, monitoring/log rotation, image pinning, security scan, firewall, RBAC audit và runbook.
- Thiết lập RPO/RTO và dung lượng file với IT; không dùng volume trên cùng một ổ làm bản backup duy nhất.

## 9. Odoo POC
1. Ghi nhận phiên bản/edition/hosting, module HR, quyền external API, URL và mạng.
2. Dùng tài khoản tích hợp quyền tối thiểu; kiểm tra get version và fetch 5 record thử nghiệm, không thay đổi dữ liệu ERP.
3. Map `employee_code`, `odoo_external_id`, `department`, `active`; xác định conflict và nhân viên chuyển phòng.
4. Thử idempotent sync hai lần, mất kết nối, retry/backoff và nhân viên nghỉ việc.
5. Lập ADR lựa chọn adapter + danh sách field, SLA đồng bộ, thời gian chạy batch.
Không dùng API key trong frontend, không hard-code JSON-2 khi chưa rõ phiên bản. Odoo 19 JSON-2 có điều kiện gói và version-specific model/fields.

## 10. Sprint 0 — 2 tuần / tiêu chí nghiệm thu
| ID | Việc | Owner đề xuất | Evidence / Acceptance |
|---|---|---|---|
| S0-01 | Chốt 8 màn hình và UI states | PO+UX | Figma/component spec, responsive, empty/loading/error, PO sign-off |
| S0-02 | Workshop 5 công đoạn | BA+Key Users | 10–15 ca thực tế, mẫu tri thức chuẩn, scope/owner thống nhất |
| S0-03 | Architecture decision records | Tech Lead | ADR modular monolith, auth, storage, integration được duyệt |
| S0-04 | Database & migration | Backend | Schema migration chạy clean DB, rollback/restore test |
| S0-05 | OpenAPI contract refinement | Backend+Frontend | Các luồng P0 có schema request/response và mã lỗi, lint pass |
| S0-06 | Source & CI foundation | Dev team | Frontend build, backend unit test, compose staging health OK |
| S0-07 | Security baseline | IT+Backend | TLS, cookies, role scoping, threat model, audit log checklist |
| S0-08 | Odoo POC | Odoo admin+Backend | Version/protocol/API rights/mapping confirmed hoặc blocker documented |
| S0-09 | Backup + restore drill | IT/DevOps | DB backup restored to isolated environment with evidence |
| S0-10 | Sprint 1 ready backlog | PO+BA+Devs | Story acceptance, estimates, dependencies, roles confirmed |

**Sprint 0 exit gate:** S0-01..S0-10 có bằng chứng nghiệm thu hoặc blocker có owner/mitigation; không đưa app production khi chưa có bảo mật, quyền và khôi phục dữ liệu. Demo phải chạy trên môi trường staging nội bộ qua desktop và điện thoại được cấp quyền.

## 11. Kế hoạch sprint sau Sprint 0
S1 (2 tuần): auth/users/RBAC/categories/layout; S2: documents/versions/articles/approval; S3: incidents/search/reading acknowledgement; S4: Q&A/course/assignment; S5: quiz/notifications/report/Odoo basic sync tùy POC; S6: UAT/security/backup/pilot release. Re-estimate theo velocity sau S1.

## 12. Rủi ro & câu hỏi mở
- Hệ thống sử dụng tại xưởng trên máy cá nhân hay máy chung? Quy trình đăng xuất và session policy?
- Phòng ban nào được duyệt nội quy chung? Trưởng bộ phận đi vắng có ủy quyền không?
- Video có cần lưu nội bộ không, kích thước tối đa bao nhiêu?
- Odoo version, license, access rights, network connectivity?
- Hardware server, backup target, offline/VPN requirements, disaster recovery?
- Dữ liệu legacy chủ yếu là kinh nghiệm: cần người chịu trách nhiệm thu thập, xác minh, kiểm soát chất lượng bài viết.

## 13. Nguồn đối chiếu
- Next.js App Router: https://nextjs.org/docs/app
- FastAPI OpenAPI: https://fastapi.tiangolo.com/tutorial/metadata/
- Odoo 19 JSON-2: https://www.odoo.com/documentation/19.0/developer/reference/external_api.html

## 14. Cập nhật Sprint 0.1 (không thay baseline/PO sign-off)

Những mô tả starter/draft ở trên là baseline ban đầu. Source hiện có thêm auth/RBAC, runtime role/RLS, file private+ClamAV, ACK theo phiên bản, quiz/history và full Compose HTTPS được kiểm thử bằng DEMO. Xem [ADR bổ sung](ADR_SPRINT01.md), [runbook](STAGING_RUNBOOK.md), [UAT](UAT_SPRINT01.md) và [báo cáo có bằng chứng](reports/sprint01/REPORT.md). Exit gate vẫn mở; không suy ra đã nghiệm thu production hoặc xác nhận Odoo.
