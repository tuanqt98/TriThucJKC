# Ảnh DEMO Dashboard UI-02

Người dùng xác nhận sẽ bổ sung ảnh gốc sau và yêu cầu đưa ảnh DEMO vào trước. Bộ ảnh này được tạo bằng **built-in image_gen**, sử dụng skill [imagegen](/Users/quoctuan8386/.codex/skills/.system/imagegen/SKILL.md), không lấy ảnh từ nhà máy hoặc nhân viên JKC.

Ảnh cuối nằm tại `starter/apps/web/public/images/dashboard-demo/`. Prompt đầy đủ và checksum được lưu trong [image-prompts.json](image-prompts.json). Chỉ chuyển định dạng sang WebP để giảm dung lượng; không ghép logo, sửa nội dung hay dùng ảnh mockup làm asset.

| Asset | Vị trí sử dụng |
|---|---|
| `offset.webp` | Hero máy in offset, danh mục In offset, thumbnail minh họa thứ nhất |
| `prepress.webp` | Danh mục Thiết kế / Chế bản |
| `digital.webp` | Danh mục In kỹ thuật số |
| `flexo.webp` | Danh mục In flexo / Bao bì, thumbnail minh họa bao bì |
| `finishing.webp` | Danh mục Gia công sau in |
| `quality.webp` | Thumbnail minh họa kiểm tra chất lượng in |

Các ảnh là **minh họa AI/DEMO**, không phải ảnh xưởng, thiết bị, quy trình hay bằng chứng nghiệp vụ thực tế của công ty. Thumbnail không phải ảnh đính kèm bài viết; vẫn có nhãn “Minh họa DEMO”. Hero có nhãn “Ảnh DEMO”, ảnh danh mục có alt tương ứng. Không thay đổi số liệu, quyền truy cập, API hoặc lịch sử của bài viết.

Để thay bằng ảnh thật sau này, thay nguồn ảnh trong `demoImageRoot`, `processImages`, `featuredImages` tại `components/dashboard-fidelity.tsx` hoặc dùng asset mới với tên được quản lý phiên bản. Khi ảnh thật gắn với từng bài viết cần metadata/ACL từ API; không tự xem thumbnail public này là tệp riêng tư của nội dung.

Ảnh WebP được mã hóa trước và phục vụ tĩnh qua Next Image với `unoptimized`, tránh yêu cầu ghi image cache trong container web read-only hiện tại. Login UI-01 và asset gốc được giữ nguyên.
