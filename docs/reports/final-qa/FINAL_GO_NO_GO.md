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

## Review hậu hợp nhất — 14/11/2026 (`docs/reports/post-merge/`)

**Baseline:** `main` `7ff930f`, tag **`baseline-main-20261113`**.

| Gate | Trạng thái sau review |
|---|---|
| G-1 DATA-39B (PR #8) | Mã đạt. Đúng phạm vi; `main` + #8 + #9: pytest 96/96; nộp đồng thời 3 tình huống PASS; bản sao staging: 4 lần làm cũ bị chặn, lịch sử 307 lần làm không đổi qua 007 → 008 → 007 → 008. **Chờ:** đổi base, review, merge |
| G-2 seed DEMO (PR #9) | **Phát hiện G2-R1 (P0):** owner ghi đè dấu DB bằng `PGOPTIONS` thì seed lọt. Bản sửa đã thử nghiệm (đọc `pg_db_role_setting`), chờ PO cho thêm vào #9. G2-R2 (P1): chèn SQL tay bằng owner → quy trình/G-5 hoặc trigger DB (cần duyệt). G2-R3 (thuộc G-3): cần compose production không có seed |
| G-3 môi trường production | Checklist IT A1–A6, B1–B10 (`IT_CHECKLIST_G3_G4.md`). Mở |
| G-4 backup/restore | Checklist C1–C9; đề xuất RPO ≤ 24 giờ, RTO ≤ 4 giờ (PO/IT chốt). Mở |
| G-8 UAT | Kế hoạch `UAT_PLAN.md`: 4 vai trò, 22 kịch bản, tiêu chí S1/S2 = 0, mẫu biên bản. Chờ PO duyệt và lên lịch |
| PR #10 / #11 | Đúng phạm vi; gộp lên `main` không xung đột; chờ quyết định riêng |

Production: **NO-GO**.

## Xử lý P0 hậu hợp nhất — 14/11/2026 (`docs/reports/post-merge/PR8_PR9_FINAL_REVIEW.md`)

| Gate | Trạng thái |
|---|---|
| G-1 DATA-39B · PR #8 | Base `main`, head `00833dd`, Draft, `CLEAN`; CI **chạy lại trên runner hiện tại** xanh 3/3. Mã và review **đạt**. **Chờ PO duyệt merge** |
| G-2 · PR #9 | **G2-R1 đã sửa** (`d751d48`): dấu đọc từ catalog; `PGOPTIONS` không lách được (7 test, RED 7/7 → GREEN 34/34; pytest 100/100). Base `main`, `CLEAN`, CI xanh 3/3. G2-R2 ghi vào hồ sơ bảo mật, kiểm soát bằng IT/G-5 (không trigger DB). **Chờ PO duyệt merge**; phần IT (B1, B5) vẫn mở |
| Tổ hợp `main` + #8 + #9 | Không xung đột; migration 008 ↔ 003 ↔ base sạch; pytest 103/103 |
| G-3 / G-4 | Đã giao IT; RPO ≤ 24 giờ, RTO ≤ 4 giờ, phải kiểm chứng thực tế. Mở |
| G-8 UAT | Kế hoạch đã duyệt (22 kịch bản, 0 lỗi S1/S2 mở). Chờ HR cung cấp người tham gia, PO chốt ngày và bản build |

Production: **NO-GO**.

## Merge PR #8 và #9 — 14/11/2026 (`docs/reports/post-merge/results/merge-log-8-9.md`)

| Bước | PR | Head | Merge commit | CI trên merge commit | Kiểm tra |
|---|---|---|---|---|---|
| 1 | #8 DATA-39B | `00833dd` | `4481d8a` | 43555978669 ✅ 3/3 | cha `7ff930f` + `00833dd`; cây = `00833dd` |
| 2 | #9 G-2 (+G2-R1) | `d751d48` | **`8046165`** | 43556454273 ✅ 3/3 | cha `4481d8a` + `d751d48`; cây = tổ hợp đã thử `79c34e6` (103/103) |

- **`main` = `8046165`**; migration head 008; G2-R1 có mặt.
- Không deploy (0 deployment/environment); PR #10/#11 mở; 14 nhánh và 4 tag giữ nguyên.
- Bản build UAT: `UAT_BUILD.md`.

### Gate sau đợt này

| Gate | Mức | Trạng thái | Việc còn lại / người làm |
|---|---|---|---|
| G-1 DATA-39B | P0 | ✅ **Đóng về mã** (merged, CI xanh). Áp dụng production khi deploy (backup trước) | — |
| G-2 seed DEMO | P0 | ✅ **Đóng về mã** (guard 3 lớp + G2-R1, merged). **Phần IT còn mở:** compose production không có seed/test (B1), dấu DB production (B5), không dùng owner cho dịch vụ/seed (G2-R2) | IT |
| G-3 môi trường production | P0 | **Mở**: checklist A1–A6, B1–B10 | IT |
| G-4 backup/restore | P0 | **Mở**: RPO ≤ 24 giờ, RTO ≤ 4 giờ; chưa diễn tập trên hạ tầng thật (C1–C9) | IT |
| G-5 owner DB không superuser | P1 | **Mở** (B4); kèm biện pháp G2-R2 | IT/DBA |
| G-6 CSP | P1 | **Mở**: chưa có header CSP | Dev (PR riêng, chờ PO) |
| G-7 cập nhật chữ ký ClamAV | P1 | **Mở**: mirror/egress chưa duyệt (B7) | IT |
| G-8 UAT ký nhận | P1 | **Mở**: kế hoạch và build đã duyệt; chờ IT dựng stack và HR gửi danh sách; khởi động thứ Hai đầu tiên sau khi cả hai xác nhận | IT + HR + PO |
| DATA-20 | P1 | Đặc tả PR #11, chờ PO duyệt | PO |
| PR #10 vùng chạm | P2 | Chờ quyết định | PO |

Production: **NO-GO** đến khi đóng G-3, G-4 (P0), xử lý G-5…G-8 (hoặc chấp nhận rủi ro bằng văn bản) và nghiệm thu triển khai.
