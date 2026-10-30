# Sprint 0 — kết quả triển khai 30/10/2026

Nền tảng đã được code và chạy thử với PostgreSQL thật. Sprint 0 **chưa đóng exit gate**, chưa production-ready. Không có phiên bản Odoo nào được giả định.

## Giai đoạn 0A — Audit trước khi sửa

Đã đọc toàn bộ AGENTS.md, START_HERE.md, SPRINT0_TASKS.md, TECHNICAL_DESIGN.md, OpenAPI, SQL, Compose và xem cả desktop/mobile trong 8 ảnh được duyệt. [Audit chi tiết](SPRINT0_AUDIT.md).

File tạo: `docs/reports/SPRINT0_AUDIT.md`. [Danh mục file](FILES.md). Baseline SQL và tài liệu thiết kế giữ nguyên.

Lỗi ban đầu: ESLint chưa có dependency/config; không có typecheck script; Python chưa có pytest; không có migration/test/auth/DB wiring; Compose chỉ init schema lần đầu; draft API không khớp endpoint thực tế. Không có `.git` nên chưa tạo commit hoặc PR.

## Giai đoạn 0B — Nền tảng đã triển khai

| Nhóm file thay đổi/tạo | Chức năng và phạm vi |
|---|---|
| `starter/apps/api/app/{config,db,security,permissions,auth,schemas,main}.py` | App factory, settings, PostgreSQL connection/transaction, Argon2id, login/logout, session lưu hash, cookie HttpOnly/SameSite/Secure, CSRF+Origin, throttling DB, đổi mật khẩu và reset one-time token, tạo user buộc đổi mật khẩu, lỗi có request ID, liveness/readiness. |
| `starter/apps/api/app/content.py` | Dashboard số liệu có ACL; danh sách/chi tiết nội quy, tri thức, guide sự cố; tìm kiếm tiêu đề/phân trang/công đoạn; khóa học được giao đúng user; lưu nháp/gửi/duyệt ARTICLE. Scope trưởng bộ phận, ngăn tự duyệt, optimistic version, row locks, audit + approval event. |
| `starter/apps/api/app/{seed,manage}.py` | Seed idempotent: 5 công đoạn, 2 bộ phận DEMO, 3 role/4 user, nội dung COMPANY/DEPARTMENT/CROSS/RESTRICTED, incident minh họa, khóa học+phiên bản+assignment; CLI cấp reset token. Password seed chỉ lấy từ môi trường/.env riêng. |
| `starter/apps/api/app/integrations/odoo.py` | Protocol `probe/fetch_employees/fetch_departments` + no-op. Version trả null, chưa có sync thật. |
| `starter/apps/api/alembic.ini`, `alembic/env.py`, `alembic/versions/*` | Migration 001 đóng băng SQL baseline; 002 reset/throttle/index, chống role NULL-scope trùng, published version cùng content+APPROVED, phiên bản APPROVED và audit append-only. |
| `starter/apps/web/app/**`, `components/{api,icon,login,workspace}.*` | Giao diện Việt: login/reset/account, sidebar navy desktop, header tìm kiếm, bottom nav 5 tab mobile, tokens CMYK; Dashboard 3 chỉ số thật, 5 shortcut công đoạn; bảng nội quy desktop/thẻ mobile; thư viện/chi tiết; form bài viết; khóa học; preview và duyệt. |
| `starter/apps/web/{package*,eslint.config.mjs,next.config.ts,tsconfig.json,playwright.config.ts}` | Lockfile, lint/typecheck/build/test scripts, same-origin API proxy, security headers, Playwright desktop/mobile. |
| `starter/apps/api/{requirements*,pyproject.toml,tests/*}` | Dependency locks runtime/dev, Ruff, integration/security tests PostgreSQL thật; không dùng SQLite thay thế. |
| `deploy/{compose*,Caddyfile*,.env.example}`, Dockerfile/.dockerignore hai app | Compose có migrate service, DB/API/web readiness, API/DB chỉ trong backend network, proxy default loopback; local HTTP override; staging TLS internal + Secure cookie; backup profile. Đã bỏ init SQL chạy song song với Alembic; sửa Caddy giữ nguyên prefix /api. |
| `.github/workflows/ci.yml`, `scripts/*`, `.gitignore`, `README.md`, `SPRINT0_TASKS.md` | CI PostgreSQL 16/17, UI/contract/lint/build, healthcheck, restore drill, hướng dẫn local/staging/reset/rollback và giới hạn. |

Auth và API test xác minh TECH_ADMIN không có quyền đọc tất cả hoặc duyệt chuyên môn. Các truy vấn list/detail/count/search dùng chung SQL ACL, nội dung chưa duyệt không lọt vào kết quả. RESTRICTED Sprint 0 chỉ tác giả được đọc; chưa có quản lý cấp quyền người dùng cụ thể. Không có file công khai hoặc chức năng download chưa kiểm quyền.

## Giai đoạn 0C — Bằng chứng kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| Next.js lint, TypeScript, production build | PASS; Next 16.4.3, Node 24.20.0 trên máy dev. Docker target Node 22. |
| Ruff lint + format | PASS. |
| Backend integration/security | 18 tests PASS trên PostgreSQL 16.13 và 17.11; Python 3.9.6 trên máy dev. CI/Docker target Python 3.12 chưa chạy ở môi trường CI. |
| API bảo mật | 401 chưa login; 403 CSRF/Origin/role/self-approval; 404 với nội dung ngoài ACL; 409 submit/approve trùng hoặc sai version; rate limit; session hết hạn/revoke/user inactive; reset token dùng một lần; đổi password và force-change; không echo password; schema ổn định khi đọc OpenAPI nhiều lần. |
| Playwright Chromium | 6 tests PASS, desktop 1440×1000 và mobile 390×844; 8 route, không tràn ngang ở route chính; login, list/detail, search empty, draft/submit, approve có preview, logout/redirect. |
| OpenAPI 3.1 | Validate PASS; export `--check` không drift; endpoint thực tế, schema request/response, cookie/Origin/CSRF. Draft cũ giữ ở `api/openapi.backlog.yaml`. |
| Migration mới trên DB rỗng | 001→002 PASS trên PostgreSQL 16 và 17. |
| Rollback/restore | Upgrade→downgrade base→upgrade; pg_dump/pg_restore DB test cô lập và so số dòng PASS trên PostgreSQL 16. [Bằng chứng JSON](database-drill.json). |
| Web→API→DB | `scripts/healthcheck.sh http://localhost:3100` PASS (live=ok, ready=ready, /login HTTP 200). |
| Compose config local/staging | PASS. Compose full stack **chưa xác nhận**: docker up dừng chờ ở pull image caddy:2.10.2/postgres:17.6, đã hủy sau khi không tiến triển. PostgreSQL 17 test dùng image có sẵn trên máy, không phải full Compose. |
| GitHub Actions | Workflow đã qua actionlint 1.7.7 + shellcheck; chưa chạy remote (workspace chưa có Git). |

Ảnh kiểm tra: [Dashboard desktop](dashboard-desktop.png), [Dashboard mobile](dashboard-mobile.png), cùng các ảnh `ui-*-desktop/mobile.png` trong thư mục này. Đã xem ảnh render để kiểm tra layout. Những ảnh này là giao diện code thực, không nhúng ảnh mockup vào app.

UI bám cấu trúc/tokens/breakpoint của bộ duyệt, dùng minh họa CSS thay ảnh máy trong mockup. Chưa có PO sign-off hoặc kiểm tra độ khớp từng pixel; không coi các ảnh tham chiếu là tài liệu sản xuất thật. Dữ liệu demo không sao chép thông số xử lý máy trong ảnh.

## Chức năng chưa hoàn thiện và P0

| Ưu tiên | Phần còn thiếu / người phụ trách đề xuất | Hướng xử lý |
|---|---|---|
| P0 | Full Compose build/health, TLS/DNS/CA trên desktop+điện thoại, firewall — DevOps/IT | Chạy ở host có registry hoạt động, kiểm tra Caddy routing/Secure cookie và mạng nội bộ; giữ bind loopback đến khi được cấu hình. |
| P0 | Runtime DB role riêng, quyền tối thiểu/RLS, threat model — Backend/IT | Hiện kết nối DB dùng cùng owner, ACL ở truy vấn API, chưa có RLS. Phân tách migrator/runtime, kiểm tra quyền trực tiếp ở database trước production. |
| P0 | File storage/scan/download có ACL — Backend/IT | Hiện deny-all/chưa phục vụ file; chưa thể nghiệm thu quyền file thật. |
| P0 | Nội quy/version/read assignments/ack đúng phiên bản, quyền ban hành công ty — PO/Backend | Mới đọc phiên bản đã duyệt; xác minh policy, thêm transaction/assignment/audit và negative tests. |
| P0 | Sửa/reopen draft, request-changes/reject và thông báo — Backend/Frontend | Hiện lưu nháp một lần, gửi, duyệt ARTICLE. Chưa UI quản lý bản nháp sau reload hoặc các quyết định khác. Form cảnh báo beforeunload; chưa có chặn mọi điều hướng SPA khi chưa lưu. |
| P0 | Khóa học: lesson player, quiz chấm server, assignment workflow — Backend/PO | UI/API hiện chỉ danh sách và tiến độ đúng user/version, không có nút học/quiz giả. |
| P0 | Incident occurrences, bằng chứng/xác minh, thiết bị — Backend/key users | Hiện API chi tiết incident là projection guide INCIDENT_GUIDE đã duyệt, không phải toàn bộ workflow incident. |
| P0 | Backup tự động, restore staging+file, RPO/RTO — IT | Local DB test đã diễn tập; còn storage độc lập, mã hóa, restore chứng cứ staging. |
| P0 | Cấp user/role, reset delivery/SMTP, chính sách máy chung — PO/IT | Có API tạo user và CLI reset; chưa có UI admin/SMTP. Login IP sau proxy dùng chung, cần trusted-proxy/rate-limit policy phù hợp. |
| P0 | Odoo POC — Odoo admin/IT | Xác minh version/edition/hosting/API rights/mapping; no-op tiếp tục dùng đến khi rõ. Không đồng bộ mật khẩu. |
| P0 | PO/UX sign-off, workshop 5 công đoạn, backlog Sprint 1 — PO/BA/key users | Duyệt layout/state trên thiết bị thật, cung cấp dữ liệu nghiệp vụ đã kiểm chứng và acceptance/owner. |
| P1 | SSR auth/data, module hóa sâu hơn, full-text tiếng Việt, taxonomy/filter nâng cao, thông báo/báo cáo/Q&A | Hiện shell dùng client auth gate và API bảo vệ dữ liệu; search ILIKE tiêu đề có ACL, chưa có full-text/snippet/file indexing. |

Các dịch vụ web/API/PostgreSQL do agent khởi tạo để kiểm thử đã được dừng sau khi lưu bằng chứng; không ảnh hưởng ứng dụng có sẵn ở cổng 3000. Chạy lại theo README với secret riêng.

Cảnh báo không chặn test: Python hệ thống 3.9 dùng LibreSSL làm urllib3 phát cảnh báo; helper validate_spec có cảnh báo deprecated. Khuyến nghị dùng Python 3.12 theo cấu hình CI/Docker.

S0-04/05 và phần source/test của S0-06 có bằng chứng local. S0-01/02/03/07/08/09/10 còn phê duyệt hoặc thực địa; S0-06 còn container staging. Không chuyển sang triển khai production theo kết quả local này.
