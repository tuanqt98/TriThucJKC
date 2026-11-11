# Đề xuất GO / NO-GO — chờ PO quyết định

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
| G-1 / DATA-39B | **P0** | Chặn nộp lần làm cũ sau khi đạt; cần migration `jkc_submit_quiz` | PO duyệt → Dev | SECURITY §1 |
| G-2 | **P0** | Seed DEMO (owner, ép `APP_ENV=development`) có thể chạy vào DB thật; tách cấu hình production và thêm chặn namespace cho `app.seed` | PO/IT → Dev | SECURITY §1 |
| G-3 | **P0** | Chưa có môi trường production (tên miền, TLS/CA thật, secret, sizing) | IT | SECURITY §1 |
| G-4 | **P0** | Backup định kỳ, lưu ngoài máy, diễn tập restore trên hạ tầng thật (RTO/RPO) | IT | SECURITY §1, ROLLBACK |
| G-5 | P1 | Owner DB không phải superuser ở production | IT | SECURITY §3 |
| G-6 | P1 | Content-Security-Policy | Dev | SECURITY §3 |
| G-7 | P1 | Cập nhật chữ ký ClamAV được IT duyệt | IT | SECURITY §3 |
| G-8 | P1 | UAT người dùng thật ký nhận | PO | E2E E2E-1 |
| RA-1 | P1 | Sprint 1 và UI-03 chưa có PR vào `main` | PO duyệt kế hoạch | REPOSITORY_AUDIT, MERGE_PLAN |
| DATA-41/42/44, DATA-31, DATA-24/25, DATA-01…05 | P1 | Hoàn thiện API theo backlog | PO ưu tiên | DATA_GAPS_REVIEW |
| VQ-1/VQ-2, G-9…G-12, RA-2/3/5/6 | P2 | Vùng chạm 36/32px, HSTS, RLS phòng thủ thêm, header lặp, nhánh UI-01/02 chỉ local, CI `main` đỏ cũ… | Dev/IT | VISUAL, SECURITY, AUDIT |

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
