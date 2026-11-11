# UI-02 — Layout chung và Dashboard Tri Thức JKC

Ngày 31/10/2026. Nhánh `feature/ui-dashboard-fidelity`, kế thừa UI-01 tại `738c2a0`. Bản DEMO review: https://localhost:18444/.

**Đã triển khai layout/Dashboard và pass kiểm thử local; chờ PO duyệt giao diện. Theo phản hồi người dùng, dùng ảnh AI/DEMO ngành in trong lúc chờ ảnh công ty; wordmark vector JKC và ảnh gốc đúng mockup vẫn còn thiếu. Không coi đây là bản nghiệm thu hình ảnh cuối hoặc triển khai production. Dừng tại UI-02.**

Bổ sung ảnh DEMO: 6 ảnh tạo bằng built-in image_gen, tổng WebP 879.700 bytes, dùng cho hero, năm danh mục và ba thumbnail (có tái sử dụng). [Danh mục, nguồn gốc và cách thay ảnh](DEMO_IMAGES.md); [prompt và checksum](image-prompts.json). Ảnh được gắn nhãn minh họa, không thay số liệu hoặc biến thành file đính kèm của bài viết. Đợt bổ sung ảnh đã chạy lại lint/typecheck/build và **16/16 test Dashboard PASS**, gồm HTTP 200/WebP cho cả sáu asset và ảnh render tải thành công ở bốn viewport; đã xem screenshot mới và cập nhật so sánh. 17 kết quả regression Login/smoke bên dưới giữ từ bản UI-02 trước thay ảnh, không ghi là vừa chạy lại trong đợt chỉ sửa ảnh này.

## Khảo sát và đối chiếu

Đã đọc AGENTS, START_HERE, Technical Design và đối chiếu `design/approved_screens/01_dashboard.png`, frontend Workspace, design tokens và API hiện hành. Chụp Dashboard DEMO trước khi sửa ở bốn viewport.

| Khu vực | Trước | Sau UI-02 |
|---|---|---|
| Sidebar desktop | Rộng 248px, khối thương hiệu cao, menu và khoảng cách khác mẫu | 224px, navy, wordmark JKC, trạng thái chọn, menu lọc quyền, khối giá trị màu CMYK; thu gọn 80px |
| Header | Tìm kiếm và tài khoản, thiếu thông báo | Tiêu đề, tìm kiếm, bell mở trạng thái thông báo, tên thật từ API và avatar chữ cái; mobile hai hàng gọn |
| Banner | Khối giới thiệu cao, icon home | Banner thấp hơn, lời chào hai dòng, biểu tượng màu và minh họa máy in; bố cục theo mẫu |
| Thống kê | Card cao, spacing lớn | Ba card tài liệu/khóa học/sự cố với icon màu và số từ API; không thêm số tăng/giảm theo tuần giả |
| Công đoạn | Cùng một icon printer và số thứ tự | Năm card pastel có ảnh DEMO theo nhóm máy/chế bản/bao bì, liên kết theo processId API |
| Việc cần làm | Tổng số khóa học và liên kết chung | Từng nhiệm vụ đọc đúng phiên bản, từng khóa chưa hoàn thành, phê duyệt đang chờ theo quyền; hạn từ API, quá hạn theo thời gian hiện tại |
| Tri thức | Card lớn, nhiều chi tiết thừa so với mẫu | Ba card desktop, danh sách ngang hình–chữ mobile; dữ liệu và phiên bản từ API, ngày tạo có nhãn rõ |
| Mobile | Thứ tự giống desktop, điều hướng khác mẫu | Logo/tìm kiếm/banner/4 shortcut/việc cần làm/tri thức; bottom nav 5 mục và menu mở rộng theo quyền |
| Tablet | Sidebar đầy đủ chiếm không gian | Rail icon 80px, nội dung một cột; không có mockup tablet riêng nên là phương án responsive suy rộng |

Tái sử dụng tokens `--navy`, `--ink`, `--primary`, `--surface`, `--border`, `--radius`, `--shadow` và Icon/component có sẵn. CSS mới nằm trong module của AppFrame/Dashboard. **Không sửa token toàn cục hoặc bất kỳ file Login UI-01 nào**; đã đối chiếu SHA-256 với base trong [verification.json](verification.json).

## Dữ liệu và giới hạn quyền

- `/auth/me`: tên người dùng, role/scope và avatar chữ cái; không dùng ảnh chân dung giả.
- `/dashboard`: các số thống kê, 5 công đoạn và bài nổi bật. Nhãn giữ đúng nghĩa API: “Tài liệu được xem”, “Khóa học được giao”, “Hồ sơ sự cố”; không đổi thành “mới tuần này”, “đang theo dõi” hoặc “chưa hoàn thành” khi API không trả số đó.
- `/my/reading`: chỉ nhiệm vụ chưa ACK và phiên bản hiện hành, liên kết đúng tài liệu; không tự xác nhận khi nhấn card.
- `/my/learning`: nhiệm vụ có `completed_at` trống, liên kết đúng assignment để học; không sửa lịch sử/điểm.
- `/approvals`: chỉ gọi khi có DEPARTMENT_HEAD kèm scope; lọc PENDING. Employee không thấy menu duyệt và API thật vẫn trả 403.
- `/documents?pageSize=3`: panel tài liệu được quyền xem thay cho luồng hoạt động chưa có API.
- Biên soạn/hồ sơ/quản lý đào tạo chỉ hiện trong menu khi có bộ phận, phù hợp điều kiện tạo nội dung hiện hành. Không tự giới hạn quyền biên soạn khóa học thành HR/head: workflow hiện tại cho phép nhân viên có bộ phận tạo bản nháp của mình. Quyền review/ban hành vẫn do API/DB kiểm tra.

Header/bottom nav mở panel “Thông báo” ghi rõ chưa kết nối nguồn dữ liệu; không tạo badge đỏ hay notification giả. Mục Hỏi đáp/Báo cáo/Quản trị chưa có route phù hợp nên không dựng link chết theo ảnh minh họa. Nút “Xem tất cả” mở rộng danh sách nhiệm vụ, có thu gọn; search và shortcut điều hướng tới các route đang hoạt động.

Khung mới được tái sử dụng bởi các trang dùng Workspace hiện có. Các màn hình biên soạn chuyên biệt độc lập vẫn giữ wrapper cũ ngoài phạm vi UI-02; chưa chuyển chúng sang thiết kế mới hay phát triển UI-03. Nội dung/logic các trang khác không được thiết kế lại.

## Screenshot và so sánh

Đã xem ảnh render cuối ở cả bốn kích thước. Ảnh After là screenshot Chromium đúng kích thước viewport. Before được crop phần đầu từ screenshot toàn trang thực tế đã lưu trước khi sửa; không dựng lại giao diện cũ. Bản `*-full.png` giữ toàn bộ nội dung để xem vùng cuộn; thanh điều hướng fixed trong ảnh toàn trang nằm ở vị trí viewport khi chụp.

| Viewport | Before | After | Toàn trang sau | Mockup / Before / After |
|---|---|---|---|---|
| 1440×900 | [Trước](before-desktop.png) | [Sau](after-desktop.png) | [Đầy đủ](after-desktop-full.png) | [So sánh](comparison-desktop.png) |
| 768×1024 | [Trước](before-tablet.png) | [Sau](after-tablet.png) | [Đầy đủ](after-tablet-full.png) | [So sánh với mẫu desktop](comparison-tablet.png) |
| 390×844 | [Trước](before-mobile390.png) | [Sau](after-mobile390.png) | [Đầy đủ](after-mobile390-full.png) | [So sánh](comparison-mobile390.png) |
| 375×812 | [Trước](before-mobile375.png) | [Sau](after-mobile375.png) | [Đầy đủ](after-mobile375-full.png) | [So sánh](comparison-mobile375.png) |

So sánh chỉ crop vùng ứng dụng trên board tham chiếu và giữ tỷ lệ ảnh, không bóp méo để tạo cảm giác khớp. Không dùng ảnh mockup làm giao diện.

## Kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| ESLint / TypeScript / Next production build | **PASS** |
| Compose build và health web | **PASS**; chỉ cập nhật service web, không migrate/seed/restart API hoặc DB |
| Dashboard, 4 viewport | **16 passed**, [JSON](test-results.json) |
| Regression UI-01 | **9 passed**, [JSON riêng](login-regression.json); không ghi đè bằng chứng UI-01 |
| Test Login cũ desktop/mobile | **2 passed**, [JSON](existing-login.json) |
| Smoke hiện có desktop/mobile | **6 passed**, [JSON](smoke-results.json) |
| Tổng | **33 passed, 0 failed/skipped** |

Dashboard test xác minh số liệu khớp API thật, số nhiệm vụ tính từ reading/learning, menu employee/head, API 403 thật, thu gọn sidebar, mở rộng nhiệm vụ, notification state, tìm kiếm rỗng, chọn công đoạn, không tràn ngang và thứ tự mobile. Các trường hợp 503/retry/empty/403 từng panel/401 redirect dùng interception để kiểm trạng thái UI, tách khỏi ca API thật. Smoke giữ nguyên test cũ: tra cứu/chuyển trang, đọc chi tiết, lưu nháp/gửi/duyệt, logout và chặn sau logout. Dữ liệu được tạo thêm chỉ là DEMO kiểm thử.

Đợt đầu 14/16 đạt; hai ca mobile phát hiện sidebar bị ẩn mà chưa có menu đầy đủ cho trưởng bộ phận. Đã bổ sung disclosure menu di động dùng cùng bộ lọc quyền, cập nhật ca kiểm tra và chạy lại đầy đủ đạt 16/16. Không xóa/nới test cũ để đạt PASS. Backend unit/integration/migration không chạy lại vì không có thay đổi backend/schema. Chưa chạy GitHub CI nhánh UI-02; không suy diễn PASS CI từ local. Browser test bỏ qua CA test cục bộ, không chứng minh TLS trust trên thiết bị thật.

## File bàn giao

- `components/app-frame.tsx`, `app-frame.module.css`: sidebar/header/mobile menu/bottom navigation, trạng thái thông báo và điều hướng theo role.
- `components/dashboard-fidelity.tsx`, `dashboard-fidelity.module.css`: banner, stats, tasks, process shortcuts, featured và tài liệu.
- `components/workspace.tsx`: tích hợp khung chung và Dashboard mới; giữ nguyên load/auth/mutation handlers của các luồng hiện có.
- `playwright.dashboard.config.ts`, `dashboard-tests/dashboard.spec.ts`: bộ UI-02 riêng bốn viewport; không làm thay đổi tập test CI hiện có.
- `scripts/ui-dashboard/capture.cjs`, `compare.py`: chụp thực tế và tạo so sánh.
- `scripts/ui-dashboard/encode-images.cjs`, `public/images/dashboard-demo/*.webp`: mã hóa và phục vụ ảnh DEMO tĩnh; prompt/checksum tại `image-prompts.json`.
- `docs/reports/ui-02/`: báo cáo, JSON, screenshot và chứng cứ phạm vi.

Các đường dẫn frontend ở trên nằm trong `starter/apps/web/`. Không thay đổi backend, OpenAPI, database, migrations, Compose, session/CSRF hay Odoo adapter. Asset người dùng mới `design/approved_screens/logo/logo1.webp` được giữ nguyên ngoài commit này; đó là ảnh nội thất, không tự thay vào Dashboard hoặc Login.

## Còn thiếu để PO chốt độ khớp hình ảnh

1. Chưa có ảnh hero máy in, ảnh danh mục và thumbnail gốc của mockup 01 trong repository. Đã thông báo thiếu asset; người dùng đồng ý bổ sung ảnh công ty sau và yêu cầu dùng ảnh DEMO trước. Hiện dùng ảnh AI/DEMO ngành in thay SVG, không lấy screenshot mockup làm ảnh app. Độ khớp ảnh gốc vẫn chờ PO review.
2. Wordmark JKC được dựng bằng chữ/CSS như cách biểu diễn của ứng dụng trước đó, chưa có vector/logo JKC nguồn đúng mockup. Không thay logo INNHATTHAN của Login và không lấy ảnh nội thất làm logo. Cần PO cung cấp/chốt asset thương hiệu cho layout.
3. Chưa có font nguồn riêng của mockup; giữ font hệ thống hiện có. Nét icon, ảnh, độ đậm và khoảng cách chưa phải pixel-identical.
4. Không có API hoạt động/notifications, lượt xem/bình luận, tăng trưởng tuần hoặc avatar ảnh. Các vùng tương ứng hiển thị dữ liệu hiện có/giới hạn rõ, không bịa các số 12/5/3, ngày tháng hoặc tên trong mẫu.
5. Shortcut QC trong mẫu mobile được thay bằng Nội quy vì hiện chưa có route QC riêng; đủ năm công đoạn có trong khối danh mục phía dưới và menu mobile bổ sung lối tới các chức năng được quyền dùng.
6. Cần PO review ảnh, tương phản/cảm ứng và thử iOS/Android thật. Các viewport và touch simulation không thay thế UAT thiết bị thật. Gate Sprint 0.1/production vẫn giữ kết luận trong báo cáo gốc.

**Bàn giao UI-02 để PO review. Không tự chuyển UI-03, không merge main và không triển khai production.**
