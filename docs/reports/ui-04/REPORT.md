# UI-04 — Chi tiết nội quy / quy trình Tri Thức JKC

Ngày 06/11/2026. Nhánh `feature/ui-document-detail`, tách từ UI-03 tại `3bb8557` (UI-03 chưa merge). Bản DEMO review: https://localhost:18444/documents/{id} (staging `jkc-staging-s1`).

**Đã triển khai trang chi tiết nội quy và luồng xác nhận đã đọc theo mockup 03. Kiểm thử local đạt; đang chờ PO duyệt. Một số trường trong mockup (ngày ban hành, ngày hiệu lực, chủ sở hữu, thẻ, tài liệu liên quan, lịch sử phiên bản đầy đủ) chưa có trong API nên UI ghi rõ là "chưa cung cấp", không hiển thị dữ liệu giả. Dừng ở UI-04, chưa làm UI-05.**

## Khảo sát và đối chiếu

Đã đọc AGENTS và Technical Design, đối chiếu `design/approved_screens/03_document_detail.png` (desktop và mobile), trang chi tiết cũ (Workspace + ReadingPanel/AttachmentsPanel của Sprint 0.1), cùng các API `GET /documents/{id}`, `GET /my/reading`, `POST /reading-assignments/{id}/acknowledge`, `GET /content-versions/{id}/attachments` và `GET /attachments/{id}/download`.

| Khu vực | Trước | Sau UI-04 |
|---|---|---|
| Điều hướng | Banner chung "Chi tiết nội dung", liên kết biên soạn lẫn vào, "← Quay lại thư viện" | Breadcrumb "← Nội quy › mã tài liệu"; bỏ banner chung để nội dung lên đầu trang |
| Tiêu đề | Badge "Đã duyệt", tên, mã | Icon tài liệu, mã, tên; chip phiên bản, "Đã ban hành · hiện hành", "Bắt buộc" (khi được giao), trạng thái đọc |
| Thông tin | Không có | Hàng thông tin: Bộ phận phụ trách, Phiên bản, Ngày ban hành, Ngày hiệu lực, Mức độ (Bắt buộc đọc / Tham khảo), Ngày tạo phiên bản |
| Nội dung | Mỗi khóa body là một đoạn | Mục đánh số, đoạn văn và gạch đầu dòng; trên mobile mỗi mục thành card thu gọn/mở rộng (`aria-expanded`), mục 1 mở sẵn |
| Xác nhận đọc | Nút "Tôi đã đọc phiên bản này" trong panel phụ | Card "Tiến độ xác nhận của bạn" (0/100%), nút **Xác nhận đã đọc** nổi bật; sau khi xác nhận hiện biên nhận gồm phiên bản và thời gian. Mobile/tablet: nút cố định đáy màn hình, trên bottom nav |
| Phiên bản mới | Một dòng "Lịch sử: đã xác nhận vX" | Banner đỏ "Đã có phiên bản mới (vN)" kèm hạn; ACK cũ hiển thị trong lịch sử, không thay cho bản mới |
| Tệp đính kèm | Danh sách chữ + nút Tải xuống | Icon theo loại (PDF/ảnh/bảng tính), dung lượng, trạng thái quét; nút tải 44–48px; chỉ file `CLEAN` mới có link |
| Lịch sử | Không có | Timeline: bản hiện tại + các phiên bản tôi từng được giao, kèm thời điểm tôi xác nhận |
| Mobile | Giống desktop, một cột | Tab Nội dung / Tệp đính kèm (n) / Lịch sử (n) dính đầu khi cuộn; banner → nội dung; nút xác nhận cố định |
| Tablet | Hai cột hẹp | Một cột; banner ở đầu nội dung; card phụ chia hai cột; nút xác nhận dính đáy. Mockup không có bản tablet nên đây là responsive suy rộng |

Dùng lại AppFrame (Sidebar, Header, bottom nav), Icon và token của UI-02. CSS mới nằm trong `document-detail.module.css`; vài icon nhỏ (tải, mũi tên, khóa…) viết nội bộ trong component, không thêm vào `icon.tsx` dùng chung. Chỉ đổi route `app/documents/[id]/page.tsx`. Trang chi tiết Kho tri thức và Sự cố vẫn dùng Workspace như cũ.

**Không sửa file nào của UI-01, UI-02, UI-03, backend/DB/API, ReadingPanel, AttachmentsPanel hay Workspace.** Đã kiểm bằng `git diff 3bb8557` trên các đường dẫn đó: không có thay đổi.

## Xác nhận đã đọc: quy tắc và xử lý lỗi

Logic ACK vẫn do API/DB quyết định (`jkc_ack_reading`). UI chỉ quyết định khi nào hiện nút:

- Nút chỉ hiện khi `/my/reading` có nhiệm vụ của **chính phiên đăng nhập**, trùng `version_id` của phiên bản đang xem, `is_current = true` và chưa có `acknowledged_at`. Request chỉ gửi `version_id`; người xác nhận do server lấy từ session nên không thể xác nhận hộ.
- Không được giao: hiện "Không được giao đọc / Tham khảo", không có nút.
- Phiên bản mới: nhiệm vụ cũ (`is_current = false`) đưa vào lịch sử, thời điểm ACK cũ giữ nguyên; bản mới phải xác nhận riêng.

| Phản hồi khi xác nhận | Xử lý |
|---|---|
| 200 | Biên nhận "Đã xác nhận phiên bản vN lúc hh:mm dd/mm/yyyy · ghi nhận bằng tài khoản của bạn"; tải lại trạng thái từ API |
| 409 (bản cũ / xung đột / chưa hiệu lực) | Báo chưa ghi nhận, tải lại phiên bản hiện hành, yêu cầu đọc lại |
| 404 (không phải nhiệm vụ của bạn) | Báo không tìm thấy nhiệm vụ, tải lại trạng thái |
| 401 (session hết hạn) | Báo chưa ghi nhận, chuyển về `/login` |
| Lỗi khác (ví dụ 403 CSRF) | Hiện thông báo của API, giữ nguyên trạng thái |

Nút bị khóa khi đang gửi để tránh bấm hai lần. Nếu server vẫn nhận request lặp thì trả 200 idempotent và không đổi thời điểm ACK đầu tiên; điều này đã được kiểm thử.

### Trạng thái màn hình

| Trạng thái | Hiển thị |
|---|---|
| Loading | Khung skeleton, `role=status`, `aria-busy` |
| 404 / id không hợp lệ | "Không tìm thấy tài liệu". API cố ý không phân biệt "không tồn tại" và "không có quyền", nên UI cũng không phân biệt |
| 403 | "Bạn không có quyền xem tài liệu này" |
| Lỗi khác | "Không thể tải tài liệu" + Thử lại |
| 401 | Chuyển về `/login` |
| Lỗi riêng `/my/reading` | Nội dung vẫn đọc được; trạng thái "Chưa tải trạng thái"; ẩn nút; có "Tải lại trạng thái" |
| Lỗi riêng tệp đính kèm | Báo lỗi trong card tệp, phần còn lại vẫn hoạt động |
| Không có nội dung / tệp | Câu hướng dẫn rõ ràng thay cho khung trống |

## Khoảng trống dữ liệu (cần PO/BE quyết định)

| Mockup | Hiện trạng | Đề xuất |
|---|---|---|
| Ngày ban hành, Ngày hiệu lực | DB có `approved_at`, `effective_at` nhưng `GET /documents/{id}` không trả về; UI ghi "Chưa cung cấp". Seed chưa có `effective_at` | Thêm hai trường vào ContentView (gộp với khoảng trống của UI-03) |
| Chủ sở hữu (HCNS), Bộ phận áp dụng, Thẻ liên quan, Mô tả ngắn | Không có trong schema/API. UI hiện "Bộ phận phụ trách" = bộ phận sở hữu nội dung | Chốt mô hình dữ liệu với JKC |
| Lịch sử phiên bản đầy đủ + ghi chú thay đổi | Chưa có API cho nhân viên. UI hiện bản hiện hành và các bản tôi được giao, kèm câu nói rõ giới hạn | API `GET /documents/{id}/versions` (chỉ bản đã ban hành, theo ACL) |
| Tài liệu liên quan | Không có quan hệ trong DB; chưa dựng | Ngoài phạm vi UI-04 |
| "Tải tất cả" | Không có API nén; chưa dựng nút giả | Tải từng file theo ACL |
| Khung cảnh báo vàng "Lưu ý an toàn" | Body là text tự do, không có kiểu mục; chưa tô riêng | Nếu cần, thêm kiểu mục khi biên soạn |
| Header mobile (nút back + tìm kiếm) | Giữ header UI-02 đã duyệt; back nằm ở breadcrumb | PO quyết định nếu muốn header riêng cho trang chi tiết |

Thứ tự mục: PostgreSQL `jsonb` không giữ thứ tự khóa của body. Nếu tên mục có số đầu ("1. Mục đích"), UI sắp theo số và ẩn số; tài liệu cũ không đánh số giữ thứ tự API trả về. Nên thống nhất quy ước này cho người biên soạn, hoặc lưu body dạng mảng mục ở sprint sau.

## Dữ liệu DEMO

`document-detail-tests/fixture.ts` tạo tài liệu qua đúng workflow Sprint 1 (không ghi thẳng DB):
1. Tác giả UAT tạo bản nháp có 4 mục và đính kèm 1 PDF tĩnh + 1 PNG (đều qua ClamAV).
2. HR UAT ban hành.
3. Giao đọc, có thể xác nhận v1.
4. Tác giả tạo v2.
5. HR ban hành v2 và giao lại.

Nội dung tổng hợp, ghi rõ DEMO; không sao chép thông số kỹ thuật in trong mockup; không dùng dữ liệu nhân viên thật. Ảnh chụp dùng tài khoản `employee` trên tài liệu tạo bằng `node scripts/ui-document-detail/fixture.mjs`. Mỗi lần chạy test tạo thêm tài liệu DEMO mới, vì ACK không thể hoàn tác.

## Screenshot và so sánh

Before là trang chi tiết cũ, chụp trên tài liệu seed của `employee`. After chụp trên tài liệu DEMO hai phiên bản (v1 đã xác nhận, v2 đang chờ). `*-full.png` là toàn trang; thanh cố định nằm ở vị trí viewport tại thời điểm chụp.

| Viewport | Before | After (chờ xác nhận v2) | Sau khi xác nhận | Mockup / Before / After |
|---|---|---|---|---|
| 1440×900 | [Trước](before-desktop.png) | [Sau](after-desktop.png) · [đầy đủ](after-desktop-full.png) | [Đã xác nhận](after-desktop-acked.png) | [So sánh](comparison-desktop.png) |
| 768×1024 | [Trước](before-tablet.png) | [Sau](after-tablet.png) · [đầy đủ](after-tablet-full.png) | [Đã xác nhận](after-tablet-acked.png) | [So sánh với mẫu desktop](comparison-tablet.png) |
| 390×844 | [Trước](before-mobile390.png) | [Sau](after-mobile390.png) · [đầy đủ](after-mobile390-full.png) · [Tệp](after-mobile390-files.png) · [Lịch sử](after-mobile390-history.png) | [Đã xác nhận](after-mobile390-acked.png) | [So sánh](comparison-mobile390.png) |
| 375×812 | [Trước](before-mobile375.png) | [Sau](after-mobile375.png) · [đầy đủ](after-mobile375-full.png) · [Tệp](after-mobile375-files.png) · [Lịch sử](after-mobile375-history.png) | [Đã xác nhận](after-mobile375-acked.png) | [So sánh](comparison-mobile375.png) |

Tái tạo:
```sh
UI_DEMO_PASSWORD=… node scripts/ui-document-detail/fixture.mjs              # in contentId
UI_CAPTURE_DOC=<contentId> UI_DEMO_PASSWORD=… node scripts/ui-document-detail/capture.cjs
UI_CAPTURE_TAB="Tệp đính kèm" UI_CAPTURE_SUFFIX=-files …                    # tab mobile
python3 scripts/ui-document-detail/compare.py
```

## Kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| ESLint / TypeScript / Next production build | **PASS** (`/documents/[id]` dynamic) |
| Unit `document-detail-model` (mục nội dung, thứ tự số, trạng thái đọc theo phiên bản, phiên bản mới, dung lượng/loại tệp, mã lỗi ACK) | **7/7 PASS** |
| Unit `documents-model` (UI-03) | **8/8 PASS** |
| UI-04 Playwright, 4 viewport × 4 kịch bản | **16/16 PASS**, [JSON](test-results.json) |
| Regression UI-01 Login | **9/9 PASS**, [JSON](regression-ui01-login.json) |
| Regression UI-02 Dashboard | **16/16 PASS**, [JSON](regression-ui02-dashboard.json) |
| Regression UI-03 Nội quy | **16/16 PASS**, [JSON](regression-ui03-documents.json) |
| E2E Sprint 0/1 `smoke` + `sprint1` (desktop + mobile) | **10/10 PASS** sau khi máy không bị ngủ giữa chừng; `sprint01` không chạy lại được trên fixture cũ (xem bên dưới) |

Kịch bản UI-04 (`starter/apps/web/document-detail-tests/document-detail.spec.ts`), chạy với API thật trừ các chỗ ghi "mock":
1. **Hiển thị và xác nhận:**
   - Tên/mã khớp API; chip Bắt buộc; 4 mục đúng thứ tự.
   - Tệp: 2 link, tải PDF trả 200 `application/pdf`; trên mobile, các tab Tệp/Lịch sử chuyển đúng panel.
   - Bấm Xác nhận đã đọc: biên nhận v1, nút biến mất, `/my/reading` có `acknowledged_at` đúng `version_id`.
   - Gửi lại trả 200, không đổi thời điểm. Sau reload vẫn giữ trạng thái. Không tràn ngang, không lỗi JS.
2. **Phiên bản mới:**
   - Đã ACK v1, sau đó v2 được ban hành và giao: hiện banner "Đã có phiên bản mới (v2)", trạng thái Chưa xác nhận, lịch sử 2 dòng có ACK v1.
   - Gửi ACK bằng `version_id` v1 vào nhiệm vụ v2 bị **409**.
   - Xác nhận v2 thành công; thời điểm ACK v1 không đổi.
3. **Quyền:**
   - Người cùng bộ phận nhưng không được giao thấy "Không được giao đọc", không có nút. Gửi ACK bằng assignment của người khác bị **404**, nhiệm vụ của người được giao vẫn chưa xác nhận.
   - `other` (khác bộ phận) và `admin` (TECH_ADMIN) thấy "Không tìm thấy tài liệu", tải file bị **404**.
   - Session hết hạn khi bấm xác nhận (mock 401): chuyển về `/login`, không ghi nhận. Xóa cookie rồi mở trang: chuyển về `/login`.
4. **Lỗi và trạng thái:**
   - Mock 409 khi xác nhận: hiện thông báo xung đột, vẫn chưa xác nhận.
   - Loading, 500 + Thử lại, 403, id không tồn tại (thật), lỗi `/my/reading` (mock): ẩn nút, có "Tải lại trạng thái".

Chạy lại: `cd starter/apps/web && UI_TEST_LOCAL_CA=true UI_UAT_FIXTURES=../../../.local/uat01.json UI_DEMO_PASSWORD=… npx playwright test -c playwright.document-detail.config.ts`.

### E2E Sprint 0/1

`tests/sprint01.spec.ts` và `tests/sprint1.spec.ts` bấm nút cũ "Tôi đã đọc phiên bản này". Tôi chỉ đổi selector sang nút mới và biên nhận `ack-receipt`; nghiệp vụ test không đổi. Kết quả:
- `smoke` và `sprint1`: **10/10 PASS** trên desktop và mobile, gồm bước HR ban hành → giao đọc → học viên xác nhận bằng nút mới.
  - Lần chạy đầu có 2 test mobile treo ~16 phút. Log `pmset` cho thấy máy ngủ 21:40–21:55 (đang dùng pin). Chạy lại dưới `caffeinate`: pass trong 17 giây.
- `sprint01`: **chưa pass, nhưng không do UI-04.** Test này xác nhận tài liệu seed bằng tài khoản trong `.local/uat01.json`; tài khoản đó đã xác nhận từ 30/10/2026, nên nút xác nhận không còn hiện (giao diện cũ cũng vậy). Test chỉ chạy được một lần cho mỗi bộ fixture. Cần tạo fixture Sprint 0.1 mới để chạy lại.

Các test cũ có ghi ảnh vào `docs/reports/sprint01/regression` và `docs/reports/sprint1`. Tôi đã khôi phục các ảnh đó về bản đã commit để giữ nguyên bằng chứng các sprint trước.

## Ghi chú môi trường

Staging local dùng override `deploy/compose.signature-updates.yml` để cập nhật chữ ký ClamAV, giống UI-03. Override này chưa được IT nghiệm thu, không dùng cho shared staging.

## Chưa làm / ngoài phạm vi

- Các trường dữ liệu ở mục Khoảng trống (cần thay đổi API).
- Tài liệu liên quan, tải tất cả, cảnh báo theo kiểu mục.
- Chưa thử trên điện thoại thật và chưa cài CA lên thiết bị (gate của IT).
- UI-05 chưa bắt đầu.
