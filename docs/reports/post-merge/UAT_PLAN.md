# Kế hoạch kiểm thử và nghiệm thu thực tế (UAT)

Dành cho PO, HR, trưởng bộ phận và IT.

**Mục tiêu:** người dùng thật xác nhận hệ thống dùng được trong công việc hằng ngày ở 3 module ưu tiên (**Nội quy**, **Sự cố/Tri thức**, **Đào tạo**), trên thiết bị thật tại xưởng, kèm **biên bản ký nhận**. Đóng gate G-8.

Kế hoạch này **không** thay thế các gate hạ tầng G-3/G-4 (`IT_CHECKLIST_G3_G4.md`).

## 1. Môi trường và dữ liệu

| Mục | Đề xuất |
|---|---|
| Bản build | `main` @ `7ff930f`, **cộng PR #8 (DATA-39B) và #9 (G-2) sau khi merge**, để UAT chạy đúng bản sẽ lên production. Ghi commit và image digest vào biên bản |
| Stack | **Stack UAT riêng, sạch** (không dùng `jkc-staging-s1`, nơi có hơn 800 bài do test tự động tạo; xem DATA-20). Cấu hình staging, HTTPS bằng CA nội bộ, chỉ trong mạng JKC |
| Tài khoản | Mỗi người tham gia một tài khoản UAT riêng (namespace `uat_`), gán đúng bộ phận và vai trò. **Không** dùng mật khẩu Odoo, **không** dùng chung tài khoản |
| Nội dung mẫu | Mỗi bộ phận chuẩn bị 3–5 nội quy/quy trình, bài tri thức và hồ sơ sự cố **mẫu**, ghi rõ "UAT". **Không** đưa thông số vận hành chưa được người phụ trách xác minh (AGENTS.md) |
| Thiết bị | Máy tính tại xưởng, điện thoại Android và iOS của người tham gia, máy dùng chung (kiểm tra đăng xuất). Ghi model, OS, trình duyệt |
| Mạng | Wi-Fi xưởng; thử thêm mạng yếu ở ít nhất một vị trí |

## 2. Người tham gia

| Vai trò | Số người | Ghi chú |
|---|---|---|
| Nhân viên xưởng | 5–8, phủ **5 công đoạn**: Thiết kế/Chế bản, In offset, In kỹ thuật số, In flexo/Bao bì, Gia công sau in | Ưu tiên người hay tra cứu tại máy |
| Trưởng bộ phận | 2–3 (ít nhất 2 bộ phận khác nhau) | Kiểm tra duyệt **trong phạm vi** và **không tự duyệt** |
| HR | 1–2 | Ban hành nội quy, giao đọc, theo dõi xác nhận |
| Quản trị kỹ thuật | 1 | Kiểm tra **không** xem được nội dung bí mật ngoài phạm vi |
| Điều phối / ghi biên bản | 1 (PO hoặc người được giao) | Ghi kết quả, ảnh chụp, lỗi |

## 3. Kịch bản

Mỗi kịch bản ghi lại: người thực hiện, thiết bị, kết quả (Đạt / Không đạt / Ghi chú), và ảnh hoặc mã lỗi nếu có.

### Nhân viên (NV)

| ID | Kịch bản | Kỳ vọng |
|---|---|---|
| NV-01 | Đăng nhập trên điện thoại và máy xưởng; sai mật khẩu; đăng xuất trên máy dùng chung | Người sau không thấy phiên của người trước |
| NV-02 | Mở nội quy được giao, đọc, **xác nhận đã đọc** | Trạng thái chuyển "Đã đọc" đúng phiên bản; xác nhận lại khi HR ban hành bản mới |
| NV-03 | **Tra cứu nhanh tại xưởng:** tìm một sự cố theo từ khóa **không dấu** (ví dụ "lem muc"), lọc theo công đoạn, mở hướng dẫn, quay lại danh sách | Tìm thấy trong ≤ 3 thao tác; quay lại giữ bộ lọc; đọc tốt trên điện thoại |
| NV-04 | Viết bài tri thức có ảnh, lưu nháp, gửi duyệt; sửa theo yêu cầu của trưởng bộ phận rồi gửi lại | Trạng thái đúng; ý kiến hiển thị rõ |
| NV-05 | Học khóa được giao, hoàn thành bài học, làm kiểm tra; trượt rồi làm lại; đạt | Điểm do máy chủ chấm; sau khi đạt **không mở thêm lần làm** (DATA-39/39B) |
| NV-06 | Thử mở bài hoặc tệp của bộ phận khác qua đường link được chia sẻ | Không xem được (404 hoặc báo không có quyền) |

### Trưởng bộ phận (TBP)

| ID | Kịch bản | Kỳ vọng |
|---|---|---|
| TBP-01 | Hàng đợi duyệt chỉ có bài của bộ phận mình | Không thấy bài của bộ phận khác |
| TBP-02 | Duyệt, yêu cầu sửa (bắt buộc ghi lý do), từ chối | Tác giả nhận đúng trạng thái và ý kiến; bài đã duyệt xuất hiện trong Kho tri thức |
| TBP-03 | Tự viết một bài và kiểm tra hàng đợi của chính mình | **Không** tự duyệt được bài của mình |
| TBP-04 | Xác minh hồ sơ sự cố và ghi nhận tái diễn | Chỉ trưởng bộ phận có thẩm quyền mới xác minh được |
| TBP-05 | Giao khóa học hoặc nội quy cho nhân viên trong bộ phận | Chỉ giao được trong phạm vi |

### HR

| ID | Kịch bản | Kỳ vọng |
|---|---|---|
| HR-01 | Soạn và ban hành nội quy phiên bản mới; xem lịch sử phiên bản | Bản cũ giữ nguyên; người đã đọc bản cũ phải xác nhận lại |
| HR-02 | Giao đọc theo bộ phận; theo dõi đã đọc / chưa đọc / quá hạn | Số liệu đúng; không sửa được xác nhận thay nhân viên |
| HR-03 | Duyệt tài liệu cấp công ty | Đúng quyền HR |

### Quản trị kỹ thuật (QT)

| ID | Kịch bản | Kỳ vọng |
|---|---|---|
| QT-01 | Thử xem bài, tệp, hàng đợi của bộ phận Sản xuất | **Không** xem được mặc định |
| QT-02 | Kiểm tra trạng thái hệ thống (health), tích hợp Odoo | Odoo hiển thị chưa kết nối (no-op) |

### Phi chức năng (cả nhóm)

| ID | Kịch bản | Kỳ vọng |
|---|---|---|
| PF-01 | Thời gian mở Trang chủ và Kho tri thức trên điện thoại ở xưởng | Ghi số giây. Với dữ liệu UAT nhỏ, mục tiêu ≤ 2 giây. Hiệu năng ở quy mô lớn xử lý trong DATA-20 |
| PF-02 | Tải ảnh hoặc PDF; thử tệp không hợp lệ | Tệp hợp lệ được quét và chấp nhận; tệp sai bị từ chối với thông báo tiếng Việt rõ |
| PF-03 | Mạng yếu hoặc mất mạng khi đang gửi | Không báo thành công giả; thử lại được |
| PF-04 | Đánh giá chung: dễ dùng, chữ đủ to, vùng bấm trên điện thoại (PR #10) | Ý kiến ghi lại |

## 4. Phân loại lỗi và điều kiện đạt

| Mức | Định nghĩa | Điều kiện để ký |
|---|---|---|
| S1 | Lộ dữ liệu ngoài quyền, mất dữ liệu, sai điểm hoặc trạng thái đọc, không đăng nhập được | **0 lỗi**. Sửa và kiểm thử lại trước khi ký |
| S2 | Chức năng chính không làm được, không có cách khác | **0 lỗi**, hoặc PO chấp nhận bằng văn bản kèm hạn sửa |
| S3 | Có cách làm khác, giao diện chưa tiện | Ghi vào backlog, không chặn |
| S4 | Góp ý | Ghi lại |

Ngoài điều kiện theo mức lỗi, mỗi vai trò phải có ít nhất **90%** kịch bản ở trạng thái Đạt.

## 5. Lịch đề xuất (PO chốt ngày)

| Ngày | Việc |
|---|---|
| N−3 → N−1 | IT dựng stack UAT, cài CA lên thiết bị; HR cung cấp danh sách người tham gia; Dev tạo tài khoản UAT; các bộ phận chuẩn bị nội dung mẫu |
| N | Hướng dẫn 30 phút; NV-01 → NV-06 tại xưởng |
| N+1 | TBP, HR, QT; kịch bản chéo bộ phận |
| N+2 | Phi chức năng; tổng hợp lỗi |
| N+3 → N+5 | Sửa lỗi S1/S2 (PR riêng, CI xanh); kiểm thử lại |
| N+6 | Họp nghiệm thu, **ký biên bản** |

## 6. Biên bản nghiệm thu (mẫu)

```
BIÊN BẢN NGHIỆM THU UAT — HỆ THỐNG TRI THỨC JKC
Ngày: ......  Địa điểm: ......  Bản build (commit / image digest): ......
Thành phần: PO ...... · HR ...... · Trưởng bộ phận ...... · Đại diện nhân viên ...... · IT ......

Kết quả: tổng số kịch bản .... · Đạt .... · Không đạt .... · Lỗi S1 .... S2 .... S3 .... S4 ....
Lỗi còn mở và hạn xử lý: ......
Kết luận:  □ Đạt — đủ điều kiện về chức năng để xét GO production (còn phụ thuộc G-1…G-4)
           □ Đạt có điều kiện: ......
           □ Không đạt
Chữ ký các bên: ......
```

Bằng chứng (ảnh, log, biên bản) lưu ở nơi hạn chế truy cập; **không** commit dữ liệu cá nhân vào repo.
