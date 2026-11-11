# Kiểm toán repository — Final QA

Ngày 11/11/2026 · Repository `tuanqt98/TriThucJKC` · Người thực hiện: Claude Code (agent). Đây là kiểm toán và diễn tập, **không merge `main`, không deploy**.

## 1. Trạng thái PR #1 → #7 (lấy bằng `gh pr view`, 11/11/2026)

| PR | Màn | Head (SHA) | Base (SHA) | Draft | Trạng thái | Mergeable | Commit | File đổi | CI head (push · PR) |
|---|---|---|---|---|---|---|---|---|---|
| #1 | UI-04 Chi tiết nội quy | `feature/ui-document-detail` @ `5348aff` | `feature/ui-documents-fidelity` @ `30aaf53` | Có | OPEN | MERGEABLE | 5 | 56 | ✅ #42563786142 · ✅ #42563790237, #42563791406 |
| #2 | UI-05 Kho tri thức | `feature/ui-knowledge-library` @ `08e337e` | `feature/ui-document-detail` @ `5348aff` | Có | OPEN | MERGEABLE | 5 | 113 | ✅ #42573984826 · ✅ #42573989648 |
| #3 | UI-05B Chi tiết bài | `feature/ui-knowledge-detail` @ `a3c3b93` | `feature/ui-knowledge-library` @ `08e337e` | Có | OPEN | MERGEABLE | 3 | 94 | ✅ #42579939079 · ✅ #42579943731 |
| #4 | UI-06 Sự cố | `feature/ui-incident-detail` @ `e2bcaba` | `feature/ui-knowledge-detail` @ `a3c3b93` | Có | OPEN | MERGEABLE | 2 | 47 | ✅ #42588859332 · ✅ #42588917483 |
| #5 | UI-07 Tạo bài | `feature/ui-knowledge-create` @ `5a3af00` | `feature/ui-incident-detail` @ `e2bcaba` | Có | OPEN | MERGEABLE | 2 | 87 | ✅ #42938582025 · ✅ #42938589119 |
| #6 | UI-08 Đào tạo | `feature/ui-my-courses` @ `6fabca0` (tag `ui-08-approved`) | `feature/ui-knowledge-create` @ `5a3af00` | Có | OPEN | MERGEABLE | 2 | 121 | ✅ #42948701767, #42949375679 · ✅ #42948707168 |
| #7 | UI-09 Phê duyệt | `feature/ui-approvals` @ `47597a6` | `feature/ui-my-courses` @ `6fabca0` | Có | OPEN | MERGEABLE | 3 | 68 | ✅ #42960562796 · ✅ #42960567568 |

**Ghi chú:**
- Số file lớn chủ yếu là ảnh bằng chứng (PNG) và JSON kết quả test trong `docs/reports/`.
- Mọi PR đều Draft, đúng chỉ đạo. Nhánh local và `origin` trùng SHA ở mọi nhánh.
- Tag `ui-08-approved` → `6fabca0` đã có trên `origin`.

## 2. Nhánh không có PR

| Nhánh | SHA | Trên origin | PR | Nội dung | CI |
|---|---|---|---|---|---|
| `feature/sprint-1-mvp` | `461a19a` | Có | **Không** | Sprint 1: workflow phiên bản, HR, sự cố, đào tạo, staging, restore… (13 commit sau `main`) | ✅ push #41092652497 |
| `feature/ui-login-fidelity` (UI-01) | `738c2a0` | **Không** (chỉ local) | Không | 3 commit login | Nằm trong UI-03 trên origin |
| `feature/ui-dashboard-fidelity` (UI-02) | `921d9f8` | **Không** (chỉ local) | Không | 2 commit dashboard | Nằm trong UI-03 trên origin |
| `feature/ui-documents-fidelity` (UI-03) | `30aaf53` | Có | **Không** (là base của PR #1) | UI-01 + UI-02 + UI-03 + bản sửa CI | ✅ push #42563785985 |
| `integration/final-qa-dryrun` | `a5b8ee8` (+ commit báo cáo) | Có (nhánh tạm) | Không | Diễn tập hợp nhất (`MERGE_PLAN.md`) | ✅ push #42970185474 |

## 3. `main`

- `main` = `dc47e98` ("Sprint 0.1 staging, RLS, secure files and learning"), cha là `cf71ecc` (first commit).
- **CI gần nhất trên `main` đỏ** (#41036298237, 30/10/2026): `staging-acceptance` lỗi khi đọc CA của proxy restore chưa sẵn sàng. `foundation` và `postgres17` xanh.
- Bản sửa `30f98da` ("wait for restored proxy readiness before CA verification") đã có trong `feature/sprint-1-mvp`, nên vào `main` khi hợp nhất.

## 4. Lịch sử kế thừa (kiểm bằng `git merge-base --is-ancestor`)

```
main dc47e98
 └─ feature/sprint-1-mvp 461a19a   (+13, ancestor ✔)
     └─ UI-01 login 738c2a0          (+3,  ancestor ✔, local only)
         └─ UI-02 dashboard 921d9f8  (+2,  ancestor ✔, local only)
             └─ UI-03 30aaf53        (+4)
                 └─ UI-04 5348aff    (+5)  PR #1
                     └─ UI-05 08e337e   (+5)  PR #2
                         └─ UI-05B a3c3b93 (+3) PR #3
                             └─ UI-06 e2bcaba (+2) PR #4
                                 └─ UI-07 5a3af00 (+2) PR #5
                                     └─ UI-08 6fabca0 (+2) PR #6
                                         └─ UI-09 47597a6 (+3) PR #7
```

- Mọi cạnh đều là quan hệ tổ tiên, **0 commit lệch ("behind")** ở mọi bước. Lịch sử thẳng, không có nhánh rẽ.
- Có 3 merge commit nội bộ (merge xuôi bản sửa CI/ruff từ UI-03 → UI-04 → UI-05), đều nằm trên đường thẳng này.
- `main..feature/ui-approvals`: 44 commit.

## 5. Rủi ro khi hợp nhất

| ID | Mức | Phát hiện | Bằng chứng | Phương án | Trạng thái |
|---|---|---|---|---|---|
| RA-1 | P1 | `feature/sprint-1-mvp` và UI-03 **không có PR vào `main`**. PR #1 lấy UI-03 làm base, nên merge PR #1 → #7 theo base hiện tại **không đưa gì vào `main`** | Bảng mục 1–2 | Theo `MERGE_PLAN.md`: tạo PR "Sprint 1 + UI-01…03 → main" hoặc một PR tích hợp duy nhất; giữ lịch sử, không squash/rebase | Mở, chờ PO |
| RA-2 | P2 | Nhánh UI-01/UI-02 chỉ có ở local | `git rev-parse @{upstream}` = none | Không mất commit (đã nằm trong UI-03 trên origin). Nếu cần dấu mốc, đẩy tag `ui-01-approved`/`ui-02-approved` thay vì đẩy nhánh | Mở, chờ PO |
| RA-3 | P2 | CI `main` đang đỏ (lỗi cũ đã sửa trong stack) | #41036298237 | Sau khi hợp nhất, CI trên `main` phải xanh, giống diễn tập #42970185474 | Theo dõi |
| RA-4 | — | Mất commit / xung đột | Diễn tập 9 lần merge: **0 xung đột**, cây kết quả **giống hệt** `47597a6` | Không cần xử lý | Đóng (đã kiểm) |
| RA-5 | P2 | Stacked PR: merge một PR giữa chuỗi sẽ đổi base của PR sau | Base mỗi PR là nhánh trước | Thứ tự và cách retarget ở `MERGE_PLAN.md` | Theo kế hoạch |
| RA-6 | P2 | Ảnh và JSON bằng chứng làm repo nặng (hàng trăm PNG) | File đổi mỗi PR 47–121 | Giữ cho nghiệm thu; sau go-live có thể chuyển sang artifact hoặc Git LFS | Đề xuất |
