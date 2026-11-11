# UI-07 — Tạo bài chia sẻ kinh nghiệm

Ngày 09/11/2026. Nhánh `feature/ui-knowledge-create`, tách từ `feature/ui-incident-detail` tại `e2bcaba`: commit UI-06 đã duyệt `5488a20` cộng một commit chỉ định dạng Prettier cho file test. Mockup: `design/approved_screens/06_create_knowledge.png`.

**Trạng thái:**
- **Vòng 2 (11/11/2026):** làm DATA-33 "Bài viết của tôi" theo quyết định PO (mục 7).
- Đã triển khai `/knowledge/new` trên desktop, tablet và mobile; luồng đầy đủ từ bản nháp đến khi bài hiện trong Kho tri thức đã kiểm thử local.
- Không đổi API, database, auth, RBAC, RLS hay workflow phê duyệt.
- Các trường trong mockup chưa có API được để trống, không làm nút giả (mục 3).
- Chưa merge. Chưa làm UI-08.

## 1. Khảo sát

**Trang cũ (Before)** là form `DraftForm` trong `Workspace` (Sprint 0):
- gọi API cũ `POST /articles` và `/articles/{id}/submit`, không chọn được công đoạn;
- không mở lại được bản nháp để sửa ("chưa có tính năng sửa bản nháp sau khi lưu");
- phải lưu xong mới hiện khu tải tệp; banner chung chung và các link nội bộ.

**API thực tế:**

| Nghiệp vụ | API | Ràng buộc từ máy chủ |
|---|---|---|
| Tạo nháp | `POST /workspace/contents` | `kind` ARTICLE; tiêu đề 1–200 ký tự; `body` là object. Bài **luôn thuộc bộ phận của tài khoản**. Phạm vi ARTICLE chỉ `DEPARTMENT` (COMPANY chỉ dành cho nội quy của HR). Tài khoản không có bộ phận → 403 |
| Lưu nháp | `PUT /workspace/contents` | Chỉ tác giả, chỉ khi DRAFT; sai `revision` (sửa ở nơi khác) → 409 |
| Gửi duyệt | `POST /workspace/contents/submit` | Chỉ tác giả; ARTICLE **bắt buộc có công đoạn**; tạo yêu cầu duyệt cho bộ phận |
| Duyệt | `POST /workspace/contents/approve` | Trưởng bộ phận trong phạm vi; **không tự duyệt bài của mình** (`jkc_review` loại tác giả) |
| Tạo bản sửa | `POST /workspace/contents/fork` | Từ bản đã duyệt, cần sửa hoặc bị từ chối |
| Mở lại bài của mình | `GET /workspace/contents` | Danh sách bài của tác giả (mọi phiên bản) |
| Đính kèm | `POST /content-versions/{id}/attachments` | Chỉ tác giả và chỉ bản nháp; PNG/JPEG/PDF tĩnh, chuẩn hóa lại; tối đa 10 MiB; **quét ClamAV ngay khi tải lên**, nhiễm mã độc → 422. Không có API xóa tệp |
| Danh mục công đoạn | `GET /processes` | |

## 2. Triển khai

### Bố cục

- **Desktop 1440×900**, theo mockup 06:
  - tiêu đề trang và nút "Quay lại danh sách";
  - **(1) Thông tin chung**: Tiêu đề, Công đoạn, Bộ phận và Phạm vi chia sẻ (chỉ đọc, đúng quy tắc máy chủ);
  - **(2)–(8) 7 mục nội dung** dạng thẻ 2 cột, có gợi ý và bộ đếm ký tự;
  - **(9) Tệp đính kèm**: kéo thả hoặc chọn tệp;
  - thanh thao tác **Lưu nháp · Xem trước · Gửi duyệt**;
  - cột phải "Mẫu bài viết tốt".
- **Tablet 768×1024:** một cột; mục nội dung 1 cột khi hẹp.
- **Mobile 390×844 / 375×812**, theo mockup 06 mobile:
  - 3 bước **Nội dung / Đính kèm (n) / Xem trước**;
  - thanh **Lưu nháp / Gửi duyệt cố định** phía trên bottom nav;
  - mọi vùng chạm ≥ 44px; không tràn ngang.

**Các mục nội dung**: theo mockup, thêm "Nguyên nhân" theo yêu cầu UI-07.
1. Mô tả vấn đề / kinh nghiệm *(bắt buộc khi gửi duyệt)*
2. Điều kiện phát sinh
3. Nguyên nhân (gợi ý ghi rõ giả thuyết hay đã xác minh)
4. Các bước kiểm tra
5. Giải pháp / quy trình thao tác
6. Kết quả đạt được
7. Lưu ý an toàn và phạm vi áp dụng

Lưu vào `body` với khóa có số (`"1. Mô tả vấn đề / kinh nghiệm"`…). JSONB không giữ thứ tự khóa, nên số này giúp thứ tự **không đổi sau khi lưu và đọc lại**; trang chi tiết UI-05B sắp theo số. Mục rỗng không lưu.

Khi mở bản nháp cũ, các tiêu đề của form trước và mockup 06 tự vào đúng ô. Mục lạ (ví dụ viết ở "Biên soạn") được giữ nguyên khi lưu.

### Thao tác và an toàn dữ liệu

- **Lưu nháp:**
  - lần đầu tạo bài, URL đổi thành `/knowledge/new?id=…` để reload hay quay lại vẫn mở đúng bản nháp;
  - các lần sau lưu kèm `revision`;
  - chỉ báo "Đã lưu bản nháp lúc HH:MM" sau khi máy chủ trả về.
- **Gửi duyệt:**
  - kiểm tra trước tiêu đề, công đoạn và mục 1;
  - còn thay đổi chưa lưu thì lưu trước rồi mới gửi;
  - báo "Đã gửi trưởng bộ phận duyệt…" sau khi máy chủ trả `PENDING`;
  - sau đó form bị khóa và thanh trạng thái hiện "Đang chờ duyệt".
- **Trạng thái bài:**
  - Đã duyệt → link "Xem bài trong Kho tri thức";
  - Cần chỉnh sửa / Bị từ chối → hiện ý kiến người duyệt và nút **Tạo bản sửa mới** (API `fork`).
- **Lỗi nhập ngay tại trường:**
  - `aria-invalid`, thông báo dưới trường, và một thông báo chung;
  - tiêu đề 5–200 ký tự; mỗi mục ≤ 5.000 ký tự; công đoạn và mục 1 bắt buộc khi gửi.
- **Chống bấm trùng:** khóa bằng ref ngay khi bấm (trước cả khi React render lại) và vô hiệu hóa nút khi đang xử lý. Test bấm đúp chỉ tạo **1** bản nháp.
- **Lỗi từ máy chủ hoặc mạng:** hiện đúng nguyên nhân, không báo thành công giả.
  - mất mạng: "Thao tác chưa được ghi nhận";
  - 409: "Tải lại trang";
  - 403, 413, 422: dùng thông báo của máy chủ;
  - 401: chuyển về đăng nhập.
- **Cảnh báo rời trang khi còn thay đổi chưa lưu:**
  - `beforeunload` khi đóng hoặc tải lại tab;
  - hỏi xác nhận khi bấm link trong ứng dụng.
- **Đính kèm:**
  - kiểm tra nhanh định dạng và dung lượng trước khi gửi; máy chủ vẫn kiểm tra lại và quét;
  - bài chưa lưu sẽ được **lưu nháp trước khi tải tệp**, vì tệp gắn với phiên bản nháp;
  - trạng thái từng tệp: ảnh xem trước tại máy, "Đang tải lên và quét…", "Đã tải lên · đã quét an toàn" (có nút tải về), hoặc "Lỗi: …";
  - quét là **đồng bộ**: máy chủ chỉ tạo bản ghi khi tệp sạch, nên không có trạng thái "đang quét" kéo dài sau khi tải xong.
- **Xem trước:** dựng bằng chính bộ phân tích của trang chi tiết UI-05B (thứ tự số, danh sách, ảnh theo quy ước "Ảnh: tên-tệp"), có nhãn "Xem trước · chưa phải bài đã duyệt".
- **Quyền:**
  - tài khoản không có bộ phận không thấy form;
  - mở `?id=` của người khác báo "Không mở được bài viết", vì API chỉ trả bài của tác giả;
  - chưa đăng nhập chuyển về `/login`;
  - bài chờ duyệt không xuất hiện trong Kho tri thức và trang chi tiết trả 404, cho tới khi trưởng bộ phận duyệt.

### Thay đổi code

- **Web (mới):** `components/knowledge-create.tsx`, `knowledge-create.module.css`, `knowledge-create-model.ts`; `app/knowledge/new/page.tsx` dùng component mới (có `Suspense` cho `useSearchParams`). Dùng lại helper của UI-04/05B; **không sửa file của UI-01 → UI-06**.
- **Test cũ cập nhật selector** (giống cách đã làm ở UI-04):
  - `tests/smoke.spec.ts` (2 test) và `tests/sprint01.spec.ts` (1 test) đi qua form cũ;
  - đổi tên nút ("Lưu nháp", "Gửi duyệt"), câu thông báo mới, chọn công đoạn (máy chủ bắt buộc khi gửi);
  - ô chọn tệp tự tải lên, link tải về "Tải <tên tệp>";
  - mục đích các test giữ nguyên.
- **Không đổi:** API, OpenAPI, DB, migration, auth, session, CSRF, RBAC, RLS, workflow phê duyệt.

## 3. GAP so với mockup 06 — cần PO quyết định

| Mockup 06 | UI-07 hiện tại | Lý do | Backlog |
|---|---|---|---|
| Bộ phận (ô chọn) | "Bộ phận của tài khoản bạn" (chỉ đọc) | **PO quyết định giữ bộ phận tự gán**, không thêm ô chọn | DATA-30 (đóng) |
| Loại bài (Kinh nghiệm xử lý…) | Không hiện | Chưa có danh mục loại | DATA-13 |
| Tag (bong mực, flexo…) | Không hiện | Chưa có API thẻ | DATA-15 |
| Nút × xóa tệp | Không hiện; ghi "Chưa hỗ trợ xóa" | Chưa có API xóa tệp | DATA-31 (**P1**, PO 11/11) |
| Hỗ trợ MP4 | Chỉ PNG, JPEG, PDF | API chưa nhận video | DATA-32 |
| Ảnh gắn vào mục | Quy ước dòng "Ảnh: tên-tệp" (PO đã chấp nhận ở UI-05B) | Chưa có liên kết tệp–mục | DATA-23 |
| Mở lại bản nháp từ danh sách | **Đã có (vòng 2):** trang "Bài viết của tôi" `/knowledge/mine` | — | DATA-33 (xong) |
| 6 mục | 7 mục (thêm "Nguyên nhân" theo yêu cầu UI-07) | Theo task UI-07 | — |

## 4. Kiểm thử (staging HTTPS, sau khi build lại `web`)

| Kiểm tra | Kết quả |
|---|---|
| ESLint / TypeScript / Prettier / Next production build | PASS |
| Ruff check/format, OpenAPI drift check | PASS (API không đổi) |
| pytest backend, PostgreSQL 16 sạch | **63/63 PASS** |
| Unit test model | **35/35 PASS** (6 mới cho UI-07) |
| UI-07 Playwright (desktop, tablet, 390, 375 × 4 kịch bản) | **16/16 PASS**, [JSON](test-results.json) |
| Regression UI-01 / 02 / 03 / 04 / 05 / 05B / 06 | **9/9 · 16/16 · 16/16 · 16/16 · 20/20 · 16/16 · 16/16 PASS** ([01](regression-ui01-login.json) · [02](regression-ui02-dashboard.json) · [03](regression-ui03-documents.json) · [04](regression-ui04-document-detail.json) · [05](regression-ui05-knowledge.json) · [05B](regression-ui05b-knowledge-detail.json) · [06](regression-ui06-incident-detail.json)) |
| E2E `smoke` + `sprint1` (đã cập nhật selector) | **10/10 PASS** |
| E2E `sprint01`, fixture DEMO mới `uat08` | **2/2 PASS** |

**Ghi chú:**
- Lần chạy regression đầu, 4 test `smoke` và 2 test `sprint01` hỏng vì vẫn tìm form cũ. Sau khi cập nhật selector, còn một lỗi do component: thẻ mục có `aria-labelledby` làm `getByLabel("Mô tả vấn đề")` khớp 2 phần tử. Đã bỏ thuộc tính thừa này (ô nhập vẫn có nhãn riêng), sau đó các bộ trên pass.
- Fixture `uat07` đã bị dùng mất ở lần chạy hỏng (đã xác nhận đọc trước khi tới bước form), nên chạy lại bằng `uat08`.

**Kịch bản UI-07** (`starter/apps/web/knowledge-create-tests/knowledge-create.spec.ts`):
1. **Luồng đầy đủ:**
   - điền lệch thứ tự → Lưu nháp; URL có `?id=`; API trả `DRAFT` với khóa có số;
   - reload: mọi ô đúng giá trị;
   - sửa và lưu lại: `revision` tăng;
   - tải PNG hợp lệ ("đã quét an toàn"), `.txt` bị chặn ở máy khách, PNG giả bị máy chủ từ chối; API chỉ còn đúng 1 tệp;
   - xem trước: thứ tự 1, 4, 5, 7 và ảnh nằm trong mục 5;
   - gửi duyệt: API trả `PENDING`, form khóa; Kho tri thức chưa có bài, chi tiết trả 404;
   - **tác giả tự duyệt bị chặn** (403/404);
   - trưởng bộ phận duyệt qua API → bài xuất hiện khi tìm trong Kho tri thức; trang chi tiết đúng thứ tự mục và có ảnh trong mục.
2. **Lỗi và bảo vệ:**
   - gửi khi trống: lỗi tại trường, **không có request ghi nào**;
   - mất mạng: thông báo lỗi, không có thông báo thành công, không tạo bài;
   - bấm đúp: đúng 1 request và 1 bản nháp;
   - lưu với `revision` cũ (đã sửa ở nơi khác): thông báo xung đột;
   - rời trang khi chưa lưu: hộp xác nhận xuất hiện; chọn ở lại thì giữ trang.
3. **Quyền:** chưa đăng nhập → `/login`; trưởng bộ phận mở bản nháp của nhân viên → "Không mở được bài viết"; tài khoản không có bộ phận (giả lập `/auth/me`) → không có form.
4. **Bố cục:** nút ≥ 44px; trên mobile, thanh thao tác nằm trong màn hình, 3 bước ẩn/hiện đúng phần, nút "chọn tệp" ≥ 44px; trên desktop không có bước và có khung "Mẫu bài viết tốt"; không tràn ngang.

## 5. Ảnh Mockup / Before / After

Ảnh chụp thật trên staging bằng tài khoản `employee`:
- "After" là form mới đã điền dữ liệu DEMO ở máy, **chưa lưu**;
- "draft" là bản nháp DEMO thật, có 1 ảnh và 1 PDF, tạo qua API (`scripts/ui-knowledge-create/fixture.mjs`).

| Viewport | Mockup / Before / After | Thêm |
|---|---|---|
| Desktop 1440×900 | [comparison-desktop](comparison-desktop.png) | [trống](after-desktop.png) · [đã điền, toàn trang](after-desktop-filled-full.png) · [xem trước](after-desktop-preview-full.png) · [bản nháp có tệp](after-desktop-draft-full.png) |
| Tablet 768×1024 | [comparison-tablet](comparison-tablet.png) | [đã điền, toàn trang](after-tablet-filled-full.png) · [bản nháp có tệp](after-tablet-draft-full.png) |
| Mobile 390×844 | [comparison-mobile390](comparison-mobile390.png) | [3 bước](after-mobile390-steps.png) · [toàn trang](after-mobile390-filled-full.png) |
| Mobile 375×812 | [comparison-mobile375](comparison-mobile375.png) | [3 bước](after-mobile375-steps.png) · [toàn trang](after-mobile375-filled-full.png) |

Before: `before-*.png` (4 viewport, có bản toàn trang).

**Tái tạo:**
```sh
UI_DEMO_PASSWORD=… UI_CAPTURE_PHASE=after node scripts/ui-knowledge-create/capture.cjs        # trống
… UI_CAPTURE_FILL=true UI_CAPTURE_SUFFIX=-filled …                                             # đã điền (không lưu)
… UI_CAPTURE_FILL=true UI_CAPTURE_STEP=preview UI_CAPTURE_SUFFIX=-preview …
ID=$(UI_DEMO_PASSWORD=… node scripts/ui-knowledge-create/fixture.mjs | jq -r .id)              # bản nháp DEMO có tệp
… UI_CAPTURE_PATH="/knowledge/new?id=$ID" UI_CAPTURE_SUFFIX=-draft …
python3 scripts/ui-knowledge-create/compare.py
cd starter/apps/web && UI_TEST_LOCAL_CA=true UI_DEMO_PASSWORD=… npx playwright test -c playwright.knowledge-create.config.ts
```

## 6. Chưa làm / ngoài phạm vi

- DATA-31 (P1, cần API xóa tệp), DATA-13, DATA-15, DATA-23, DATA-32 (backlog).
- Trang "Biên soạn / phiên bản" (`/workspace`) và "Phê duyệt" (`/approvals`, mockup 08) vẫn là giao diện cũ.
- Chưa có tự động lưu nháp (autosave); chỉ lưu khi người dùng bấm.
- Chưa làm UI-08.

## 7. Vòng 2 (11/11/2026): DATA-33 "Bài viết của tôi"

### Quyết định của PO
1. Giữ nguyên giao diện tạo bài theo mockup 06.
2. Ưu tiên DATA-33: đường dẫn "Bài viết của tôi" và danh sách cơ bản để tìm lại bài ở các trạng thái nháp, chờ duyệt, cần chỉnh sửa, bị từ chối, đã duyệt.
3. Chỉ dùng `GET /workspace/contents` có sẵn; không đổi DB, quyền hay workflow.
4. Mở lại bản nháp qua `/knowledge/new?id=…`; chỉ hiện hành động hợp lệ theo trạng thái.
5. DATA-30: giữ bộ phận tự gán theo tài khoản (không làm ô chọn).
6. DATA-31 lên P1; DATA-13/15, DATA-23, DATA-32 để backlog.

### Triển khai
- **Trang mới `/knowledge/mine`** (`components/knowledge-mine.tsx`, `knowledge-mine.module.css`, `knowledge-mine-model.ts`; `app/knowledge/mine/page.tsx`):
  - lấy `GET /workspace/contents`, chỉ giữ **bài ARTICLE do chính người dùng tạo**. API này còn trả bài chờ người dùng duyệt (nếu là trưởng bộ phận); các bài đó **không** hiện ở đây. Nội quy (DOCUMENT) cũng không hiện;
  - **mỗi bài một dòng** = phiên bản mới nhất (bản mà workflow đang xử lý), hiện trạng thái, số phiên bản, ngày tạo phiên bản, công đoạn;
  - "Cần chỉnh sửa" và "Bị từ chối" hiện **ý kiến người duyệt**;
  - nếu bài đang có bản mới (nháp/chờ duyệt) trong khi bản cũ đã duyệt vẫn hiển thị, ghi rõ "Bản vN đã duyệt vẫn đang hiển thị trong Kho tri thức";
  - lọc theo trạng thái (chip có số đếm), tìm theo tiêu đề (không dấu), phân trang 10 bài; bộ lọc lưu trên URL nên reload hay quay lại vẫn giữ;
  - trạng thái: đang tải, chưa có bài (kèm "Tạo bài chia sẻ đầu tiên" khi có bộ phận), không khớp (kèm "Xóa bộ lọc"), lỗi + "Thử lại".
- **Hành động theo trạng thái** (mọi chỉnh sửa vẫn qua form UI-07, nên workflow giữ nguyên):

| Trạng thái | Hành động |
|---|---|
| Bản nháp | Tiếp tục soạn → `/knowledge/new?id=` |
| Chờ duyệt | Xem bài đang chờ duyệt → form ở chế độ khóa |
| Cần chỉnh sửa, Bị từ chối | Xem ý kiến và tạo bản sửa → form (nút "Tạo bản sửa mới" gọi `fork`) |
| Đã duyệt | Xem trong Kho tri thức → `/knowledge/{id}` · Tạo bản sửa mới → form |
| (thêm) Có bản cũ đã duyệt | Xem bản vN đang hiển thị → `/knowledge/{id}` |

- **Lối vào:** link "Bài viết của tôi" ở đầu trang Tạo bài (desktop; trên mobile nằm hàng riêng dưới tiêu đề). Link này cũng đi qua cảnh báo khi còn thay đổi chưa lưu. Chưa thêm lối vào ở Kho tri thức hay menu tài khoản vì đó là màn hình đã duyệt (UI-02/UI-05); chờ PO quyết định.
- **Không đổi:** API, OpenAPI, DB, auth, RBAC, RLS, workflow; UI-01 → UI-06.

### Kiểm thử vòng 2

| Kiểm tra | Kết quả |
|---|---|
| ESLint / TypeScript / Prettier / Next production build | PASS |
| pytest backend (PostgreSQL 16 sạch) | 63/63 PASS |
| Unit test model | **39/39 PASS** (4 mới cho "Bài viết của tôi") |
| UI-07 Playwright (4 viewport × 6 kịch bản: 4 cũ + 2 mới) | **24/24 PASS**, [JSON](test-results.json) |
| Regression UI-01 / 02 / 03 / 04 / 05 / 05B / 06 | **9/9 · 16/16 · 16/16 · 16/16 · 20/20 · 16/16 · 16/16 PASS** (JSON `regression-*.json` đã cập nhật) |
| `smoke` + `sprint1` · `sprint01` (fixture mới `uat09`) | **10/10 · 2/2 PASS** |
| CI `655a9d9` (vòng 1) | ✅ foundation · postgres17 · staging-acceptance (push + PR) |

**Kịch bản mới** (`knowledge-create-tests/knowledge-mine.spec.ts`), dữ liệu tạo qua workflow thật (trưởng bộ phận yêu cầu sửa / từ chối / duyệt; tác giả tạo bản sửa):
1. Từ trang Tạo bài bấm "Bài viết của tôi"; tìm theo mã kiểm thử ra đúng 6 bài:
   - mỗi bài đúng trạng thái và **đúng danh sách hành động** (nhãn và đường dẫn);
   - có ý kiến người duyệt; bài đang sửa ghi v2 và có link xem bản v1;
   - lọc "Cần chỉnh sửa" còn 1 bài; URL có `status=`; reload vẫn giữ;
   - bấm "Tiếp tục soạn" mở form với đúng tiêu đề và cho sửa; bài chờ duyệt mở ở chế độ khóa;
   - không có lỗi JS.
2. Trưởng bộ phận **không thấy bài của nhân viên** trong "Bài viết của tôi" (dù có quyền duyệt). Không khớp → "Xóa bộ lọc"; danh sách rỗng (giả lập); lỗi 500 + "Thử lại"; không tràn ngang; link hành động cao ≥ 44px; chip trên mobile ≥ 44px.

### Ảnh vòng 2

| Màn | Desktop | Mobile 390 | Mobile 375 |
|---|---|---|---|
| Bài viết của tôi (6 bài DEMO, đủ trạng thái) | [màn hình](after-desktop-mine.png) · [toàn trang](after-desktop-mine-full.png) | [màn hình](after-mobile390-mine.png) · [toàn trang](after-mobile390-mine-full.png) | [màn hình](after-mobile375-mine.png) · [toàn trang](after-mobile375-mine-full.png) |
| Tạo bài (có link "Bài viết của tôi") | [after-desktop](after-desktop.png) | [after-mobile390](after-mobile390.png) | [after-mobile375](after-mobile375.png) |

Tablet: [after-tablet-mine](after-tablet-mine.png). Dữ liệu ảnh: `UI_DEMO_PASSWORD=… node scripts/ui-knowledge-create/fixture-mine.mjs` (in mã), rồi `UI_CAPTURE_PATH="/knowledge/mine?q=<mã>" UI_CAPTURE_SUFFIX=-mine node scripts/ui-knowledge-create/capture.cjs`.

Số trên chip là tổng theo trạng thái của mọi bài của người dùng (không phụ thuộc ô tìm). Trên staging, `employee` có hơn 400 bài do các bộ test tự động tạo.
