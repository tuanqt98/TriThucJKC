# UI-06 — Chi tiết sự cố & giải pháp

Ngày 09/11/2026. Nhánh `feature/ui-incident-detail`, tách từ `feature/ui-knowledge-detail` tại `a3c3b93` (UI-05B đã được PO duyệt; chứa UI-01 → UI-05B). Mockup: `design/approved_screens/05_incident_detail.png`.

**Trạng thái:**
- Đã triển khai `/incidents/[id]` theo mockup 05 trên desktop, tablet và mobile; kiểm thử local đạt.
- Nhiều thành phần của mockup chưa có dữ liệu trong API. Bảng GAP ở mục 3 cần PO quyết định.
- Không hiển thị dữ liệu giả; không khẳng định "Đã xác minh" khi API không trả thông tin xác minh.
- Chưa merge. Chưa làm UI-07.

## 1. Khảo sát

**Hai nguồn dữ liệu "sự cố" trong hệ thống hiện tại:**

| Nguồn | Nội dung | Quyền đọc | Dùng ở |
|---|---|---|---|
| **Hướng dẫn xử lý đã duyệt** (`contents.kind = INCIDENT_GUIDE`), `GET /api/v1/incidents/{id}` | Tiêu đề, mã, bộ phận, công đoạn, phiên bản, nội dung theo mục, người biên soạn, **người duyệt, ngày duyệt**, tệp đính kèm | ACL nội dung (chỉ bản đã duyệt, đúng phạm vi; ngoài phạm vi trả 404) | `/incidents` ("Hướng dẫn đã duyệt"), Kho tri thức, Dashboard đều mở `/incidents/[id]` bằng **id nội dung** |
| **Hồ sơ sự cố** (`incidents`, `incident_solutions`, `incident_occurrences`), `/api/v1/workspace/incidents` | Mức độ, hiện tượng, điều kiện, giải pháp đề xuất / đã xác minh, người và thời điểm xác minh, tái diễn | RLS: người báo cáo hoặc cùng bộ phận | `/incidents/manage` ("Hồ sơ / tái diễn") |

**Hai bên chưa liên kết:** cột `incident_solutions.approved_content_version_id` có trong schema nhưng không có luồng nào ghi. Vì vậy `/incidents/[id]` hiển thị **hướng dẫn đã duyệt**; mức độ, xác minh hiện trường và tái diễn không lấy được cho một hướng dẫn cụ thể.

**Biên soạn:** workflow nội dung chỉ tạo được DOCUMENT/ARTICLE, nên hướng dẫn sự cố hiện chỉ có từ seed. Xem mục 4 về dữ liệu DEMO.

**Trang cũ (Before)** vẫn là component `Workspace` Sprint 0:
- các mục sai thứ tự (1, 8, 5…) vì JSONB không giữ thứ tự khóa;
- banner chung "Chi tiết nội dung" và các link nội bộ;
- dòng "Ảnh: tên-tệp" hiện thành chữ thay vì ảnh;
- ảnh chỉ tải xuống được;
- còn dòng giữ chỗ "Nội dung DEMO để kiểm thử";
- "Quay lại thư viện" mất bộ lọc.

## 2. Triển khai

### Desktop 1440×900 (2 cột như mockup)
- Breadcrumb "← Kho tri thức › Giải pháp sự cố". Nút quay lại giữ từ khóa, bộ lọc, trang và kiểu xem, cùng cơ chế với UI-05B.
- **Khối tiêu đề:**
  - icon cảnh báo đỏ và mã nghiệp vụ (mã kỹ thuật `S1-…` bị ẩn);
  - chip **"Hướng dẫn đã duyệt"** · phiên bản · "Giải pháp sự cố" · công đoạn;
  - dải **ảnh sự cố** gồm ảnh thật chưa gắn vào mục; bấm vào ảnh để phóng to toàn màn hình;
  - metadata: Người biên soạn, Bộ phận, Công đoạn, **Người duyệt**, **Ngày duyệt**.
- **Các mục nội dung** dạng thẻ 2 cột, mỗi loại có icon và màu riêng như mockup:
  - các loại: Hiện tượng, Điều kiện, Nguyên nhân, Các bước kiểm tra, Giải pháp, Kết quả, Phòng ngừa, An toàn (khung vàng);
  - loại mục nhận theo tiêu đề đã duyệt (không phân biệt dấu); thứ tự theo số đầu tiêu đề;
  - ảnh theo bước dùng quy ước tên tệp PO đã duyệt ở UI-05B.
- **Phân biệt chưa xác minh:**
  - mục nguyên nhân viết dạng giả thuyết ("nghi ngờ", "giả thuyết", "dự kiến") có nhãn **"Giả thuyết · chưa xác minh"**;
  - giao diện không có nhãn "Đã xác minh" nào.
- **Cột phải:**
  1. **Trạng thái duyệt & xác minh:** hướng dẫn đã duyệt, phiên bản, người duyệt, ngày duyệt; "Xác minh hiện trường: **Chưa liên kết hồ sơ**", kèm giải thích ngắn.
  2. **Tái diễn:** "Chưa có dữ liệu tái diễn liên kết với hướng dẫn này". Người dùng có bộ phận có nút **"Ghi nhận tái diễn trong Hồ sơ sự cố"** (44px), dẫn tới `/incidents/manage`, nơi API tái diễn đã hỗ trợ (chống ghi trùng, đúng quyền).
  3. **Ảnh & tệp đính kèm:** ảnh thu nhỏ, dung lượng, trạng thái quét, tải từng tệp.
  4. **Sự cố cùng công đoạn:** tối đa 3 hướng dẫn đã duyệt khác, đúng ACL (`GET /incidents?processId=`).

### Tablet 768×1024
Một cột; các mục giữ 2 cột thẻ; thẻ phụ 2 cột một hàng; "Sự cố cùng công đoạn" chiếm cả hàng.

### Mobile 390×844 / 375×812
- Giữ Header và Bottom Navigation UI-02.
- Khối tiêu đề: tiêu đề, chip, dải ảnh vuốt ngang (ảnh rộng, bấm để phóng to) và một dòng metadata (bộ phận · ngày duyệt).
- **Các mục dạng accordion:** Hiện tượng, Nguyên nhân, Giải pháp mở sẵn; các mục khác đóng. Nút mở/đóng 44×44.
- Sau các mục: Trạng thái, Tái diễn (nút 44px), Ảnh & tệp, Cùng công đoạn.
- Không tràn ngang (đã test).

### Thay đổi code
- **Web (mới):** `components/incident-detail.tsx`, `incident-detail.module.css`, `incident-detail-model.ts`; `app/incidents/[id]/page.tsx` dùng component mới.
  - Dùng lại helper của UI-05B (`articleSections`, `splitImages`, `businessCode`, `libraryHref`, `shouldGoBack`); **không sửa file của UI-01 → UI-05B**.
- **API:** không đổi endpoint, schema, ACL hay RLS. `approver_name` đã có từ UI-05B.
- **DEMO seed (mới):** `app/seed_incident_guides.py`; xem mục 4.
- **Không đổi:** auth, session, CSRF, RBAC, RLS, workflow phê duyệt, xác nhận đọc, migration.

## 3. GAP so với mockup 05 — cần PO quyết định

| Mockup 05 | UI-06 hiện tại | Lý do | Đề xuất (backlog) |
|---|---|---|---|
| Mức độ "Cao" | Không hiện | Mức độ chỉ có ở hồ sơ, hướng dẫn chưa liên kết | DATA-24 |
| "Đã xác minh", Xác minh bởi, Ngày xác minh, "Nguyên nhân đã xác minh" | "Hướng dẫn đã duyệt" + người/ngày **duyệt**; "Xác minh hiện trường: Chưa liên kết hồ sơ"; nguyên nhân dạng giả thuyết có nhãn "chưa xác minh" | Không khẳng định xác minh khi API không có bằng chứng | DATA-24 |
| Người báo cáo, Ngày báo cáo | Người biên soạn, Ngày duyệt | Hướng dẫn có tác giả và người duyệt, không có người báo cáo | DATA-24 |
| Máy (Heidelberg SM74), Vật tư (Giấy Couche) | Không hiện | Chưa có danh mục thiết bị/vật tư | DATA-27 (đi cùng DATA-14) |
| Số lần tái diễn + biểu đồ 6 tháng | "Chưa có dữ liệu tái diễn liên kết" + nút sang Hồ sơ | Tái diễn gắn với hồ sơ | DATA-24, DATA-26 |
| Nút "Tôi cũng gặp lỗi này" | "Ghi nhận tái diễn trong Hồ sơ sự cố" (dẫn sang `/incidents/manage`) | API tái diễn cần id hồ sơ | DATA-26 |
| Sự cố liên quan (có mã, ngày) | Sự cố **cùng công đoạn** (hướng dẫn đã duyệt, đúng ACL) | Chưa có quan hệ nội dung | DATA-08 |
| Trao đổi & xác minh (bình luận) | Không hiện | Chưa có bảng | DATA-28 |
| In phiếu xử lý, Báo lỗi mới | Không hiện | Chưa có trang in; tạo hồ sơ ở `/incidents/manage` | DATA-29 (chỉ UI, có thể làm nhanh nếu PO muốn) |
| Bottom nav "Hỏi đáp" | Giữ bottom nav UI-02 | Không sửa UI-02 | — |
| Ảnh lớn + 4 ảnh nhỏ dưới tiêu đề (mobile) | Dải ảnh vuốt ngang, bấm để phóng to | Đúng ý, khác cách trình bày | — |

**Đề xuất kỹ thuật chính (DATA-24, cần PO/IT duyệt vì đổi nghiệp vụ và có thể cần migration):**
- Khi trưởng bộ phận xác minh giải pháp trong hồ sơ, cho phép "Xuất bản thành hướng dẫn": tạo bản nháp INCIDENT_GUIDE từ các trường của hồ sơ, rồi duyệt như bình thường.
- Sau khi duyệt, ghi `approved_content_version_id`.
- `GET /incidents/{id}` trả thêm `record_summary` chỉ đọc (mức độ, người và thời điểm xác minh, nguyên nhân đã xác minh, số lần tái diễn theo tháng).
- **Câu hỏi quyền:** người đọc hướng dẫn ở bộ phận khác có được thấy tóm tắt hồ sơ không? Hiện RLS hồ sơ chỉ cho người báo cáo và cùng bộ phận.

## 4. Dữ liệu DEMO cho review và test

- Workflow chưa tạo được INCIDENT_GUIDE (DATA-25), nên thêm module seed DEMO **`app/seed_incident_guides.py`**, chạy trong container `seed` (role owner) theo 2 bước:
  1. `draft`: tạo 5 hướng dẫn DEMO ở trạng thái **nháp**, mã `DEMO-UI06-*`: chính, không ảnh, liên quan cùng công đoạn, của bộ phận Kỹ thuật, và một bản nháp không bao giờ duyệt.
  2. Tác giả **tải ảnh và PDF qua API thật** (quét ClamAV, chuẩn hóa).
  3. `publish`: đặt trạng thái đã duyệt với người duyệt là trưởng bộ phận tương ứng.
- **Rào chắn:**
  - chỉ chạy khi `APP_ENV` là development/test và DB chỉ có tài khoản DEMO;
  - `publish` chỉ nhận bản nháp `DEMO-UI06-*` chưa xuất bản;
  - có audit log;
  - nội dung chung chung, ghi DEMO, không có thông số vận hành.
- **Công cụ:**
  - script điều phối: `scripts/ui-incident-detail/fixture.mjs`, ghi `.local/ui06.json` (gitignored, quyền 600);
  - Playwright chỉ đọc fixture này, nên chạy lại nhiều lần không sinh thêm dữ liệu.

## 5. Kiểm thử (staging HTTPS, sau khi build lại `api` + `web`)

| Kiểm tra | Kết quả |
|---|---|
| ESLint / TypeScript / Next production build | PASS |
| Ruff check/format, OpenAPI drift check | PASS (OpenAPI không đổi) |
| pytest backend, PostgreSQL 16 sạch | **63/63 PASS** (4 test mới, xem dưới) |
| Unit test model | **29/29 PASS** (3 mới cho UI-06) |
| UI-06 Playwright (desktop, tablet, 390, 375 × 4 kịch bản) | **16/16 PASS**, [JSON](test-results.json) |
| Regression UI-01 / UI-02 / UI-03 / UI-04 / UI-05 / UI-05B | **9/9 · 16/16 · 16/16 · 16/16 · 20/20 · 16/16 PASS** ([01](regression-ui01-login.json) · [02](regression-ui02-dashboard.json) · [03](regression-ui03-documents.json) · [04](regression-ui04-document-detail.json) · [05](regression-ui05-knowledge.json) · [05B](regression-ui05b-knowledge-detail.json)) |
| E2E `smoke` + `sprint1` | **10/10 PASS** |

**Ghi chú regression:** lần chạy đầu, một test UI-05B (desktop, "quay lại Kho tri thức") hỏng sau 13,5 phút. Log `pmset` cho thấy máy **ngủ do không hoạt động từ 15:30:52 đến 15:44:19** (đang dùng pin). Chạy lại bằng `caffeinate -dims` thì UI-05B 16/16 pass trong 55 giây. Không đổi code hay test UI-05B.

**pytest mới** (`tests/test_incident_guides.py`):
- bản nháp không ai xem được (404);
- sau khi duyệt, `employee`/`head` chỉ thấy hướng dẫn của Sản xuất, `other`/`admin` chỉ thấy của Kỹ thuật, kể cả khi tìm kiếm;
- `approver_name` đúng trưởng bộ phận;
- `publish` từ chối bản đã xuất bản và nội dung không phải `DEMO-UI06`;
- module từ chối chạy khi `APP_ENV=staging` hoặc khi DB có tài khoản ngoài namespace DEMO.

**Kịch bản Playwright UI-06** (`starter/apps/web/incident-detail-tests/incident-detail.spec.ts`):
1. **Dữ liệu:**
   - tiêu đề và metadata khớp API; 8 mục đúng thứ tự;
   - nhãn "Giả thuyết · chưa xác minh"; không có chữ "Đã xác minh";
   - trạng thái có người và ngày duyệt cùng "Chưa liên kết hồ sơ";
   - ảnh dưới tiêu đề và ảnh trong mục Hiện tượng; dòng tên tệp bị ẩn;
   - phóng to ảnh: ảnh tải được, nút Đóng nhận focus, Esc đóng;
   - 4 tệp; tải PDF trả 200;
   - "Sự cố cùng công đoạn" chỉ chứa hướng dẫn API trả về, không có bài đang xem;
   - nút ghi tái diễn cao ≥ 44px và mở `/incidents/manage`;
   - mobile: accordion mở đúng các mục ưu tiên, nút 44×44, bấm mở được mục đang đóng; desktop không có nút accordion;
   - không tràn ngang, không lỗi JS.
2. **Quay lại:**
   - Kho tri thức (`q`, loại Giải pháp sự cố, sắp xếp, kiểu lưới) → mở hướng dẫn → "Kho tri thức" về đúng URL và ô tìm giữ từ khóa;
   - reload rồi quay lại: vẫn đúng;
   - mở trực tiếp ở tab mới: về `/knowledge`.
3. **Quyền:**
   - bản nháp và hướng dẫn bộ phận Kỹ thuật với `employee`: "Không tìm thấy sự cố", không lộ tiêu đề;
   - `other` và `admin` (quản trị kỹ thuật) với hướng dẫn Sản xuất: 404, không có ảnh, API tệp trả 404;
   - đối chứng: `admin` (thuộc bộ phận Kỹ thuật) xem được hướng dẫn của Kỹ thuật;
   - chưa đăng nhập: chuyển về `/login`.
4. **Trạng thái:** đang tải, lỗi 500 + Thử lại, 403, lỗi tải tệp không chặn nội dung, hướng dẫn không ảnh, id không tồn tại.

## 6. Ảnh Mockup / Before / After

Ảnh chụp thật trên staging bằng tài khoản `employee`. Cột Mockup là phần ứng dụng cắt từ mockup 05.

| Viewport | Mockup / Before / After | After |
|---|---|---|
| Desktop 1440×900 | [comparison-desktop](comparison-desktop.png) | [màn hình](after-desktop.png) · [toàn trang](after-desktop-full.png) |
| Tablet 768×1024 | [comparison-tablet](comparison-tablet.png) | [màn hình](after-tablet.png) · [toàn trang](after-tablet-full.png) |
| Mobile 390×844 | [comparison-mobile390](comparison-mobile390.png) | [mặc định + mở tất cả](after-mobile390-pages.png) · [toàn trang](after-mobile390-full.png) |
| Mobile 375×812 | [comparison-mobile375](comparison-mobile375.png) | [mặc định + mở tất cả](after-mobile375-pages.png) · [toàn trang](after-mobile375-full.png) |

Before (4 viewport, có bản toàn trang): `before-*.png`. Ảnh Before chụp từ bộ fixture đầu tiên (mã `491F98`); After từ bộ fixture sau (mã `81B600`, có thêm hướng dẫn cùng công đoạn). Cả hai có cùng nội dung.

**Tái tạo:**
```sh
UI_DEMO_PASSWORD=… node scripts/ui-incident-detail/fixture.mjs            # → .local/ui06.json
UI_DEMO_PASSWORD=… UI_CAPTURE_PHASE=after node scripts/ui-incident-detail/capture.cjs
UI_CAPTURE_EXPAND=true UI_CAPTURE_SUFFIX=-expanded …                      # mobile: mở tất cả mục
python3 scripts/ui-incident-detail/compare.py
cd starter/apps/web && UI_TEST_LOCAL_CA=true UI_DEMO_PASSWORD=… UI_INCIDENT_FIXTURES=../../../.local/ui06.json \
  npx playwright test -c playwright.incident-detail.config.ts
```

## 7. Chưa làm / ngoài phạm vi

- DATA-24 → DATA-29 (mục 3): liên kết hướng dẫn với hồ sơ, biên soạn INCIDENT_GUIDE, "Tôi cũng gặp lỗi này" trên hướng dẫn, thiết bị/vật tư, bình luận, in phiếu, báo lỗi mới.
- Trang danh sách `/incidents` ("Hướng dẫn đã duyệt") và `/incidents/manage` vẫn là giao diện cũ, không thuộc UI-06.
- Môi trường review DEMO sạch (đề xuất ở UI-05B mục 8) chưa triển khai.
- Chưa làm UI-07.
