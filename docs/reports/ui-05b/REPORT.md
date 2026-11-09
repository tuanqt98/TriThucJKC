# UI-05B — Chi tiết bài viết tri thức: ĐỀ XUẤT THIẾT KẾ (chờ PO duyệt)

Ngày 09/11/2026. Nhánh `feature/ui-knowledge-detail`, tách từ `feature/ui-knowledge-library` tại `08e337e` (UI-01 → UI-05 vòng 3).

**Dự án chưa có mockup riêng cho trang chi tiết bài tri thức** (`design/approved_screens/` chỉ có 03 chi tiết nội quy, 05 chi tiết sự cố, 06 tạo bài). Theo yêu cầu task, **dừng ở bước đề xuất**:
- Chưa viết lại giao diện `/knowledge/[id]`.
- Chưa đổi code ứng dụng, API hay database.
- Chưa làm UI-06.

Bản đề xuất được dựng **trong khung ứng dụng thật** (sidebar, header, bottom nav của UI-05) và lấy **dữ liệu thật từ API** của một bài DEMO đã duyệt qua workflow thật. Mọi ảnh đề xuất có dải cam "ĐỀ XUẤT THIẾT KẾ UI-05B · chưa triển khai". Ô viền nét đứt là dữ liệu **chưa có API**; khi triển khai sẽ không hiển thị.

## 1. Khảo sát hiện trạng

**Trang hiện tại** `/knowledge/[id]` vẫn là component cũ `Workspace` (Sprint 0), chưa theo hệ thiết kế UI-01 → UI-05:

| Vấn đề | Ảnh |
|---|---|
| Thứ tự mục sai: 1, 2, **5, 3, 4**, 6. Do `jsonb` không giữ thứ tự khóa; UI-04 đã xử lý bằng `parseSections`, trang này chưa | [before-desktop-full](before-desktop-full.png) |
| Banner chung "Chi tiết nội dung" và link nội bộ "Biên soạn / Hồ sơ / Quản lý đào tạo" chiếm chỗ, nhất là trên mobile | [before-mobile390-full](before-mobile390-full.png) |
| Không hiện người chia sẻ, công đoạn, ngày duyệt (API đã có từ UI-05) | |
| Ảnh đính kèm chỉ là nút "Tải xuống", không xem được tại chỗ | |
| Dòng giữ chỗ "Nội dung DEMO để kiểm thử." và "Lịch sử xác nhận…" (không áp dụng cho bài tri thức) | |
| "← Quay lại thư viện" về `/knowledge` trống, **mất từ khóa, bộ lọc, trang**. Nút Back của trình duyệt thì giữ được, vì UI-05 lưu trạng thái trên URL | |

**API sẵn có (không cần sửa):**

| Dữ liệu | Nguồn |
|---|---|
| Tiêu đề, mã, loại, bộ phận, phiên bản hiện hành, trạng thái, nội dung theo mục, ngày tạo phiên bản, **ngày duyệt, người chia sẻ, công đoạn** | `GET /api/v1/articles/{id}` (`ContentView`). Chỉ trả bài **đã duyệt, đúng phạm vi ACL**; ngoài phạm vi trả 404 |
| Tệp đính kèm: tên, loại, dung lượng, trạng thái quét | `GET /api/v1/content-versions/{version_id}/attachments` |
| Xem ảnh / tải tệp | `GET /api/v1/attachments/{id}/download` (kiểm tra quyền theo phiên bản) |
| Bài cùng công đoạn | `GET /api/v1/articles?processId=…` (cùng điều kiện ACL/đã duyệt) |

**Chưa có trong API:**

| Dữ liệu | Backlog |
|---|---|
| Tên người duyệt (DB có `approved_by`, chưa trả về) | DATA-16 |
| Lịch sử các phiên bản đã duyệt trước của bài tri thức | **DATA-22 (mới)** |
| Thẻ, thiết bị, lượt xem, bình luận, lưu bài | DATA-14/15/17 |
| Ảnh gắn với từng mục nội dung (hiện tệp gắn với phiên bản, không gắn mục) | DATA-04 |

**Kiểm tra quyền trên staging, bài DEMO của đề xuất:**

| Người dùng | Bài viết | Tệp đính kèm |
|---|---|---|
| `employee` (tác giả, cùng bộ phận) | 200 | 200 |
| `head` (trưởng bộ phận) | 200 | 200 |
| `other` (khác bộ phận) | 404 | 404 |
| `admin` (quản trị kỹ thuật) | 404 | 404 |
| Chưa đăng nhập | 401 | |

Bản nháp, bản chờ duyệt và ngoài phạm vi đã có test trả 404 ở UI-05 (`knowledge.spec.ts` kịch bản 3 và `test_knowledge_listing.py`).

## 2. Đề xuất thiết kế

Kế thừa hệ thiết kế đã duyệt:
- **UI-04 / mockup 03:** breadcrumb, khối tiêu đề có icon và chip, dải metadata có icon, mục đánh số tròn, khung cảnh báo vàng cho "Lưu ý an toàn", cột phải 340px, tab trên mobile.
- **Mockup 05:** ảnh minh họa ngay dưới tiêu đề, timeline xác minh/phê duyệt.
- **Mockup 06:** 6 mục chuẩn của bài kinh nghiệm (Mô tả vấn đề → Lưu ý an toàn).
- **UI-02 / UI-05:** token màu, AppFrame, bottom nav.

### Desktop 1440×900
- Breadcrumb "← Kho tri thức › *Công đoạn*". Nút này **khôi phục đúng từ khóa, bộ lọc và trang** trước đó (mục 3).
- **Khối tiêu đề:**
  - icon "bài tri thức" màu xanh (phân biệt với icon đỏ của nội quy) và mã bài;
  - chip Đã duyệt · v1 · Bài tri thức · Công đoạn;
  - metadata 3×2: Người chia sẻ, Bộ phận, Công đoạn, Ngày duyệt, Phiên bản.
- **Hình ảnh:** lưới ảnh đính kèm đã quét sạch, xem ngay trên trang.
- **Nội dung:** các mục theo **đúng thứ tự số**, nhận dạng danh sách gạch đầu dòng và đánh số. Mục có "an toàn"/"lưu ý" hiển thị trong khung cảnh báo vàng.
- **Cột phải:**
  - **Phê duyệt & phiên bản:** phiên bản hiện hành, ngày duyệt, ngày tạo, trạng thái, bộ phận duyệt;
  - **Tệp đính kèm** (tải từng tệp);
  - **Cùng công đoạn**: tối đa 3 bài đã duyệt khác, dữ liệu thật.

### Tablet 768×1024
Một cột. Metadata giữ lưới 3 cột. Các thẻ của cột phải xuống dưới nội dung (2 thẻ một hàng), "Cùng công đoạn" chiếm cả hàng.

### Mobile 390×844 / 375×812
- Giữ Header UI-02 (có ô tìm toàn cục) như UI-04. Phương án A chỉ ẩn ô này ở trang danh sách `/knowledge`.
- Khối tiêu đề gọn, metadata 2 cột.
- **3 tab:** *Nội dung* (mặc định) · *Ảnh & tệp (n)* · *Phê duyệt*. Tab nằm ngay dưới khối tiêu đề để đọc nhanh ở xưởng; vùng chạm ≥ 44px; không tràn ngang.

### Ảnh

| Viewport | Before / Đề xuất | Đề xuất (đầy đủ) |
|---|---|---|
| Desktop 1440 | [comparison-desktop](comparison-desktop.png) | [proposal-desktop](proposal-desktop.png) · [toàn trang](proposal-desktop-full.png) |
| Tablet 768 | [comparison-tablet](comparison-tablet.png) | [proposal-tablet](proposal-tablet.png) · [toàn trang](proposal-tablet-full.png) |
| Mobile 390 | [comparison-mobile390](comparison-mobile390.png) | [3 tab](proposal-mobile390-tabs.png) · [Nội dung](proposal-mobile390-full.png) · [Ảnh & tệp](proposal-mobile390-files-full.png) · [Phê duyệt](proposal-mobile390-version-full.png) |
| Mobile 375 | [comparison-mobile375](comparison-mobile375.png) | [3 tab](proposal-mobile375-tabs.png) · [Nội dung](proposal-mobile375-full.png) · [Ảnh & tệp](proposal-mobile375-files-full.png) · [Phê duyệt](proposal-mobile375-version-full.png) |

Ảnh Before ở [before-*.png](before-desktop.png) (4 viewport, kèm bản toàn trang).

**Tái tạo:**
```sh
UI_DEMO_PASSWORD=… node scripts/ui-knowledge-detail/fixture.mjs        # 1 bài DEMO, 2 ảnh + 1 PDF, qua workflow thật
UI_DEMO_PASSWORD=… UI_ARTICLE_ID=<id> node scripts/ui-knowledge-detail/capture.cjs                    # Before
UI_CAPTURE_PHASE=proposal [UI_PROPOSAL_TAB=files|version UI_CAPTURE_SUFFIX=-files|-version] …          # Đề xuất
python3 scripts/ui-knowledge-detail/compare.py
```

Bài DEMO dùng 6 mục theo mockup 06, nội dung chung chung, **không có thông số vận hành**. Hai ảnh là ảnh minh họa DEMO của UI-02, chuyển sang JPEG vì API chỉ nhận PNG/JPEG/PDF. Mục "Cùng công đoạn" trên staging đang hiện cả bài do test tự động sinh ra; đó là dữ liệu thật của staging.

## 3. Quay lại Kho tri thức giữ trạng thái

- **Hiện tại:** UI-05 đã ghi từ khóa, công đoạn, loại, bộ phận, sắp xếp, trang và kiểu xem lên URL. Nút Back của trình duyệt khôi phục đúng (đã có test UI-05).
- **Đề xuất:**
  - Mỗi lần URL đổi, trang Kho tri thức lưu query hiện tại vào `sessionStorage` (`jkc.knowledge.query`; chỉ trong tab, không gửi lên server, không chứa dữ liệu bài).
  - Nút "← Kho tri thức" ở trang chi tiết dẫn tới `/knowledge?<query đã lưu>`.
  - Mở link chi tiết trực tiếp (không qua thư viện) thì về `/knowledge` mặc định.
  - Không thêm tham số vào URL chi tiết, nên link chia sẻ vẫn gọn.
- Thay đổi này chạm `knowledge-library.tsx` của UI-05 (1–2 dòng, không đổi hành vi hiển thị). Sẽ chạy lại regression UI-05.

## 4. Phạm vi khi PO duyệt (chưa làm)

- **Code:**
  - Thêm `components/knowledge-detail.tsx`, `knowledge-detail.module.css`, `knowledge-detail-model.ts`. Model dùng lại `parseSections`/`formatBytes`/`fileKind` của UI-04, không sửa UI-04.
  - `app/knowledge/[id]/page.tsx` dùng component mới; `Workspace` cũ vẫn phục vụ các route khác.
- **Trạng thái:** đang tải, 404 "Không tồn tại hoặc không có quyền", 403, lỗi + Thử lại, phiên hết hạn chuyển về đăng nhập, bài không có ảnh/tệp, tệp đang quét.
- **Test:**
  - Playwright `knowledge-detail-tests` trên 4 viewport: dữ liệu khớp API, thứ tự mục, ảnh, tải tệp, tab mobile, quay lại giữ trạng thái;
  - quyền: nháp, chờ duyệt, `other`, `admin` → 404; chưa đăng nhập → `/login`;
  - unit test cho model;
  - regression UI-01 → UI-05, smoke/sprint1; lint/typecheck/build; CI.
- **Không đổi:** auth, session, CSRF, RBAC, RLS, phê duyệt, xác nhận đọc; trang `/incidents/[id]` (Giải pháp sự cố, theo mockup 05, làm riêng).

## 5. Cần PO quyết định

1. **Duyệt bố cục** desktop / tablet / mobile như ảnh đề xuất?
2. **Mobile:** dùng 3 tab (đề xuất) hay một trang dài cuộn liên tục?
3. **Ảnh:** đặt lưới ảnh ngay dưới tiêu đề (đề xuất, giống mockup 05) hay cuối bài? Ảnh hiện gắn với phiên bản, chưa gắn từng mục (DATA-04).
4. **"Cùng công đoạn":** giữ (dữ liệu thật, đúng ACL) hay bỏ?
5. **Người duyệt (DATA-16):** thêm trường chỉ đọc `approver_name` vào `ContentView` ngay trong UI-05B (thay đổi API nhỏ, có test), hay để sau? Nếu để sau, khối "Phê duyệt" chỉ hiện ngày duyệt, bộ phận và phiên bản.
6. **Lịch sử phiên bản bài tri thức (DATA-22):** để backlog hay làm cùng?
7. **Mã bài** (`S1-…`, mã hệ thống): giữ dòng nhỏ trên tiêu đề hay ẩn với nhân viên?
8. **Quay lại giữ trạng thái** bằng `sessionStorage` như mục 3: đồng ý?

## 6. Kiểm thử trong vòng đề xuất

| Kiểm tra | Kết quả |
|---|---|
| Quyền xem bài và tệp theo vai trò (staging, curl) | Đúng như bảng ở mục 1 |
| Ruff check/format các script mới | PASS |
| Code ứng dụng | **Không đổi**, nên chưa chạy lại lint/build/Playwright/regression. Sẽ chạy đủ khi triển khai |

Thay đổi trong commit: chỉ có `scripts/ui-knowledge-detail/` (fixture, capture, compare, `proposal/`), `docs/reports/ui-05b/` và backlog.
