# UI-05B — Chi tiết bài viết tri thức

Ngày 09/11/2026. Nhánh `feature/ui-knowledge-detail`, tách từ `feature/ui-knowledge-library` tại `08e337e` (UI-01 → UI-05 vòng 3). Draft PR #3, base `feature/ui-knowledge-library`.

**Trạng thái:**
- Đề xuất (mục 1–6, giữ nguyên làm hồ sơ) đã được PO chấp thuận định hướng ngày 09/11/2026 với 8 quyết định.
- **Đã triển khai giao diện thật** (mục 7), CI xanh trên `c741eac`.
- **Vòng 2 theo PO** (mục 8): trên mobile, ảnh đại diện chuyển vào tab Nội dung; thanh 3 tab nằm ngay sau tiêu đề và metadata rút gọn. Có đề xuất môi trường review DEMO sạch.
- Đang chờ PO duyệt hình ảnh UI-05B cuối cùng.
- Chưa merge. Chưa làm UI-06.

> Mục 1–6 dưới đây là bản đề xuất **trước khi PO quyết định**. Các điểm đã thay đổi theo quyết định (ẩn mã `S1-…`, ảnh theo bước, người duyệt đã có API) xem ở mục 7.

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

## 7. Triển khai thực tế (sau khi PO chấp thuận định hướng)

### Quyết định của PO và cách làm

| # | Quyết định | Triển khai |
|---|---|---|
| 1 | Desktop 2 cột; tablet và mobile 1 cột | Cột phải 340px; ≤ 1100px một cột (tablet: các thẻ phụ 2 cột một hàng); < 768px một cột |
| 2 | Mobile 3 tab | *Nội dung* (mặc định) · *Ảnh & tệp (n)* · *Phê duyệt*; khối tiêu đề luôn hiện; vùng chạm 44px |
| 3 | Ảnh đại diện dưới tiêu đề nếu có ảnh thật; ảnh theo bước gần mục tương ứng | Ảnh đại diện = ảnh đã quét sạch đầu tiên **chưa gắn mục**. Ảnh theo bước: API chưa gắn tệp với mục, nên dùng quy ước dựa trên dữ liệu thật: dòng trong mục **đúng bằng tên tệp ảnh** của phiên bản (có thể ghi "Ảnh: tên-tệp.jpg") thì hiện ảnh tại đó. Ảnh còn lại ở "Hình ảnh khác". Không có ảnh thì không hiện khung ảnh. Giải pháp lâu dài ghi ở **DATA-23** |
| 4 | Giữ "Cùng công đoạn" | `GET /articles?processId=…` (cùng ACL, chỉ bài đã duyệt), bỏ bài đang xem, tối đa 3 |
| 5 | Thêm người duyệt (chỉ đọc) | `ContentView.approver_name`: LEFT JOIN `users` theo `approved_by` của **phiên bản đã duyệt hiện hành**. Không đổi WHERE/ACL/RLS, không migration. OpenAPI thêm 1 trường tùy chọn |
| 6 | Lịch sử phiên bản: backlog | DATA-22; khối "Phê duyệt & phiên bản" chỉ hiện phiên bản hiện hành, không có dòng giữ chỗ |
| 7 | Ẩn mã kỹ thuật `S1-…` | Mã do workflow sinh (`S1-<uuid>`) bị ẩn; mã nghiệp vụ khác (ví dụ `JKC-QD-001`) vẫn hiện |
| 8 | Quay lại giữ từ khóa, bộ lọc, trang, kiểu xem | URL của UI-05 là nguồn chính. Trang Kho tri thức lưu query vào `sessionStorage` (mỗi tab trình duyệt một bản riêng). Nút "← Kho tri thức": nếu bài được mở từ thư viện trong cùng tab thì dùng `history.back()` (khôi phục cả vị trí cuộn); ngược lại dẫn tới `/knowledge?<query đã lưu>`, chỉ giữ tham số hợp lệ của UI-05. Mở trực tiếp trong tab mới thì về `/knowledge` |

**Yêu cầu thêm:**
- Mục sắp theo số đầu tiêu đề, không theo thứ tự khóa JSONB (cùng quy tắc với UI-04).
- Dòng giữ chỗ "Nội dung DEMO để kiểm thử", "Lịch sử xác nhận…" và dòng "Môi trường DEMO" không hiện trên trang này.
- Metadata chỉ hiện khi API có giá trị; không có giá trị giả hay "Chưa cung cấp".

### Thay đổi

- **Web:**
  - mới `components/knowledge-detail.tsx`, `knowledge-detail.module.css`, `knowledge-detail-model.ts`;
  - `app/knowledge/[id]/page.tsx` dùng component mới;
  - `api.ts` thêm trường tùy chọn `approver_name`;
  - `knowledge-library.tsx` (UI-05) chỉ thêm việc lưu query vào `sessionStorage` và đánh dấu bài vừa mở; không đổi giao diện hay hành vi của UI-05;
  - `tsconfig.json` bật `allowImportingTsExtensions` (dự án đã `noEmit`), để model dùng lại `sectionTitle` của UI-04 và `readState`/`writeState` của UI-05 mà vẫn chạy được unit test bằng Node.
- **API:** `content.py` (SELECT thêm `approver_name`), `schemas.py`, `api/openapi.yaml`.
- **Test:**
  - `tests/test_knowledge_listing.py` +2 test;
  - `scripts/tests/knowledge-detail-model.test.mjs` 6 test;
  - `knowledge-detail-tests/` (Playwright, 4 kịch bản × 4 viewport).
- **Không đổi:** auth, session, CSRF, RBAC, RLS, workflow phê duyệt, xác nhận đọc, migration; giao diện UI-01 → UI-05; trang `/incidents/[id]`.

### Kiểm thử (staging HTTPS, sau khi build lại `api` + `web`)

| Kiểm tra | Kết quả |
|---|---|
| ESLint / TypeScript / Next production build | PASS |
| Ruff check/format, OpenAPI drift check | PASS |
| pytest backend, PostgreSQL 16 sạch (gồm 2 test `approver_name`: đúng người duyệt của bản đã duyệt hiện hành kể cả khi có bản nháp/chờ duyệt mới; `other`/`admin` 404 và tìm không thấy; giữ đủ các trường cũ; dữ liệu seed không có người duyệt vẫn chạy) | **59/59 PASS** |
| Unit test model (`node --test scripts/tests/*.test.mjs`) | **26/26 PASS** (6 mới) |
| UI-05B Playwright (desktop, tablet, 390, 375 × 4 kịch bản) | **16/16 PASS**, [JSON](test-results.json) |
| Regression UI-01 / UI-02 / UI-03 / UI-04 / UI-05 | **9/9 · 16/16 · 16/16 · 16/16 · 20/20 PASS** ([01](regression-ui01-login.json) · [02](regression-ui02-dashboard.json) · [03](regression-ui03-documents.json) · [04](regression-ui04-document-detail.json) · [05](regression-ui05-knowledge.json)) |
| E2E `smoke` + `sprint1` | **10/10 PASS** |
| E2E `sprint01`, fixture DEMO mới `uat06` (`app.seed_uat`) | **2/2 PASS** |

**Kịch bản UI-05B** (`starter/apps/web/knowledge-detail-tests/knowledge-detail.spec.ts`), dữ liệu tạo qua workflow thật:
1. **Dữ liệu:**
   - Tiêu đề và metadata khớp API.
   - Các mục ghi lệch thứ tự (6, 2, 1, 10, 3) hiển thị đúng 1, 2, 3, 6, 10; danh sách đánh số đúng.
   - Mã `S1-…` và các dòng giữ chỗ không hiện.
   - Ảnh đại diện tải được; ảnh của bước 2 nằm trong mục 2, dòng tên tệp không hiện.
   - "Cùng công đoạn" chỉ chứa bài API trả về và không có bài đang xem.
   - Mobile: chuyển tab ẩn/hiện đúng phần. Desktop/tablet: không có tab.
   - 3 tệp; tải PDF trả 200. Người duyệt khớp API.
   - Không tràn ngang, không lỗi JS.
2. **Quay lại:**
   - `/knowledge?q=DEMO&type=ARTICLE&sort=title&page=2&view=grid` → mở bài → "Kho tri thức" về đúng URL, ô tìm giữ "DEMO", cùng bài đầu tiên.
   - Reload trang bài rồi quay lại: vẫn đúng.
   - Thư viện → bài A → bài liên quan B → "Kho tri thức": về danh sách đã lưu.
   - Tab thứ hai mở trực tiếp: về `/knowledge`. Tab thứ hai đổi bộ lọc không ảnh hưởng tab đầu.
3. **Quyền:**
   - Bản nháp, bản chờ duyệt: "Không tìm thấy bài viết", không lộ tiêu đề.
   - `other`, `admin`: không thấy bài, ảnh; API tệp trả 404.
   - Chưa đăng nhập: chuyển về `/login`.
4. **Trạng thái:** đang tải, lỗi 500 + Thử lại, 403, lỗi tải tệp không chặn nội dung, bài không tồn tại.

### Ảnh Mockup / Before / After

Chưa có mockup được duyệt riêng cho màn này, nên cột **Mockup** là ảnh đề xuất mà PO đã chấp thuận định hướng. Ảnh After chụp trang thật trên staging, tài khoản `employee`, bài DEMO tạo qua workflow thật (`scripts/ui-knowledge-detail/fixture.mjs`, mục 5 gắn ảnh "sau xử lý").

| Viewport | Mockup / Before / After | After |
|---|---|---|
| Desktop 1440×900 | [final-desktop](final-desktop.png) | [màn hình](after-desktop.png) · [toàn trang](after-desktop-full.png) |
| Tablet 768×1024 | [final-tablet](final-tablet.png) | [màn hình](after-tablet.png) · [toàn trang](after-tablet-full.png) |
| Mobile 390×844 | [final-mobile390](final-mobile390.png) | [3 tab](after-mobile390-tabs.png) · [Nội dung](after-mobile390-full.png) · [Ảnh & tệp](after-mobile390-files-full.png) · [Phê duyệt](after-mobile390-approval-full.png) |
| Mobile 375×812 | [final-mobile375](final-mobile375.png) | [3 tab](after-mobile375-tabs.png) · [Nội dung](after-mobile375-full.png) · [Ảnh & tệp](after-mobile375-files-full.png) · [Phê duyệt](after-mobile375-approval-full.png) |

Tái tạo:
```sh
UI_DEMO_PASSWORD=… node scripts/ui-knowledge-detail/fixture.mjs
UI_DEMO_PASSWORD=… UI_ARTICLE_ID=<id> UI_CAPTURE_PHASE=after node scripts/ui-knowledge-detail/capture.cjs
… UI_CAPTURE_TAB=files UI_CAPTURE_SUFFIX=-files …   # và UI_CAPTURE_TAB=approval UI_CAPTURE_SUFFIX=-approval
python3 scripts/ui-knowledge-detail/compare.py
cd starter/apps/web && UI_TEST_LOCAL_CA=true UI_DEMO_PASSWORD=… npx playwright test -c playwright.knowledge-detail.config.ts
```

### Điểm cần PO lưu ý khi nghiệm thu

- **Ảnh theo bước** dùng quy ước tên tệp (mục 7, quyết định 3). Người biên soạn cần ghi đúng tên tệp ảnh trong mục. Muốn chọn ảnh theo mục ngay trong trình biên soạn thì cần DATA-23 (thay đổi DB/API), chưa làm.
- **Trên mobile**, ảnh đại diện (cao tối đa 170px) và metadata đẩy thanh tab xuống gần cuối màn hình đầu tiên (390×844). Nếu PO muốn tab hiện ngay, có thể chuyển ảnh đại diện vào tab Nội dung.
- **"Cùng công đoạn"** trên staging hiện cả bài do test tự động tạo; đó là dữ liệu thật của staging, môi trường thật sẽ chỉ có bài nghiệp vụ.
- **Bài "Giải pháp sự cố"** từ Kho tri thức vẫn mở `/incidents/[id]` (mockup 05, làm riêng).
- **Lịch sử phiên bản đầy đủ:** DATA-22, chưa làm.

## 8. Vòng 2 (09/11/2026): mobile, quy ước ảnh, môi trường review sạch

### Quyết định của PO

1. **Ảnh theo bước:** chấp nhận tạm thời quy ước tên tệp trong MVP. Giữ DATA-23 (chọn và gắn ảnh trực tiếp vào từng mục) trong backlog.
2. **Mobile:**
   - ảnh đại diện chuyển vào tab "Nội dung";
   - thanh 3 tab nằm ngay sau tiêu đề và metadata rút gọn;
   - desktop và tablet giữ nguyên.
3. **"Cùng công đoạn":** giữ; không xóa audit hay nội dung đã duyệt để làm sạch staging; đề xuất môi trường review DEMO riêng.

### Thay đổi (chỉ web, 2 file component + test)

- **`knowledge-detail.tsx`:**
  - Trên mobile, khối tiêu đề có tiêu đề, chip (Đã duyệt · phiên bản · Bài tri thức · công đoạn) và **một dòng metadata**: người chia sẻ · bộ phận · ngày duyệt.
  - Phiên bản và công đoạn đã có trong chip, nên không mất thông tin.
  - Ảnh đại diện nằm đầu tab "Nội dung".
  - Desktop/tablet giữ ảnh dưới tiêu đề và lưới metadata 3 cột như cũ.
  - Mỗi bố cục chỉ hiển thị một bản ảnh; bản còn lại `display: none`, nên trình đọc màn hình chỉ thấy một.
- **`knowledge-detail.module.css`:** chỉ thêm quy tắc trong `@media (max-width: 767px)`.
- **Test:** kịch bản 1 kiểm tra thêm trên mobile:
  - thanh tab nằm trọn trong màn hình đầu tiên (390×844, 375×812);
  - có dòng metadata rút gọn, lưới metadata bị ẩn;
  - ảnh đại diện nằm trong tab Nội dung và biến mất khi sang tab "Ảnh & tệp".
  Desktop/tablet kiểm tra ảnh vẫn ở khối tiêu đề và lưới metadata vẫn hiện.
- **Không đổi:** API, auth, RBAC, RLS, workflow phê duyệt; UI-01 → UI-05.

### Kiểm thử vòng 2 (staging HTTPS, sau khi build lại `web`)

| Kiểm tra | Kết quả |
|---|---|
| ESLint / TypeScript / Next production build | PASS |
| Unit test model | 26/26 PASS |
| UI-05B Playwright (4 viewport × 4 kịch bản) | **16/16 PASS** ([JSON](test-results.json)) |
| Regression UI-01 / UI-02 / UI-03 / UI-04 / UI-05 | **9/9 · 16/16 · 16/16 · 16/16 · 20/20 PASS** (JSON `regression-*.json` đã cập nhật) |
| E2E `smoke` + `sprint1` | **10/10 PASS** |
| CI `c741eac` (lần triển khai đầu) | ✅ foundation · postgres17 · staging-acceptance, cả push và pull_request |

### Ảnh Before / After vòng 2 (`round2/`)

| Viewport | Trước → sau | 3 tab (trước → sau) |
|---|---|---|
| Mobile 390×844 | [compare-mobile390](round2/compare-mobile390.png) | [compare-mobile390-tabs](round2/compare-mobile390-tabs.png) |
| Mobile 375×812 | [compare-mobile375](round2/compare-mobile375.png) | [compare-mobile375-tabs](round2/compare-mobile375-tabs.png) |

Ảnh After chính (`after-*.png`, `final-*.png`, `after-mobile*-tabs.png`) đã chụp lại sau vòng 2. Desktop và tablet không đổi bố cục.

### Đề xuất: môi trường review DEMO sạch, tách khỏi kiểm thử tự động

**Vấn đề:**
- Staging `jkc-staging-s1` (https://localhost:18444) được dùng chung cho review và cho các bộ test tự động.
- Mỗi lần chạy test tạo thêm bài DEMO qua workflow thật.
- Duyệt bài và xác nhận đọc không hoàn tác được; audit phải giữ.
- Vì vậy "Cùng công đoạn", "Mới được duyệt"… trên staging lẫn bài test. Không được xóa để làm sạch.

**Đề xuất:** thêm một stack thứ hai, **chỉ dùng để PO/người dùng review**, từ cùng `deploy/compose.yml`. Không sửa code ứng dụng, không đổi quyền.

| Hạng mục | Cách làm |
|---|---|
| Tách biệt | Compose project riêng, ví dụ `jkc-review`, file env riêng `.local/review.env` (không commit): DB, volume tệp, mật khẩu DB/runtime/DEMO riêng; cổng riêng, ví dụ `HTTPS_PORT=18446`, `BIND_ADDRESS=127.0.0.1` (không mở ra mạng ngoài). Staging hiện tại giữ nguyên làm môi trường test tự động |
| Dữ liệu | Chỉ seed tài khoản DEMO (`seed` profile `demo`) và **bộ nội dung review chọn lọc**, tạo qua workflow thật bằng các script có sẵn (`scripts/ui-knowledge/fixture.mjs`, `scripts/ui-knowledge-detail/fixture.mjs`, fixture UI-03/UI-04) với `UI_BASE_URL` trỏ vào stack review. Tiêu đề có nhãn DEMO, không có thông số vận hành |
| Chặn test chạy nhầm | Thêm lệnh kiểm tra trong các fixture/Playwright config: từ chối chạy khi `UI_BASE_URL` trùng cổng review (hoặc khi API báo `APP_ENV=review`). Đây là thay đổi nhỏ trong code test, không chạm ứng dụng |
| Làm mới | Stack review là dữ liệu dùng một lần, không chứa dữ liệu thật: muốn làm sạch thì chạy `docker compose -p jkc-review … down --volumes` rồi dựng lại và seed lại. Lệnh chỉ trỏ vào project `jkc-review`, **không đụng staging và audit của staging**. Cần lưu lại thì chụp trước bằng `scripts/staging/snapshot.py` |
| Đóng gói | Một script `scripts/review/up.sh` (dựng, seed, in URL và CA) cùng hướng dẫn trong README. Ước lượng khoảng 0,5–1 ngày công, gồm kiểm thử |
| Cần quyết định | PO/IT chốt: cổng, ai được truy cập (chỉ máy nội bộ), tần suất làm mới, và stack review có đi theo nhánh đang review hay theo bản đã merge |

Chưa triển khai đề xuất này; chờ PO quyết định.
