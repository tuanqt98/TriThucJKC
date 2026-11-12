# Lệnh hợp nhất `main` — phương án A, **điều chỉnh B: 8 bước**

> **Điều chỉnh 12/11/2026 (PO chọn phương án B).**
> - **Lý do:** PR #12 (`feature/sprint-1-mvp` @ `461a19a` → `main`) có `foundation` đỏ ở bước diễn tập DB (run 43257509355). Runner GitHub hiện dùng `pg_dump` ≥ 17, sinh `SET transaction_timeout` mà PostgreSQL 16 trong job không hiểu. Bản sửa CI (ghim client PG16) là commit `30aaf53`, head của bước 2 cũ; `461a19a` không có.
> - **Quyết định:** gộp bước 1 và 2 cũ thành **bước 1 mới**: PR `feature/ui-documents-fidelity` @ `30aaf53` → `main`, gồm Sprint 1 (13 commit) và UI-01…03 (9 commit). Không đổi SHA nào, không vượt bảo vệ. PR #12 **giữ nguyên làm bằng chứng**, không đóng.
> - **Bổ sung:** tạo PR sẽ kích hoạt CI `pull_request` mới. Phải **chờ** 3 check xong và xanh rồi PR mới `CLEAN`; tuyệt đối không vượt.

Bản gốc 9 bước được PO duyệt 12/11/2026 ("DUYỆT THỰC HIỆN MERGE_EXECUTION"); bản điều chỉnh 8 bước được PO duyệt cùng ngày (phương án B).

Soạn ngày 12/11/2026. **Chưa chạy lệnh nào trong tài liệu này.** Chỉ chạy khi PO ghi rõ "Duyệt thực hiện MERGE_EXECUTION".

Hợp nhất `main` **không** phải deploy. Không merge PR #8, #9, #10, #11. Không xóa nhánh, tag hay PR.

## 0. Điều kiện đã xác nhận

`scripts/final-qa/merge_preflight.sh` là script **chỉ đọc**. Kết quả **PASS** ngày 12/11/2026 (`results/merge-preflight.txt`):

| Điều kiện | Trạng thái |
|---|---|
| 10 SHA khóa trên origin khớp; chuỗi thẳng (mỗi bước là con của bước trước) | ✅ |
| CI 3/3 xanh trên **từng** head (`foundation`, `postgres17`, `staging-acceptance`) | ✅ |
| Cây `47597a6` = cây diễn tập `a5b8ee8` | ✅ |
| Tag `pre-merge-main-20261111` → `dc47e98`; `ui-08-approved` → `6fabca0`; `ui-09-approved` → `47597a6` | ✅ |
| Branch protection `main` | ✅ |
| Repo chỉ cho merge commit; giữ nhánh sau merge | ✅ |
| Không auto-deploy: chỉ `ci.yml`, 0 webhook, 0 environment | ✅ |
| UI-09 PO APPROVED (12/11/2026) | ✅ |
| PR #1–#7 mở, đúng head/base; PR #8–#11 nằm ngoài chuỗi | ✅ |

Chi tiết branch protection: bắt buộc PR, bắt buộc 3 check, áp dụng cả admin, cấm force-push và cấm xóa nhánh.

**Ngay trước bước 1, chạy lại preflight; phải PASS:**

```sh
scripts/final-qa/merge_preflight.sh
```

## 1. Bảng bước

| Bước | PR | Nhánh nguồn | SHA head (khóa) | Commit mới | File đổi | Base trước khi merge |
|---|---|---|---|---|---|---|
| 1 | PR-U3 (tạo mới) | `feature/ui-documents-fidelity` (Sprint 1 + UI-01…03) | `30aaf53bea5e52a0627808d794e4709d8e4dea32` | 22 | 219 | `main` |
| 2 | #1 UI-04 | `feature/ui-document-detail` | `5348affc3a83ee65c19c25c95fd473c081d9ec2d` | 5 | 56 | đổi sang `main` |
| 3 | #2 UI-05 | `feature/ui-knowledge-library` | `08e337ec29db82f5e04305e8c6b34c9c9d8ebb46` | 5 | 113 | đổi sang `main` |
| 4 | #3 UI-05B | `feature/ui-knowledge-detail` | `a3c3b93712c51fe686c5569b12907b1b64967f67` | 3 | 94 | đổi sang `main` |
| 5 | #4 UI-06 | `feature/ui-incident-detail` | `e2bcabad0a558818d8f63ea0eb09e34582c5a8a8` | 2 | 47 | đổi sang `main` |
| 6 | #5 UI-07 | `feature/ui-knowledge-create` | `5a3af00a21cbe43f2845fb73c389c07fb6e691c8` | 2 | 87 | đổi sang `main` |
| 7 | #6 UI-08 | `feature/ui-my-courses` | `6fabca09e74384c300ee0a05a41d17350e8da16c` | 2 | 121 | đổi sang `main` |
| 8 | #7 UI-09 | `feature/ui-approvals` | `47597a6903b8d48e53f7aca6cd1630c2e699caae` | 3 | 68 | đổi sang `main` |

`PREV` của bước k là SHA head của bước k−1 (bước 1: `dc47e9830a40603152b052ab7650a7e2cdf32979`). Tự động hóa: `scripts/final-qa/merge_step.sh` (đúng trình tự a→h, dừng ở kiểm tra đầu tiên không đạt).

## 2. Lệnh cho mỗi bước

Thay `N`, `HEAD_SHA`, `PREV`, `COMMITS`, `FILES` theo bảng trên. Mỗi lệnh kiểm tra phải cho đúng kết quả ghi bên cạnh, nếu sai thì **DỪNG**.

### 2.1 Trước khi merge

**a. `main` đang đúng trạng thái mong đợi:** cây của `main` bằng cây `PREV` (nghĩa là bước trước đã vào đủ, không có gì lạ).

```sh
git fetch origin --prune
git diff --quiet PREV origin/main && echo OK
```

**b. Chỉ ở bước 1: tạo PR vào `main`.** Không để Draft; nội dung đã nghiệm thu.

```sh
gh pr create --base main --head feature/ui-documents-fidelity \
  --title "Sprint 1 + UI-01…UI-03 (hợp nhất 1/8)" \
  --body "Phương án A điều chỉnh B, bước 1/8. Gồm Sprint 1 (thay PR #12) và UI-01…03. CI xanh trên 30aaf53. Không deploy."
```

**c. Bước 2–8: đổi base của PR sang `main`.**

```sh
gh pr edit N --base main
```

**d. Kiểm tra PR:**

```sh
gh pr view N --json headRefOid,baseRefName,commits,changedFiles,mergeStateStatus \
  --jq '"\(.headRefOid) \(.baseRefName) commits=\(.commits|length) files=\(.changedFiles) state=\(.mergeStateStatus)"'
```

Kết quả phải là:
- `headRefOid` = `HEAD_SHA`;
- `baseRefName` = `main`;
- `commits` = `COMMITS`, `files` = `FILES`;
- `state` = `CLEAN` (hoặc `DRAFT` ở bước 2–8 trước lệnh e). Nếu `BLOCKED` vì check của PR đang chạy: **chờ** xong; mọi check phải `SUCCESS`, nếu không thì DỪNG.

**e. Bước 2–8: bỏ trạng thái Draft.**

```sh
gh pr ready N
```

### 2.2 Merge

Merge commit; `--match-head-commit` từ chối nếu head khác SHA đã khóa.

```sh
gh pr merge N --merge --match-head-commit HEAD_SHA
```

Không dùng `--squash`, `--rebase`, `--delete-branch`, `--admin` hoặc `--auto`.

### 2.3 Sau merge

**f. Cấu trúc commit và cây:**
- `main` mới là merge commit với cha thứ 2 = `HEAD_SHA`;
- cây của `main` giống hệt cây `HEAD_SHA`.

```sh
git fetch origin
git log -1 --format='%P' origin/main          # "<main trước> HEAD_SHA"
git diff --quiet HEAD_SHA origin/main && echo "tree OK"
```

**g. CI trên `main`** (push của merge commit): phải đủ 3 job `success`.

```sh
gh run list --branch main --limit 1 --json databaseId,headSha,status,conclusion
gh run watch <databaseId> --exit-status
```

**h. Ghi kết quả bước vào `results/merge-log.md`:** thời gian, merge commit, run CI, kết quả f/g.

Chỉ khi a → h đều đạt mới sang bước tiếp theo.

## 3. Điều kiện DỪNG (bất kỳ điều nào)

- Preflight không PASS, hoặc SHA head khác bảng.
- `main` không bằng cây `PREV` trước bước (có commit lạ trên `main`).
- Sau đổi base: số commit hoặc file của PR khác bảng, hoặc `mergeStateStatus` khác `CLEAN`/`DRAFT`.
- `gh pr merge` báo lỗi. **Không** dùng `--admin` để vượt bảo vệ.
- Sau merge: cây `main` khác `HEAD_SHA`, hoặc cha thứ 2 không phải `HEAD_SHA`.
- CI trên `main` không đủ 3/3 `success` (kể cả lỗi hạ tầng CI: dừng, báo PO, không chạy lại tùy tiện).
- Bất kỳ thông báo deploy, webhook hay environment nào xuất hiện.

**Khi dừng:**
1. Không thao tác thêm, báo PO kèm log.
2. Nếu cần rollback: tạo **PR revert** merge commit vừa rồi (`git revert -m 1 <merge>`), chờ CI xanh, PO duyệt rồi mới merge. Không force-push (đã bị chặn). Mốc quay về: tag `pre-merge-main-20261111`. Xem `ROLLBACK_PLAN.md`.

## 4. Kết thúc

**Sau bước 8:**
- `git diff --quiet a5b8ee8 origin/main`: cây `main` = cây diễn tập = UI-09 đã duyệt;
- CI `main` xanh 3/3;
- PR #1–#7 và PR bước 1 ở trạng thái **Merged**; mọi nhánh vẫn còn. PR #12 giữ nguyên (GitHub có thể tự hiển thị là merged khi các commit của nó đã nằm trong `main`).

**Không thuộc đợt này, chờ PO:**
- đổi base PR #8 (DATA-39B), #9 (G-2), #10 (vùng chạm), #11 (đặc tả DATA-20) sang `main`;
- review và merge từng PR;
- deploy production (vẫn **NO-GO** đến khi đóng G-1…G-4).

**Thời gian dự kiến:** khoảng 8 × (CI `main` ~7 phút + kiểm tra) + CI PR bước 1 ≈ **1,5 giờ**, làm liên tục và dừng ngay nếu bất thường.
