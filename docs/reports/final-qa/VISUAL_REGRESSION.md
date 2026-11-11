# Regression và kiểm tra hình ảnh (Visual QA)

**Snapshot:** `a5b8ee8` (cây = UI-09 `47597a6`), staging build từ snapshot.
- **Ảnh:** `scripts/final-qa/screens.cjs` chụp 12 màn × 4 viewport, đúng vai trò (trưởng bộ phận cho UI-09; nhân viên cho các màn khác), chỉ mở trang, không thao tác ghi.
- **Kiểm tra tự động mỗi ảnh** (`results/screens.json`): mã HTTP, tràn ngang, đúng một `h1`, ô nhập có nhãn, ảnh có `alt`, lỗi JS, số phần tử bấm được nhỏ.
- **Thao tác chính** (modal, bottom sheet, tab, lọc, phân trang, quay lại): nằm trong các bộ Playwright UI-01 → UI-09, cũng chạy 4 viewport (UI-01: 3).

## Bảng PASS/FAIL

| Màn | Playwright | Desktop 1440×900 | Tablet 768×1024 | Mobile 390×844 | Mobile 375×812 |
|---|---|---|---|---|---|
| UI-01 Đăng nhập | 9/9 | PASS [ảnh](screens/ui01-login-desktop.png) · [toàn trang](screens/ui01-login-desktop-full.png) | PASS [ảnh](screens/ui01-login-tablet.png) · [toàn trang](screens/ui01-login-tablet-full.png) | PASS [ảnh](screens/ui01-login-mobile390.png) · [toàn trang](screens/ui01-login-mobile390-full.png) | PASS [ảnh](screens/ui01-login-mobile375.png) · [toàn trang](screens/ui01-login-mobile375-full.png) |
| UI-02 Trang chủ | 16/16 | PASS [ảnh](screens/ui02-dashboard-desktop.png) · [toàn trang](screens/ui02-dashboard-desktop-full.png) | PASS [ảnh](screens/ui02-dashboard-tablet.png) · [toàn trang](screens/ui02-dashboard-tablet-full.png) | PASS [ảnh](screens/ui02-dashboard-mobile390.png) · [toàn trang](screens/ui02-dashboard-mobile390-full.png) | PASS [ảnh](screens/ui02-dashboard-mobile375.png) · [toàn trang](screens/ui02-dashboard-mobile375-full.png) |
| UI-03 Nội quy | 16/16 | PASS [ảnh](screens/ui03-documents-desktop.png) · [toàn trang](screens/ui03-documents-desktop-full.png) | PASS [ảnh](screens/ui03-documents-tablet.png) · [toàn trang](screens/ui03-documents-tablet-full.png) | PASS [ảnh](screens/ui03-documents-mobile390.png) · [toàn trang](screens/ui03-documents-mobile390-full.png) | PASS [ảnh](screens/ui03-documents-mobile375.png) · [toàn trang](screens/ui03-documents-mobile375-full.png) |
| UI-04 Chi tiết nội quy | 16/16 | PASS [ảnh](screens/ui04-document-detail-desktop.png) · [toàn trang](screens/ui04-document-detail-desktop-full.png) | PASS [ảnh](screens/ui04-document-detail-tablet.png) · [toàn trang](screens/ui04-document-detail-tablet-full.png) | PASS [ảnh](screens/ui04-document-detail-mobile390.png) · [toàn trang](screens/ui04-document-detail-mobile390-full.png) | PASS [ảnh](screens/ui04-document-detail-mobile375.png) · [toàn trang](screens/ui04-document-detail-mobile375-full.png) |
| UI-05 Kho tri thức | 20/20 | PASS [ảnh](screens/ui05-knowledge-desktop.png) · [toàn trang](screens/ui05-knowledge-desktop-full.png) | PASS [ảnh](screens/ui05-knowledge-tablet.png) · [toàn trang](screens/ui05-knowledge-tablet-full.png) | PASS [ảnh](screens/ui05-knowledge-mobile390.png) · [toàn trang](screens/ui05-knowledge-mobile390-full.png) | PASS [ảnh](screens/ui05-knowledge-mobile375.png) · [toàn trang](screens/ui05-knowledge-mobile375-full.png) |
| UI-05B Chi tiết bài | 16/16 | PASS [ảnh](screens/ui05b-knowledge-detail-desktop.png) · [toàn trang](screens/ui05b-knowledge-detail-desktop-full.png) | PASS [ảnh](screens/ui05b-knowledge-detail-tablet.png) · [toàn trang](screens/ui05b-knowledge-detail-tablet-full.png) | PASS [ảnh](screens/ui05b-knowledge-detail-mobile390.png) · [toàn trang](screens/ui05b-knowledge-detail-mobile390-full.png) | PASS [ảnh](screens/ui05b-knowledge-detail-mobile375.png) · [toàn trang](screens/ui05b-knowledge-detail-mobile375-full.png) |
| UI-06 Sự cố | 16/16 | PASS [ảnh](screens/ui06-incident-detail-desktop.png) · [toàn trang](screens/ui06-incident-detail-desktop-full.png) | PASS [ảnh](screens/ui06-incident-detail-tablet.png) · [toàn trang](screens/ui06-incident-detail-tablet-full.png) | PASS [ảnh](screens/ui06-incident-detail-mobile390.png) · [toàn trang](screens/ui06-incident-detail-mobile390-full.png) | PASS [ảnh](screens/ui06-incident-detail-mobile375.png) · [toàn trang](screens/ui06-incident-detail-mobile375-full.png) |
| UI-07 Tạo bài | 24/24 | PASS [ảnh](screens/ui07-knowledge-create-desktop.png) · [toàn trang](screens/ui07-knowledge-create-desktop-full.png) | PASS [ảnh](screens/ui07-knowledge-create-tablet.png) · [toàn trang](screens/ui07-knowledge-create-tablet-full.png) | PASS [ảnh](screens/ui07-knowledge-create-mobile390.png) · [toàn trang](screens/ui07-knowledge-create-mobile390-full.png) | PASS [ảnh](screens/ui07-knowledge-create-mobile375.png) · [toàn trang](screens/ui07-knowledge-create-mobile375-full.png) |
| UI-07 Bài viết của tôi | 24/24 | PASS [ảnh](screens/ui07-my-articles-desktop.png) · [toàn trang](screens/ui07-my-articles-desktop-full.png) | PASS [ảnh](screens/ui07-my-articles-tablet.png) · [toàn trang](screens/ui07-my-articles-tablet-full.png) | PASS [ảnh](screens/ui07-my-articles-mobile390.png) · [toàn trang](screens/ui07-my-articles-mobile390-full.png) | PASS [ảnh](screens/ui07-my-articles-mobile375.png) · [toàn trang](screens/ui07-my-articles-mobile375-full.png) |
| UI-08 Khóa học của tôi | 16/16 | PASS [ảnh](screens/ui08-my-courses-desktop.png) · [toàn trang](screens/ui08-my-courses-desktop-full.png) | PASS [ảnh](screens/ui08-my-courses-tablet.png) · [toàn trang](screens/ui08-my-courses-tablet-full.png) | PASS [ảnh](screens/ui08-my-courses-mobile390.png) · [toàn trang](screens/ui08-my-courses-mobile390-full.png) | PASS [ảnh](screens/ui08-my-courses-mobile375.png) · [toàn trang](screens/ui08-my-courses-mobile375-full.png) |
| UI-08 Học khóa học | 16/16 | PASS [ảnh](screens/ui08-course-desktop.png) · [toàn trang](screens/ui08-course-desktop-full.png) | PASS [ảnh](screens/ui08-course-tablet.png) · [toàn trang](screens/ui08-course-tablet-full.png) | PASS [ảnh](screens/ui08-course-mobile390.png) · [toàn trang](screens/ui08-course-mobile390-full.png) | PASS [ảnh](screens/ui08-course-mobile375.png) · [toàn trang](screens/ui08-course-mobile375-full.png) |
| UI-09 Phê duyệt | 16/16 | PASS [ảnh](screens/ui09-approvals-desktop.png) · [toàn trang](screens/ui09-approvals-desktop-full.png) | PASS [ảnh](screens/ui09-approvals-tablet.png) · [toàn trang](screens/ui09-approvals-tablet-full.png) | PASS [ảnh](screens/ui09-approvals-mobile390.png) · [toàn trang](screens/ui09-approvals-mobile390-full.png) | PASS [ảnh](screens/ui09-approvals-mobile375.png) · [toàn trang](screens/ui09-approvals-mobile375-full.png) |

**Tổng:** 48/48 ảnh PASS (không tràn ngang, 1 `h1`, ô nhập có nhãn, ảnh có `alt`, HTTP 200, 0 lỗi JS) · Playwright **165/165** · `smoke`+`sprint1` 10/10 · `sprint01` 2/2.

**Thao tác giao diện được Playwright kiểm** (tất cả PASS):
- **bottom sheet/modal:** bảng lọc mobile UI-05, bottom sheet UI-09 (Esc đóng, nút trong màn hình), phóng to ảnh UI-06 (Esc, focus nút Đóng);
- **tab:** tab mobile UI-04, UI-05B, UI-07; accordion UI-06;
- **thanh thao tác cố định:** UI-04, UI-07, UI-09;
- **điều hướng:** quay lại giữ trạng thái UI-05/05B/06; header ẩn ô tìm trên `/knowledge` mobile (UI-05).

## Phát hiện

| ID | Mức | Phát hiện | Bằng chứng | Phương án | Trạng thái |
|---|---|---|---|---|---|
| VQ-1 | P2 | UI-03 mobile: chip danh mục (Tất cả, Nội quy, Quy trình, An toàn, Biểu mẫu) cao **36px**, dưới chuẩn 44px | Đo trên mobile 390: `68x36` | Tăng `min-height` lên 44px (đổi UI-03 đã duyệt, cần PO cho phép) | Mở, chờ PO |
| VQ-2 | P2 | Breadcrumb quay lại ("← Nội quy", "← Kho tri thức", "← Khóa học của tôi") cao **32px** ở UI-04, 05B, 06, 08 | Đo: `66x32` | Tăng vùng chạm lên 44px (không đổi hình) | Mở, chờ PO |
| VQ-3 | P2 | Header có các tiêu đề HTTP bị lặp (`x-frame-options`, `x-content-type-options`, `referrer-policy`) do cả Caddy và Next cùng đặt | `curl -D -` trên `/login` | Đặt ở một nơi (proxy) | Mở |
| VQ-4 | — | Không có màn nào tràn ngang hay lỗi JS ở 4 viewport | `results/screens.json` | — | Đóng |

Kiểm tra trợ năng ở đây là kiểm tra tự động cơ bản. **Chưa** đánh giá bằng trình đọc màn hình thật hay đo tương phản (P2, đề xuất trước go-live).
