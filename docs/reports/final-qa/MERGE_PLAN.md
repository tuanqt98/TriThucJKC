# Kế hoạch hợp nhất (chưa thực hiện, chờ PO GO)

## 1. Kết quả diễn tập (đã làm, không đụng `main`)

- **Nhánh tạm:** `integration/final-qa-dryrun`, tạo từ `origin/main` @ `dc47e98`.
- **Cách làm:** merge `--no-ff` theo đúng thứ tự phụ thuộc, mỗi bước một merge commit:

| Bước | Nguồn | SHA | Xung đột |
|---|---|---|---|
| 1 | `feature/sprint-1-mvp` (không PR) | `461a19a` | 0 |
| 2 | `feature/ui-documents-fidelity` (UI-01…03, không PR) | `30aaf53` | 0 |
| 3 | PR #1 UI-04 | `5348aff` | 0 |
| 4 | PR #2 UI-05 | `08e337e` | 0 |
| 5 | PR #3 UI-05B | `a3c3b93` | 0 |
| 6 | PR #4 UI-06 | `e2bcaba` | 0 |
| 7 | PR #5 UI-07 | `5a3af00` | 0 |
| 8 | PR #6 UI-08 | `6fabca0` | 0 |
| 9 | PR #7 UI-09 | `47597a6` | 0 |

- **Kết quả:**
  - snapshot `a5b8ee8`: `git diff 47597a6 a5b8ee8` **rỗng**, tức cây giống hệt UI-09 đã CI PASS; mọi màn hình và chức năng đã duyệt đều có mặt;
  - 53 commit mới so với `main` (44 commit gốc + 9 merge commit diễn tập);
  - **CI trên snapshot:** ✅ foundation · postgres17 · staging-acceptance, [run 42970185474](https://github.com/tuanqt98/TriThucJKC/actions/runs/42970185474) (gồm drill DB, ClamAV thật, backup/restore cô lập);
  - **Kiểm thử local trên snapshot** (staging build từ snapshot): xem `E2E_ACCEPTANCE.md` và `VISUAL_REGRESSION.md`.

Nhánh `integration/final-qa-dryrun` chỉ dùng diễn tập. Commit báo cáo `docs/reports/final-qa/` được thêm sau snapshot. **Không merge nhánh này vào `main`.**

## 2. Phương án merge thật (đề xuất, cần PO GO)

**Nguyên tắc:**
- giữ lịch sử đã nghiệm thu: **"Create a merge commit"**, không squash, không rebase, không force-push;
- `main` được bảo vệ (khuyến nghị bật branch protection: bắt buộc CI 3 job, cấm force-push);
- merge `main` **không phải** deploy production.

### Phương án A — chuỗi PR theo thứ tự (khuyến nghị: truy vết từng màn)
1. **Chuẩn bị:**
   - gắn tag mốc `pre-merge-main-YYYYMMDD` trên `dc47e98` (đẩy tag, không đổi `main`);
   - gắn tag nghiệm thu cho từng nhánh nếu PO muốn (`ui-01-approved` … `ui-09-approved`).
2. **Tạo 2 PR còn thiếu:**
   - **PR-S1** `feature/sprint-1-mvp` → `main`;
   - **PR-U3** `feature/ui-documents-fidelity` → `main`, tạo **sau** khi PR-S1 đã merge.
3. **Merge từng PR, chờ CI xanh trên `main` sau mỗi bước:**
   - PR-S1 → PR-U3 → **PR #1 → #7**;
   - trước khi merge PR #k, **retarget base của PR #k sang `main`** (`gh pr edit k --base main`);
   - vì lịch sử thẳng, diff của mỗi PR sau khi retarget chỉ còn phần của chính nó.
4. **Không xóa nhánh** sau merge (theo quy tắc). PR merged tự đóng. Nhánh giữ đến khi PO cho phép dọn.
5. Sau bước cuối, `main` có cây giống `a5b8ee8` (đã diễn tập).

### Phương án B — một PR tích hợp
- Mở PR `feature/ui-approvals` → `main`, merge commit duy nhất. Nhanh hơn, nhưng PR #1–#7 không ghi nhận "merged" (cần đóng tay kèm ghi chú).
- Chỉ nên dùng nếu PO ưu tiên một lần duyệt.

### Xử lý stacked PR
- **Đổi base PR sau khi PR trước merge:** GitHub không tự retarget khi nhánh base vẫn còn (ta không xóa nhánh). Phải `gh pr edit <n> --base main` trước khi merge PR đó.
- **Nếu có commit mới trên một nhánh giữa chuỗi** (ví dụ sửa sau nghiệm thu): merge xuôi lên các nhánh sau (như đã làm với bản sửa CI), không rebase.
- **Sau mỗi merge:** chạy lại CI trên `main` và so cây với diễn tập.

## 3. Điều kiện trước khi merge `main`

| Điều kiện | Trạng thái |
|---|---|
| PO GO cho hợp nhất | Chờ |
| CI xanh trên đầu chuỗi và snapshot tích hợp | ✅ (#42960562796/#42960567568 · #42970185474) |
| Không xung đột, cây đúng | ✅ (diễn tập) |
| Tag mốc trước merge | Làm khi GO |
| Branch protection `main` | Đề xuất, cần quản trị repo |

## 4. Điều kiện trước production (khác với merge)

Xem `SECURITY_AND_PRODUCTION_GATES.md` và `FINAL_GO_NO_GO.md`:
- **DATA-39B (P0);**
- **guard seed DEMO cho production (P0);**
- TLS/CA thật, môi trường production, backup và restore trên hạ tầng thật, UAT người dùng thật (P0/P1).

Merge `main` có thể làm trước; **deploy production thì chưa**.
