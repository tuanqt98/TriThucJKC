# ADR — commit transaction trước khi gửi HTTP success

Trạng thái: đã triển khai và có regression. Phạm vi DEMO, không thay quyền hay chính sách cấp HR.

CI xuất hiện lỗi rời rạc ở request ngay sau login và kiểm private download sau khi đổi sang TECH_ADMIN. `database()` là dependency `yield`; scope mặc định request đóng context sau khi response đã gửi. INSERT session hoặc thay đổi nội dung có thể chưa commit dù client đã nhận cookie/200. TestClient thông thường đợi cleanup nên che khuất cửa sổ này.

Test `test_commit_boundary.py` gọi ASGI trực tiếp, chèn độ trễ **chỉ trong test** trước commit và mở connection độc lập tại `http.response.start`. Trên bản cũ, cookie đã xuất hiện nhưng session chưa thấy (`False`), test FAIL. Sau sửa scope, session thấy trước response, test PASS. Ca thứ hai mô phỏng commit lỗi: trả 503, không gửi cookie thành công và không thêm session. Bằng chứng [before](reports/sprint1/commit-boundary-before.xml), [after](reports/sprint1/commit-boundary-after.xml), [full suite](reports/sprint1/backend-junit.xml). Before là lỗi cố ý tái hiện ở code cũ, không phải trạng thái regression hiện hành.

Quyết định: `DB = Depends(database, scope="function")` tập trung tại `app/db.py`, dùng nhất quán trong current_user và mọi route để chia sẻ đúng một connection/transaction. Source FastAPI đã khóa hiện tại có hỗ trợ scope này; đã kiểm nguồn dependency stack và kiểm bằng runtime Python 3.12/PostgreSQL thật. Không thêm commit thủ công rải rác hoặc retry che 401. `connection()` dùng cho CLI/seed giữ nguyên.

Function-scope cleanup commit/rollback trước response.start; lỗi commit có thể được exception handler trả đúng 503. Các query trả dữ liệu eager; protected download đọc/đóng file trước trả bytes, không có stream/cursor phụ thuộc connection đã đóng. Nếu thêm streaming DB trong tương lai phải thiết kế riêng, không kéo scope request trở lại cho mutation. Giữ regression này khi nâng FastAPI.

Probe HTTPS kiểm `/auth/me` ngay sau mỗi login và đúng identity, không retry; TECH_ADMIN download vẫn phải **404**. Frontend cũng khóa login/reset trước hydration, form method POST và test JavaScript tắt; đây là guard riêng, không thay thế việc commit đúng ở API. Không tăng timeout hay bỏ kiểm tra quyền để đổi FAIL thành PASS.
