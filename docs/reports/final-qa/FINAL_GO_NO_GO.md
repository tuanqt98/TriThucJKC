# GO / NO-GO — PO đã quyết định 11/11/2026

Ngày 11/11/2026 · Snapshot tích hợp `integration/final-qa-dryrun` @ `a5b8ee8` (cây = UI-09 `47597a6`).

**Agent không merge, không deploy, không xóa nhánh hay PR.** CI xanh **không** đồng nghĩa với nghiệm thu production.

## Đề xuất

| Quyết định | Đề xuất | Lý do |
|---|---|---|
| **Hợp nhất mã vào `main`** (không deploy) | **GO có điều kiện** | 9 bước merge diễn tập không xung đột; cây giống hệt UI-09 đã duyệt; CI snapshot xanh 3 job (#42970185474); mọi kiểm thử trên snapshot PASS. Điều kiện: PO GO; tag mốc `pre-merge-main-YYYYMMDD`; theo `MERGE_PLAN.md` (merge commit, không squash/rebase); chạy CI trên `main` sau mỗi bước |
| **Deploy production** | **NO-GO** | Còn 4 gate **P0** mở (bảng dưới) và các P1 bảo mật/vận hành; UAT người dùng thật chưa ký |
| **UAT người dùng tại xưởng** (staging) | **GO** (khuyến nghị làm song song) | Chức năng đủ và ổn định trên staging; cần ký nhận thực tế (G-8) |

## Gate còn mở

| ID | Mức | Nội dung | Chủ trì | Tài liệu |
|---|---|---|---|---|
| G-1 / DATA-39B | **P0** | Chặn nộp lần làm cũ sau khi đạt; cần migration `jkc_submit_quiz` | PO duyệt → Dev | SECURITY §1 · **Đã sửa: PR #8 (migration 008), CI xanh, chờ review/merge sau bước 9** |
| G-2 | **P0** | Seed DEMO (owner, ép `APP_ENV=development`) có thể chạy vào DB thật; tách cấu hình production và thêm chặn namespace cho `app.seed` | PO/IT → Dev | SECURITY §1 · **Phần Dev đã sửa: PR #9, CI xanh. Còn IT: cấu hình production không có seed/test + đánh dấu DB `jkc.environment=production`** |
| G-3 | **P0** | Chưa có môi trường production (tên miền, TLS/CA thật, secret, sizing) | IT | SECURITY §1 |
| G-4 | **P0** | Backup định kỳ, lưu ngoài máy, diễn tập restore trên hạ tầng thật (RTO/RPO) | IT | SECURITY §1, ROLLBACK |
| G-5 | P1 | Owner DB không phải superuser ở production | IT | SECURITY §3 |
| G-6 | P1 | Content-Security-Policy | Dev | SECURITY §3 |
| G-7 | P1 | Cập nhật chữ ký ClamAV được IT duyệt | IT | SECURITY §3 |
| G-8 | P1 | UAT người dùng thật ký nhận | PO | E2E E2E-1 |
| RA-1 | P1 | Sprint 1 và UI-03 chưa có PR vào `main` | PO duyệt kế hoạch | REPOSITORY_AUDIT, MERGE_PLAN |
| DATA-41/42/44, DATA-31, DATA-24/25, DATA-01…05 | P1 | Hoàn thiện API theo backlog | PO ưu tiên | DATA_GAPS_REVIEW |
| VQ-1/VQ-2, G-9…G-12, RA-2/3/5/6 | P2 | Vùng chạm 36/32px (**VQ: PO cho sửa; CSS xong trên `fix/touch-targets-44`, chờ đo After/regression**), HSTS, RLS phòng thủ thêm, header lặp, nhánh UI-01/02 chỉ local, CI `main` đỏ cũ… | Dev/IT | VISUAL, SECURITY, AUDIT |

## Bằng chứng tóm tắt (trên snapshot)

| Hạng mục | Kết quả |
|---|---|
| Diễn tập merge 9 bước | 0 xung đột · cây = `47597a6` |
| CI snapshot (foundation · postgres17 · staging-acceptance, gồm drill DB, ClamAV thật, backup/restore cô lập) | ✅ #42970185474 |
| pytest / unit / lint-TS-build / ruff / OpenAPI | 66/66 · 50/50 · PASS · PASS · PASS |
| Playwright UI-01 → UI-09 (4 viewport) | 165/165 |
| `smoke` + `sprint1` · `sprint01` (UAT mới) | 10/10 · 2/2 |
| Visual QA 12 màn × 4 viewport | 48/48 PASS (2 phát hiện P2 vùng chạm) |
| Bảo mật: ACL/RLS, admin không bypass, không tự duyệt, session, CSRF, HTTPS, upload, ClamAV, bí mật | PASS (chi tiết SECURITY §2) |

## PO cần quyết định

1. **GO/NO-GO hợp nhất `main`**, và chọn phương án A (chuỗi PR) hay B (một PR) trong `MERGE_PLAN.md`.
2. **Duyệt làm DATA-39B** (migration) và **G-2** (chặn seed DEMO ở production).
3. **Giao IT** G-3, G-4, G-5, G-7; lịch **UAT** người dùng thật (G-8).
4. Có cho sửa P2 trên màn đã duyệt không (VQ-1, VQ-2: vùng chạm 44px).
5. Giữ hay xóa nhánh tạm `integration/final-qa-dryrun` sau khi quyết định (hiện giữ, không xóa).

## Quyết định PO 11/11/2026 và theo dõi gate

**Quyết định:**
- Hợp nhất `main`: **GO có điều kiện**, theo phương án A (9 bước, merge commit).
- Production: **NO-GO**.

Quyết định này **chưa phải lệnh merge**. Agent chỉ chuẩn bị điều kiện và chờ xác nhận cuối của PO.

### A. Điều kiện trước merge thật

| Điều kiện | Trạng thái | Bằng chứng |
|---|---|---|
| CI commit báo cáo `3d1239a` | ✅ foundation · postgres17 · staging-acceptance | run 42972378780 |
| PO duyệt giao diện UI-09 | ✅ **PO APPROVED 12/11/2026** tại `47597a6`; ghi trong PR #7, tag `ui-09-approved` (không thêm commit, để giữ SHA khóa) | PR #7, `git show ui-09-approved` |
| Khóa SHA 9 bước | ✅ origin = local, khớp diễn tập | Bảng dưới |
| Cơ chế tự động deploy | ✅ **Không có**: chỉ có workflow `ci.yml` (test); 0 webhook, 0 environment, 0 deployment | `gh api …/hooks`, `/environments`, `/deployments` |
| Tag mốc trước merge | ✅ `pre-merge-main-20261111` → `dc47e98` (annotated, đã đẩy) | `git ls-remote --tags` |
| Branch protection `main` | ✅ Bật ngày 11/11/2026 theo PO: bắt buộc PR (0 người duyệt, vì một chủ repo không tự duyệt được PR của mình), bắt buộc 3 check `foundation`/`postgres17`/`staging-acceptance` (strict = off để giữ SHA chuỗi PR), áp dụng cả admin, cấm force-push và xóa nhánh; repo chỉ cho **merge commit** (tắt squash/rebase) | `gh api …/branches/main/protection` |
| Repo public → private | ⏳ PO đề nghị chủ repo xem xét. **Lưu ý:** tài khoản cá nhân gói Free **không** áp dụng branch protection cho repo private; nếu chuyển private cần GitHub Pro hoặc chuyển repo sang Organization, nếu không bảo vệ trên sẽ mất hiệu lực | — |

**SHA đã khóa:**

| Bước | Nhánh | SHA |
|---|---|---|
| 0 | `main` | `dc47e98` |
| 1 | `feature/sprint-1-mvp` | `461a19a` |
| 2 | `feature/ui-documents-fidelity` | `30aaf53` |
| 3–9 | PR #1…#7 | `5348aff` · `08e337e` · `a3c3b93` · `e2bcaba` · `5a3af00` · `6fabca0` · `47597a6` |

### B/D. PR xử lý (không thuộc 9 bước; base `feature/ui-approvals`, đổi sang `main` sau bước 9)

| PR | Nội dung | CI | Trạng thái |
|---|---|---|---|
| #8 | DATA-39B: migration 008 | ✅ 3 job | Draft, chờ review |
| #9 | G-2: guard seed DEMO | ✅ 3 job | Draft, chờ review |
| #10 | D: vùng chạm 44px (chỉ CSS) | ✅ 3 job (`1e0e44a`) | Draft. Phần tử dưới 44px: 72 → 0 (1666 phần tử). 22/24 ảnh giống hệt; UI-03 desktop/tablet ô lọc cao thêm 6px. Regression 160/160 + 10/10 + 2/2; UI-05B có 4 lỗi **có từ trước** (bản đã duyệt cũng fail, xem RG-1) |

Merge thử #8, #9, #10 với nhau (`git merge-tree`): không xung đột.

### C. Hạ tầng (IT/PO)

Chưa bắt đầu:
- G-3: môi trường production, tên miền, TLS, secrets, sizing, và dấu DB `jkc.environment=production`;
- G-4: backup định kỳ, restore drill, RTO/RPO;
- G-5: owner DB không superuser;
- G-7: cập nhật chữ ký ClamAV;
- G-8: UAT có biên bản ký nhận.

### Phát hiện mới trong lúc làm D

| ID | Mức | Phát hiện | Đề xuất |
|---|---|---|---|
| RG-1 | **P1** (PO nâng DATA-20 ngày 12/11/2026) | Kho tri thức (UI-05) tải **toàn bộ** kết quả về trình duyệt. Staging có **815** bài DEMO, mất khoảng **6,5 giây** mới hiện danh sách, làm UI-05B fail 4 test (cả trên bản đã duyệt) | Đặc tả **PR #11** (chỉ tài liệu): nguyên nhân chính là RLS gọi hàm từng dòng (role runtime ~350 ms/truy vấn so với owner 5 ms); đề xuất B1 API, B2 index, B3 RLS (B3 cần PO duyệt riêng). Chưa triển khai; không trộn vào PR khác |
| OPS-1 | — | Docker Desktop treo do ổ máy còn 2,8 GB; cache **BuildKit** (`cache.db`) hỏng làm `dockerd` panic khi build | Đã xử lý: xóa cache npm (10 GB), dừng/khởi động lại Docker, **đổi tên** (không xóa) `cache.db` hỏng. PostgreSQL staging tự phục hồi bằng WAL; dữ liệu đủ (92 tài khoản, 1797 nội dung, 1792 tệp, khớp ổ đĩa); **không đụng volume** |

## Trạng thái 12/11/2026 — sẵn sàng trình merge

- **Mọi điều kiện trước merge đã đạt:** `scripts/final-qa/merge_preflight.sh` (chỉ đọc) **PASS**, xem `results/merge-preflight.txt`.
- **Lệnh merge chính xác:** `MERGE_EXECUTION.md` (9 bước, điều kiện dừng, rollback). **Chờ PO duyệt lần cuối.**

| Hạng mục | Quyết định |
|---|---|
| Hợp nhất `main` (9 bước) | **Sẵn sàng**, chờ PO cho phép chạy |
| PR #8 DATA-39B, #9 G-2 | Giữ, chưa merge; là **gate P0 trước production** |
| PR #10 vùng chạm | Giữ riêng, CI xanh; lỗi UI-05B có từ trước, đã có bằng chứng đối chiếu |
| PR #11 DATA-20 (P1) | Đặc tả chờ PO duyệt; triển khai sau, PR riêng |
| Deploy production | **NO-GO** (G-1…G-4) |

## Kết quả hợp nhất `main` — 13/11/2026 (phương án A điều chỉnh B, 8 bước)

| Hạng mục | Kết quả |
|---|---|
| `main` | `dc47e98` → **`7ff930f`** (8 merge commit, không squash/rebase/force-push/`--admin`) |
| Cây `main` | **== `a5b8ee8`** (bản tích hợp) **== `47597a6`** (UI-09 đã duyệt) |
| Nội dung đã duyệt | Mọi head Sprint 1, UI-01…UI-09 là tổ tiên của `main` |
| CI | 3/3 xanh trên **mỗi** merge commit; commit cuối `7ff930f`: run 43412922799 |
| PR | #13 (Sprint 1 + UI-01…03), #1–#7 **MERGED**; #12 GitHub tự đánh dấu MERGED (bằng chứng, không thao tác); **#8–#11 OPEN**, chưa merge |
| Nhánh, tag | Giữ đủ (14 nhánh, 3 tag) |
| Deploy | **Không**: 0 deployment, 0 environment |
| Nhật ký | `results/merge-log.md` |

**Còn tồn đọng:**
- **P0 trước production:**
  - G-1 DATA-39B (PR #8);
  - G-2 seed guard (PR #9; phần IT: đánh dấu DB production);
  - G-3 môi trường production (IT);
  - G-4 backup/restore, RTO/RPO (IT).
- **P1:**
  - DATA-20 (đặc tả PR #11, chờ PO duyệt; B3 duyệt riêng);
  - G-5 owner DB, G-6 CSP, G-7 ClamAV, G-8 UAT ký nhận;
  - DATA-41/42/44, DATA-31, DATA-24/25, DATA-01…05.
- **P2:** PR #10 (vùng chạm 44px) chờ review/merge; G-9…G-12.
- **Việc tiếp theo cần PO:** đổi base PR #8–#11 sang `main` (nhánh base `feature/ui-approvals` vẫn còn; PR không tự retarget), review và merge từng PR.

Production: **NO-GO** đến khi đóng G-1…G-4 và nghiệm thu vận hành.
