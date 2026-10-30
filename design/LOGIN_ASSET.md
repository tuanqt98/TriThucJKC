# Login — thiết kế 09

Nguồn duyệt: `approved_screens/09_login.png` (desktop + mobile). Yêu cầu người dùng ưu tiên nút đăng nhập **đỏ**. Giữ tên/logo JKC trong sản phẩm, không suy ra đổi tên công ty từ chữ trong mockup.

Ảnh dùng trong giao diện: `starter/apps/web/public/images/login-hero.png`. Tạo bằng built-in `image_gen`, đã xem kết quả và copy vào repository; ảnh minh họa tổng hợp, không phải địa điểm công ty thật. Không cắt ảnh mockup làm giao diện.

Prompt cuối: “Photorealistic northern Vietnamese mountains at sunrise, misty blue ridges and warm golden light, grassy hillside with two small distant farmers and grazing buffalo, small Vietnamese flag near rural shelter. Wide landscape with center subjects suitable for desktop portrait and mobile wide crop. Photo only; no UI, words, logos, watermark or borders; illustrative generated landscape, not a real company location.”

Component giữ nguyên API login/session/CSRF/reset, thêm hiện mật khẩu. CSS mobile giữ hero hiển thị; nút màu #c92331. Docker standalone copy thư mục public. Playwright kiểm ảnh PNG được trả 200, hero hiện, nút đỏ, password toggle và liên kết reset; kiểm auth vẫn qua các regression cũ.
