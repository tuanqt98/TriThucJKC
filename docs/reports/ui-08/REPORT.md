# UI-08 — Đào tạo / Khóa học của tôi

Ngày 11/11/2026. Nhánh `feature/ui-my-courses`, tách từ `feature/ui-knowledge-create` tại `5a3af00` (UI-07 đã duyệt). Mockup: `design/approved_screens/07_my_courses.png`.

**Trạng thái:**
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

**Phát hiện nghiệp vụ cần PO chốt (DATA-39, P1):** API vẫn cho **mở lần làm mới sau khi đã đạt** (nếu còn lượt). UI-08 không hiện nút làm bài khi đã đạt, nhưng backend chưa chặn. Có hai hướng:
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
