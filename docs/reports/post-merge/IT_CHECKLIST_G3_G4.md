# Checklist phối hợp IT — đóng G-3 (môi trường production) và G-4 (backup/restore)

Dành cho IT JKC và PO.

Mỗi dòng cần **bằng chứng** (ảnh chụp, log, biên bản) và **người ký**. Dev hỗ trợ cấu hình nhưng **không** tự triển khai production. Các số liệu đề xuất (RPO/RTO, sizing) để IT và PO chốt.

**Hiện trạng:**
- `main` @ `7ff930f` (tag `baseline-main-20261113`).
- Chỉ có cấu hình **staging**: `deploy/compose.yml`, Caddy `tls internal`.
- Backup và restore đã chạy thử trong CI trên stack tạm, chưa có trên hạ tầng thật.
- Hướng dẫn liên quan: `docs/STAGING_RUNBOOK.md`, `docs/UAT_SPRINT1_FIELD.md` (mục Hạ tầng).

## G-3 · Môi trường production

### A. Hạ tầng và mạng

| # | Hạng mục | Yêu cầu | Bằng chứng | Người ký |
|---|---|---|---|---|
| A1 | Máy chủ và sizing | Ghi CPU, RAM, disk, IO, kiến trúc (amd64/arm64), OS và lịch vá. Đề xuất khởi điểm cho 50–200 người dùng: 4 vCPU, 8 GB RAM, 100 GB SSD cho DB + tệp, tách đĩa backup. ClamAV cần khoảng 2–3 GB RAM | Bảng cấu hình | IT |
| A2 | Tên miền nội bộ | Ví dụ `trithuc.jkc.internal`; DNS nội bộ phân giải đúng; **không** phân giải từ internet | `nslookup` từ trong và ngoài mạng | IT |
| A3 | TLS | Chứng chỉ do **CA nội bộ JKC** cấp (thay `tls internal`), cài CA lên máy xưởng và điện thoại qua kênh quản lý; ghi ngày hết hạn và quy trình gia hạn. Ghi người giữ khóa CA | Ảnh trình duyệt không cảnh báo; chain; ngày hết hạn | IT |
| A4 | Firewall | Chỉ reverse proxy (443, và 80 để chuyển hướng) trong dải mạng được duyệt. DB, API, ClamAV, cổng quản trị **không** mở ra ngoài (AGENTS.md: không public cổng quản trị) | Quét cổng từ máy độc lập | IT |
| A5 | VPN / truy cập từ xa | Quyết định có cho truy cập ngoài xưởng hay không; nếu có thì chỉ qua VPN | Chính sách | IT/PO |
| A6 | Đồng bộ thời gian | NTP; múi giờ ứng dụng Asia/Ho_Chi_Minh (hạn đọc, hạn học) | `timedatectl` | IT |

### B. Cấu hình ứng dụng

| # | Hạng mục | Yêu cầu | Bằng chứng | Người ký |
|---|---|---|---|---|
| B1 | Compose production | Tệp riêng (`compose.production.yml`): **không có** service `seed`, `test` và profile `demo`/`test`; `APP_ENV=production`; `COOKIE_SECURE=true`; `APP_ORIGIN` = URL thật. Dev soạn, IT duyệt | `docker compose config` | Dev + IT |
| B2 | Image | Build từ tag/commit đã duyệt; đẩy vào **registry nội bộ**; ghim theo **digest** (api, web, postgres, caddy, clamav) | Danh sách digest | IT |
| B3 | Secret | Sinh mới, khác staging: `DB_PASSWORD` và `DB_RUNTIME_PASSWORD` khác nhau, ≥ 20 ký tự, URL-safe. **Không** đặt `DEMO_PASSWORD`. Lưu trong kho secret của IT; không commit, không gửi qua chat | Biên bản (không ghi giá trị) | IT |
| B4 | Vai trò DB (G-5) | Owner/migration **không superuser**, chỉ sở hữu schema; runtime `jkc_runtime` không BYPASSRLS (`provision_runtime`); superuser chỉ DBA giữ | `\du` | IT/DBA |
| B5 | **Dấu chặn DEMO (G-2)** | Ngay sau khi tạo DB: `ALTER DATABASE <db> SET jkc.environment = 'production';` rồi kiểm tra `SHOW jkc.environment;` ở phiên mới. **Không** chạy `app.seed`, `seed_uat`, `seed_incident_guides` | Ảnh `SHOW` | IT/DBA |
| B6 | Migration | `alembic upgrade head` (007, hoặc 008 sau khi PR #8 được merge) bằng owner; readiness `/api/v1/health/ready` = 200 | Log | Dev + IT |
| B7 | ClamAV (G-7) | Mirror chữ ký nội bộ hoặc egress được duyệt; chữ ký ≤ 7 ngày; cảnh báo khi cũ. Upload bị từ chối khi chữ ký cũ là **đúng thiết kế** | `VERSION`, test EICAR | IT |
| B8 | Tiêu đề bảo mật | HSTS ≥ 6 tháng sau khi TLS ổn định (G-9); CSP (G-6, Dev chuẩn bị) | `curl -I` | Dev + IT |
| B9 | Tài khoản | Tài khoản JKC riêng; **không** lấy mật khẩu từ Odoo; Odoo giữ connector no-op đến khi xác minh phiên bản và gói quyền. Danh sách nhân viên, bộ phận, trưởng bộ phận, HR do HR/IT cung cấp | Danh sách đã duyệt | HR + IT |
| B10 | Giám sát | Log tập trung, cảnh báo khi readiness ≠ 200, khi disk > 80%, khi backup lỗi | Ảnh cấu hình cảnh báo | IT |

## G-4 · Backup và restore

| # | Hạng mục | Yêu cầu | Bằng chứng | Người ký |
|---|---|---|---|---|
| C1 | RPO / RTO | **Đề xuất:** RPO ≤ 24 giờ (backup hằng đêm), RTO ≤ 4 giờ. PO và IT chốt | Quyết định | PO + IT |
| C2 | Lịch backup | DB và tệp đính kèm **cùng một thời điểm**: `deploy/backup.sh` hoặc `scripts/staging/snapshot.py backup` (tạm dừng API khi chụp). Chạy theo lịch, ví dụ 01:00 hằng ngày | Cron/scheduler, log 7 ngày | IT |
| C3 | Lưu ngoài máy | Bản sao **mã hóa** sang hệ lưu trữ độc lập; ổ cùng máy **không tính** là backup | Đường dẫn, cách mã hóa, người giữ khóa | IT |
| C4 | Lưu giữ | Ví dụ: 14 bản hằng ngày, 8 hằng tuần, 12 hằng tháng. Xóa theo chính sách | Chính sách | IT/PO |
| C5 | Kiểm tra toàn vẹn | `SHA256SUMS` và tệp `COMPLETE`; từ chối bản thiếu | Log kiểm tra | IT |
| C6 | **Diễn tập restore** | Restore vào stack **cô lập** với secret mới (`snapshot.py restore` + `verify_restore.py verify`); so số dòng và hash tệp; đăng nhập, xem bài, tải tệp, lịch sử đọc/điểm. **Đo thời gian** (RTO) và **độ mất dữ liệu** (RPO) | Biên bản có số đo | IT + Dev |
| C7 | Định kỳ | Diễn tập restore mỗi quý và sau mỗi nâng cấp lớn | Lịch | IT |
| C8 | Trước mỗi lần deploy | Backup đầy đủ, ghi image tag đang chạy (xem `docs/reports/final-qa/ROLLBACK_PLAN.md`) | Checklist deploy | IT |
| C9 | Nhãn manifest | `backup.sh` đang ghi "schema 003". Sửa để ghi đúng revision (G2-R4) | PR nhỏ | Dev |

## Điều kiện đóng gate

- **G-3:** đóng khi A1–A6 và B1–B10 có bằng chứng và chữ ký. Trong đó **B5** (dấu DB) và **B1** (compose không có seed) là bắt buộc để G-2 có hiệu lực ở production.
- **G-4:** đóng khi C1–C8 xong và **ít nhất một** lần diễn tập restore trên hạ tầng thật đạt RTO/RPO đã chốt.
- Chỉ sau đó, cùng G-1 (PR #8 đã merge), G-2 (PR #9 đã merge kèm sửa G2-R1) và UAT có ký nhận, PO mới xem xét GO production.
