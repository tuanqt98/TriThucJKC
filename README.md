# TriThucJKC — Tri Thức JKC, nền tảng Sprint 0

Ứng dụng kiểm thử nội bộ, chưa nghiệm thu production. Đã có Next.js responsive, FastAPI kết nối PostgreSQL, session/RBAC cơ bản, migration, seed DEMO và tests. Ba module Nội quy, Sự cố/Tri thức, Đào tạo được giữ nguyên. Chi tiết nghiệm thu và P0 còn thiếu: [báo cáo Sprint 0](docs/reports/SPRINT0_IMPLEMENTATION.md).

## Chạy bằng Compose local

Cần Docker Compose v2.24.4+ (override ports). Chỉ bind loopback; không expose API, database hay cổng quản trị.

```sh
cp deploy/.env.example deploy/.env
# Điền DB_PASSWORD và DEMO_PASSWORD riêng, URL-safe, tối thiểu 12 ký tự.
# Gợi ý sinh: python3 -c 'import secrets; print(secrets.token_urlsafe(36))'
docker compose --env-file deploy/.env -f deploy/compose.yml -f deploy/compose.local.yml up -d --build
docker compose --env-file deploy/.env -f deploy/compose.yml -f deploy/compose.local.yml --profile demo run --rm seed
./scripts/healthcheck.sh http://localhost:8080
```

Mở http://localhost:8080/login. Seed tạo `employee`, `head`, `other`, `admin` với mật khẩu do bạn đặt qua `DEMO_PASSWORD`. Seed chỉ chạy development/test, idempotent và không thay mật khẩu đã tồn tại. Không sử dụng những tài khoản này cho môi trường thật.

## Chạy source local

Cần Node 22+, Python 3.12 khuyến nghị (đã kiểm thử thêm Python 3.9), PostgreSQL 16/17; tạo database riêng trước. Dùng URL-safe password hoặc percent-encode ký tự đặc biệt trong DATABASE_URL.

```sh
python3 -m venv .venv
.venv/bin/pip install -r starter/apps/api/requirements-dev.lock.txt
cp starter/apps/api/.env.example starter/apps/api/.env
# Sửa DATABASE_URL, DEMO_PASSWORD, APP_ORIGIN theo máy dev.
cd starter/apps/api
../../../.venv/bin/alembic upgrade head
../../../.venv/bin/python -m app.seed
../../../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Trong terminal khác:

```sh
cd starter/apps/web
npm ci
npm run dev -- --hostname 127.0.0.1
```

Mặc định web http://localhost:3000, API qua Next rewrite cùng origin `/api/v1`. Nếu cổng 3000 bận, đổi cổng web và `APP_ORIGIN` tương ứng rồi khởi động lại API. `INTERNAL_API_URL` cần đặt **trước build** nếu API không ở http://127.0.0.1:8000; Docker build đã đặt http://api:8000. Cookie chỉ bật `COOKIE_SECURE=false` ở local HTTP. Staging HTTPS phải true.

Source vẫn ở `starter/apps` để giữ đường dẫn baseline; tên thư mục không có nghĩa auth/UI còn là stub. Không tự tạo Git history trong thư mục bàn giao chưa có `.git`.

## Quyền và workflow

- Nhân viên: nội dung APPROVED trong COMPANY, DEPARTMENT của mình, CROSS_DEPARTMENT có ACL, RESTRICTED do chính mình tạo. Draft chưa công khai.
- Trưởng bộ phận: duyệt ARTICLE đúng scope bộ phận, không tự duyệt, có kiểm tra phiên bản/trạng thái, khóa hàng trong transaction, audit và approval event.
- TECH_ADMIN: tạo tài khoản và xem trạng thái adapter. Không tự có quyền đọc bí mật, duyệt chuyên môn hoặc ban hành nội quy.
- Tài khoản tạo mới buộc đổi mật khẩu. Đổi/reset mật khẩu thu hồi mọi session và reset token còn sống. Session chỉ lưu SHA-256 của token ngẫu nhiên; mật khẩu Argon2id.
- Mọi POST yêu cầu `Origin` bằng APP_ORIGIN. POST đã đăng nhập cần `X-CSRF-Token` lấy từ `/auth/me` hoặc login. Không lưu session ở localStorage. Cookie HttpOnly, SameSite=Lax, path=/api, Secure theo môi trường, hạn 8 giờ.
- Login limit tại PostgreSQL: 5 lần sai/tài khoản, 20 lần sai/IP trong cửa sổ 15 phút. API không tin X-Forwarded-For; sau reverse proxy IP dùng chung là giới hạn bảo thủ cần hiệu chỉnh cho staging.
- Chỉ duyệt ARTICLE; quyền ban hành DOCUMENT toàn công ty chưa được xác nhận. Upload/download không được phục vụ, không có public storage.

Tạo tài khoản: `POST /api/v1/users` từ session TECH_ADMIN, xem schema tại `/api/v1/docs`. Chưa có UI quản lý người dùng/gán vai trò; cần quy trình quản trị được JKC chốt.

Reset thủ công: người có quyền vận hành server xác minh danh tính qua kênh độc lập rồi chạy trong thư mục API:

```sh
../../../.venv/bin/python -m app.manage reset-password TEN_DANG_NHAP
```

CLI hiển thị mã một lần; chuyển qua kênh an toàn, không ghi log/chat/commit. Nhân viên mở `/reset`, nhập mã (hạn 15 phút, dùng một lần) và mật khẩu mới. Chưa có SMTP hay self-service yêu cầu reset công khai.

## Kiểm thử và contract

Dùng database riêng **bắt đầu bằng `jkc_test`**, không dùng DB demo/staging. Các test ghi dữ liệu thử và mặc định không xóa audit để giữ tính bất biến.

```sh
export TEST_DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:5432/jkc_test_local'
cd starter/apps/api
DATABASE_URL="$TEST_DATABASE_URL" ../../../.venv/bin/alembic upgrade head
../../../.venv/bin/pytest -q
cd ../../..
.venv/bin/ruff check starter/apps/api scripts
.venv/bin/ruff format --check starter/apps/api scripts
PYTHONPATH=starter/apps/api .venv/bin/python scripts/export_openapi.py --check
TEST_DATABASE_URL="$TEST_DATABASE_URL" .venv/bin/python scripts/database_drill.py
cd starter/apps/web
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
# API và production web phải đang chạy, ví dụ Origin http://localhost:3100.
UI_BASE_URL=http://localhost:3100 UI_DEMO_PASSWORD='<mật khẩu seed riêng>' npm run test:ui
```

UI tests ghi nháp, gửi và duyệt bài DEMO, chỉ chạy trên DB demo/test dùng riêng. Không chạy vào staging có dữ liệu thật. CI đã được khai báo trong `.github/workflows/ci.yml`; chưa chạy GitHub Actions vì thư mục này chưa có Git/remote.

`api/openapi.yaml` sinh từ code và validate OpenAPI 3.1. Sửa API rồi chạy script export không có `--check` để cập nhật. `api/openapi.backlog.yaml` là draft cũ, **không phải endpoint đã hỗ trợ**. Contract dùng đường dẫn đầy đủ `/api/v1/...`. API chỉ expose response schema, không trả password hash/đáp án quiz.

## Migration và backup

Baseline `database/001_initial.sql` giữ nguyên. Bản sao đóng băng ở `starter/apps/api/alembic/versions/001_initial.sql`; migration 002 bổ sung guard/version/audit, index, throttling và reset token. Compose migrate chạy xong trước API, readiness kiểm tra revision head.

Với database mới: `alembic upgrade head`. Rollback trên DB thử nghiệm có thể `alembic downgrade base`; thao tác này **xóa toàn bộ bảng ứng dụng**. Với DB đã chạy baseline trước đây: sao lưu, đối chiếu đầy đủ schema 001 rồi mới cân nhắc `alembic stamp 001` và upgrade; không tự stamp DB chưa xác minh. Không dùng đồng thời init SQL và Alembic.

`database_drill.py` yêu cầu PostgreSQL CLI cùng major hoặc mới hơn server. Tự tạo DB tạm, thử upgrade/downgrade/upgrade, dump và restore vào DB rỗng, so sánh số dòng rồi xóa DB tạm. Bằng chứng nằm trong `docs/reports/database-drill.json`; đây là diễn tập dữ liệu test, chưa phải backup/restore staging thật.

Backup thủ công staging:

```sh
mkdir -p deploy/backups
chmod 700 deploy/backups
docker compose --env-file deploy/.env -f deploy/compose.yml --profile ops run --rm backup
```

Chép backup tới thiết bị lưu độc lập; cần lịch tự động, kiểm tra restore, RPO/RTO, mã hóa và backup tệp trước production. File dump chứa dữ liệu nhạy cảm, không commit.

## Staging và giới hạn

`deploy/compose.yml` dùng Caddy TLS internal; cấu hình DNS/APP_HOST, thiết bị tin CA và firewall nội bộ/VPN trước khi đổi BIND_ADDRESS khỏi loopback. Không public quản trị ra internet. Chưa được coi là production-ready: cần tách DB owner/migrator/runtime role, RLS defense in depth, least privilege, TLS/backup thực địa, kiểm thử tải/bảo mật, quản lý secret, file scan/storage, giám sát và UAT.

Odoo chỉ có Protocol + NoOpOdooAdapter (`probe`, `fetch_employees`, `fetch_departments`). Chưa xác định phiên bản/gói quyền; không gọi API Odoo hay lấy mật khẩu ERP.
