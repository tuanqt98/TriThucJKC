# D — Vùng chạm tối thiểu 44px (VQ-1, VQ-2)

PO cho phép ngày 11/11/2026 (quyết định D): sửa vùng chạm P2 tại UI-03, UI-04, UI-05B, UI-06, UI-08 lên tối thiểu 44px. **Chỉ điều chỉnh vùng tương tác, không thiết kế lại bố cục đã duyệt.**

## 1. Cách làm

| Loại phần tử | Cách sửa | Thay đổi hình |
|---|---|---|
| Link và nút: chip danh mục, link tiêu đề, "Xem tài liệu", phân trang, "Xem tất cả", nút "Tìm kiếm", breadcrumb quay lại | Lớp `::after` **trong suốt** mở rộng **riêng vùng bấm** đến 44px. `inset: min(0px, calc(50% - 22px))`, nên phần tử nào đã ≥ 44px thì không bị mở rộng | **Không** (pixel giống hệt) |
| Chip danh mục UI-03 trên mobile | Khung `.library` cắt phía trên (`overflow: hidden`, không có padding trên), nên vùng bấm mở rộng **xuống dưới** 8px, nằm trong khoảng trống 14px có sẵn trước ô tìm kiếm | **Không** |
| Thành phần gốc của trình duyệt (`select`, `input`) và nút "Xóa bộ lọc" cùng hàng | Không gắn được `::after`, nên đặt `min-height: 44px` (trước đó 38–43px) | Ô lọc UI-03 desktop/tablet **cao thêm 6px**; ô tìm kiếm thêm 1–2px |

**Tệp thay đổi (chỉ CSS):**
- `documents-library.module.css` (UI-03);
- `.crumbs a` trong `document-detail`, `knowledge-detail`, `incident-detail`, `course-detail`.

Không đổi TSX, API hay dữ liệu.

## 2. Đo vùng chạm thực tế

Script `scripts/touch-targets/measure.cjs` đo **vùng bấm hiệu dụng** của mọi link, nút, ô nhập và tab trong `<main>`. Cách đo: dò `document.elementFromPoint` từ tâm phần tử ra 4 phía. Nhờ vậy lớp trong suốt được tính, còn phần chỉ được vẽ thì không.

Phạm vi đo:
- **6 màn:** UI-03, UI-04, UI-05B, UI-06, UI-08 danh sách khóa học, UI-08 chi tiết khóa học;
- **4 viewport:** desktop 1440, tablet 768, mobile 390, mobile 375.

Cùng dữ liệu staging, cùng tài khoản `employee`.

| | Phần tử đo | Dưới 44px |
|---|---|---|
| **Before** (`before/targets.json`) | 1666 | **72** |
| **After** (`after/targets.json`) | 1666 | **0** |

**Chi tiết Before:**
- **UI-03:**
  - chip danh mục 36px (mọi viewport);
  - ô lọc 38px, ô tìm kiếm 42–43px, "Xóa bộ lọc" 38px;
  - link tiêu đề trong bảng 32px;
  - "Xem tài liệu" 36–40px, phân trang và "Xem tất cả" 36px (desktop/tablet).
- **Breadcrumb quay lại** cao 32px trên UI-04, 05B, 06 và trang chi tiết khóa học.
- **UI-08 `/learning`:** đã đạt sẵn.

## 3. So sánh ảnh Before/After

`compare.json` (pixel khác > ngưỡng 16/255):

| Màn | Desktop | Tablet | Mobile 390 | Mobile 375 |
|---|---|---|---|---|
| UI-03 | 3,25% (ô lọc cao thêm, phần dưới dịch 6px) | 5,07% (như desktop) | **0%** | **0%** |
| UI-04 · UI-05B · UI-06 · UI-08 (2 màn) | **0%** | **0%** | **0%** | **0%** |

- **22/24 ảnh trùng khít từng pixel.**
- UI-03 desktop/tablet: chỉ ô lọc và "Xóa bộ lọc" cao thêm; chip, ô tìm kiếm, bảng, màu sắc và bố cục giữ nguyên. Ảnh cạnh nhau: `diff/ui03-desktop-before-after.png`, `diff/ui03-tablet-before-after.png`. Vùng khác biệt tô đỏ: `diff/ui03-documents-*.png`.

## 4. Regression

Kết quả trong `regression/ui-suites.txt` (JSON trong `regression/*-test-results.json`). Chạy trên staging với web build từ nhánh này.

| Bộ | Kết quả |
|---|---|
| UI-01 login · UI-02 dashboard · **UI-03 documents** · **UI-04** · UI-05 knowledge · **UI-06** · UI-07 · **UI-08** · UI-09 | **160/160 PASS** |
| **UI-05B** knowledge-detail | 12/16. **4 lỗi có từ trước, không do D** (giải thích bên dưới) |
| `smoke` + `sprint1` (UAT `uat16`, có HR) · `sprint01` (UAT `uat16`) | 10/10 · 2/2 PASS |
| Unit test model web · ESLint · TypeScript | 50/50 · PASS · PASS |

**Lỗi UI-05B có từ trước (không do D):**
- 4 viewport của kịch bản "quay lại Kho tri thức giữ trạng thái" đều chờ danh sách quá 5 giây.
- Chạy **cùng bộ** trên web **bản đã duyệt** `feature/ui-approvals` cũng fail đúng 4 test này.
- **Nguyên nhân:** Kho tri thức (UI-05) tải **toàn bộ** kết quả về trình duyệt, mỗi trang 100 bài. Staging hiện có **815** bài DEMO do các lần test tạo ra, tức 9 request × khoảng 0,7 giây ≈ **6,5 giây** mới hiện kết quả (đo bằng trình duyệt). Đợt Final QA trước ít bài hơn nên chưa lộ.
- Đây là giới hạn đã ghi ở **DATA-20** (P3, lọc và phân trang phía server). **Đề xuất PO cân nhắc nâng ưu tiên**, vì thời gian tải tăng theo số bài thật. Phần D không sửa.

## 5. Rollback

Revert commit. Chỉ có CSS, không có dữ liệu hay migration.
