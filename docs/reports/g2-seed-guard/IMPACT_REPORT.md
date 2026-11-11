# G-2 — Chặn tạo dữ liệu DEMO trên production: báo cáo tác động

PO duyệt hướng xử lý ngày 11/11/2026 (quyết định B). Không đổi schema, quyền, RLS, endpoint hay UI.

## 1. Lỗi

- **Compose ép môi trường development.** Service `seed` trong `deploy/compose.yml` (profile `demo`) dùng kết nối **owner** và **ép `APP_ENV: development`**. Vì vậy kiểm tra môi trường trong các module seed luôn qua khi chạy bằng compose, bất kể môi trường thật là gì.
- **`app.seed` không kiểm tra namespace DEMO.** Chạy nhầm `--profile demo run seed` trên DB thật sẽ thêm tài khoản `employee`, `head`, `other`, `admin` (mật khẩu `DEMO_PASSWORD`) và nội dung DEMO.

## 2. Thay đổi

| Tệp | Thay đổi |
|---|---|
| `app/demo_guard.py` (mới) | `require_demo_database(conn)`: **3 lớp kiểm tra độc lập, chạy trước mọi lệnh ghi** (chi tiết bên dưới bảng) |
| `app/seed.py`, `app/seed_uat.py`, `app/seed_incident_guides.py` | Gọi chung `require_demo_database` thay cho kiểm tra riêng lẻ. `app.seed` **lần đầu** có kiểm tra namespace |
| `deploy/compose.yml` | Service `seed` **bỏ** `APP_ENV: development`, nên kế thừa `APP_ENV` của triển khai (`staging`) |
| `.github/workflows/ci.yml` | (a) Sau pytest, DB có tài khoản không DEMO: CI chạy `app.seed` và **bắt buộc bị từ chối**. Trước đây bước này seed lại; dữ liệu DEMO đã do pytest seed sẵn. (b) Kiểm tra `docker compose config`: `seed` kế thừa `APP_ENV=staging` và chỉ nằm trong profile `demo` |
| `tests/conftest.py` | Chỉ seed khi DB chưa có baseline DEMO (seed vốn idempotent). Nhờ vậy vẫn chạy lại pytest được trên DB test cũ |
| `tests/test_demo_guard.py` (mới), `tests/test_incident_guides.py` | 27 test mới; cập nhật fixture/test UI-06 theo guard chung |
| `README.md`, `docs/STAGING_RUNBOOK.md` | Quy tắc G-2 và lệnh IT đánh dấu DB production |

**3 lớp kiểm tra trong `require_demo_database`:**
1. `APP_ENV` phải thuộc `development`, `test` hoặc `staging`.
2. DB **không** được đánh dấu `jkc.environment = 'production'`. IT đặt dấu này bằng `ALTER DATABASE … SET`; đây là tham số của database, không phải bảng hay cột mới.
3. DB chỉ được chứa tài khoản DEMO (`employee_code` dạng `DEMO-*`) hoặc tài khoản `uat_*`.

## 3. Tác động

| Đối tượng | Tác động |
|---|---|
| **Production** (khi có) | Seed DEMO bị chặn bởi 3 lớp. Chỉ cần **một** lớp đúng là đủ chặn: đặt `APP_ENV=production`, **hoặc** IT gắn dấu DB, **hoặc** đã có nhân viên thật |
| Staging (`jkc-staging-s1`, CI staging-acceptance) | Seed và fixture UAT/UI-06 chạy như cũ: `APP_ENV=staging` được phép, DB chỉ có tài khoản DEMO/UAT |
| **Thay đổi hành vi có chủ đích** | Trước đây module seed chỉ nhận `development`/`test`, nhưng compose luôn ép `development`, nên trên thực tế staging vẫn seed được. Nay `staging` được phép **công khai** và kèm thêm 2 lớp DB. Không mở rộng quyền thực tế |
| API, quyền, RLS, schema, UI | Không đổi |
| Dev local | `python -m app.seed` trên DB dev chỉ có tài khoản DEMO: như cũ. Trên DB có tài khoản khác: bị từ chối, cần dùng DB riêng |

## 4. Kiểm thử

**RED** (`red.txt`): chạy cùng bộ test trên mã seed/compose cũ: **27/27 FAIL**. Trong đó, lỗ hổng bảo mật thật là:
- `app.seed` **ghi** vào DB có tài khoản thật;
- cả 3 seed **ghi** vào DB đã đánh dấu production;
- compose ép `APP_ENV`.

Phần còn lại fail vì thông báo lỗi khác, hoặc vì mã cũ từ chối `staging`.

**GREEN** (`green.txt`):

| Kiểm thử | Kết quả |
|---|---|
| `APP_ENV` = `production`, `prod`, rỗng, `"Staging "` × 3 seed → từ chối, **số dòng 7 bảng không đổi** | PASS |
| DB đánh dấu `production`, `PRODUCTION`, `" Production "` × 3 seed, kể cả khi `APP_ENV=development` (mô phỏng compose cấu hình sai) → từ chối, **không ghi** | PASS |
| DB có 1 nhân viên thật × 3 seed → từ chối, **không có tài khoản DEMO nào được tạo** | PASS |
| DB staging trống → seed thành công, chạy lại idempotent; dấu khác `production` không chặn | PASS |
| `compose.yml`: `seed` không có `APP_ENV` riêng | PASS (pytest và CI) |
| pytest toàn bộ trên PostgreSQL 16 sạch | **93/93 PASS** |
| Chạy như CI: `app.seed` sau pytest → **bị từ chối** (exit ≠ 0) | PASS |
| ruff · format · OpenAPI · `docker compose config` | PASS |

Mỗi test guard chạy trên **database riêng vừa migrate** rồi xóa, nên "không ghi" được chứng minh bằng đếm dòng trước/sau.

**Ghi nhận (không do thay đổi này):** chạy lại pytest trên DB test đã dùng thì `test_course_authoring_assignment_new_version_and_grading` fail, trên cả nhánh gốc. CI luôn dùng DB mới nên không bị ảnh hưởng.

## 5. Rollback

- Revert commit này. Không có migration, không ghi dữ liệu, nên **không cần thao tác DB**.
- Dấu `jkc.environment` (nếu IT đã đặt) vô hại với mã cũ; gỡ bằng `ALTER DATABASE … RESET jkc.environment` nếu cần.

## 6. Việc còn lại

- **IT (G-3):** cấu hình production không có service `seed`/`test` và không dùng profile `demo`/`test`; đặt `APP_ENV=production`; chạy `ALTER DATABASE … SET jkc.environment='production'` và lưu bằng chứng `SHOW jkc.environment`.
- PR này **không** thuộc 9 bước merge đã chốt. Đưa vào `main` **sau** bước 9 (đổi base sang `main`) khi PO cho phép.
