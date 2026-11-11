# UI-08 — Đào tạo / Khóa học của tôi

Ngày 11/11/2026. Nhánh `feature/ui-my-courses`, tách từ `feature/ui-knowledge-create` tại `5a3af00` (UI-07 đã duyệt). Mockup: `design/approved_screens/07_my_courses.png`.

**Trạng thái:**
- **Vòng 2 (11/11/2026):** làm DATA-39 theo quyết định PO (chặn mở lần làm mới sau khi đạt, ở backend); ảnh nghiệm thu cuối đủ 5 trạng thái × 4 viewport (mục 7–8). PO đã chấp thuận định hướng trình bày `/learning/[id]` theo hệ thiết kế, chưa nghiệm thu hình ảnh cuối.
- Đã triển khai `/learning` theo mockup 07 và làm lại `/learning/[id]` (học bài, làm kiểm tra) theo hệ thiết kế đã duyệt; kiểm thử local đạt.
- Không đổi API, database, auth, RBAC, RLS, dữ liệu hay workflow đào tạo.
- Mockup 07 chỉ có màn danh sách. **Trang học khóa học `/learning/[id]` không có mockup riêng**: giữ nguyên chức năng và nhãn nút của trang cũ, chỉ trình bày lại theo hệ thiết kế UI-02 → UI-07. Cần PO xem kỹ phần này (mục 5).
- Chưa merge. Chưa làm UI-09.

## 1. Khảo sát

**Route có sẵn:** `/learning` (danh sách), `/learning/[id]` (học, id là **assignment**), `/learning/manage` (quản lý đào tạo, ngoài phạm vi). Không tạo route mới.

**API (đã đọc mã nguồn):**

| API | Dữ liệu / ràng buộc |
|---|---|
| `GET /my/learning` | Chỉ khóa **được giao cho chính tài khoản** và phiên bản đã duyệt: tiêu đề, phiên bản, hạn (`due_at`), ngày hoàn thành, `status`, số bài học đã xong / tổng |
| `jkc_training_status` (DB) | `COMPLETED` nếu có `completed_at`; nếu không, `OVERDUE` khi quá hạn; `FAILED` khi đã nộp đủ số lần tối đa; `IN_PROGRESS` khi đã có tiến độ hoặc lần làm; còn lại `NOT_STARTED` |
| `GET /my/learning/{id}` | Bài học (nội dung văn bản), câu hỏi và lựa chọn **không có đáp án**, điểm đạt, số lần tối đa, lịch sử lần làm. Không phải khóa của mình → 404 |
| `POST /my/learning/{id}/lessons/{lesson}/complete` | Ghi nhận hoàn thành bài học, có audit |
| `POST /my/learning/{id}/quiz-attempts` | Mở lần làm. Chặn khi chưa xong bài học, hết lượt, hoặc chưa có bài kiểm tra; trả lại lần đang mở nếu có |
| `POST /quiz-attempts/{id}/submit` | **Chấm trong DB** (`jkc_submit_quiz`) theo đáp án được bảo vệ, lưu lịch sử bất biến; đạt thì ghi `completed_at` |
| Biên soạn khóa học (`/workspace/courses`) | Tác giả tạo/lưu/gửi; trưởng bộ phận (không phải tác giả) duyệt và giao (kèm hạn). Chỉ dùng để tạo dữ liệu kiểm thử |

**Trang cũ (Before):**
- `/learning`: banner chung, link nội bộ, thẻ khóa đơn giản, thanh tiến độ mảnh, không có thống kê, lọc hay tìm.
- `/learning/[id]`: các panel thô, dùng class CSS chung.

## 2. Triển khai

### `/learning` — Khóa học của tôi (theo mockup 07)
- **Banner** "Học hôm nay vững tay nghề, in chất lượng hơn!" kèm ảnh minh họa DEMO của UI-02 (trang trí, không phải dữ liệu).
- **4 thẻ thống kê** Chưa bắt đầu / Đang học / Hoàn thành / Quá hạn; số đếm theo `status` của backend; bấm thẻ để lọc.
- **Tab** Được giao (tất cả) / Chưa bắt đầu / Đang học / Hoàn thành / Quá hạn / Không đạt (chỉ hiện khi có), kèm số đếm. **Tìm theo tiêu đề** (không dấu). Bộ lọc lưu trên URL.
- **Thẻ khóa học:**
  - tiêu đề, nhãn trạng thái, phiên bản;
  - **Hạn** (đỏ khi quá hạn) và ngày hoàn thành;
  - **tiến độ = số bài học đã xong / tổng từ backend** (không có bài học thì không hiện %);
  - nút theo trạng thái: Bắt đầu học / Tiếp tục học / Xem lại khóa học / Xem kết quả.
- **Cột phải:**
  - **Hạn hoàn thành sắp tới:** 5 khóa chưa hoàn thành có hạn gần nhất, từ dữ liệu thật;
  - **Kết quả kiểm tra gần đây:** 5 lần nộp gần nhất, điểm do máy chủ chấm, Đạt/Chưa đạt.
- **Trạng thái trang:** đang tải, chưa được giao khóa nào, không khớp bộ lọc (kèm "Xóa bộ lọc"), lỗi + "Thử lại", **hết phiên** → `/login?reason=session-expired` (dùng thông báo của UI-01).

### `/learning/[id]` — Học khóa học (không có mockup riêng)
- Breadcrumb "← Khóa học của tôi".
- Khối tiêu đề: trạng thái, phiên bản, hạn, điểm đạt, số lần đã nộp / tối đa, bài học x/y, thanh tiến độ. Khi máy chủ đã ghi `completed_at`: "Đã hoàn thành khóa học này · ngày".
- **Bài học:** đánh số và có dấu tích khi xong; nội dung theo mục (dùng bộ phân tích UI-05B); nút "Tôi đã hoàn thành bài học này" → "Đã hoàn thành bài học".
- **Kiểm tra cuối khóa:**
  - điều kiện giống API (chưa xong bài học / hết lượt / đã đạt / chưa có bài kiểm tra);
  - "Bắt đầu kiểm tra" mở lần làm;
  - mỗi lựa chọn là một hàng ≥ 44px;
  - "Nộp bài kiểm tra" chỉ bật khi đã trả lời mọi câu;
  - kết quả hiển thị **đúng số máy chủ trả về** ("Đã nộp bài: 100/100 · Đạt (lần 1). Điểm do hệ thống chấm.").
  - **Không có đáp án nào ở giao diện hay trong dữ liệu gửi xuống** (test kiểm tra không có `is_correct`). **Không tự chấm, không tự đánh dấu hoàn thành.**
- **Lịch sử làm bài** (bảng): lần, điểm, ngưỡng, Đạt/Chưa đạt, thời gian.
- Khóa lại khi đang gửi (chống bấm trùng). Lỗi mạng báo "chưa được ghi nhận"; 409 tải lại dữ liệu; 404 "Không tìm thấy khóa học"; hết phiên chuyển về đăng nhập.

### Responsive
- Desktop: 2 cột.
- Tablet: 1 cột; thẻ thống kê 2×2; khung bên dưới 2 cột.
- Mobile: thẻ thống kê 2×2; tab cuộn ngang; thẻ khóa học có nút rộng; mọi vùng chạm ≥ 44px; không tràn ngang.
- Giữ AppFrame, Header, Sidebar, Bottom Navigation UI-02 (mục "Học tập" sáng).

### Thay đổi code
- **Mới:**
  - `components/my-courses.tsx` + `.module.css`;
  - `components/course-detail.tsx` + `.module.css`;
  - `components/learning-model.ts`;
  - `app/learning/page.tsx` (Suspense) và `app/learning/[id]/page.tsx` dùng component mới.
  - Component cũ `CoursePlayer` vẫn còn trong mã nhưng không còn được dùng ở route này.
- **Test cũ cập nhật selector** (giống UI-04/UI-07):
  - `tests/sprint01.spec.ts`: `.history-table` → bảng "Lịch sử làm bài", `.course-player` → `main`, thông báo trong `main`;
  - `tests/sprint1.spec.ts`: thẻ `article` + "Mở khóa học" → mục danh sách + "Bắt đầu học/Tiếp tục học".
  - Nhãn nút học và kiểm tra giữ nguyên.
- **Không đổi:** API, OpenAPI, DB, migration, auth, session, CSRF, RBAC, RLS, workflow đào tạo; UI-01 → UI-07.

## 3. GAP so với mockup 07 — cần PO quyết định

| Mockup 07 | UI-08 | Backlog |
|---|---|---|
| Mô tả, phòng phụ trách, thời lượng, Bắt buộc/Khuyến nghị, ảnh khóa học | Không hiện (chưa có dữ liệu); dùng icon khóa học thay ảnh | DATA-35 |
| Bộ lọc "Tất cả lĩnh vực" | Không hiện; có tìm theo tiêu đề và lọc trạng thái | DATA-35 |
| "Khóa đang học 4 · ↑1 so với tháng trước", "Hoàn thành tháng này" | 4 thẻ số theo trạng thái hiện tại (theo yêu cầu UI-08), không so sánh tháng | DATA-36 |
| Lịch học & nhắc việc (giờ học, buổi kiểm tra) | "Hạn hoàn thành sắp tới" từ hạn thật | DATA-37 |
| Kết quả kiểm tra gần đây | Có, từ lịch sử thật; đọc tối đa 30 khóa vì chưa có API riêng | DATA-34 |
| Học video, tài liệu | Bài học chỉ có văn bản | DATA-38 |
| Chứng nhận | Chưa có | DATA-40 |
| Bottom nav "Hỏi đáp" | Giữ bottom nav UI-02 | — |

**DATA-39 (P1) — đã xử lý ở vòng 2 (mục 7).** Ghi nhận ban đầu: API vẫn cho **mở lần làm mới sau khi đã đạt** (nếu còn lượt). UI-08 không hiện nút làm bài khi đã đạt, nhưng backend chưa chặn. Có hai hướng:
1. chặn ở backend;
2. cho làm lại để ôn, không ảnh hưởng hoàn thành.

**Ghi chú dữ liệu:** trạng thái "Không đạt" (đã hết lượt) không có thẻ thống kê riêng vì yêu cầu UI-08 chỉ có 4 thẻ; khóa "Không đạt" vẫn có tab riêng. Theo quy tắc backend, quá hạn được ưu tiên hơn không đạt.

## 4. Kiểm thử (staging HTTPS, sau khi build lại `web`)

| Kiểm tra | Kết quả |
|---|---|
| ESLint / TypeScript / Prettier / Next production build | PASS |
| Ruff check/format, OpenAPI drift | PASS (API không đổi) |
| pytest backend, PostgreSQL 16 sạch | **63/63 PASS** |
| Unit test model | **45/45 PASS** (6 mới cho UI-08) |
| UI-08 Playwright (desktop, tablet, 390, 375 × 4 kịch bản) | **16/16 PASS**, [JSON](test-results.json) |
| Regression UI-01 / 02 / 03 / 04 / 05 / 05B / 06 / 07 | **9/9 · 16/16 · 16/16 · 16/16 · 20/20 · 16/16 · 16/16 · 24/24 PASS** ([JSON](regression-ui01-login.json) …) |
| E2E `smoke` + `sprint1` (đã cập nhật selector) | **10/10 PASS** |
| E2E `sprint01`, fixture DEMO mới `uat10` | **2/2 PASS** |

**Dữ liệu test** (`my-courses-tests/fixture.ts`) tạo qua workflow thật: nhân viên soạn khóa, trưởng bộ phận duyệt và giao (có hạn, kể cả hạn đã qua), sau đó thao tác bằng API học viên để có đủ trạng thái. Không ghi DB trực tiếp.

**Kịch bản UI-08:**
1. **Danh sách:**
   - 4 thẻ thống kê khớp API;
   - tìm theo mã kiểm thử ra 5 khóa; mỗi khóa đúng trạng thái, `x/y bài học`, %, hạn và nút;
   - lọc "Quá hạn" và thẻ "Hoàn thành"; URL giữ sau khi reload;
   - "Hạn hoàn thành sắp tới" đúng 5 hạn gần nhất từ API;
   - "Kết quả kiểm tra gần đây" có 100/100 và "Chưa đạt";
   - không tràn ngang, không lỗi JS.
2. **Học:**
   - API chi tiết **không chứa `is_correct`**;
   - chưa xong bài học thì không làm bài được;
   - hoàn thành 2 bài, tiến độ 0 → 100;
   - "Nộp bài" chỉ bật khi đủ đáp án; lựa chọn cao ≥ 44px;
   - nộp đúng → "100/100 · Đạt", lịch sử, "Đã hoàn thành khóa học này", không còn nút làm bài; API báo COMPLETED;
   - khóa 1 lượt nộp sai → "Chưa đạt", "đã dùng hết số lần", API báo FAILED.
3. **Quyền và phiên:**
   - người khác mở khóa của nhân viên → "Không tìm thấy khóa học"; API mở lần làm trả 404; danh sách của họ không có khóa đó;
   - không có API sửa điểm/trạng thái (PUT/PATCH → 404/405);
   - khóa đã đạt không hiện nút làm bài;
   - hết phiên (401 giả lập) → `/login?reason=session-expired`; chưa đăng nhập → `/login`.
4. **Trạng thái:** đang tải, rỗng, lỗi 500 + Thử lại, lỗi mạng khi ghi nhận bài học (không báo thành công), khóa không tồn tại; link và tab ≥ 44px; không tràn ngang.

**Ghi chú khi phát triển:**
- Lúc đầu test giả định API chặn mở lần làm sau khi đạt; thực tế API cho phép, nên đã sửa test và ghi DATA-39.
- "Kết quả gần đây" ban đầu đọc 20 khóa theo hạn gần nhất nên bỏ sót khóa mới trên staging nhiều dữ liệu test; đã đổi cách chọn (nửa đã hoàn thành mới nhất, nửa khóa khác).
- Một test học bị bấm nút trong lúc đang gửi; đã sửa test chờ máy chủ xác nhận từng bài.

## 5. Ảnh Mockup / Before / After

Ảnh chụp thật trên staging bằng tài khoản `employee`. Danh sách lọc theo mã của 5 khóa DEMO (`scripts/ui-my-courses/fixture.mjs`).
- **Thẻ thống kê và các khung bên phải** là số liệu thật của tài khoản, gồm cả khóa do các bộ test tạo trước đó (nên số lớn).
- **Cột Mockup** là phần ứng dụng cắt từ mockup 07.

| Viewport | Danh sách: Mockup / Before / After | Học khóa học: Before / After (không có mockup) |
|---|---|---|
| Desktop 1440×900 | [comparison-desktop](comparison-desktop.png) · [after toàn trang](after-desktop-full.png) | [comparison-desktop-course](comparison-desktop-course.png) · [đã hoàn thành](after-desktop-course-done-full.png) |
| Tablet 768×1024 | [comparison-tablet](comparison-tablet.png) | [comparison-tablet-course](comparison-tablet-course.png) |
| Mobile 390×844 | [comparison-mobile390](comparison-mobile390.png) · [after toàn trang](after-mobile390-full.png) | [comparison-mobile390-course](comparison-mobile390-course.png) |
| Mobile 375×812 | [comparison-mobile375](comparison-mobile375.png) | [comparison-mobile375-course](comparison-mobile375-course.png) · [đã hoàn thành](after-mobile375-course-done-full.png) |

**Tái tạo:**
```sh
UI_DEMO_PASSWORD=… node scripts/ui-my-courses/fixture.mjs          # → {token, course, done}
UI_DEMO_PASSWORD=… UI_CAPTURE_PHASE=after UI_CAPTURE_PATH="/learning?q=<token>" node scripts/ui-my-courses/capture.cjs
… UI_CAPTURE_PATH="/learning/<course>" UI_CAPTURE_SUFFIX=-course …
… UI_CAPTURE_PATH="/learning/<done>" UI_CAPTURE_SUFFIX=-course-done …
python3 scripts/ui-my-courses/compare.py
cd starter/apps/web && UI_TEST_LOCAL_CA=true UI_DEMO_PASSWORD=… npx playwright test -c playwright.my-courses.config.ts
```

## 6. Chưa làm / ngoài phạm vi

- DATA-34 → DATA-40 (mục 3), trong đó DATA-39 cần PO chốt quy tắc.
- `/learning/manage` (quản lý đào tạo của trưởng bộ phận) vẫn là giao diện cũ.
- Chưa làm UI-09.

## 7. DATA-39 — Chặn mở lần làm bài mới sau khi đã đạt (PO quyết định 11/11/2026)

### 7.1 Kế hoạch và phạm vi (lập trước khi sửa)

**Quy tắc mới.** Khi một bài được giao đã **đạt** thì `POST /api/v1/my/learning/{id}/quiz-attempts` trả **409**, mã `QUIZ_ALREADY_PASSED`, thông báo tiếng Việt, và **không tạo bản ghi nào**. "Đạt" nghĩa là có lần nộp `passed = true` hoặc bài được giao đã có `completed_at`; theo DB, `completed_at` chỉ được ghi khi một lần nộp đạt.

**Giữ nguyên:**
- điểm, lịch sử các lần làm và `completed_at` (không sửa hay xóa dòng nào);
- quy tắc cũ: phải xong bài học, giới hạn số lần, chưa có bài kiểm tra → 409; còn lần đang mở → trả lại lần đó;
- khi **chưa đạt** (kể cả đã nộp trượt mà còn lượt), vẫn mở lần mới như trước.

**Phạm vi thay đổi:**

| Phần | Thay đổi |
|---|---|
| `starter/apps/api/app/learning.py` · `start_attempt` | Thêm **một kiểm tra** ngay sau `assignment(..., lock=True)`. Thứ tự: đã đạt → 409 `QUIZ_ALREADY_PASSED`, đặt **trước** bước trả lại lần đang mở. Ngoài ra không đổi gì |
| Database / migration | **Không.** Không đổi `jkc_submit_quiz`, `jkc_training_status`, RLS, quyền hay dữ liệu |
| OpenAPI | Không đổi hợp đồng (409 đã là phản hồi lỗi chung; mã lỗi là chuỗi tự do) |
| Web | Không cần sửa logic: UI-08 đã ẩn nút làm bài khi đã đạt; nếu vẫn nhận 409 thì hiện thông báo của máy chủ và tải lại |
| Test | Thêm pytest mới. **Sửa test cũ** `test_quiz_grades_server_history_and_limit`: test này đang khẳng định quy tắc cũ (lần 3 mở được sau khi đạt ở lần 2), nay tách thành (a) trượt → đạt → mở thêm bị 409, (b) giới hạn số lần kiểm bằng chuỗi trượt. Playwright UI-08: API mở lần mới sau khi đạt phải trả 409 |

**Đồng thời:** `start_attempt` khóa dòng `course_assignments` (`jkc_lock_assignment … FOR UPDATE`); `jkc_submit_quiz` cũng khóa đúng dòng đó. Vì vậy hai thao tác chạy tuần tự, và kiểm tra "đã đạt" luôn thấy kết quả nộp vừa xong, không có khe trống.

**Dữ liệu cũ:** trên staging có thể còn lần làm mở sau khi đã đạt (do test UI-08 trước đây tạo khi quy tắc cũ còn hiệu lực).
- Sau thay đổi, API mở lần làm sẽ trả 409 và không trả lại lần đó; UI không hiện.
- Nộp trực tiếp lần đó qua API vẫn chấm được (vì `jkc_submit_quiz` không đổi); kết quả và lịch sử cũ giữ nguyên, `completed_at` không đổi (`COALESCE`).
- Nếu PO muốn chặn cả ở DB thì cần migration 008 sửa `jkc_submit_quiz` (chưa làm, cần duyệt riêng).

**Hoàn tác:** revert commit; không có dữ liệu hay schema phải khôi phục.

### 7.2 Thực hiện

- **Code:** `app/learning.py` · `start_attempt`: sau khi khóa dòng bài được giao, nếu `completed_at` có giá trị hoặc đã có lần nộp `passed` thì trả `409 QUIZ_ALREADY_PASSED` ("Bạn đã đạt bài kiểm tra của khóa học này; không mở thêm lần làm bài."). Thêm 4 dòng, không đổi gì khác.
- **Không đổi:** DB, migration, `jkc_submit_quiz`, `jkc_training_status`, RLS, quyền, OpenAPI (drift check PASS), web (UI-08 vốn đã ẩn nút làm bài khi đã đạt).

### 7.3 Kiểm thử DATA-39

| Test | Nội dung | Kết quả |
|---|---|---|
| `test_quiz_grades_server_history_and_limit` (**sửa**) | Trượt → đạt; mở thêm → 409 `QUIZ_ALREADY_PASSED`; lịch sử còn đúng 2 lần, `completed_at` giữ; các kiểm tra cũ (điểm do server chấm, không gửi điểm từ client, payload sai → 422, nộp lại → 409, người khác → 404, lịch sử bất biến) giữ nguyên | PASS |
| `test_quiz_after_pass_is_blocked_and_history_is_kept` (**mới**) | Đạt ở lần 1; thử mở 2 lần → đều 409 có thông báo; danh sách lần làm, `completed_at`, trạng thái COMPLETED không đổi; DB chỉ có 1 dòng `quiz_attempts` | PASS |
| `test_failed_attempts_still_allow_retry_until_limit` (**mới**) | Chưa đạt thì vẫn mở được lần mới: trượt 3 lần → lần 4 → 409 `VERSION_CONFLICT` (giới hạn cũ), trạng thái FAILED | PASS |
| `test_passed_assignment_does_not_hand_out_a_leftover_open_attempt` (**mới**) | Dữ liệu cũ có lần làm mở sau khi đạt → API trả 409, không trả lại lần đó | PASS |
| Playwright UI-08 "quyền và phiên" | Khóa đã đạt: API mở lần mới → 409 `QUIZ_ALREADY_PASSED`; lịch sử 1 lần, đạt; giao diện không có nút làm bài | PASS (16/16) |

| Kiểm tra vòng 2 | Kết quả |
|---|---|
| Ruff check/format, OpenAPI drift | PASS |
| pytest backend, PostgreSQL 16 sạch | **66/66 PASS** (3 mới, 1 sửa) |
| Unit test model | **45/45 PASS** |
| ESLint / TypeScript / Prettier / Next build | PASS |
| UI-08 Playwright (4 viewport × 4 kịch bản) | **16/16 PASS** |
| Regression UI-01 / 02 / 03 / 04 / 05 / 05B / 06 / 07 | **9/9 · 16/16 · 16/16 · 16/16 · 20/20 · 16/16 · 16/16 · 24/24 PASS** (JSON `regression-*.json` cập nhật) |
| `smoke` + `sprint1` · `sprint01` (fixture mới `uat11`) | **10/10 · 2/2 PASS** |

## 8. Ảnh nghiệm thu cuối (PO yêu cầu 11/11/2026)

Dữ liệu: 6 khóa DEMO cho `employee` tạo qua workflow thật (`scripts/ui-my-courses/fixture.mjs`): chưa học, đang học (1/2 bài), **đang làm kiểm tra** (đã mở lần làm, chưa nộp), **đạt** (100/100), **không đạt** (0/100, hết 1 lượt) và quá hạn.

**Trang học `/learning/[id]`, 5 trạng thái** (Chưa học · Đang học · Đang làm kiểm tra · Đạt · Không đạt):

| Viewport | Bảng 5 trạng thái | Từng ảnh (toàn trang) |
|---|---|---|
| Desktop 1440×900 | [final-desktop-states](final-desktop-states.png) | [chưa học](final-desktop-not-started-full.png) · [đang học](final-desktop-in-progress-full.png) · [làm bài](final-desktop-quiz-full.png) · [đạt](final-desktop-passed-full.png) · [không đạt](final-desktop-failed-full.png) |
| Tablet 768×1024 | [final-tablet-states](final-tablet-states.png) | [chưa học](final-tablet-not-started-full.png) · [đang học](final-tablet-in-progress-full.png) · [làm bài](final-tablet-quiz-full.png) · [đạt](final-tablet-passed-full.png) · [không đạt](final-tablet-failed-full.png) |
| Mobile 390×844 | [final-mobile390-states](final-mobile390-states.png) | [chưa học](final-mobile390-not-started-full.png) · [đang học](final-mobile390-in-progress-full.png) · [làm bài](final-mobile390-quiz-full.png) · [đạt](final-mobile390-passed-full.png) · [không đạt](final-mobile390-failed-full.png) |
| Mobile 375×812 | [final-mobile375-states](final-mobile375-states.png) | [chưa học](final-mobile375-not-started-full.png) · [đang học](final-mobile375-in-progress-full.png) · [làm bài](final-mobile375-quiz-full.png) · [đạt](final-mobile375-passed-full.png) · [không đạt](final-mobile375-failed-full.png) |

**Danh sách `/learning`** (6 khóa DEMO, đủ trạng thái): [desktop](after-desktop-full.png) · [tablet](after-tablet-full.png) · [mobile 390](after-mobile390-full.png) · [mobile 375](after-mobile375-full.png); so với mockup 07: [comparison-desktop](comparison-desktop.png) · [comparison-mobile390](comparison-mobile390.png).
