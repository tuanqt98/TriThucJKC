# UI-01 — Bàn giao màn hình Đăng nhập

Ngày 31/10/2026. Nhánh `feature/ui-login-fidelity`, xuất phát từ `feature/sprint-1-mvp` tại `461a19a`. **Sẵn sàng PO review; chưa có phê duyệt giao diện cuối.** Chỉ cập nhật màn hình Login trong môi trường DEMO https://localhost:18444/login. Không triển khai production hoặc merge main.

Điều chỉnh theo phản hồi PO ngày 31/10: trên mobile, thêm lớp chuyển từ trắng sang trong suốt cao 80px ở đầu hero, kết hợp blur 3px giảm dần để hòa ảnh vào nền logo. Logo vẫn sắc nét và giữ nguyên tỷ lệ; asset gốc không bị chỉnh sửa. Không thay đổi bố cục desktop hoặc chức năng đăng nhập. Đã chụp lại ảnh 390×844, 375×812 và cập nhật ảnh so sánh; lint/typecheck/build và bộ Login UI-01 chạy lại **9/9 PASS**. Kết quả 2 regression Login cũ bên dưới là từ lần bàn giao trước điều chỉnh CSS này.

Điều chỉnh tiếp theo: ba cụm giá trị trên desktop tăng chữ chính từ 12px lên 16px, chữ phụ 14px, nét thường 400 và giãn dòng 1.55. Thay icon tài liệu/người đơn/clipboard bằng SVG nét mảnh mô phỏng lớp xếp, nhóm người và biểu đồ tăng trưởng của mockup 09; kích thước icon 36px. Cập nhật câu cuối thành “Cùng nhau vươn xa” theo phản hồi. Chỉ sửa `login-fidelity.tsx` và CSS module của Login; đã xem ảnh desktop mới, cập nhật ảnh so sánh, lint/typecheck/build **PASS** và chạy lại **9/9 test Login PASS**. Icon được dựng lại từ mẫu raster, chưa phải file vector gốc nên vẫn chờ PO duyệt độ khớp.

## Thiết kế và asset

Đã đối chiếu màn hình chạy thực tế trước khi sửa với `design/approved_screens/09_login.png`. Bản cũ dùng hero khác, tỷ lệ cột 46/54, logo chữ JKC nằm trên ảnh, chưa có hàng ghi nhớ tên đăng nhập và khối hỗ trợ như mẫu.

Bản mới dùng nguyên byte `design/approved_screens/logo/bgr.jpg` (1536×863) và `logo.jpg` (959×339), đưa vào public để phục vụ web. [SHA-256 đối chiếu](asset-integrity.json) xác nhận không chỉnh sửa asset. Logo gốc ghi **INNHATTHAN / NHAT HAN PRINTING COMPANY LIMITED**, đúng asset người dùng cung cấp và mockup; không tự vẽ logo JKC thay thế. Tên ứng dụng Tri Thức JKC và nhãn DEMO vẫn hiển thị ở footer.

| Thành phần | Kết quả |
|---|---|
| Desktop | Hai cột 64/36, hero bên trái, logo và form bên phải; slogan, ba giá trị và dải cong đỏ/navy |
| Mobile | Logo trên nền trắng, hero phía trên form, đường cong chuyển tiếp; có cuộn dọc khi chiều cao bị thu hẹp |
| Logo | Giữ tỷ lệ tự nhiên, không kéo méo |
| Form | Input có icon, nút hiện/ẩn mật khẩu bên trong, ghi nhớ và quên mật khẩu, khối hỗ trợ, footer |
| Nút | Đỏ `#c92331` theo yêu cầu UI-01; đây là khác biệt có chủ đích so với nút xanh trong ảnh 09 |
| Thao tác | Focus ring, loading/disabled, lỗi đăng nhập và thông báo mạng bằng tiếng Việt |

## Ảnh thực tế và so sánh

Ảnh chụp Chromium từ web standalone chạy trong Compose, không dùng mockup thay cho ứng dụng. Đã mở và xem ảnh sau cùng.

| Viewport | Before | After | Before / Mockup / After |
|---|---|---|---|
| 1440×900 | [Trước](before-desktop.png) | [Sau](after-desktop.png) | [So sánh desktop](comparison-desktop.png) |
| 390×844 | [Trước](before-mobile390.png) | [Sau](after-mobile390.png) | [So sánh 390](comparison-mobile390.png) |
| 375×812 | [Trước](before-mobile375.png) | [Sau](after-mobile375.png) | [So sánh 375](comparison-mobile375.png) |

Ảnh so sánh crop phần ứng dụng khỏi board mockup, giữ tỷ lệ từng ảnh và có khoảng đệm để không bóp méo; không phải phép đo pixel tuyệt đối giữa hai canvas đồng kích thước.

## Chức năng và kiểm thử

Theo lựa chọn của người dùng, checkbox chỉ lưu **tên đăng nhập** tại `localStorage["jkc.login.username.v1"]`; bỏ chọn rồi gửi form sẽ xóa tên đã lưu. Không lưu mật khẩu/token, không kéo dài session. Trình duyệt cấm storage vẫn đăng nhập được.

Hàm submit login/reset giữ nguyên nội dung so với base (đã so sánh bỏ khoảng trắng); JSX nhánh reset giữ nguyên sau khi tách hàm submit. Session, CSRF, chuyển hướng bắt buộc đổi mật khẩu, API và RBAC dùng cơ chế hiện có. Chưa hydrate hoặc không chạy JavaScript thì trường thông tin và nút submit vẫn bị khóa, form vẫn dùng POST.

| Kiểm tra | Kết quả và bằng chứng |
|---|---|
| ESLint, TypeScript, production build | **PASS** cả ba lệnh `npm run lint`, `npm run typecheck`, `npm run build` |
| Compose web | **PASS** build và `up --no-deps --wait web`; service healthy; không migrate/seed lại DB |
| Login UI-01 | **9 passed, 0 failed/skipped**, [JSON Playwright](test-results.json) |
| Regression Login hiện có | **2 passed**, desktop/mobile: hero thực, nút đỏ, hiện/ẩn mật khẩu, no-JS guard và liên kết reset |
| Đăng nhập thật | **PASS** trên cả ba viewport: POST login 200, auth/me đúng DEMO employee, cookie Secure/HttpOnly/path `/api`, logout có CSRF thành công và me trở về 401 |
| Ghi nhớ và trạng thái lỗi | **PASS**: reload chỉ nhớ tên, mật khẩu trống; bỏ ghi nhớ xóa storage; loading khóa input; mạng lỗi hiển thị rõ |
| Responsive | **PASS** không tràn ngang ở ba viewport; mobile thu chiều cao xuống 430px vẫn cuộn tới nút đăng nhập |

Các test lỗi 401/loading/mạng dùng route giả lập có chủ đích để kiểm tra UI, tách khỏi ba ca đăng nhập thật không mock API. Lần chạy đầu có 6 test lỗi do selector `role=alert` trùng Next route announcer; đã giới hạn selector trong form và chạy lại đủ 9 ca đạt PASS. Không xóa hoặc nới assertion chức năng cũ. Chỉ điều chỉnh test Login cũ sang asset được duyệt và nút eye thay checkbox.

[Tổng hợp kiểm tra](verification.json). Không chạy lại toàn bộ backend hoặc UAT các module khác cho thay đổi UI này. Không coi các kết quả này là chứng nhận TLS thực địa; browser test dùng ngoại lệ CA test cục bộ. Chưa chạy GitHub CI cho nhánh bàn giao này.

## File thay đổi

- `starter/apps/web/components/login.tsx`: nối giao diện Login mới vào handler sẵn có.
- `starter/apps/web/components/login-fidelity.tsx`, `login-fidelity.module.css`: markup, CSS riêng Login, nhớ tên và các trạng thái trình bày.
- `starter/apps/web/public/images/login-approved/*.jpg`, `design/approved_screens/logo/*.jpg`: asset gốc và bản phục vụ web giống byte.
- `starter/apps/web/tests/sprint1.spec.ts`: chỉ cập nhật ca regression Login.
- `starter/apps/web/playwright.login.config.ts`, `ui-tests/login-fidelity.spec.ts`: bộ kiểm thử riêng ba kích thước; không làm đổi tập test Sprint 1 hiện có.
- `scripts/ui-login/capture.cjs`, `compare.py`: chụp ảnh và ghép bằng chứng tái lập.
- `docs/reports/ui-01/`: báo cáo, JSON và ảnh nghiệm thu.

Không thay đổi Dashboard, các route khác, CSS toàn cục, backend, OpenAPI hoặc migrations. Secret chỉ đọc từ env riêng khi chạy test; không đưa env, credential hoặc trace trình duyệt vào bàn giao.

## Khác biệt còn lại và bước PO review

- Ảnh nền gốc được cung cấp có chữ ký tác giả ở phía trên; giữ nguyên, nên desktop thấy chữ ký và mobile có thể thấy một phần sát mép ảnh. Nếu PO muốn bản không chữ ký cần cung cấp asset gốc phù hợp; chưa tự xóa hoặc vẽ đè.
- Tỷ lệ vùng hero thực tế 1440×900 khác khung desktop trên board mockup; `cover` thay đổi vùng crop và vị trí nhân vật. Mobile cũng dùng crop responsive từ ảnh gốc được cung cấp.
- Không có file font/icon nguồn riêng của mockup. Dùng font hệ thống hiện có, serif cho slogan và icon SVG của ứng dụng; độ đậm/chữ và nét icon chưa trùng tuyệt đối. Đường cong footer được dựng bằng SVG/CSS, chưa khớp từng pixel.
- Checkbox mặc định không chọn khi chưa lưu tên; khác trạng thái minh họa đã tick trong mockup. Nút đỏ và nhãn DEMO là yêu cầu giữ theo ngữ cảnh dự án.
- Thông báo hết phiên hỗ trợ URL `/login?reason=session-expired`. Các redirect cũ chưa truyền lý do vẫn hiển thị Login bình thường; không sửa các màn hình khác để thêm tham số trong UI-01.
- Thu chiều cao viewport là kiểm tra tự động khả năng cuộn; vẫn cần PO kiểm tra bàn phím trên iOS/Android thật và cảm nhận font/crop trước duyệt.

**Dừng tại bàn giao Login để PO xem và duyệt.** Không tiếp tục thiết kế Dashboard hoặc tự đóng gate Sprint 0.1/Sprint 1 từ kết quả UI-01.
