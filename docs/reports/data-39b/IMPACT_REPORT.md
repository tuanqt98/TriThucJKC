# DATA-39B — Báo cáo tác động (migration 008)

PO duyệt hướng xử lý ngày 11/11/2026 (quyết định B). Chỉ áp dụng cho môi trường kiểm thử và staging. **Không chạy trên production.**

## 1. Lỗi

- **DATA-39** (API) đã chặn **mở** lần làm mới sau khi đạt.
- Tuy vậy, nếu còn **một lần làm đang mở** song song với lần đã đạt, lần đó vẫn **nộp** được và được ghi thêm điểm.
- Lần làm như vậy có thể xuất hiện do:
  - API cũ, trước khi có DATA-39, cho mở lần mới sau khi đạt;
  - dữ liệu ghi ngoài API.
- **Nguyên nhân:** hàm DB `jkc_submit_quiz` không kiểm tra trạng thái "đã đạt".

Tái hiện trước khi sửa (DB ở revision 007): nộp lần làm còn mở sau khi đạt → **200**, `score 0.00`, có thêm bản ghi lịch sử. Xem `red-green-rollback.txt`.

## 2. Thay đổi

| Tệp | Thay đổi |
|---|---|
| `alembic/versions/008_quiz_after_pass.{py,sql}` | `CREATE OR REPLACE jkc_submit_quiz`: thêm **một dòng**. Sau khi khóa hàng `course_assignments` và kiểm tra quyền sở hữu, nếu `completed_at` đã có hoặc đã có lần nộp `passed` thì `RAISE 'JKC_ALREADY_PASSED'`. Giữ nguyên chữ ký, `SECURITY DEFINER`, `search_path` và quyền (`REVOKE … FROM PUBLIC`) |
| `alembic/versions/008_down.sql` | Khôi phục **nguyên văn** hàm của 003. `diff` giữa up và down chỉ khác dòng kiểm tra trên và chú thích |
| `app/learning.py` | Ánh xạ `JKC_ALREADY_PASSED` → **409 `QUIZ_ALREADY_PASSED`**, cùng mã lỗi với DATA-39 nên UI-08 hiển thị như hiện tại |
| `app/main.py` | Readiness đòi revision **008** |
| `scripts/database_drill.py`, `scripts/migration_cycle.py` | Revision head = 008 |
| `tests/test_sprint01.py` | +3 test (mục 4) |
| `README.md`, `docs/UI_DATA_GAPS_BACKLOG.md` | Cập nhật revision và trạng thái DATA-39B |

**Không thay đổi:**
- bảng, cột, index, RLS, GRANT, vai trò, endpoint, OpenAPI;
- giao diện;
- dữ liệu đang có.

## 3. Tác động

| Đối tượng | Tác động |
|---|---|
| Học viên chưa đạt | Không đổi. Vẫn nộp và làm lại cho tới giới hạn số lần (test `failed_only_history…`, `failed_attempts_still_allow_retry…`) |
| Học viên đã đạt | Không nộp thêm được. Kết quả đạt, `completed_at`, câu trả lời và audit **giữ nguyên** |
| Lần làm còn mở trên dữ liệu cũ | **Giữ nguyên**: không xóa, không tự đóng, không chấm. Lần làm đó chỉ không nộp được nữa. Đúng quy tắc "không sửa lịch sử" |
| Người khác (admin, trưởng bộ phận, bộ phận khác) | Vẫn nhận **404**, không phải 409. Kiểm tra quyền sở hữu chạy **trước** kiểm tra "đã đạt", nên không lộ trạng thái học của người khác |
| Đồng thời | Kiểm tra chạy dưới khóa hàng `course_assignments` mà mọi lần nộp đều lấy. `uq_open_attempt` bảo đảm mỗi assignment chỉ có tối đa một lần làm đang mở |
| Hiệu năng | Thêm một truy vấn `EXISTS` trên `quiz_attempts(assignment_id)` khi nộp; không đáng kể |
| Triển khai | Image API mới **bắt buộc** DB ở 008 mới báo sẵn sàng. Image cũ đòi 007, nên phải chạy migration cùng đợt triển khai |

## 4. Kiểm thử

| Kiểm thử | Kết quả |
|---|---|
| **RED** (DB 007): `test_stale_attempt_cannot_be_submitted_after_pass_and_history_is_kept` | FAIL như mong đợi: API trả 200 (tái hiện lỗi) |
| **GREEN** (DB 008): 3 test mới | PASS |
| **Bảo mật:** `test_stale_attempt_check_does_not_reveal_status_to_other_users` (admin, head, other → 404; lần làm vẫn chưa nộp) | PASS |
| **Hồi quy:** `test_failed_only_history_still_allows_submitting_an_open_attempt` cùng các test DATA-39 hiện có | PASS |
| **Lịch sử bất biến:** trước/sau khi nộp bị chặn, điểm, `completed_at`, số câu trả lời và số audit `QUIZ_SUBMITTED` giống hệt nhau | PASS |
| pytest toàn bộ trên PostgreSQL 16 sạch | **69/69 PASS** (`pytest.txt`) |
| ruff check/format · OpenAPI drift | PASS |
| CI (drill upgrade → downgrade base → upgrade; PostgreSQL 17; staging-acceptance) | Xem PR |

## 5. Rollback

1. `alembic downgrade 007` chạy `008_down.sql`, khôi phục hàm cũ. Đã thử: revision 007, hàm không còn kiểm tra, quyền giữ nguyên, test RED lại FAIL (`red-green-rollback.txt`).
2. Triển khai lại image API trước đó (đòi 007).
3. Không mất dữ liệu: migration không ghi dữ liệu, nên rollback cũng không cần khôi phục backup.

## 6. Việc còn lại

- Review PR; CI xanh.
- PO quyết định thời điểm đưa vào `main`: **sau** 9 bước hợp nhất. PR này dựa trên `feature/ui-approvals`; sau bước 9 thì đổi base sang `main`.
- Trên production (khi có): backup trước migration. Đề xuất **giữ** các lần làm còn mở trên dữ liệu thật như hiện trạng, vì chúng không nộp được nữa.
