# Bảo mật và điều kiện trước production

Kiểm tra trên snapshot `a5b8ee8` và staging `jkc-staging-s1` (https://localhost:18444) ngày 11/11/2026. **Không sửa migration, quyền hay cấu hình**; chỉ đo và đề xuất.

## 1. Gate P0 (chặn production)

| ID | Mức | Phát hiện | Bằng chứng | Phương án đề xuất | Trạng thái |
|---|---|---|---|---|---|
| **G-1 · DATA-39B** | **P0** | Lần làm bài **đã mở trước** khi học viên đạt vẫn **nộp được** sau khi đạt. Lịch sử có thêm lần nộp; `completed_at` không đổi | Probe tạm (đã xóa) trên DB test sạch: mở lại → **409** (DATA-39 đúng); nộp lần làm cũ → **200**, `passed=false`, `score=0`; lịch sử 2 lần, `completed_at` giữ (`results/data39b-probe.txt`) | Migration mới: `jkc_submit_quiz` dưới khóa `course_assignments` trả `JKC_CONFLICT` nếu đã có lần nộp đạt. Kèm pytest, cập nhật readiness (`main.py` đòi revision), `database_drill.py`, `migration_cycle.py`. Quyết định cách xử lý lần làm mở sẵn trên dữ liệu thật | **Mở · chờ PO duyệt migration** |
| **G-2 · Seed DEMO có thể chạy vào DB thật** | **P0** | Service `seed` trong `deploy/compose.yml` (profile `demo`) **ép `APP_ENV: development`** và dùng **kết nối owner**, nên guard `app_env` trong các module seed luôn được thỏa trong compose. `app.seed` (seed cơ bản) **không** kiểm tra namespace DEMO, nên `--profile demo run seed` trên stack thật sẽ thêm tài khoản DEMO (`employee`, `head`, `admin` dùng `DEMO_PASSWORD`) và nội dung DEMO. `seed_uat` và `seed_incident_guides` có chặn khi DB có tài khoản thật | `deploy/compose.yml` dòng 128–136; `app/seed.py` dòng 13–17 | (a) Compose production **không có** service `seed`/`test`, hoặc file compose production riêng; (b) `app.seed` thêm kiểm tra giống `seed_uat` (từ chối khi DB có tài khoản ngoài DEMO) và đọc `APP_ENV` từ môi trường triển khai, không ép trong compose; (c) runbook cấm profile `demo` ở production | **Mở · chờ PO/IT** |
| **G-3 · Chưa có môi trường production** | **P0** | `compose.yml` đang là cấu hình **staging** (`APP_ENV: staging`, CA nội bộ Caddy `tls internal`); chưa có cấu hình production đã duyệt (tên miền, chứng chỉ, secret, sizing) | `deploy/compose.yml`, `Caddyfile` | IT cung cấp hạ tầng, tên miền nội bộ, CA/chứng chỉ thật, quy trình secret; tạo cấu hình production riêng | Mở · IT |
| **G-4 · Backup và restore trên hạ tầng thật** | **P0** | Backup và restore **đã kiểm chứng trong CI** (staging tạm), nhưng chưa có backup định kỳ, lưu ngoài máy, mã hóa, và diễn tập restore có đo RTO/RPO trên hạ tầng production | CI #42970185474: "Database drill …" ✅, "Isolated DB and attachment restore" ✅ | Lịch backup (DB + uploads), lưu giữ, kiểm tra restore định kỳ, runbook (`docs/STAGING_RUNBOOK.md` mở rộng) | Mở · IT |

## 2. Kiểm tra đã PASS

| Hạng mục | Kết quả | Bằng chứng |
|---|---|---|
| **Không lộ dữ liệu chưa duyệt / ngoài phạm vi** | Nội dung chỉ trả bản đã duyệt và đúng ACL. Bản nháp và chờ duyệt → 404 cho người đọc. `other`/`admin` → 404 với bài và tệp của bộ phận khác | pytest `test_security`, `test_knowledge_listing`, `test_incident_guides`, `test_sprint01`; Playwright UI-04/05/05B/06/09 |
| **RLS** | Bật RLS + policy trên mọi bảng nội dung, phiên bản, duyệt, tệp, đọc, đào tạo, sự cố, audit; role runtime `jkc_runtime`: không superuser, **không BYPASSRLS** | `results/rls-tables.txt`, `results/db-roles.txt` |
| **Quản trị kỹ thuật không xem mặc định** | `admin` không thấy nội dung, tệp, hàng đợi ngoài phạm vi | pytest `test_file_restricted_has_no_admin_or_head_bypass`; UI-05/05B/06 |
| **Không tự duyệt** | Trưởng bộ phận không thấy bài của mình trong hàng đợi; API duyệt → 403/404 | UI-07, UI-09, pytest workflow |
| **Session** | Cookie `jkc_session`: `HttpOnly; Secure; SameSite=lax; Path=/api; Max-Age=28800` | `curl` khi đăng nhập (giá trị đã che) |
| **CSRF / Origin** | POST thiếu CSRF token → **403**; Origin lạ → **403**; chưa đăng nhập → **401** | `curl` trên staging |
| **HTTPS** | HTTP → **308** sang HTTPS; HSTS bật; chỉ proxy mở cổng (bind `127.0.0.1`); DB, API, ClamAV chỉ trong mạng nội bộ | `curl`, `docker ps` |
| **Tệp tải lên** | Chỉ PNG/JPEG/PDF tĩnh, chuẩn hóa lại, giới hạn dung lượng, chặn đường dẫn, PDF có JS bị từ chối, quét **ClamAV thật**, chữ ký cũ → từ chối (fail closed) | pytest `test_upload_rejects_…`, `test_stale_or_invalid_antivirus_signatures_fail_closed`; CI "Real antivirus …" ✅ |
| **Bí mật** | Chỉ commit `.env.example`; `.local/` nằm trong `.gitignore`; không tìm thấy mật khẩu hay khóa dạng chuỗi trong mã | `git ls-files`, `git grep` |
| **Dữ liệu DEMO tách biệt** | DB staging chỉ có tài khoản DEMO/UAT (0 tài khoản thật); mọi seed DEMO ghi rõ "DEMO", không có thông số vận hành | Truy vấn đếm; module seed |
| **Điểm và trạng thái không sửa được từ client** | Không có API sửa điểm/trạng thái; chấm trong DB; lịch sử bất biến (trigger) | pytest `test_runtime_cannot_rewrite_scope_or_quiz_history`; UI-08 |

## 3. Gate P1/P2

| ID | Mức | Phát hiện | Bằng chứng | Phương án | Trạng thái |
|---|---|---|---|---|---|
| G-5 | P1 | `jkc_owner` là **superuser** trên staging (user mặc định của image postgres); migration và seed chạy bằng tài khoản này | `results/db-roles.txt` | Production: owner/migration **không superuser**, chỉ sở hữu schema; superuser chỉ cho DBA | Mở · IT |
| G-6 | P1 | **Chưa có Content-Security-Policy** | Header `/login` | Thêm CSP ở proxy (`default-src 'self'`; ảnh `self data: blob:`), kiểm tra Next | Mở |
| G-7 | P1 | ClamAV cập nhật chữ ký qua override `compose.signature-updates.yml`, **chưa được IT duyệt** egress/mirror; không cập nhật thì chữ ký cũ làm upload bị từ chối (an toàn nhưng gây gián đoạn) | File override ghi "IT approves egress/mirror first" | IT duyệt mirror nội bộ hoặc egress | Mở · IT |
| G-8 | P1 | **UAT người dùng thật** chưa ký nhận | `human_uat_signoff: PENDING` | UAT tại xưởng | Mở · PO |
| G-9 | P2 | HSTS chỉ 1 ngày (`max-age=86400`) | Header | Production: ≥ 6 tháng sau khi TLS ổn định | Mở |
| G-10 | P2 | Bảng `users`, `sessions`, `notifications`, `questions`, `answers` không bật RLS (chỉ dựa vào API) | `results/rls-tables.txt` | Cân nhắc RLS hoặc thu hẹp GRANT cho runtime (phòng thủ nhiều lớp) | Mở |
| G-11 | P2 | Tiêu đề bảo mật bị lặp (Caddy + Next) | Header | Đặt một nơi | Mở |
| G-12 | P2 | Odoo: chỉ có connector no-op (đúng chỉ đạo), chưa xác minh phiên bản và gói quyền | `AGENTS.md`; API trạng thái Odoo | Giữ no-op tới khi IT xác minh | Theo dõi |

## 4. Kết luận gate

Production: **NO-GO** cho tới khi đóng G-1 → G-4 (P0), rồi xử lý G-5 → G-8 (P1) hoặc có chấp nhận rủi ro bằng văn bản. Merge `main` (không deploy) không bị chặn bởi các gate này. Xem `FINAL_GO_NO_GO.md`.
