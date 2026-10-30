# ADR bổ sung — Sprint 0.1

Trạng thái: đã triển khai/kiểm thử bằng DEMO, chờ PO/IT phê duyệt vận hành. Không thay ADR Odoo no-op.

## DB runtime và RLS

Migration 003 dùng RLS cho nội dung, phiên bản, file, reading và LMS; giữ SQL ACL hiện có ở API. Migrate/seed/operator dùng owner riêng, API dùng login jkc_runtime không owner/superuser/BYPASSRLS/role membership. Không FORCE RLS với owner để các hàm SECURITY DEFINER đọc đúng dữ liệu, tránh policy recursion. Vì owner có thể bypass RLS, readiness từ chối API chạy bằng owner. Cách phân biệt này theo [PostgreSQL 17 RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

API lấy user từ session và SET LOCAL jkc.user_id trong transaction; DB tự tra department/role, không tin department/user từ client. Context không sống qua transaction/connection mới. Runtime credential là ranh giới tin cậy của API, không phát cho nhân viên; RLS không được coi là bảo vệ khỏi API server đã bị chiếm toàn quyền. Bảng identity cần cho auth vẫn do API kiểm soát; không có cổng DB public.

Quiz key không được GRANT SELECT cột is_correct cho runtime; chấm bằng hàm DB có kiểm ownership/version/trạng thái/tập đáp án. ACK cũng dùng hàm hẹp để khóa assignment+content nhất quán. Runtime không UPDATE điểm/completion/response history. Các hàm có search_path cố định, không SQL động từ người dùng; CREATE public schema đã bị thu hồi; audit/versions/history có trigger bất biến.

## File private và scanner

Volume private chỉ API mount; random key, mode 0600, O_NOFOLLOW; filename không thành path. Chỉ PNG/JPEG/PDF tĩnh trong phạm vi đã kiểm thử. ClamAV bắt buộc trước và sau chuẩn hóa, timeout/unknown/stale database đều fail-closed; giao thức [INSTREAM](https://docs.clamav.net/manual/Usage/ClamdProtocol.html). Không có no-op scanner trong staging; dependency override chỉ nằm trong tests.

File chỉ gắn vào DRAFT của tác giả, khóa cùng version để chống race với submit. Metadata/file được lưu sau CLEAN, checksum xác minh khi download. Crash giữa ghi file và commit có thể để orphan private không truy cập được; chưa có GC tự động. Cần thiết kế worker/parser isolation/capacity lớn hơn trước mở rộng loại file/video.

## HTTPS và backup

Caddy dùng internal CA, admin off, chỉ proxy bind loopback; không lộ API/DB/scanner. Đã kiểm certificate chain bằng CA cụ thể. Theo [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https), IT vẫn phải cấp trust CA cho từng thiết bị; không coi automated browser ignoreHTTPSErrors là sign-off trust thực địa.

Backup có maintenance window: dừng API/web/proxy, dump DB và snapshot files, manifest SHA-256, rồi khởi động lại. Restore chỉ vào project/volume mới, kiểm từng file và fingerprint 22 bảng trước khi login kiểm app. Đã làm trên staging local; chưa chứng minh bản sao độc lập/off-site, lịch chạy, RPO/RTO hoặc custody private CA key cho hạ tầng JKC.
