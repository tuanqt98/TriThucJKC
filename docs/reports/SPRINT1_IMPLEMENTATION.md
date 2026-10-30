# Sprint 1 — triển khai và kiểm chứng

Ngày 30/10/2026. Nhánh `feature/sprint-1-mvp`, baseline `dc47e98`. Chỉ DEMO; không production, không dữ liệu nhân viên thật.

## Audit source và CI

Đã fetch và pull --ff-only main trước khi tạo nhánh; không có thay đổi tracked chưa commit. Giữ ảnh mới của người dùng `09_login.png`; bỏ qua .DS_Store, không xóa dữ liệu người dùng. Đã đọc AGENTS, START_HERE, README, technical design, OpenAPI, baseline SQL, Compose, checklist Sprint 0, báo cáo Sprint 0/0.1, ADR, runbook và UAT. Đã xem 9 bảng thiết kế desktop/mobile. Không tìm thấy SRS/backlog riêng trong baseline; tài liệu truy vết bổ sung cần PO review.

CI baseline [41036298237](https://github.com/tuanqt98/TriThucJKC/actions/runs/41036298237): foundation PASS, PostgreSQL 17 PASS, staging FAIL tại docker cp CA sau restore. Log xác nhận dump, file checksum và restore đã pass; proxy mới ở trạng thái Started, CA chưa tồn tại. Sửa snapshot restore chờ toàn stack healthy qua Compose --wait/240s, giữ guard từ chối volume đã tồn tại. Regression unit kiểm tra chờ readiness và không chạm volume cũ. Không nới lỏng kiểm tra TLS/CA.

CI bản sửa staging [41037682167](https://github.com/tuanqt98/TriThucJKC/actions/runs/41037682167): staging PASS; foundation phát hiện test duyệt phụ thuộc bản nháp test trước. Đã cho test tự tạo fixture riêng, chọn đúng hồ sơ thay vì phần tử đầu. [41038282100](https://github.com/tuanqt98/TriThucJKC/actions/runs/41038282100) tại `f663d03`: **cả 3 job PASS**, trước khi mở rộng chức năng.

## Quyết định nghiệp vụ

Người dùng xác nhận trong phiên làm việc: **HR ban hành nội quy**. Quyền HR riêng, cấp tường minh theo phạm vi; TECH_ADMIN không tự có quyền HR. Không tạo chữ ký PO/IT hay tự coi account DEMO là nhân sự thật.

## Trạng thái nghiệm thu

**NO-GO đóng gate Sprint 0.1 / phát hành production**: chưa có UAT thực địa, CA/DNS/VPN/firewall/capacity, backup độc lập/scheduler/retention và sign-off IT/PO. Local/CI tự động không thay thế các chữ ký này. Sprint 1 đang triển khai, chưa nghiệm thu.

## Kết quả triển khai theo module

| SRS | Hoàn thành kỹ thuật | Bằng chứng / giới hạn |
|---|---|---|
| DOC-01 | Tạo/sửa nháp, tiêu đề/nội dung/công đoạn theo version, gửi HR, approve/request-changes/reject; bản mới sau phản hồi hoặc đã ban hành | API/DB chặn tự duyệt, sai scope, TECH_ADMIN, stale revision. Version cũ và approval_events/audit giữ nguyên. HR công ty phải được operator cấp rõ; không có account thật tự được cấp HR. |
| DOC-02 | UI giao theo nhân viên/bộ phận, deadline, đọc/chưa đọc/quá hạn, bản cũ/hiện hành; ACK cũ giữ nguyên | Giao hàng loạt atomic, scope/recipient ACL/current version; idempotent không đổi hạn của nhiệm vụ đã có. HR/head chỉ theo phạm vi. |
| KB-01/02 | Sửa/reopen sau reload, gửi lại bằng version mới, yêu cầu sửa/từ chối có lý do, 5 công đoạn và search theo bản ban hành | Optimistic revision + khóa content/version; concurrent save chỉ một thành công. Không tự duyệt/sai bộ phận. Tệp private theo từng version; bản mới cần upload tệp riêng, không tự sao chép tệp. |
| INC-01/02 | Hồ sơ hiện tượng/điều kiện/mức độ/công đoạn, sửa trước khi xác minh, giả thuyết/nguyên nhân/bước đề xuất/kết quả, tái diễn | Request key chống trùng và chỉ một audit cho retry; scoped head khác người báo/người đề xuất mới xác minh, kiểm cả revision hồ sơ và phương án. Phương án VERIFIED bất biến. Không tự chuyển hướng dẫn DEMO thành SOP; trang hướng dẫn cũ giữ nguyên. |
| LMS-01/02 | Tạo/sửa/mở lại khóa nháp, nhiều bài và câu hỏi; submit/head approve/no-self; clone bản ban hành thành version mới; giao user/dept; tiến độ | Chấm bằng hàm DB cũ, answer key chỉ qua author/reviewer endpoint trước ban hành, không lộ cho học viên/TECH_ADMIN; bản ban hành/điểm/lịch sử bất biến. Trạng thái ưu tiên COMPLETED → OVERDUE → FAILED (hết lượt) → IN_PROGRESS → NOT_STARTED. |
| UX-01 | Login theo thiết kế 09: hero ảnh riêng desktop/mobile, logo JKC, nút đỏ, hiện mật khẩu; session/reset/CSRF giữ nguyên | Đã xem ảnh render. Mockup không được nhúng làm app; [asset/prompt](../../design/LOGIN_ASSET.md). Các trang quản lý bổ sung dùng component/CSS thật, cần PO/UX review thực địa. |
| SEC-01/02 | Giữ runtime non-owner/no BYPASSRLS, quyền hẹp và file fail-closed; thêm RLS incident và các hàm workflow có scope | Mọi hàm SECURITY DEFINER có search_path cố định, PUBLIC EXECUTE bị thu hồi, runtime chỉ được execute tường minh. Không thêm SELECT answer key hay UPDATE score/completion cho runtime. API identity vẫn là ranh giới tin cậy như Sprint 0.1. |
| OPS-01 | Chờ full restore healthy trước đọc CA; output evidence-dir riêng; fingerprint mở rộng toàn bộ 41 bảng | PASS local staging: dump+files checksum, restore secret mới/volume trống, khớp mọi row hash trước login. Chỉ drill cùng host; chưa phải backup IT độc lập. |

## Migration và endpoint

- `004_workflows`: HR role riêng (không gán account), revision/công đoạn version, workflow nội dung và quản lý đọc. Không nới raw runtime UPDATE policy để làm workflow; ghi qua các hàm hẹp có kiểm quyền/trạng thái.
- `005_incidents`: owner department, revision, RLS hồ sơ/phương án/tái diễn, unique request key và immutable verified/occurrence history.
- `006_training`: revision/approver course version, authoring/clone/assign, training status và scoped progress. Giữ nguyên grader/ACK ở 003.
- `007_titles`: tiêu đề theo content version (legacy fallback c.title), refine content/reading functions và stale incident verification guard. Không UPDATE những bản APPROVED cũ khi thêm cột.
- Không đổi baseline hoặc migrations 001–003. Đã drill head→003→head→base→head trên DB test trống. Rollback có dữ liệu cần backup/restore được duyệt, không coi downgrade là công cụ xóa lịch sử.
- API thực: GET/POST/PUT `/workspace/contents`, POST `/workspace/contents/{fork,submit,approve,request-changes,reject}`; GET `/workspace/people`, GET/POST `/workspace/reading`; GET/POST/PUT `/workspace/incidents`, POST `/solutions`, `/verify`, `/occurrences`; GET/POST/PUT `/workspace/courses`, GET `/progress`, POST `/submit`, `/approve`, `/fork`, `/assign`. Prefix chung `/api/v1`. Request/response schemas trong OpenAPI export từ code; các URL dự thảo cũ trong `openapi.backlog.yaml` không mặc nhiên được triển khai.
- Màn hình `/workspace`, `/incidents/manage`, `/learning/manage`; thêm link desktop/mobile từ workspace hiện hữu. Player, route đọc tài liệu, upload/download và auth cũ tiếp tục dùng được.

## Kiểm thử và chứng cứ

- [backend-junit.xml](sprint1/backend-junit.xml): **43 passed**, Python 3.12 / PostgreSQL 17 trong database test mới; giữ đủ 34 tests Sprint 0.1. Có 2 DeprecationWarning từ validator/PDF fixture, không fail.
- [uat-results.json](sprint1/uat-results.json): **12 passed, 0 fail/skip**, desktop 1440×1000 và mobile 390×844. Gồm 8 ca regression cũ, hero/red button/reset và end-to-end 3 module. Test không dựa thứ tự nội dung đầu danh sách; so dashboard với API thật. Không bỏ hay nới kiểm tra authorization cũ.
- [staging-probe.json](sprint1/staging-probe.json): HTTPS xác thực đúng CA, cookie Secure/HttpOnly, ClamAV CLEAN/EICAR thật, ACL, ACK và quiz duplicate guard.
- [infrastructure.json](sprint1/infrastructure.json): cả 5 service healthy; chỉ proxy loopback; runtime không owner/superuser/BYPASSRLS, không answer key SELECT/score UPDATE.
- [migration-cycle.json](sprint1/migration-cycle.json): upgrade/downgrade/reapply 003/007/base PASS, không stamp thay migration.
- [backup-fingerprint.json](sprint1/backup-fingerprint.json), [backup-operation.json](sprint1/backup-operation.json), [restore-operation.json](sprint1/restore-operation.json), [restore-verification.json](sprint1/restore-verification.json): **41 bảng khớp count/hash**, từng file khớp SHA-256; login/ACK/quiz/protected download còn sau restore. Snapshot được lấy sau UAT, trước post-restore login.
- Ruff lint/format, Next lint/typecheck/build, OpenAPI export --check, Compose staging config, actionlint, unit restore readiness/volume refusal: PASS theo lệnh đã chạy. Final feature CI cần xem trên [Actions nhánh feature](https://github.com/tuanqt98/TriThucJKC/actions?query=branch%3Afeature%2Fsprint-1-mvp); không lấy local PASS thay remote CI.
- Ảnh có tại [regression](sprint1/regression/), đã xem login mobile, biên soạn mobile, hồ sơ desktop và đào tạo mobile. Chromium local-CA ignore chỉ cho automated fixture; probe riêng kiểm CA thật. Không suy ra thiết bị xưởng đã trust CA.

## File thay đổi và lỗi đã sửa

Các file chính: `starter/apps/api/alembic/versions/004*` đến `007*`; `app/workflows.py`, `workspace_schemas.py`, `incident_records.py`, `training_authoring.py`, `grant_hr.py`, auth context/grants/file-access integration; `tests/test_workflows.py`, `test_sprint1_features.py`. Frontend: `authoring.tsx`, `reading-manager.tsx`, `incident-manager.tsx`, `training-manager.tsx`, `use-management.ts`, routes tương ứng, login/CSS/nav và public hero. Ops: scripts staging, migration_cycle/database_drill, workflow CI và Docker web copy public. Contract/docs: OpenAPI, SRS/backlog, runbook/UAT và báo cáo/bằng chứng.

Đã sửa SQL alias đụng biến PL/pgSQL ở list reading/incident gây 500; test giao đọc dùng fixture riêng để không nhầm idempotency với cập nhật hạn cũ; dùng accessible combobox locator; Docker standalone thiếu public; course draft reload cần bỏ ID/order metadata trước gửi strict lesson input. Thêm guard NULL revision ở hàm DB, chặn stale verification theo cả hồ sơ lẫn phương án, tiêu đề bản mới không sửa tiêu đề đã ban hành, seed không kéo published pointer về v1 khi chạy lại.

## Còn lại, rủi ro và GO/NO-GO

**NO-GO đóng exit gate / phát hành chính thức / production**. Kỹ thuật có bằng chứng tự động; PO/HR/key users chưa ký UAT thực địa. IT chưa xác nhận TLS/trust CA/DNS/VPN/firewall trên mạng và thiết bị thật, năng lực host, release digest/AV freshness alert, đích backup độc lập/mã hóa/scheduler/retention/RPO/RTO và CA-key custody. Dùng [checklist](../UAT_SPRINT1_FIELD.md); owner và các trường ký đều PENDING, không tự điền PASS.

HR là bên ban hành đã được người dùng chốt; danh sách người được cấp HR và phạm vi cụ thể vẫn cần operator/IT đối chiếu quyết định trước khi chạy `grant_hr`. Không có HR thực được tự cấp. Odoo vẫn no-op, version/edition/API rights chưa xác minh. Không ERP call/password sync.

Giới hạn MVP còn cần PO chốt: editor nội dung dạng text/JSON, không rich-text CMS; không workflow notification/Q&A/analytics; chưa storage GC/parser worker, load/pentest và UX sign-off thực địa. Hồ sơ sự cố mới tách khỏi thư viện hướng dẫn đã duyệt; không tự xuất bản SOP hay nhân bản file giữa các version. Trang quản lý mới chưa có paging server cho dữ liệu lớn; cần capacity review trước dữ liệu thực. Các giới hạn này không được quảng bá là chức năng đã triển khai.

Stack review DEMO mới tại https://localhost:18444, secret private ở `.local/sprint1.env`; các stack khác giữ nguyên. Backup/checkpoint/CA private key/credentials/trace không đưa vào Git. Không force-push hay merge main. Xem [runbook Sprint 1](../STAGING_SPRINT1.md) và [SRS](../SRS.md).
