# UAT thực địa — Sprint 0.1 gate và Sprint 1

Trạng thái: **PENDING**, không dùng tài liệu này làm bằng chứng đã nghiệm thu. Chỉ dữ liệu DEMO/tài khoản tổng hợp. HR là bên ban hành nội quy theo xác nhận người dùng; danh sách tài khoản/phạm vi thực tế cần IT ghi nhận trước khi cấp.

## Thông tin mỗi lần chạy

- Người thực hiện / vai trò / người chứng kiến: PENDING
- Ngày, host, phiên bản Git/image digest: PENDING
- Thiết bị xưởng/điện thoại, OS/browser, kích thước màn hình: PENDING
- Mạng được cho phép, DNS/VPN, URL staging: PENDING
- Evidence ID / vị trí lưu hạn chế truy cập: PENDING

## Hạ tầng — IT ký, không thay bằng test local

| Gate | Cách kiểm tra và bằng chứng cần lưu | Kết quả / người ký |
|---|---|---|
| TLS/CA | IT cài CA qua kênh quản lý, mở URL trên từng thiết bị thật không bỏ qua lỗi TLS; kiểm chain/hostname/hạn | PENDING |
| DNS/VPN | Resolve tên nội bộ trên mạng được cấp quyền; thử VPN và mạng ngoài; ngoài mạng không truy cập được | PENDING |
| Firewall | Chỉ reverse proxy trong phạm vi được duyệt; kiểm từ thiết bị độc lập API/DB/scanner/admin không public | PENDING |
| Backup độc lập | Dump + files + manifest mã hóa tại đích độc lập; xác minh quyền/retention/scheduler/alert; không tính volume cùng host | PENDING |
| Restore/RPO/RTO | Restore vào volume trống bằng secret mới; so DB/file hash trước login; đọc ACK/quiz/file; ghi thời lượng và mất dữ liệu tối đa | PENDING |
| CA private key | Người giữ khóa, lưu trữ mã hóa và quy trình thu hồi/phục hồi được IT xác nhận | PENDING |
| Antivirus | Digest đã duyệt theo kiến trúc; mirror/egress; signature còn hạn; cảnh báo stale; EICAR và mất scanner phải fail-closed | PENDING |
| Capacity | Ghi CPU/RAM/disk/IO/kiến trúc, người dùng đồng thời mục tiêu, p95/error/resource khi upload/quiz/search; IT chốt ngưỡng trước test | PENDING |

## Chức năng — PO/HR/key users ký

| Ca | Kỳ vọng | Kết quả / bằng chứng |
|---|---|---|
| Nội quy | Tạo/sửa/version/trình HR; TECH_ADMIN không ban hành; lịch sử bản cũ nguyên vẹn | PENDING |
| Giao đọc | Giao đúng đối tượng/phạm vi, đúng phiên bản; đã đọc/chưa đọc/quá hạn; không giả nhân viên | PENDING |
| Tri thức | 5 công đoạn; yêu cầu sửa/từ chối/sửa/gửi lại; head đúng phạm vi, không tự duyệt | PENDING |
| Sự cố | Lưu hiện tượng/điều kiện/nguyên nhân/phương án/kết quả; ghi nhận tái diễn; chỉ head có thẩm quyền xác minh | PENDING |
| Đào tạo | Tạo bài/quiz, ban hành version/giao học; điểm server; fail/pass/overdue; không sửa lịch sử | PENDING |
| File | Tải đúng ACL; sai bộ phận/TECH_ADMIN không bypass; file không sạch không tải được | PENDING |
| UI | Desktop và mobile thật: hero login/nút đỏ, tìm kiếm nhanh, states/error, bàn phím và mạng yếu | PENDING |
| Máy chung | Logout/timeout/đổi mật khẩu/reset theo chính sách HR/IT; người sau không xem phiên người trước | PENDING |

## Quyết định

Lỗi và owner/ETA: PENDING. Chấp thuận ngoại lệ (phạm vi, lý do, mitigation, người có thẩm quyền): PENDING. Chữ ký PO: PENDING. HR: PENDING. IT/Security: PENDING. GO/NO-GO: **NO-GO khi gate bắt buộc chưa có bằng chứng**. Không tự mở internet hoặc đưa dữ liệu nhân viên thật vào staging để thực hiện checklist.
