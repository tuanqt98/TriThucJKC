# Rà soát thiếu hụt dữ liệu / API (DATA-01 → DATA-46, DATA-39B)

Nguồn: `docs/UI_DATA_GAPS_BACKLOG.md` (bản đầy đủ có hiện trạng, đề xuất kỹ thuật và câu hỏi cho PO). Bảng dưới tổng hợp mức độ và trạng thái tại snapshot `a5b8ee8`.

| ID | Ưu tiên | Nội dung | Trạng thái |
|---|---|---|---|
| DATA-01 | P1 | Ngày hiệu lực (danh sách UI-03, chi tiết UI-04) | Mở |
| DATA-02 | P1 | Ngày ban hành (UI-04) | Mở |
| DATA-03 | P1 | Loại tài liệu (tab Nội quy chung / Quy trình / An toàn / Biểu mẫu ở UI-03) | Mở |
| DATA-04 | P1 | Thứ tự mục nội dung (`sort_order`) | Mở |
| DATA-05 | P1 | Lịch sử phiên bản đầy đủ (UI-04) | Mở |
| DATA-06 | P2 | Chủ sở hữu, bộ phận áp dụng (UI-04) | Mở |
| DATA-07 | P2 | Mô tả ngắn, thẻ liên quan (UI-04) | Mở |
| DATA-08 | P2 | Tài liệu liên quan (UI-04) | Mở |
| DATA-09 | P3 | "Tải tất cả" tệp đính kèm (UI-04) | Mở |
| DATA-10 | P3 | Kiểu mục "Lưu ý an toàn" (khung cảnh báo vàng trong mockup) | Mở |
| DATA-11 | — | Tìm kiếm không dấu | Xong |
| DATA-12 | — | Tìm trong nội dung | Xong |
| DATA-13 | P1 | Loại kiến thức (Kinh nghiệm / Hướng dẫn / Checklist / FAQ) | Mở |
| DATA-14 | P2 | Thiết bị / máy | Mở |
| DATA-15 | P2 | Thẻ từ khóa | Mở |
| DATA-16 | — | Người duyệt | Xong |
| DATA-17 | P3 | Lượt xem, bình luận, lưu bài (bookmark), "nổi bật tuần" | Mở |
| DATA-18 | P3 | Hỏi đáp ("Đặt câu hỏi" trong mockup) | Mở |
| DATA-19 | P3 | Ảnh đại diện bài viết | Mở |
| DATA-20 | P3 | Lọc phía server theo loại/bộ phận | Mở |
| DATA-21 | P2 | Index cho tìm kiếm | Mở |
| DATA-22 | P2 | Lịch sử phiên bản bài tri thức | Mở |
| DATA-23 | P2 | Ảnh gắn với từng mục nội dung | Mở |
| DATA-24 | P1 | Liên kết hướng dẫn ↔ hồ sơ sự cố (mức độ, người/ngày báo cáo, người/ngày xác min | Mở |
| DATA-25 | P1 | Biên soạn INCIDENT_GUIDE qua workflow | Mở |
| DATA-26 | P2 | "Tôi cũng gặp lỗi này" ngay trên hướng dẫn | Mở |
| DATA-27 | P2 | Máy/thiết bị, vật tư (Heidelberg SM74, Giấy Couche…) | Mở |
| DATA-28 | P3 | Trao đổi & xác minh (bình luận theo dòng thời gian) | Mở |
| DATA-29 | P3 | In phiếu xử lý, Báo lỗi mới (nút trong mockup) | Mở |
| DATA-30 | — | Tên bộ phận của người dùng | Đóng (PO) |
| DATA-31 | P1 (PO 11/11/2026) | Xóa tệp đã tải lên khỏi bản nháp (nút × trong mockup) | Mở |
| DATA-32 | P3 | Video MP4 (mockup ghi "JPG, PNG, MP4, PDF") | Mở |
| DATA-33 | — | Danh sách "Bài viết của tôi" | Xong |
| DATA-34 | P2 | Kết quả kiểm tra gần đây (khung trong mockup) | Mở |
| DATA-35 | P2 | Mô tả khóa học, bộ phận phụ trách, thời lượng, Bắt buộc/Khuyến nghị, ảnh, lĩnh v | Mở |
| DATA-36 | P3 | So sánh với tháng trước ("↑1 so với tháng trước"), "Hoàn thành tháng này" | Mở |
| DATA-37 | P3 | Lịch học & nhắc việc (giờ học, buổi kiểm tra) | Mở |
| DATA-38 | P2 | Tài liệu/video trong bài học | Mở |
| DATA-39 | — | Làm lại bài kiểm tra sau khi đã đạt | Xong |
| DATA-39B | P0 · BẮT BUỘC TRƯỚC PRODUCTION (PO 11/11/2026) | Chặn nộp lần làm cũ sau khi đã đạt | Mở |
| DATA-40 | P3 | Chứng nhận hoàn thành ("Xem điểm, tiến độ và chứng nhận") | Mở |
| DATA-41 | P1 (PO 11/11/2026) | Thời điểm gửi duyệt trong hàng đợi (mockup "Ngày gửi") | Mở |
| DATA-42 | P1 (PO 11/11/2026) | "Yêu cầu chỉnh sửa", "Đã duyệt hôm nay" (thẻ thống kê mockup) | Mở |
| DATA-43 | P2 (PO 11/11/2026) | Mức ưu tiên, từ khóa | Mở |
| DATA-44 | P1 (PO 11/11/2026) | Lịch sử duyệt / phiên bản (tab "Lịch sử" trong khung chi tiết) | Mở |
| DATA-45 | P2 (PO 11/11/2026) · chưa làm duyệt hàng loạt | Duyệt hàng loạt (ô chọn trong bảng mockup) | Mở |
| DATA-46 | P2 (PO 11/11/2026) | Mã nội dung nghiệp vụ (KB-023, DOC-011) | Mở |

## Tác động tới GO/NO-GO

- **Chặn production:** chỉ **DATA-39B (P0)**, xem `SECURITY_AND_PRODUCTION_GATES.md` G-1.
- **P1 nên có trước go-live diện rộng (không chặn kỹ thuật):**
  - DATA-41/42/44: hoàn thiện API và lịch sử phê duyệt;
  - DATA-31: xóa tệp khỏi bản nháp;
  - DATA-24/25: liên kết hướng dẫn với hồ sơ sự cố và biên soạn INCIDENT_GUIDE;
  - DATA-01…05: nội quy (hiệu lực, phạm vi, lịch sử phiên bản…) theo backlog UI-03/04.
- **P2/P3:** cải tiến; không ảnh hưởng an toàn dữ liệu.
- **Không có GAP nào bị lấp bằng dữ liệu giả:** mọi trường thiếu đều ẩn hoặc ghi rõ "chưa có" trên UI.
