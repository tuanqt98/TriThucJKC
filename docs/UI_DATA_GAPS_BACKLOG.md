# Backlog thiếu hụt dữ liệu API cho UI Nội quy (UI-03, UI-04)

Ngày 07/11/2026. Nguồn: [báo cáo UI-03](reports/ui-03/REPORT.md), [báo cáo UI-04](reports/ui-04/REPORT.md).

Mục đích: liệt kê các trường mà mockup đã duyệt (02, 03) cần hiển thị nhưng API hiện chưa trả về. UI hiện ghi rõ "Chưa cung cấp" thay vì hiển thị dữ liệu giả.

**Chưa task nào dưới đây được triển khai.** Trong UI-03/UI-04 không đổi API, schema, nghiệp vụ hay giao diện đã duyệt. Mỗi mục cần PO chốt trước khi BE làm. Thứ tự ưu tiên chỉ là đề xuất.

## Quy ước

- Mọi trường mới đi qua ACL hiện hành (`READ_ACL`, RLS). TECH_ADMIN không có quyền vượt.
- Chỉ bổ sung trường hoặc endpoint đọc; không đổi logic ban hành, giao đọc hay ACK.
- Mỗi task kèm migration có downgrade, cập nhật `api/openapi.yaml` và test quyền.

## Danh sách

| ID | Đề xuất ưu tiên | Thiếu hụt | Hiện trạng | Đề xuất kỹ thuật | Cần PO/JKC chốt |
|---|---|---|---|---|---|
| DATA-01 | P1 | **Ngày hiệu lực** (danh sách UI-03, chi tiết UI-04) | Có cột `content_versions.effective_at` nhưng `GET /documents` và `GET /documents/{id}` không trả về. Seed DEMO chưa có giá trị | Thêm `effective_at` vào `ContentView`; seed DEMO có ngày | Quy tắc "hiệu lực" so với "đã ban hành": có cho phép hiệu lực ở tương lai không, và khi đó ACK bị chặn (DB đã chặn khi `effective_at > now()`) |
| DATA-02 | P1 | **Ngày ban hành** (UI-04) | Có cột `content_versions.approved_at` nhưng API không trả về | Thêm `approved_at` vào `ContentView` | Không |
| DATA-03 | P1 | **Loại tài liệu** (tab Nội quy chung / Quy trình / An toàn / Biểu mẫu ở UI-03) | Có cột `contents.category_id` nhưng API không trả về; seed chưa có danh mục. Tab đang bị khóa | Seed danh mục, trả `category` trong listing và detail, thêm tham số lọc `categoryId` | Danh sách danh mục chính thức của JKC |
| DATA-04 | P1 | **Thứ tự mục nội dung (`sort_order`)** | `body` lưu dạng `jsonb` object, PostgreSQL không giữ thứ tự khóa. UI-04 tạm sắp theo số đầu tiêu đề ("1. Mục đích"); tài liệu cũ không đánh số thì giữ thứ tự API trả về | Phương án A: body dạng mảng `[{title, text, sort_order}]`, có migration chuyển dữ liệu. Phương án B: thêm `section_order text[]` vào phiên bản. Cả hai cần trình biên soạn hỗ trợ sắp xếp | Chọn phương án; trong thời gian chờ, quy ước đánh số tiêu đề mục cho người biên soạn |
| DATA-05 | P1 | **Lịch sử phiên bản đầy đủ** (UI-04) | Nhân viên chỉ thấy bản hiện hành và các bản mình được giao | `GET /documents/{id}/versions`: chỉ bản `APPROVED`, theo ACL; trả `version_number`, `approved_at`, `effective_at`, ghi chú thay đổi | Có cần "ghi chú thay đổi" bắt buộc khi ban hành không |
| DATA-06 | P2 | **Chủ sở hữu, bộ phận áp dụng** (UI-04) | Chỉ có `owner_department` (đang hiện là "Bộ phận phụ trách"). Mockup có "Chủ sở hữu: HCNS" và "Áp dụng: Toàn xưởng in" | Thêm trường phạm vi áp dụng; xác định chủ sở hữu là bộ phận hay vai trò HR | Mô hình chủ sở hữu và phạm vi áp dụng |
| DATA-07 | P2 | **Mô tả ngắn, thẻ liên quan** (UI-04) | Không có trong schema | Thêm `summary` và bảng thẻ | Có cần thẻ không, ai quản lý danh mục thẻ |
| DATA-08 | P2 | **Tài liệu liên quan** (UI-04) | Không có quan hệ giữa các tài liệu | Bảng quan hệ `content_relations`, lọc theo ACL người xem | Có trong phạm vi MVP không |
| DATA-09 | P3 | **"Tải tất cả" tệp đính kèm** (UI-04) | Chỉ tải được từng tệp | Endpoint tạo gói ZIP theo ACL, kiểm tra lại trạng thái quét của từng tệp | Có cần không, vì đa số tài liệu ít tệp |
| DATA-10 | P3 | **Kiểu mục "Lưu ý an toàn"** (khung cảnh báo vàng trong mockup) | Body là text tự do | Gắn thuộc tính `kind: "warning"` cho mục (đi cùng DATA-04) | Có cần không |

## Liên quan UI (không phải API)

- Header mobile của trang chi tiết: mockup có nút quay lại + tìm kiếm; UI-04 giữ header UI-02 đã duyệt và đặt nút quay lại ở breadcrumb. PO quyết định có làm header riêng hay không.
- Khi DATA-01/02/03 xong, UI-03/UI-04 chỉ cần nối trường. Nhãn "Đã ban hành" có thể tách thành "Hiệu lực" và "Sắp hiệu lực".
