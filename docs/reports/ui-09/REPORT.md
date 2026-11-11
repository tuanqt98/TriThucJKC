# UI-09 — Phê duyệt nội dung

Ngày 11/11/2026. Nhánh `feature/ui-approvals`, tách từ `feature/ui-my-courses` tại `6fabca0`. UI-08 được PO duyệt tại commit này; snapshot khóa bằng tag `ui-08-approved`, CI xanh (run 42948701767 và 42948707168). Mockup: `design/approved_screens/08_approvals.png`.

**Trạng thái:**
- Đã triển khai `/approvals` theo mockup 08 trên desktop, tablet và mobile; kiểm thử local đạt.
- Không đổi API, database, auth, RBAC, RLS hay workflow phê duyệt.
- Chưa merge. Chưa deploy.

**Trước UI-09:** commit đầu nhánh ghi **DATA-39B** vào backlog là **điều kiện bắt buộc trước production**: chặn *nộp* lần làm cũ sau khi đã đạt. Chưa sửa DB hay migration, theo yêu cầu PO.

## 1. Khảo sát

**Mockup 08** gồm:
- tiêu đề và cảnh báo "Không tự duyệt nội dung do chính mình tạo";
- thẻ thống kê: Chờ duyệt, Yêu cầu chỉnh sửa, Đã duyệt hôm nay;
- bộ lọc: loại, bộ phận, mức ưu tiên, tìm kiếm;
- bảng: mã, loại, tiêu đề, bộ phận, người gửi, ngày gửi, trạng thái;
- khung chi tiết: người gửi, bộ phận, ngày, mức ưu tiên, từ khóa; tab Nội dung / Tệp / Lịch sử; ô nhận xét; nút Phê duyệt / Yêu cầu chỉnh sửa / Từ chối;
- mobile: danh sách thẻ và bottom sheet có 3 nút.

**API thực tế (đã đọc mã):**

| API | Khả năng | Giới hạn |
|---|---|---|
| `GET /workspace/contents` | Mục người dùng **được duyệt** (`can_review`, do `jkc_review`): trưởng bộ phận trong phạm vi duyệt **bài tri thức**, HR duyệt **tài liệu**. Có id nội dung/phiên bản, `revision`, nội dung, công đoạn, thời điểm tạo phiên bản | Không có tên người gửi, thời điểm gửi duyệt, mức ưu tiên |
| `POST /workspace/contents/{approve\|request-changes\|reject}` | Quyết định có kiểm `revision` (409 khi đã đổi). **Lý do bắt buộc** khi yêu cầu sửa hoặc từ chối. Không tự duyệt (`jkc_review` loại tác giả). Có audit và `approval_events` | — |
| `GET /workspace/people` | Tên người và bộ phận trong phạm vi người duyệt | — |
| `GET /approvals` (cũ) | Lịch sử duyệt bài tri thức, có tên tác giả và thời điểm gửi; **chỉ trưởng bộ phận** | Chỉ ARTICLE. RLS không cho người duyệt đọc phiên bản đã trả về hoặc từ chối nên chỉ thấy *đã duyệt* và *chờ duyệt*. Không có `decided_at`. API duyệt cũ chỉ có "phê duyệt" |
| `GET /content-versions/{id}/attachments` | Người duyệt được giao xem tệp của bản chờ duyệt | — |

**Before:**
- banner chung, link nội bộ;
- danh sách thẻ thô, có cả bài đã duyệt;
- chỉ có nút "Phê duyệt phiên bản này" (API cũ); yêu cầu sửa hoặc từ chối phải sang trang "Biên soạn";
- không có lọc, tìm hay thống kê.

## 2. Triển khai

- **Đầu trang:** tiêu đề, mô tả và khung cảnh báo đỏ "Không tự duyệt nội dung do chính mình tạo".
- **Thẻ thống kê** (bấm để chuyển tab):
  - **Chờ duyệt:** số mục máy chủ cho phép người này duyệt;
  - **Đã duyệt (bài tri thức trong phạm vi):** tổng thật từ `GET /approvals`, chỉ hiện với trưởng bộ phận.
- **Hàng đợi:**
  - chip loại **Tất cả / Tri thức / Tài liệu** có số đếm; lọc **bộ phận**; **tìm** tiêu đề và người gửi (không dấu); phân trang 10;
  - sắp **mới nhất trước** như mockup;
  - mỗi dòng có loại, tiêu đề, "Tạo phiên bản" + số phiên bản, bộ phận, người gửi, trạng thái;
  - **chỉ** gồm mục máy chủ đánh dấu `can_review`, đang `PENDING`, **không phải của chính người duyệt**.
- **Khung chi tiết** (desktop bên phải; tablet và mobile là **bottom sheet**, đóng bằng × hoặc Esc):
  - chip loại và trạng thái, tiêu đề; người gửi, bộ phận, công đoạn, phiên bản (ghi "bản sửa" khi > v1), thời điểm tạo phiên bản;
  - tab **Nội dung** (các mục theo thứ tự số) và **Tệp đính kèm** (tải từng tệp đã quét);
  - **Nhận xét** tối đa 4.000 ký tự (giới hạn máy chủ), bắt buộc khi Yêu cầu chỉnh sửa hoặc Từ chối (báo lỗi ngay tại ô, **không gửi request**);
  - nút **Phê duyệt / Yêu cầu chỉnh sửa / Từ chối** ≥ 44px; trên tablet và mobile ghim ở đáy màn hình. **Từ chối** có hộp xác nhận.
- **Sau quyết định:**
  - chỉ báo kết quả **khi máy chủ xác nhận**; mục rời hàng đợi và hàng đợi tải lại;
  - **409** (người khác đã xử lý hoặc tác giả vừa đổi) báo rõ và tải lại hàng đợi;
  - mất mạng báo "Quyết định chưa được ghi nhận";
  - khóa chống bấm trùng.
- **Tab "Đã duyệt":** 50 bài tri thức đã duyệt mới nhất trong phạm vi (chỉ đọc).
- **Trạng thái trang:**
  - đang tải; hàng đợi rỗng ("Không còn nội dung chờ duyệt"); không khớp bộ lọc; lỗi + Thử lại;
  - **không có quyền** (nhân viên): "Chỉ trưởng bộ phận … hoặc HR … mới có quyền duyệt";
  - **hết phiên** → `/login?reason=session-expired`.
- **Thay đổi code:**
  - mới `components/approvals.tsx`, `approvals.module.css`, `approvals-model.ts`;
  - `app/approvals/page.tsx` dùng component mới; không sửa file UI-01 → UI-08;
  - **Test cũ** `tests/smoke.spec.ts`: chỉ đổi selector (`.approval-row`, `.approval-preview`, `.error` → role, nút "Phê duyệt"); giữ mục đích (nhân viên bị chặn; trưởng bộ phận tìm, đọc, duyệt).

## 3. GAP so với mockup 08 — cần PO quyết định

| Mockup 08 | UI-09 | Backlog |
|---|---|---|
| Thẻ "Yêu cầu chỉnh sửa", "Đã duyệt hôm nay" | "Chờ duyệt" và "Đã duyệt (tổng trong phạm vi)" | DATA-42 (RLS ẩn bản trả về/từ chối với người duyệt; không có `decided_at`) |
| Cột "Ngày gửi" | "Tạo phiên bản" (thời điểm thật của phiên bản) | DATA-41 |
| Lọc mức ưu tiên; mức ưu tiên, từ khóa trong chi tiết | Không hiện | DATA-43 |
| Tab "Lịch sử" trong chi tiết | Không hiện | DATA-44 |
| Ô chọn nhiều dòng (duyệt hàng loạt) | Không có; duyệt từng bài | DATA-45 |
| Mã KB-023, DOC-011 | Không hiện mã kỹ thuật `S1-…` | DATA-46 |
| Chip "Sự cố" | Ẩn (chưa có workflow) | DATA-25 |
| "So với tuần trước" | Không có | DATA-42 |
| Bottom nav "Hỏi đáp" | Giữ bottom nav UI-02 | — |

## 4. Kiểm thử (staging HTTPS, sau khi build lại `web`)

| Kiểm tra | Kết quả |
|---|---|
| ESLint / TypeScript / Prettier / Next production build | PASS |
| Ruff, OpenAPI drift | PASS (API không đổi) |
| pytest backend, PostgreSQL 16 sạch | **66/66 PASS** |
| Unit test model | **50/50 PASS** (5 mới cho UI-09) |
| UI-09 Playwright (desktop, tablet, 390, 375 × 4 kịch bản) | **16/16 PASS**, [JSON](test-results.json) |
| Regression UI-01 / 02 / 03 / 04 / 05 / 05B / 06 / 07 / 08 | **9/9 · 16/16 · 16/16 · 16/16 · 20/20 · 16/16 · 16/16 · 24/24 · 16/16 PASS** ([JSON](regression-ui01-login.json) …) |
| E2E `smoke` + `sprint1` (đã cập nhật selector) | **10/10 PASS** |
| E2E `sprint01`, fixture DEMO mới `uat13` | **2/2 PASS** |

**Dữ liệu test:** tạo qua workflow thật (`approvals-tests/fixture.ts`): nhân viên soạn và gửi bài/tài liệu. Tài liệu do tài khoản HR tổng hợp duyệt; tài khoản này lấy từ `app.seed_uat` (fixture `uat12`).

**Kịch bản UI-09:**
1. **Hàng đợi:**
   - khung cảnh báo; số "Chờ duyệt" khớp API; mới nhất trước;
   - chi tiết có người gửi, bộ phận, công đoạn, phiên bản, nội dung, tệp (link tải);
   - 3 nút ≥ 44px;
   - **Phê duyệt** → thông báo từ máy chủ, mục rời hàng đợi; bài có trong `/articles/{id}` với người duyệt đúng; xuất hiện ở tab "Đã duyệt".
2. **Quyết định khác:**
   - Yêu cầu chỉnh sửa khi chưa nhập lý do → lỗi tại ô, **0 request**; có lý do → thành công;
   - Từ chối: hủy hộp xác nhận thì không gửi; đồng ý thì từ chối;
   - **xung đột** (bài đã được duyệt ở nơi khác) → thông báo, không báo thành công, hàng đợi tải lại;
   - tác giả thấy `CHANGES_REQUESTED` kèm đúng ý kiến, và `REJECTED`.
3. **Quyền:**
   - bài do trưởng bộ phận tự gửi **không vào hàng đợi** của chính họ; API duyệt trả 403/404;
   - trưởng bộ phận khác (`other`) không thấy bài của Sản xuất;
   - nhân viên → "Bạn không có quyền phê duyệt";
   - **HR** thấy và duyệt **tài liệu**, tài liệu được công bố (`/documents/{id}` 200); HR không có tab lịch sử bài tri thức.
4. **Trạng thái và bố cục:**
   - đang tải, rỗng, lỗi 500 + Thử lại;
   - bottom sheet (tablet/mobile): nút nằm trong màn hình, Esc đóng;
   - mất mạng khi duyệt → "chưa được ghi nhận", không báo thành công;
   - không tràn ngang; chip ≥ 40px; hết phiên → đăng nhập.

## 5. Ảnh Mockup / Before / After

Ảnh chụp thật trên staging, tài khoản `head`. Hàng đợi lọc theo mã của 3 nội dung DEMO (`scripts/ui-approvals/fixture.mjs`). Các thẻ thống kê là số thật của staging, gồm cả dữ liệu do test tạo.

| Viewport | Hàng đợi: Mockup / Before / After | Chi tiết đang mở | HR duyệt tài liệu | Nhân viên (không có quyền) |
|---|---|---|---|---|
| Desktop 1440×900 | [comparison-desktop](comparison-desktop.png) | [after-desktop-open](after-desktop-open.png) | [after-desktop-hr](after-desktop-hr.png) | [after-desktop-denied](after-desktop-denied.png) |
| Tablet 768×1024 | [comparison-tablet](comparison-tablet.png) | [after-tablet-open](after-tablet-open.png) | [after-tablet-hr](after-tablet-hr.png) | [after-tablet-denied](after-tablet-denied.png) |
| Mobile 390×844 | [comparison-mobile390](comparison-mobile390.png) | [after-mobile390-open](after-mobile390-open.png) | [after-mobile390-hr](after-mobile390-hr.png) | [after-mobile390-denied](after-mobile390-denied.png) |
| Mobile 375×812 | [comparison-mobile375](comparison-mobile375.png) | [after-mobile375-open](after-mobile375-open.png) | [after-mobile375-hr](after-mobile375-hr.png) | [after-mobile375-denied](after-mobile375-denied.png) |

**Tái tạo:**
```sh
UI_DEMO_PASSWORD=… node scripts/ui-approvals/fixture.mjs                      # → {token}
UI_DEMO_PASSWORD=… UI_CAPTURE_PHASE=after UI_CAPTURE_SEARCH=<token> node scripts/ui-approvals/capture.cjs
… UI_CAPTURE_OPEN=<token> UI_CAPTURE_SUFFIX=-open …                           # khung chi tiết / bottom sheet
… UI_CAPTURE_USER=<uat_hr…> UI_CAPTURE_OPEN=<token> UI_CAPTURE_SUFFIX=-hr …
python3 scripts/ui-approvals/compare.py
cd starter/apps/web && UI_TEST_LOCAL_CA=true UI_DEMO_PASSWORD=… UI_UAT_FIXTURES=../../../.local/uat12.json \
  npx playwright test -c playwright.approvals.config.ts
```

## 6. Chưa làm / ngoài phạm vi

- DATA-41 → DATA-46 (mục 3). **DATA-39B (P0, trước production)** vẫn mở.
- Trang "Biên soạn / phiên bản" (`/workspace`) và `/learning/manage` vẫn là giao diện cũ.
- Badge số thông báo ở header (UI-02) không đổi.
- Không merge PR #1–#6; không deploy.
