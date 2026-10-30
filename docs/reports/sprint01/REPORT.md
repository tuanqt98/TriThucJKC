# Sprint 0.1 — báo cáo triển khai và nghiệm thu kỹ thuật

Ngày 30/10/2026. Chỉ dữ liệu DEMO/tài khoản tổng hợp, không production, không nhân viên thật. Source tiếp tục từ commit cf71ecc, giữ auth/layout/API đang hoạt động và Odoo no-op; không sửa baseline SQL hay migrations 001/002.

**Kết luận: các luồng kỹ thuật đã triển khai và pass kiểm thử local staging; exit gate chưa đóng. NO-GO chuyển Sprint 1 chính thức khi P0 phê duyệt/thực địa còn mở.** Có thể review code/tiếp tục xử lý backlog trong môi trường DEMO, không dùng kết quả này làm giấy phép triển khai production.

## Hoàn thành theo yêu cầu

| Hạng mục | Đã triển khai | Pass/fail và giới hạn |
|---|---|---|
| 1. Full Docker staging | Caddy/admin off, Next standalone, FastAPI non-root/read-only, PG17, migrate + storage-init, ClamAV; API/DB/scanner không public, proxy chỉ loopback 18080/18443 | **PASS** cả 5 service healthy. Các stack có sẵn ở 80/443/8080 không thay đổi. |
| 2. HTTPS + backup/restore | CA-specific verification, HTTP→HTTPS, cookie Secure/HttpOnly; pause writes, DB dump + private files + SHA256SUMS; restore volume rỗng bằng secret DB/runtime mới | **PASS local staging**: 22 bảng khớp count + SHA-256 canonical rows, từng file khớp hash, protected download/ACK/quiz history còn. Chưa có bản sao độc lập/scheduler của IT hoặc trust CA điện thoại thật. |
| 3. Runtime role/RLS | Migration 003, jkc_runtime không owner/superuser/BYPASSRLS/role membership; RLS nội dung/version/attachments/reading/LMS; câu trả lời đúng không có SELECT grant, score/completion không UPDATE grant; thủ tục chấm/ACK hẹp | **PASS** test bằng connection runtime thật + HTTP; unscoped SQL thấy 0 contents, TECH_ADMIN không bypass bí mật; raw edit score/history/disable RLS bị chặn. Identity/auth vẫn là ranh giới tin cậy API, không giả định bảo vệ khỏi API host bị chiếm toàn quyền. |
| 4. Upload/download | PNG/JPEG/PDF tĩnh <=10MB, verify/canonicalize, chặn path/control chars/active PDF/bad CRC, ClamAV trước/sau, age <=7 ngày, fail-closed; private random key/mode0600/no-follow; CLEAN + parent ACL + hash | **PASS** real ClamAV: CLEAN tải được, EICAR bị 422 và không lưu; admin/sai scope 404; PENDING/hash hỏng/mất scanner không download/upload được. Không nhận video/Office/SVG/HTML; chưa có orphan GC/worker/parser capacity thực địa. |
| 5. Đã đọc theo phiên bản | GET my/reading, giao nhiệm vụ scope trưởng bộ phận qua API, ACK dùng session user + expected version, khóa content/assignment, idempotent và audit; UI hiển thị lịch sử | **PASS** giả user/sai version/stale 409/404, 2 lần ACK chỉ 1 record/audit, v2 không overwrite ACK v1. Chưa có UI giao task/ban hành version; quyền ban hành công ty chờ PO. |
| 6. Quiz đào tạo | Player bài học được giao, complete lesson, open/reuse attempt, max attempts, exact questions/options, grading DB/server, snapshot ngưỡng/score/đúng-tổng/version, completion sau pass, immutable history | **PASS** 0/100 theo đáp án server, payload score bị 422, option sai câu/submit lại/concurrent submit bị chặn; admin không xem khóa không được giao; course structure đã duyệt không sửa/thêm câu âm thầm. LMS authoring/assignment UI chưa có. |
| 7. Regression + UAT | Giữ 18 test cũ, thêm RLS/file/reading/quiz/health/guard tests; Playwright desktop/mobile và probe HTTPS/AV thật; CI full staging/restore khai báo | **PASS tự động**, **PENDING UAT PO/IT thực địa**. Workflow mới đã actionlint, chưa chạy trên GitHub ở lần bàn giao này. |

## Bằng chứng

- [backend-results.json](backend-results.json), [backend-junit.xml](backend-junit.xml): **34 passed, 0 failures/errors** trong image test Python **3.12**, PostgreSQL **17.11**; app runtime không chứa test tools. Trước đó 31 tests đã pass Python 3.9/PG16; migration drill cuối trên PG16.
- [uat-results.json](uat-results.json): **8 passed, 0 failed/skipped**, Chromium desktop **1440×1000**, mobile **390×844**; locale vi-VN/timezone Asia/Ho_Chi_Minh; login, routes, search empty, draft/submit/approve/logout, file upload/download, ACK, lesson/quiz/history/reload.
- [staging-probe.json](staging-probe.json): CA-verified HTTPS, Secure/HttpOnly cookie, real CLEAN/EICAR, parent ACL, idempotent ACK và score/duplicate submission.
- [infrastructure.json](infrastructure.json): health/ports/image IDs/runtime flags/RLS guards/current ClamAV version. Chỉ proxy publish loopback; không xuất env/secret.
- [backup-operation.json](backup-operation.json), [restore-operation.json](restore-operation.json), [backup-fingerprint.json](backup-fingerprint.json), [restore-verification.json](restore-verification.json): drill độc lập trước các lần UAT tiếp theo, so 22 bảng và file; app đọc lại ACK và quiz pass sau restore. Không nhầm fingerprint snapshot với dữ liệu source đã tiếp tục được UAT ghi thêm sau đó.
- [migration-drill.json](migration-drill.json): clean upgrade→downgrade base→upgrade 003 và dump/restore vào database tạm; không thay bằng stamp.
- Ruff lint/format, Next lint/typecheck/build, OpenAPI validate/export --check, Compose local/staging config và actionlint: **PASS** theo lệnh đã chạy. Docker web build dùng Node22, đã chạy standalone trong full stack.
- Ảnh: [reading desktop](reading-desktop.png) / [mobile](reading-mobile.png), [upload desktop](upload-desktop.png) / [mobile](upload-mobile.png), [quiz desktop](quiz-desktop.png) / [mobile](quiz-mobile.png). Đã xem ảnh render. Không nhúng mockup làm app.

Bằng chứng TLS dùng Python/curl tin đúng CA. Chromium ignoreHTTPSErrors chỉ dành cho CA test tự sinh, không chứng minh trust CA thực địa. Backend còn 2 DeprecationWarning từ helper validator/PDF test; không có test fail. Docker image chuyển qua host tải registry (TLS + SHA-256) để xử lý engine pull bị treo; ClamAV amd64 chạy qua emulation trên Apple Silicon, không phải benchmark phần cứng JKC.

## Lỗi đã tìm và sửa trong đợt này

- Policy course unqualified id khiến runtime không đọc khóa được giao; sửa qualified parent ID và test với runtime thật.
- SELECT FOR UPDATE assignment đòi quyền UPDATE quá rộng; thay bằng thủ tục khóa kiểm ownership, không cấp runtime quyền tự sửa completion/score.
- Rollback SQL bị bind placeholder và thiếu hàm ở vòng thử đầu; sửa execute/rollback, đã diễn tập clean apply/downgrade/reapply và restore.
- PNG lỗi CRC ném SyntaxError thành 500; sửa thành 422, thêm regression bằng tệp lỗi thực.
- Health storage thiếu trả 500; sửa 503, thêm test readiness/scanner stale fail-closed.
- OpenAPI bổ sung 413 và binary download; wait Compose healthy trước probe tránh false failure trong khoảng health=starting.
- UAT fixture dùng mới mỗi lần; không reuse max-attempt history; thêm guard từ chối tạo fixture trên DB có account ngoài DEMO namespace. Thông báo upload/save/submit có selector riêng để kiểm đúng trạng thái, không bỏ qua lỗi.

## File thay đổi

| Nhóm | File chính |
|---|---|
| DB/RLS | `alembic/versions/003_sprint01.py`, `003_sprint01.sql`, `003_down.sql`, `app/provision_runtime.py`; bổ sung context hẹp trong auth/permissions |
| Backend | `app/files.py`, `reading.py`, `learning.py`, `seed_sprint01.py`, `seed_uat.py`; config/main/schema contract và dependency locks |
| Frontend | `components/sprint01.tsx`, api multipart helper, tích hợp vào workspace hiện tại, `/learning/[id]`, styles, `tests/sprint01.spec.ts`, Playwright locale |
| Hạ tầng/ops | `deploy/compose*.yml`, Caddyfiles, backup.sh/restore.sh, env examples; `Dockerfile.test`; healthcheck và `scripts/staging/*` |
| Tests/CI/docs | `test_sprint01.py`, workflow CI, OpenAPI, README, ADR/runbook/UAT/checklist và thư mục bằng chứng này |

Chi tiết [danh mục file](FILES.md). Secret/env, CA private key, backup dump/tar, fixture credentials và browser trace ở `.local`/ignored paths; không đưa vào báo cáo/repo. Mã nguồn và bằng chứng Sprint 0.1 được bàn giao qua Git; kết quả local trong báo cáo không thay thế trạng thái workflow CI trên GitHub.

## P0 còn mở, owner và điều kiện chuyển gate

| P0 | Owner đề xuất | Điều kiện chốt / mitigation hiện tại |
|---|---|---|
| UAT trên máy xưởng/điện thoại thật; PO/UX sign-off | PO + key users | Chạy [UAT checklist](../../UAT_SPRINT01.md), ghi thiết bị/mạng/kết quả/chữ ký. Hiện chỉ automated acceptance, chưa có chữ ký. |
| DNS/VPN/firewall/trust CA và host capacity JKC | IT | Thử CA chain trên thiết bị thật qua mạng được cấp quyền; giữ localhost/DEMO đến khi duyệt, không mở internet. |
| Backup độc lập/scheduler/retention/mã hóa/RPO-RTO và CA-key custody | IT/DevOps | Đã có consistent local drill; cần thực hiện ở đích độc lập, chốt lịch/quyền/restore thực địa. Không tính volume cùng host là backup độc lập. |
| Chữ ký AV cập nhật và release image pinning | IT/Security | Duyệt mirror/egress (override có sẵn), giám sát freshness/alert, pin digest ở registry; giữ scan fail-closed, không tắt kiểm tra stale. |
| Policy ban hành nội quy/cấp user-role/reset/máy chung và acceptance Sprint 1 | PO/IT/BA | Không cấp TECH_ADMIN quyền ban hành/xem bí mật; không authoring/giao học tự do; chốt owners/scope/stories. |
| Odoo POC | Odoo admin/IT | Xác minh version/edition/API rights/mapping; tiếp tục no-op, không gọi ERP hay đồng bộ password. Có thể ghi blocker được PO chấp thuận theo exit gate, chưa có phê duyệt đó ở đây. |

Backlog giữ nguyên, không quảng bá đã làm: request-changes/reject, sửa/reopen draft sau reload, incident occurrences/verification đầy đủ, LMS authoring/giao khóa UI, notifications/Q&A/reports, storage GC/worker và các kiểm thử tải/security thực địa. Những phần này cần PO chốt vào Sprint 1/tiếp theo, không tự xóa ba module ưu tiên.

**Go/No-Go Sprint 1: NO-GO để đóng exit gate hiện tại.** Những tiêu chí kỹ thuật trong phạm vi Sprint 0.1 có bằng chứng pass; P0 PO/IT/thực địa nêu trên chưa đạt. Không production, không dùng dữ liệu nhân viên thật. [Runbook](../../STAGING_RUNBOOK.md) và [ADR](../../ADR_SPRINT01.md) nêu ranh giới kiểm thử và vận hành.

## Trạng thái bàn giao

Staging DEMO chính `jkc-s01` giữ chạy tại https://localhost:18443 để review sau khi tin CA test đúng cách; secret riêng ở `.local/staging01.env` đã Git ignore, không in vào báo cáo. Stack restore đã dừng, giữ volume/backup/checkpoint riêng; PostgreSQL test local đã dừng. Không đụng các stack khác và không tự thay trust store của máy người dùng.
