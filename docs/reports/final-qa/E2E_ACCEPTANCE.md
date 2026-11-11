# Kiểm thử chấp nhận đầu–cuối (E2E)

## Phạm vi và điều kiện

- **Snapshot:** `integration/final-qa-dryrun` @ `a5b8ee8` (cây = UI-09 `47597a6`).
- **Staging HTTPS:** https://localhost:18444, build lại `api` + `web` từ snapshot ngày 11/11/2026. ClamAV thật, PostgreSQL 17, runtime role có RLS.
- **Tài khoản:**
  - DEMO cố định: `employee` (Sản xuất), `head` (trưởng bộ phận Sản xuất), `other` (trưởng bộ phận Kỹ thuật), `admin` (quản trị kỹ thuật, bộ phận Kỹ thuật);
  - tài khoản UAT tổng hợp **mới, độc lập** từ `app.seed_uat`: `uat14` (2 học viên cho `sprint01`), `uat15` (HR cho UI-09).
- **Dữ liệu:**
  - mỗi lần chạy tạo dữ liệu mới có mã riêng qua **workflow thật** (soạn → gửi → duyệt/giao);
  - **không xóa hay sửa** lịch sử phê duyệt, điểm, audit;
  - DB staging có **0** tài khoản ngoài namespace DEMO/UAT (`results/rls-tables.txt`, truy vấn đếm).
- **Chạy tuần tự**, máy giữ thức (`caffeinate -dims`).

## Kết quả tổng (trên snapshot)

| Bộ kiểm thử | Kết quả | Bằng chứng |
|---|---|---|
| pytest backend, PostgreSQL 16 sạch | **66/66 PASS** | `results/pytest.txt` |
| Unit test model web | **50/50 PASS** | `results/unit.txt` |
| ESLint / TypeScript / Next build | PASS | `results/web-static.txt` |
| Ruff · OpenAPI drift | PASS | `results/ruff.txt`, `results/openapi.txt` |
| Playwright UI-01 → UI-09 (10 bộ, 4 viewport; UI-01 3 viewport) | **165/165 PASS** | `results/ui-suites.txt`, `results/playwright-*.json` |
| E2E `smoke` + `sprint1` (desktop + mobile) | **10/10 PASS** | `results/ui-suites.txt` |
| E2E `sprint01` (UAT `uat14`) | **2/2 PASS** | `results/ui-suites.txt` |
| CI snapshot (foundation · postgres17 · staging-acceptance) | **PASS** | [run 42970185474](https://github.com/tuanqt98/TriThucJKC/actions/runs/42970185474) |

## Ma trận yêu cầu ↔ kiểm thử

| Yêu cầu Phase 2 | Kiểm thử (tất cả PASS trên snapshot) |
|---|---|
| **Đăng nhập, hết phiên, phân quyền** | UI-01 `login` (9: đăng nhập, sai mật khẩu, khóa tạm, hết phiên); pytest `test_security`, `test_sprint01::test_unauthenticated_new_routes`; hết phiên → `/login?reason=session-expired` trong UI-08, UI-09; chưa đăng nhập → `/login` trong UI-04…UI-09 |
| **Tạo bài, lưu nháp, mở lại nháp** | UI-07 kịch bản 1 (lưu → URL `?id=` → reload giữ dữ liệu → sửa, `revision` tăng); "Bài viết của tôi" mở lại bản nháp |
| **Tải ảnh/PDF và quyền tệp** | UI-07 (PNG hợp lệ "đã quét an toàn", `.txt` bị chặn, PNG giả bị máy chủ từ chối); UI-04/05B/06 tải PDF 200; `other`/`admin` → API tệp 404 (UI-05B, UI-06); pytest `test_file_parent_acl_lifecycle_and_integrity`, `test_upload_rejects_type_path_active_pdf_size_and_scanner_failure`, `test_file_restricted_has_no_admin_or_head_bypass`; CI "Real antivirus …" (ClamAV thật) |
| **Gửi duyệt, yêu cầu sửa, từ chối, phê duyệt** | UI-07 (gửi → `PENDING` → trưởng bộ phận duyệt → hiện trong Kho); UI-09 kịch bản 1–2 (phê duyệt; yêu cầu sửa và từ chối có lý do bắt buộc; hủy xác nhận không gửi; tác giả nhận `CHANGES_REQUESTED` + ý kiến, `REJECTED`); "Bài viết của tôi" đủ 5 trạng thái |
| **Tìm không dấu, lọc, phân trang, xem bài và quay lại** | UI-05 (20: không dấu, hoa/thường, từ trong nội dung, lọc công đoạn/loại/bộ phận, phân trang, Back giữ trạng thái); UI-05B và UI-06 (quay lại giữ từ khóa/bộ lọc/trang/kiểu xem, reload, tab mới); pytest `test_knowledge_listing` |
| **Đọc nội quy, xác nhận theo phiên bản** | UI-04 (16: xác nhận v1, phiên bản mới v2 cần xác nhận lại, lịch sử giữ); `sprint01` (đọc đúng phiên bản với UAT mới); pytest `test_reading_*` |
| **Học, hoàn thành bài học, kiểm tra, kết quả** | UI-08 kịch bản 2 (bài học → tiến độ 0→100 → kiểm tra → 100/100 Đạt → hoàn thành; lượt sai → Chưa đạt → hết lượt → FAILED); `sprint01` (học và quiz); pytest `test_quiz_grades_server_history_and_limit`, `test_concurrent_quiz_submit_one_history` |
| **Chặn mở lượt mới sau khi đạt (DATA-39)** | pytest `test_quiz_after_pass_is_blocked_and_history_is_kept`, `test_passed_assignment_does_not_hand_out_a_leftover_open_attempt`; UI-08 kịch bản 3 (API 409 `QUIZ_ALREADY_PASSED`, lịch sử giữ) |
| **Quyền theo vai trò** | Nhân viên: UI-09 (không quyền duyệt), dashboard (API `/approvals` 403). Trưởng bộ phận: UI-09 duyệt trong phạm vi, **không tự duyệt** (UI-07, UI-09). HR: UI-09 duyệt tài liệu. **Quản trị kỹ thuật** (`admin`): không xem bài Sản xuất (UI-05, 05B, 06), không bypass (pytest `test_security`, `test_file_restricted_has_no_admin_or_head_bypass`). Khác bộ phận (`other`): không thấy bài/tệp/hàng đợi (UI-05, 05B, 06, 09) |
| **Lỗi mạng, 401, 403, 404, 409** | Mạng: UI-07, UI-08, UI-09 (không báo thành công). 401: UI-08, UI-09. 403: UI-04, UI-05, UI-05B, UI-06 (giả lập). 404: UI-04…UI-08. 409: UI-04 (xác nhận đọc), UI-07 (`revision` cũ), UI-09 (đã có người duyệt) |

## Phát hiện

| ID | Mức | Phát hiện | Bằng chứng | Phương án | Trạng thái |
|---|---|---|---|---|---|
| E2E-1 | P1 | **Chưa có UAT do người dùng thật ký nhận** (kiểm thử trên là tự động với dữ liệu DEMO) | `sprint1` có dòng `human_uat_signoff: PENDING` trong log CI | PO/IT tổ chức UAT tại xưởng theo `docs/UAT_*`, ký biên bản | Mở |
| E2E-2 | P2 | Dữ liệu staging chứa nhiều bản ghi do test tạo, ảnh hưởng số thống kê khi demo | Thẻ thống kê UI-08/09 | Dựng stack review riêng (đề xuất UI-05B mục 8) | Mở, chờ PO |
| E2E-3 | — | Chưa phát hiện lỗi chức năng nào trên snapshot | Bảng trên | — | Đóng |
