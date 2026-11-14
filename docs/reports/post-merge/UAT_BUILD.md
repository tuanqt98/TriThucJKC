# Bản build UAT (PO duyệt 14/11/2026)

| Mục | Giá trị |
|---|---|
| Commit | **`80461653ec1cc366495402f36770a4a83ae995bd`** (`main` sau merge PR #8 và PR #9) |
| Nội dung | Sprint 1, UI-01…UI-09 (đã nghiệm thu), DATA-39B (migration 008), G-2 kèm G2-R1 |
| CI trên commit | run 43556454273: foundation · postgres17 · staging-acceptance ✅ |
| DB revision bắt buộc | **008** (API chỉ báo sẵn sàng khi DB ở 008) |
| Không gồm | PR #10 (vùng chạm 44px), PR #11 (đặc tả DATA-20) |

## Image digest — IT ghi khi build stack UAT

| Image | Nguồn | Digest (IT điền) |
|---|---|---|
| api | `starter/apps/api` @ commit trên | sha256:…… |
| web | `starter/apps/web` @ commit trên | sha256:…… |
| postgres | `postgres:17.11-alpine3.23` | sha256:…… |
| caddy | `caddy:2.10.2` | sha256:…… |
| clamav | theo IT duyệt (G-7) | sha256:…… |

## Điều kiện dựng stack UAT (IT)

- **Stack riêng, sạch**; không dùng `jkc-staging-s1`.
- Cấu hình staging (`APP_ENV=staging`), HTTPS bằng CA nội bộ, chỉ trong mạng JKC.
- DB mới; migration `alembic upgrade head` → **008**.
- Seed baseline DEMO (`--profile demo run seed`) được phép **vì đây là UAT**. **Không** đặt dấu `jkc.environment=production` trên DB UAT.
- Tài khoản người tham gia trong namespace `uat_`, theo danh sách HR.
- Ghi digest vào bảng trên, chụp `/api/v1/health/ready` = 200.

**Ngày bắt đầu:** thứ Hai đầu tiên sau khi **IT** (stack sẵn sàng, CA đã cài trên thiết bị) và **HR** (danh sách người tham gia) cùng xác nhận.

**Điều kiện ký nghiệm thu:** 0 lỗi S1/S2 còn mở (`UAT_PLAN.md`).
