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
| 1 | #13 | `30aaf53` | `2494387` | [43260591724](https://github.com/tuanqt98/TriThucJKC/actions/runs/43260591724) | ✅ cha = `dc47e98` + `30aaf53`; cây = head; 22 commit, 219 file; CI 3/3 (16:43Z) |
|  | #12 | `461a19a` | — | — | ℹ️ Sau bước 1, GitHub **tự** đánh dấu PR #12 là MERGED (16:36:52Z) vì mọi commit của nó đã vào `main` qua #13. Không thao tác trên #12; nhánh và SHA giữ nguyên |
| 2 | #1 | `5348aff` | — | — | ⏸ Lần chạy 1 dừng: mất kết nối api.github.com khi đọc `mergeStateStatus` (sau `gh pr ready`). Kiểm tra lại: `main`=`2494387` (cây = `30aaf53`), #1 base `main`, không Draft, CLEAN, 5 commit/56 file, 3 check xanh, #2–#7 không đổi. **Không sai lệch** → thêm thử lại cho lệnh chỉ đọc, chạy tiếp |
| 2 | #1 | `5348aff` | `b5fd1ed` | [43293622079](https://github.com/tuanqt98/TriThucJKC/actions/runs/43293622079) | ✅ cha = `2494387` + `5348aff`; cây = head; 5 commit, 56 file; CI 3/3. Ghi chú: GitHub đã merge (19:46:37Z) nhưng máy nhận timeout mạng (`read tcp … operation timed out`), script dừng; kiểm tra f/g làm thủ công, đạt |
| 3 | #2 | `08e337e` | `35f64a3` | [43337106227](https://github.com/tuanqt98/TriThucJKC/actions/runs/43337106227) | ✅ cha = `b5fd1ed` + `08e337e`; cây = head; 5 commit, 113 file; CI 3/3. Ghi chú: `gh run watch` đứt kết nối nên script đọc kết quả rỗng và dừng; kiểm tra lại thủ công, đạt |
| 4 | #3 | `a3c3b93` | `758b2cb` | [43350084304](https://github.com/tuanqt98/TriThucJKC/actions/runs/43350084304) | ✅ cha = `35f64a3` + `a3c3b93`; cây = head; 3 commit, 94 file; CI 3/3 (03:54Z) |
| 5 | #4 | `e2bcaba` | — | — | ⏸ Lần chạy 1 dừng: timeout mạng khi `gh pr edit --base main`. Kiểm tra: #4 không đổi (base cũ, Draft), `main`=`758b2cb` (cây = `a3c3b93`). Không sai lệch → đổi base có thử lại + đọc lại xác nhận, chạy tiếp |
| 5 | #4 | `e2bcaba` | `a8e52b0` | [43375240545](https://github.com/tuanqt98/TriThucJKC/actions/runs/43375240545) | ✅ cha = `758b2cb` + `e2bcaba`; cây = head; 2 commit, 47 file; CI 3/3 (06:56Z) |
| 6 | #5 | `5a3af00` | `5b3388c` | [43382285060](https://github.com/tuanqt98/TriThucJKC/actions/runs/43382285060) | ✅ cha = `a8e52b0` + `5a3af00`; cây = head; 2 commit, 87 file; CI 3/3 (10:47Z) |
| 7 | #6 | `6fabca0` | `a9e0604` | [43412006877](https://github.com/tuanqt98/TriThucJKC/actions/runs/43412006877) | ✅ cha = `5b3388c` + `6fabca0`; cây = head; 2 commit, 121 file; CI 3/3 (10:54Z) |
| 8 | #7 | `47597a6` | `7ff930f` | [43412922799](https://github.com/tuanqt98/TriThucJKC/actions/runs/43412922799) | ✅ cha = `a9e0604` + `47597a6`; cây = head; 3 commit, 68 file; CI 3/3 (11:00Z) |

| ℹ️ | Sự cố vận hành | — | — | — | Mạng máy thực thi chập chờn: DNS, timeout, IP đổi (192.168.91.104 → 192.168.110.182). 4 lần script dừng do lỗi mạng ở lệnh client (bước 2, 3, 4, 5). Mỗi lần đều kiểm tra lại trạng thái thật trên GitHub trước khi chạy tiếp; **không có sai lệch dữ liệu, cây hay CI**. Script bổ sung thử lại cho lệnh chỉ đọc và xác nhận theo trạng thái server (`scripts/final-qa/merge_step.sh`) |

## Xác minh cuối (2026-11-13T11:01:17Z)

- `main` = `7ff930fdf25d406bfb7dc3370e131077d4b999e3`
- ✅ cây `main` == cây bản tích hợp `a5b8ee8` (== UI-09 đã duyệt `47597a6`)
- ✅ cây `main` == `47597a6`
- ✅ mọi head đã nghiệm thu (Sprint 1, UI-01, UI-02, UI-03…UI-09) là tổ tiên của `main`; không squash/rebase
- Số commit mới trên main so với `dc47e98`: 52 (44 commit gốc + 8 merge commit)
- Merge commit (first-parent): 7ff930f a9e0604 5b3388c a8e52b0 758b2cb 35f64a3 b5fd1ed 2494387 
- CI trên commit cuối của main: foundation=success postgres17=success staging-acceptance=success
- PR:
  - #1: MERGED base=main merge=b5fd1ed
  - #2: MERGED base=main merge=35f64a3
  - #3: MERGED base=main merge=758b2cb
  - #4: MERGED base=main merge=a8e52b0
  - #5: MERGED base=main merge=5b3388c
  - #6: MERGED base=main merge=a9e0604
  - #7: MERGED base=main merge=7ff930f
  - #8: OPEN base=feature/ui-approvals merge=—
  - #9: OPEN base=feature/ui-approvals merge=—
  - #10: OPEN base=feature/ui-approvals merge=—
  - #11: OPEN base=feature/ui-approvals merge=—
  - #12: MERGED base=main merge=461a19a
  - #13: MERGED base=main merge=2494387
- Nhánh còn trên origin: 14 (feature/fix/spec/integration); tag: pre-merge-main-20261111 ui-08-approved ui-09-approved 
- Deploy: 0 deployment, 0 environment
