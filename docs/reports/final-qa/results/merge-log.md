# Nhật ký hợp nhất main — phương án A (PO duyệt 12/11/2026)

Preflight trước bước 1: **PASS** (2026-11-12T16:19:37Z).

| Bước | PR | Head SHA | Merge SHA | CI run | Kết quả |
|---|---|---|---|---|---|
| 1 | #12 (PR-S1) | `461a19a` | — | — | ⏸ Tạm dừng có kiểm soát: PR mới kích hoạt CI `pull_request` (run 43257509355), nên `BLOCKED` đến khi 3 check xong. Không phải sai lệch mã; `main` vẫn `dc47e98`. Kế hoạch bổ sung bước chờ CI của PR; không vượt bảo vệ |
| 1 | #12 (PR-S1) | `461a19a` | — | [43257509355](https://github.com/tuanqt98/TriThucJKC/actions/runs/43257509355) | ❌ **DỪNG.** CI `pull_request` mới: `foundation` FAIL ở `database_drill.py` (`unrecognized configuration parameter "transaction_timeout"`); `postgres17` và `staging-acceptance` PASS. Lý do: runner hiện dùng `pg_dump` ≥ 17 với dịch vụ PG16; bản sửa (`30aaf53`, ghim client PG16) chỉ có từ bước 2. CI cũ của `461a19a` (run 41092652497) xanh nhờ runner cũ. **Chưa merge; `main` vẫn `dc47e98`; PR #12 để mở.** Chờ PO |

## Trạng thái khi dừng

- `main` = `dc47e98` (không đổi); không có merge nào.
- PR #12 (`feature/sprint-1-mvp` → `main`) mở, không Draft, `BLOCKED` do check `foundation` đỏ. Không đóng, không sửa.
- Không dùng `--admin`; không đổi nhánh hay SHA nào.

## Điều chỉnh kế hoạch — PO chọn phương án B (12/11/2026)

- **Lý do:** `foundation` đỏ trên PR #12 vì runner dùng `pg_dump` ≥ 17 với dịch vụ PG16; bản sửa CI chỉ có từ `30aaf53`.
- **Kế hoạch mới (8 bước):**
  - bước 1: PR `feature/ui-documents-fidelity` @ `30aaf53` → `main` (22 commit, 219 file; chứa đủ 13 commit Sprint 1 của `461a19a`);
  - bước 2–8: PR #1 → #7.
- Không đổi SHA nào. PR #12 giữ nguyên làm bằng chứng.
- Preflight cập nhật: **PASS** (2026-11-12T16:29:24Z), `results/merge-preflight-planB.txt`.

| Bước | PR | Head SHA | Merge SHA | CI run (push trên merge commit) | Kết quả |
|---|---|---|---|---|---|
