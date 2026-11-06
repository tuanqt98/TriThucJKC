# UI-03 — Nội quy & danh sách tài liệu Tri Thức JKC

Ngày 06/11/2026. Nhánh `feature/ui-documents-fidelity`, kế thừa UI-02 tại `921d9f8`. Bản DEMO review: https://localhost:18444/documents (staging `jkc-staging-s1`).

**Đã triển khai giao diện Nội quy & Quy trình, kiểm thử local đạt. Đang chờ PO duyệt. Hai cột dữ liệu trong mockup (loại tài liệu, ngày hiệu lực) chưa có trong API nên UI ghi rõ là "chưa cung cấp", không hiển thị dữ liệu giả. Dừng ở UI-03, chưa làm UI-04.**

## Khảo sát và đối chiếu

Đã đọc AGENTS và Technical Design, đối chiếu `design/approved_screens/02_documents_library.png` (desktop và mobile), AppFrame/token của UI-02 và API hiện hành. Ảnh Before được chụp trước khi sửa, ở bốn viewport.

| Khu vực | Trước | Sau UI-03 |
|---|---|---|
| Tiêu đề | Banner chung kiểu Workspace, có liên kết biên soạn lẫn vào | Banner "Thư viện nội quy & quy trình", icon tài liệu, 3 nhãn tính năng, ảnh DEMO máy in từ UI-02; trên mobile chỉ còn tiêu đề và mô tả, giống mockup |
| Tổng quan | Không có | Card Tổng số, Chờ xác nhận, Đã xác nhận, Quá hạn; bấm vào card để lọc theo trạng thái đọc |
| Tab loại | Không có | Tab Tất cả (số lượng), Nội quy, Quy trình, An toàn, Biểu mẫu. Bốn tab sau bị khóa, có tooltip, vì API chưa có phân loại |
| Tìm kiếm và bộ lọc | Ô tìm theo tiêu đề và bộ lọc Công đoạn | Tìm theo tên/mã, không phân biệt dấu. Lọc theo Bộ phận, Phiên bản, Trạng thái ban hành, Xác nhận đọc, Yêu cầu đọc; có nút Xóa bộ lọc |
| Danh sách desktop | Bảng mã, tiêu đề, bộ phận, phiên bản | Bảng Mã, Tên, Bộ phận phụ trách, Phiên bản, Hiệu lực từ, Trạng thái (Đã ban hành + trạng thái đọc + hạn), nút Xem tài liệu; phân trang 5 dòng |
| Bắt buộc của tôi | Không có | Vòng tiến độ đã xác nhận/được giao, danh sách nhiệm vụ (chưa xác nhận xếp trước, theo hạn), nút "Xem tất cả" lọc theo nhiệm vụ được giao |
| Mobile | Card lớn có thumbnail, bộ lọc Công đoạn | Tiêu đề, tab, tìm kiếm, hai bộ lọc chính (Bộ phận, Xác nhận đọc) đúng như mockup. Ba bộ lọc còn lại nằm trong nút "Bộ lọc khác (n)" có `aria-expanded`. Card gọn gồm mã, tên, phiên bản·bộ phận, nhãn trạng thái, mũi tên; vùng chạm ≥ 44px |
| Tablet | Sidebar thu gọn kiểu UI-02 | Rail 80px của UI-02, tổng quan nằm ngang, bảng đầy đủ, panel bắt buộc hai cột. Mockup không có bản tablet nên đây là responsive suy rộng |

Dùng lại AppFrame (Sidebar, Header, bottom nav, menu mobile), Icon và token `--primary`, `--ink`, `--muted`, `--border` của UI-02. CSS mới nằm trong `documents-library.module.css`. **Không sửa file nào của Login (UI-01), AppFrame/Dashboard (UI-02), token toàn cục hay backend/DB/API.** Đã kiểm bằng `git diff 921d9f8` trên các đường dẫn đó: không có thay đổi.

## Dữ liệu, trạng thái và quyền

- `/documents`: tải toàn bộ danh sách trong phạm vi ACL theo trang 100. Bộ lọc chạy trên toàn bộ danh sách, không chỉ trên một trang. Nếu danh sách vượt 2.000 tài liệu hoặc thay đổi trong lúc tải thì báo lỗi thay vì hiện số sai (`documents-model.ts`).
- `/my/reading`: chỉ nhiệm vụ `is_current`, khớp cả `content_id` và `version_id` của phiên bản đã ban hành. Trạng thái đọc được tính như sau:
  - **Đã xác nhận**: có `acknowledged_at`.
  - **Quá hạn**: chưa xác nhận và `due_at` đã qua.
  - **Chờ xác nhận**: chưa xác nhận, chưa quá hạn.
  - **Không được giao**: không có nhiệm vụ.

  Danh sách chỉ lấy phiên bản `APPROVED` hiện hành (API lọc), nên mọi dòng đều mang nhãn **Đã ban hành**.
- Nhấn vào tài liệu chỉ mở `/documents/{id}`, không tự xác nhận đọc. Xác nhận vẫn qua luồng có version/audit của Sprint 1. Workflow HR ban hành, phiên bản, giao đọc và RBAC giữ nguyên.
- Đã kiểm ACL trên staging. TECH_ADMIN không có quyền vượt:

  | Tài khoản | Tài liệu thấy | Nhiệm vụ đọc |
  |---|---|---|
  | employee | 17 | 1 |
  | head | 17 | 0 |
  | other | 1 | 0 |
  | admin | 1 | 0 |

- Ô tìm ở header chuyển sang Kho tri thức (`/knowledge?q=`), giống hành vi UI-02.

### Trạng thái màn hình

| Trạng thái | Hiển thị |
|---|---|
| Loading | Khung skeleton, `role=status`, `aria-busy` |
| Empty | Hai trường hợp: "Chưa có tài liệu được quyền xem" và "Không tìm thấy kết quả phù hợp" (kèm nút xóa bộ lọc) |
| Error | `role=alert`, nút Thử lại, liên kết Về Trang chủ |
| Permission-denied (403) | Icon khóa, "Bạn không có quyền xem danh sách này" |
| 401 | Chuyển về `/login` |
| Lỗi riêng `/my/reading` | Danh sách vẫn tra cứu được; bộ lọc đọc bị khóa, số đếm hiện "—", có nút tải lại |

## Khoảng trống dữ liệu (cần PO/BE quyết định)

| Mockup | Hiện trạng | Đề xuất |
|---|---|---|
| Ngày "Hiệu lực từ" | Bảng `content_versions.effective_at` có cột này, nhưng `GET /documents` chưa trả về. UI ghi "— / Chưa cung cấp" | Task BE: thêm `effective_at` vào listing; UI chỉ cần nối trường này |
| Tab Nội quy chung / Quy trình / An toàn / Biểu mẫu | Bảng `contents.category_id` có cột này, nhưng API chưa trả về và seed chưa có danh mục. Bốn tab bị khóa | Chốt danh mục với JKC, thêm `category` vào API, rồi bật tab |
| Nhãn "Hiệu lực" | Chưa hiển thị vì `effective_at` có thể ở tương lai; dùng nhãn "Đã ban hành" để không khẳng định sai | Đổi thành "Hiệu lực"/"Sắp hiệu lực" khi API có ngày |
| Bộ lọc Công đoạn | Không có trong danh sách yêu cầu UI-03, nên chưa thêm | Có thể dùng `processId` sẵn có nếu PO muốn |
| Checkbox chọn nhiều, nút "Xác nhận đã đọc" ngay trên bảng | Không làm. Xác nhận phải gắn đúng phiên bản và thực hiện sau khi mở tài liệu | Giữ xác nhận ở trang chi tiết (UI-04) |
| Avatar ảnh, badge thông báo đỏ | Dùng avatar chữ cái, không làm badge giả (giữ như UI-02) | Chờ nguồn thông báo |

Tiêu đề và mã tài liệu trong ảnh là dữ liệu seed DEMO/UAT, không phải tài liệu vận hành thật.

## Screenshot và so sánh

Ảnh After là screenshot Chromium đúng kích thước viewport, tài khoản `employee`. Before chụp từ trang `/documents` trước UI-03. Ảnh `*-full.png` là toàn trang; thanh điều hướng cố định nằm ở vị trí viewport tại thời điểm chụp. Ảnh so sánh crop vùng ứng dụng của mockup và giữ nguyên tỷ lệ.

| Viewport | Before | After | Toàn trang sau | Mockup / Before / After |
|---|---|---|---|---|
| 1440×900 | [Trước](before-desktop.png) | [Sau](after-desktop.png) | [Đầy đủ](after-desktop-full.png) | [So sánh](comparison-desktop.png) |
| 768×1024 | [Trước](before-tablet.png) | [Sau](after-tablet.png) | [Đầy đủ](after-tablet-full.png) | [So sánh với mẫu desktop](comparison-tablet.png) |
| 390×844 | [Trước](before-mobile390.png) | [Sau](after-mobile390.png) | [Đầy đủ](after-mobile390-full.png) | [So sánh](comparison-mobile390.png) |
| 375×812 | [Trước](before-mobile375.png) | [Sau](after-mobile375.png) | [Đầy đủ](after-mobile375-full.png) | [So sánh](comparison-mobile375.png) |

Tái tạo: `UI_DEMO_PASSWORD=… node scripts/ui-documents/capture.cjs` rồi `python3 scripts/ui-documents/compare.py`.

## Kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| ESLint / TypeScript / Prettier / Next production build | **PASS** |
| Unit `documents-model` (trạng thái đọc, lọc, snapshot phân trang) | **8/8 PASS** (`node --test scripts/tests/documents-model.test.mjs`) |
| UI-03 Playwright, 4 viewport × 4 kịch bản | **16/16 PASS**, [JSON](test-results.json) |
| Regression UI-01 Login | **9/9 PASS**, [JSON](regression-ui01-login.json) |
| Regression UI-02 Dashboard | **16/16 PASS**, [JSON](regression-ui02-dashboard.json) |
| Compose web build + health | **PASS**; chỉ rebuild service web, không migrate/seed lại |

Các kịch bản UI-03 (`starter/apps/web/documents-tests/documents.spec.ts`):
1. Số tổng, Chờ xác nhận, Đã xác nhận và tiến độ bắt buộc khớp `/documents` và `/my/reading`. Không có lỗi JS. Không tràn ngang.
2. Tìm theo mã ra đúng 1 kết quả; từ khóa không tồn tại hiện trạng thái empty; xóa bộ lọc trả lại đủ danh sách. Số "Được giao" cộng "Không được giao" bằng tổng. Lọc phiên bản hoạt động. Trên mobile, nút "Bộ lọc khác" mở/đóng đúng; trên desktop nút này ẩn. Mở tài liệu đến đúng `/documents/{id}`.
3. Phân quyền: với employee, other và admin, số trên UI bằng số API trả theo ACL. Tập tài liệu của admin là tập con thực sự của employee (không bypass). Sau khi đăng xuất, vào `/documents` bị chuyển về `/login`.
4. Loading, empty, lỗi 500, 403 và lỗi riêng `/my/reading` (giả lập bằng route mock trên trình duyệt; backend không đổi).

Chạy lại: `cd starter/apps/web && UI_TEST_LOCAL_CA=true UI_DEMO_PASSWORD=… npx playwright test -c playwright.documents.config.ts`.

## Ghi chú môi trường

Staging local có chữ ký ClamAV quá 7 ngày, nên API báo chưa sẵn sàng (fail-closed, đúng thiết kế). Đã bật `deploy/compose.signature-updates.yml` cho máy local để cập nhật (daily 28175). Override này **chưa được IT nghiệm thu trên mạng JKC**, không áp dụng cho shared staging.

## Chưa làm / ngoài phạm vi

- Ngày hiệu lực và loại tài liệu (cần thay đổi API, xem mục Khoảng trống dữ liệu).
- Trang chi tiết tài liệu và xác nhận đọc theo mockup 03 (UI-04, chưa bắt đầu).
- Chưa kiểm thử trên điện thoại thật và chưa cài CA trên thiết bị (gate của IT).
