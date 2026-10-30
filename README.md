# TriThucJKC — Tri Thức JKC

Cổng tri thức nội bộ JKC, đang phát triển Sprint 1 với dữ liệu DEMO. Ba module Nội quy, Sự cố/Tri thức và Đào tạo có ưu tiên ngang nhau. **Chưa nghiệm thu để dùng nhân viên thật hoặc production.** [Sprint 1 / bằng chứng / Go-No-Go](docs/reports/SPRINT1_IMPLEMENTATION.md), [Sprint 0.1](docs/reports/sprint01/REPORT.md), [UAT thực địa](docs/UAT_SPRINT1_FIELD.md).

Đã có auth/session/CSRF/RBAC, layout desktop/mobile, Dashboard và thư viện theo ACL; lưu nháp/gửi/duyệt ARTICLE; PostgreSQL migration + runtime role/RLS; file private được ClamAV quét; xác nhận đọc theo phiên bản; bài học, quiz chấm server và lịch sử. Odoo chỉ là no-op adapter, chưa giả định version/gói quyền.

## Chạy staging HTTPS cô lập

Cần Docker Compose 2.24.4+, RAM đủ cho ClamAV và Node build. Trên máy đang có ứng dụng khác, chọn project/port riêng, ví dụ 18080/18443; không dùng volume/database cũ mà chưa có backup và đối chiếu schema.

```sh
cp deploy/.env.example deploy/.env
# Điền DB_PASSWORD và DB_RUNTIME_PASSWORD KHÁC NHAU (URL-safe, >=20 ký tự).
# Điền DEMO_PASSWORD >=12 ký tự. Gợi ý sinh: python3 -c 'import secrets; print(secrets.token_urlsafe(36))'
# Với demo trên máy cá nhân: APP_HOST=localhost, APP_ORIGIN=https://localhost:18443,
# HTTP_PORT=18080, HTTPS_PORT=18443; giữ BIND_ADDRESS=127.0.0.1.
docker compose --project-name jkc-staging --env-file deploy/.env -f deploy/compose.yml up -d --build
docker compose --project-name jkc-staging --env-file deploy/.env -f deploy/compose.yml --profile demo run --rm seed
```

Seed tạo `employee`, `head`, `other`, `admin`, mật khẩu từ DEMO_PASSWORD. Chỉ chạy development/test; service seed đặt development rõ ràng, không tự seed mỗi lần API khởi động. Seed idempotent, không đổi mật khẩu đã có, không dùng tài khoản này cho nhân viên thật.

DB/API/scanner không publish cổng. Chỉ Caddy bind loopback, admin API Caddy bị tắt. Migrate dùng `jkc_owner`, API chỉ dùng `jkc_runtime` không owner/superuser/BYPASSRLS. Readiness kiểm tra migration 007, runtime role, storage có thể ghi và chữ ký ClamAV không quá 7 ngày. API/web chạy non-root, read-only root filesystem.

Lấy **public CA certificate**, không xuất private key:

```sh
mkdir -p .local
docker cp jkc-staging-proxy-1:/data/caddy/pki/authorities/local/root.crt .local/staging-ca.crt
JKC_CA_CERT=.local/staging-ca.crt ./scripts/healthcheck.sh https://localhost:18443
```

Trình duyệt/điện thoại cần tin CA đúng theo IT; không hướng dẫn người dùng bỏ qua cảnh báo TLS. Không expose staging ra internet. DNS/VPN, trust CA trên điện thoại thật và firewall là gate IT chưa ký. APP_ORIGIN phải đúng Origin của browser: bỏ `:443` khi dùng cổng chuẩn, giữ port khi dùng 18443.

Nếu Docker engine không truy cập registry nhưng host được phép tải Docker Hub, có công cụ nạp image chính thức qua TLS và kiểm tra SHA-256 từng layer:

```sh
python3 -m venv .venv
.venv/bin/pip install -r starter/apps/api/requirements-dev.lock.txt
.venv/bin/python scripts/staging/pull_image.py caddy:2.10.2
.venv/bin/python scripts/staging/pull_image.py python:3.12-slim
.venv/bin/python scripts/staging/pull_image.py node:22-alpine
.venv/bin/python scripts/staging/pull_image.py clamav/clamav:stable --architecture amd64
# Staging kiểm thử dùng ClamAV amd64/emulation trên Apple Silicon; chưa chứng minh capacity host JKC.
```

ClamAV base staging dùng chữ ký trong image. Upload/readiness fail-closed nếu daemon lỗi hoặc chữ ký quá 7 ngày. [Runbook](docs/STAGING_RUNBOOK.md) mô tả cập nhật chữ ký, pin image và backup. Cần IT chốt mirror/egress trước shared pilot.

## Chạy source local

Node 22+, Python 3.12, PostgreSQL 16/17. Local không thay thế nghiệm thu full Compose. Tạo DB riêng trước; không dùng mật khẩu Odoo.

```sh
python3 -m venv .venv
.venv/bin/pip install -r starter/apps/api/requirements-dev.lock.txt
cp starter/apps/api/.env.example starter/apps/api/.env
# Sửa DATABASE_URL, APP_ORIGIN, DEMO_PASSWORD; chỉ local HTTP mới COOKIE_SECURE=false.
cd starter/apps/api
../../../.venv/bin/alembic upgrade head
../../../.venv/bin/python -m app.seed
../../../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Terminal khác:

```sh
cd starter/apps/web
npm ci
npm run dev -- --hostname 127.0.0.1
```

Mặc định web http://localhost:3000; API qua same-origin `/api/v1`. Đổi cổng thì đổi APP_ORIGIN và restart API. INTERNAL_API_URL cần đặt trước web build nếu backend không ở 127.0.0.1:8000. Source local mặc định dùng DB URL bạn cấp; để kiểm chứng RLS cần provision runtime role theo runbook. Đừng dùng owner connection cho shared staging.

## Quyền và chức năng

- Nhân viên: nội dung đã duyệt theo COMPANY/DEPARTMENT/CROSS_DEPARTMENT ACL; RESTRICTED hiện chỉ tác giả. TECH_ADMIN không có bypass quyền nội dung hay duyệt chuyên môn.
- Trưởng bộ phận: duyệt ARTICLE trong scope, không tự duyệt, kiểm tra expectedVersion và trạng thái; transaction + row lock + audit. Quyền ban hành nội quy công ty vẫn chưa được JKC xác nhận.
- Tạo user: POST `/api/v1/users` từ TECH_ADMIN, buộc đổi password. Đổi/reset thu hồi mọi session. Reset CLI phải chạy bằng owner/operator connection riêng: `python -m app.manage reset-password TEN_DANG_NHAP`, hạn 15 phút/dùng một lần; chuyển mã qua kênh an toàn. Runtime API không có quyền cấp reset token qua giao diện.
- POST yêu cầu Origin và X-CSRF-Token từ login/me (login/reset công khai chỉ cần Origin); cookie HttpOnly/SameSite=Lax/Secure trên HTTPS, token ngẫu nhiên lưu hash, không localStorage. Login limiter tại PostgreSQL; IP sau proxy vẫn dùng chung nên cần policy trusted proxy trước triển khai rộng.
- File: lưu nháp rồi upload PNG/JPEG/PDF tĩnh <=10 MB. Kiểm tra loại/cấu trúc, tái mã hóa ảnh, từ chối PDF chủ động/mã hóa, quét ClamAV trước/sau chuẩn hóa. Chỉ CLEAN và đúng ACL phiên bản mới download; kiểm checksum, không public storage URL. Không nhận video/Office/SVG/HTML trong phạm vi này.
- Nội quy: `/my/reading`, giao đọc theo version trong scope trưởng bộ phận, ACK lấy user từ session, sai/stale version bị 409, gửi lại idempotent; lịch sử cũ không ghi đè. Chưa có UI giao nhiệm vụ/ban hành phiên bản mới; chỉ dùng API/seed DEMO đã được kiểm thử.
- Đào tạo: mở khóa được giao, hoàn thành bài học, làm quiz tối đa số lần đã cấu hình. Server/DB chấm từ đáp án được bảo vệ, kiểm tra đúng tập câu hỏi/lựa chọn, không nhận score từ client. Lịch sử cố định theo course_version, số lần và ngưỡng đạt tại lúc nộp. Giao khóa/authoring hiện qua seed/operator, chưa có UI quản trị LMS.

## Kiểm thử

Luôn dùng database **tên bắt đầu jkc_test**, không dùng dữ liệu thật. Tests giữ version/audit và archive nội dung tổng hợp để có thể chạy lại. Chi tiết bằng chứng có trong báo cáo Sprint 0.1.

```sh
export TEST_DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:5432/jkc_test_local'
cd starter/apps/api
DATABASE_URL="$TEST_DATABASE_URL" ../../../.venv/bin/alembic upgrade head
../../../.venv/bin/pytest -q
cd ../../..
.venv/bin/ruff check starter/apps/api scripts
.venv/bin/ruff format --check starter/apps/api scripts
PYTHONPATH=starter/apps/api .venv/bin/python scripts/export_openapi.py --check
.venv/bin/python scripts/database_drill.py
cd starter/apps/web
npm run lint
npm run typecheck
npm run build
```

UAT HTTPS tái lập (chỉ DEMO, tạo account tổng hợp mới mỗi lần):

```sh
.venv/bin/python scripts/staging/uat.py --project jkc-staging --env-file deploy/.env --ca .local/staging-ca.crt
.venv/bin/python scripts/staging/collect_evidence.py --project jkc-staging --env-file deploy/.env
```

Runner kiểm tra CA bằng Python HTTPS thật và ClamAV/EICAR, rồi chạy 8 Playwright regression/UAT desktop/mobile. Chromium dùng ignoreHTTPSErrors **chỉ cho CA test cục bộ**; không đồng nghĩa trust CA trên thiết bị thật đã nghiệm thu. Script đọc secret vào process, không in/ghi vào báo cáo. `.local` và browser traces/cache bị Git ignore. EICAR là chuỗi kiểm tra antivirus vô hại, không phải mã độc thực thi.

`api/openapi.yaml` sinh từ code; draft cũ ở `api/openapi.backlog.yaml` không phải contract đã hỗ trợ. CI có backend PG16/17 và full Compose/HTTPS/AV/UAT/restore; mới kiểm tra actionlint cục bộ, chưa chạy phiên bản workflow này trên GitHub.

## Backup/restore và giới hạn

[Runbook staging](docs/STAGING_RUNBOOK.md) có quy trình dừng ghi, dump DB + private files, SHA-256, restore sang **project/volume rỗng**, kiểm fingerprint và app. Không restore đè. Baseline SQL và migrations 001/002 giữ nguyên; thay đổi Sprint 0.1 ở 003. Rollback có thể làm mất snapshot lịch sử quiz nên ưu tiên restore backup khi đã có dữ liệu cần giữ.

Còn P0 ở exit gate: PO/key users UAT thực địa, IT DNS/VPN/trust CA, lịch backup và bản sao độc lập/retention/RPO-RTO, cập nhật chữ ký/pin release image, danh sách cấp quyền và chính sách máy chung. Người dùng đã xác nhận HR ban hành nội quy. Không dùng dữ liệu nhân viên thật, không production. Notifications/Q&A/reports và capacity/security assessment thực địa còn backlog.

## Sprint 1 — các màn hình mới

- `/workspace`: tạo/sửa nháp, phiên bản, yêu cầu sửa/từ chối/gửi lại, HR ban hành nội quy, head duyệt tri thức; giao và theo dõi đọc.
- `/incidents/manage`: hồ sơ/điều kiện/nguyên nhân/phương án/kết quả, tái diễn idempotent và head xác minh.
- `/learning/manage`: khóa/bài học/quiz, lưu và mở lại nháp, duyệt, tạo phiên bản mới và giao học; tiến độ 5 trạng thái. Player cũ giữ chấm DB và lịch sử bất biến.
- `/login`: hero desktop/mobile và nút đỏ theo thiết kế 09; giữ session/CSRF/reset.

HR là role riêng, không cấp ngầm cho TECH_ADMIN. Scope bộ phận chỉ ban hành trong bộ phận; scope company phải cấp rõ bằng `--company`. Chỉ operator kết nối bằng table owner được chạy `python -m app.grant_hr --username '<approved_username>' --department-code '<approved_department>' --approval-reference '<approval_reference>'`; dùng `--company` thay department-code khi được duyệt phạm vi toàn công ty. Không có API TECH_ADMIN tự cấp HR. Người soạn không tự duyệt, kể cả HR; cần HR khác duyệt nội quy do HR soạn. UAT runner chỉ tạo HR tổng hợp mới trong database DEMO đã qua guard.

Migrations Sprint 1: 004 workflow/HR/reading, 005 incident records/RLS/history, 006 course authoring/status, 007 tiêu đề theo phiên bản và stale incident verification. Giữ nguyên baseline và 001–003. Backup trước rollback có dữ liệu lịch sử; drill downgrade chỉ dùng DB `jkc_test*` riêng.

Lưu bằng chứng mới bằng `--evidence-dir docs/reports/sprint1` khi chạy các script `scripts/staging/*.py`, không ghi đè bằng chứng Sprint 0.1. `uat.py` chạy 12 ca desktop/mobile, tạo fixture riêng mỗi lần, không chấp nhận skip. [Runbook bổ sung](docs/STAGING_SPRINT1.md) ghi stack review và các lệnh kiểm chứng.
