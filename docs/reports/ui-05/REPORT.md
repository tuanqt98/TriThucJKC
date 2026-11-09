# UI-05 — Kho tri thức & Tìm kiếm Tri Thức JKC

Ngày 09/11/2026. Nhánh `feature/ui-knowledge-library`, tách từ `feature/ui-document-detail` tại `ed0d9ea` (chứa UI-01 → UI-04; `main` mới có Sprint 0.1). Bản DEMO review: https://localhost:18444/knowledge (staging `jkc-staging-s1`).

**Đã triển khai trang Kho tri thức & Tìm kiếm theo mockup 04; kiểm thử local đạt. Đang chờ PO duyệt. Có một thay đổi API nhỏ, chỉ đọc (mục "Thay đổi backend"). Nhiều thành phần trong mockup chưa có dữ liệu (loại kiến thức, thiết bị, thẻ, lượt xem, hỏi đáp…); UI ghi rõ hoặc bỏ qua, không dùng dữ liệu giả. Dừng ở UI-05, chưa làm UI-06.**

## Khảo sát

- Đã đọc AGENTS, SRS, Technical Design và báo cáo UI-01 → UI-04.
- Mockup: `design/approved_screens/04_knowledge_library.png`, đúng tên, có cả desktop và mobile.
- Trang cũ `/knowledge` dùng Workspace chung: banner chung, ô tìm, chọn công đoạn, card lớn; chưa có loại, bộ phận, người chia sẻ, đồng bộ URL.
- API trước UI-05:
  - `/articles`, `/incidents`, `/search` lọc theo `READ_ACL`, chỉ trả bài `APPROVED`. Có `q` (ILIKE trên **tiêu đề**, phân biệt dấu), `processId` và phân trang.
  - `/processes` trả đúng 5 công đoạn.
  - Response **không có** công đoạn, người chia sẻ hay ngày duyệt, dù DB có và tài khoản runtime đọc được.

| Khu vực | Trước | Sau UI-05 |
|---|---|---|
| Tiêu đề | Banner chung "Tri thức JKC / Không gian tri thức", liên kết biên soạn lẫn vào | Banner "Kho tri thức" + mô tả + ảnh DEMO máy in (UI-02); mobile chỉ còn tiêu đề |
| Tìm kiếm | Ô tìm, phải bấm nút | Ô tìm nổi bật, tự tìm sau 350 ms, Enter tìm ngay, nút xóa từ khóa |
| Chia sẻ | Nút "Tạo bài chia sẻ" luôn hiện | "Chia sẻ kiến thức" chỉ hiện khi tài khoản có bộ phận (điều kiện DB đòi hỏi để tạo bài); mobile đặt cuối danh sách |
| Bộ lọc | Chỉ có Công đoạn | Chip loại (Tất cả / Bài tri thức / Giải pháp sự cố); Công đoạn, Bộ phận; Thiết bị và Thẻ khóa kèm ghi "Chưa có"; Xóa bộ lọc; sắp xếp; mobile dùng bảng lọc trượt từ dưới lên |
| Kết quả | Card ảnh lớn + tiêu đề + bộ phận | Card có ảnh minh họa theo công đoạn, tiêu đề, trích đoạn, "Đã duyệt", chip loại / công đoạn / bộ phận, người chia sẻ, ngày duyệt, phiên bản; chuyển dạng danh sách/lưới; phân trang 8 bài |
| Khung bên phải | Không có | "Mới được duyệt" (5 bài mới nhất) và khung "Không tìm thấy?" kèm nút chia sẻ |
| URL | Chỉ `q`, `processId` | `q`, `processId`, `type`, `department`, `sort`, `page`, `view`: chia sẻ link được, Back từ bài viết trả về đúng trang và bộ lọc |

Dùng lại AppFrame (Sidebar, Header, bottom nav), Icon, ảnh DEMO và token của UI-02. CSS riêng trong `knowledge-library.module.css`. **Không sửa file nào của UI-01 → UI-04**, kể cả Workspace dùng cho `/knowledge/[id]` và `/knowledge/new`; đã kiểm bằng `git diff ed0d9ea` trên các đường dẫn đó. Chỉ thêm trường **tùy chọn** vào kiểu `Content` dùng chung trong `components/api.ts`.

## Thay đổi backend (chỉ đọc)

Mockup cần công đoạn, người chia sẻ và thời điểm duyệt trên mỗi card. Dữ liệu đã có trong DB nhưng API không trả về. Tôi thêm 4 trường vào `SELECT` dùng chung của content API và vào `ContentView`:

| Trường | Nguồn |
|---|---|
| `process_id`, `process_name` | Công đoạn của phiên bản; nếu trống thì lấy liên kết cũ `content_processes`, giống điều kiện lọc `processId` hiện có |
| `author_name` | `users.full_name` của người tạo |
| `approved_at` | `content_versions.approved_at` |

- **Không đổi điều kiện WHERE/ACL, không có migration, không đổi auth/session/CSRF/RBAC/RLS, phê duyệt hay xác nhận đọc.** Các join là LEFT JOIN/LATERAL 1 dòng nên không thể sinh thêm dòng. Trường mới là tùy chọn, các màn hình cũ bỏ qua được.
- `api/openapi.yaml` đã xuất lại (+22 dòng, chỉ thêm trường); `scripts/export_openapi.py --check` pass.
- Test mới `starter/apps/api/tests/test_knowledge_listing.py`:
  1. Các trường có mặt và khớp nhau ở listing / search / detail; công đoạn lấy từ liên kết cũ.
  2. Lọc `processId` chỉ trả bài có đúng công đoạn hiển thị.
  3. Tập bài nhìn thấy của admin / employee / head không đổi so với test ACL sẵn có.
- `pytest` backend: **48/48 pass** trên PostgreSQL 16 tạm (container riêng, đã xóa sau khi chạy).

## Tìm kiếm và dữ liệu

- Mỗi lần đổi từ khóa hoặc công đoạn (lọc phía server), UI tải **toàn bộ** kết quả `/articles` và `/incidents` trong phạm vi ACL (trang 100, tối đa 2.000 bài mỗi loại; vượt hoặc dữ liệu đổi giữa chừng thì báo lỗi). Sau đó lọc loại, bộ phận, sắp xếp và phân trang ngay trên trình duyệt, để số kết quả luôn đúng. Lý do là API chưa có tham số loại/bộ phận/sắp xếp (backlog DATA-20).
- **Chống hiện kết quả cũ:**
  - Debounce 350 ms.
  - Mỗi request mang số thứ tự và có `AbortController`; response cũ về muộn bị bỏ.
  - Khi đang tải cho từ khóa mới thì hiện skeleton, không giữ kết quả cũ.
  - Có test: request của từ khóa trước bị làm chậm 1,5 giây, sau đó vẫn chỉ hiện kết quả của từ khóa mới.
- **Tìm kiếm tiếng Việt:** backend dùng `ILIKE` trên **tiêu đề**, **phân biệt dấu**. "lệch màu" tìm được, "lech mau" không. Test xác nhận đúng hành vi này, không tuyên bố tìm không dấu đã chạy. Khi từ khóa không dấu ra 0 kết quả, UI gợi ý gõ có dấu. Tìm không dấu và tìm trong nội dung: backlog DATA-11, DATA-12.
- Không có dữ liệu giả: mọi con số, tiêu đề, tác giả, ngày đều từ API. Ảnh card là ảnh minh họa DEMO theo công đoạn của UI-02, có nhãn "Ảnh minh họa", không phải ảnh của bài.
- **Quyền:** chỉ hiện bài `APPROVED` theo `READ_ACL`. Bài nháp và chờ duyệt của chính tác giả không xuất hiện; bài DEPARTMENT của Sản xuất không hiện với `other` (Kỹ thuật) và `admin` (TECH_ADMIN không có quyền vượt). Đã kiểm bằng E2E.

### Trạng thái

| Trạng thái | Hiển thị |
|---|---|
| Đang tải | Skeleton, `role=status`, `aria-busy` |
| Chưa có bài | "Chưa có bài tri thức được duyệt" + giải thích + nút chia sẻ (nếu có quyền) |
| Không tìm thấy | "Không tìm thấy kết quả phù hợp." + gợi ý gõ có dấu khi cần + Xóa bộ lọc |
| Không có quyền (403) | Icon khóa, "Bạn không có quyền xem kho tri thức" |
| Lỗi kết nối | "Không thể tải kho tri thức" + Thử lại |
| 401 | Chuyển về `/login` |
| Có kết quả | "Tìm thấy N kết quả cho “…”" hoặc "N bài đã duyệt"; đọc qua `aria-live` |

**Accessibility:** ô tìm `role=search` có nhãn riêng (không trùng ô tìm trên header). Chip loại và nút chuyển kiểu hiển thị dùng `aria-pressed`. Bảng lọc mobile là `dialog` `aria-modal`: Escape để đóng, focus trả về nút "Bộ lọc". Vùng chạm trên mobile ≥ 44 px; ô tìm mobile cỡ chữ 16 px để iOS không tự phóng to.

## Sai khác còn tồn tại so với mockup

| Mockup | UI-05 | Lý do / backlog |
|---|---|---|
| Tab Kinh nghiệm / Hướng dẫn / Checklist / FAQ | Tất cả / Bài tri thức / Giải pháp sự cố | Chưa có taxonomy, DATA-13 |
| Bộ lọc Thiết bị, Tag | Hiện nhưng khóa, ghi "Chưa có" | DATA-14, DATA-15 |
| Thẻ trên card (Heidelberg, Bao bì…) | Chip loại / công đoạn / bộ phận | DATA-15 |
| Người duyệt, lượt xem, bình luận, bookmark, menu "…" | Không hiện | DATA-16, DATA-17 |
| Sắp xếp "Liên quan nhất" | Mới duyệt nhất / Cũ nhất / Tên A–Z | Không có điểm liên quan, DATA-12 |
| "Tri thức nổi bật tuần này" | "Mới được duyệt" (theo thời điểm duyệt) | Không có lượt xem, DATA-17 |
| "Không tìm thấy? Hãy đặt câu hỏi" / nút "Đặt câu hỏi" mobile | "Không tìm thấy?" + "Chia sẻ kiến thức" | Chưa có Hỏi đáp, DATA-18 |
| Ảnh riêng từng bài | Ảnh minh họa DEMO theo công đoạn | DATA-19 |
| Mobile chỉ 1 ô tìm | 2 ô: header UI-02 đã duyệt + ô của trang | Bỏ ô header phải sửa AppFrame dùng chung, cần PO quyết định |
| Bottom nav: Trang chủ / Tìm kiếm / Hỏi đáp / Thông báo / Cá nhân | Giữ bottom nav UI-02 đã duyệt ("Tra cứu" sáng khi ở trang này) | Không sửa UI-02 |

Dữ liệu DEMO cho ảnh chụp tạo bằng `node scripts/ui-knowledge/fixture.mjs`: 5 bài, mỗi công đoạn một bài, đi qua workflow thật (tác giả `employee` → `head` duyệt). Nội dung ghi rõ DEMO, không có thông số vận hành. Tiêu đề có kèm thời điểm tạo. Staging còn nhiều bài "DEMO · Duyệt độc lập…" và "Tra cứu ui05…" do các bộ test sinh ra, vì xác nhận/duyệt không hoàn tác được.

## Screenshot

Ảnh chụp bằng Chromium đúng kích thước viewport, tài khoản `employee`. Before là trang `/knowledge` cũ. `*-full.png` là toàn trang; thanh cố định nằm ở vị trí viewport tại thời điểm chụp. Ảnh so sánh crop vùng ứng dụng trong mockup, giữ nguyên tỷ lệ.

| Viewport | Before | After | Tìm "lệch màu" | Khác | Mockup / Before / After |
|---|---|---|---|---|---|
| 1440×900 | [Trước](before-desktop.png) | [Sau](after-desktop.png) · [đầy đủ](after-desktop-full.png) | [Có kết quả](after-desktop-search.png) | [Lưới](after-desktop-grid.png) · ["lech mau": 0 kết quả](after-desktop-noresult.png) | [So sánh](comparison-desktop.png) |
| 768×1024 | [Trước](before-tablet.png) | [Sau](after-tablet.png) · [đầy đủ](after-tablet-full.png) | [Có kết quả](after-tablet-search.png) | [Lưới](after-tablet-grid.png) | [So sánh với mẫu desktop](comparison-tablet.png) |
| 390×844 | [Trước](before-mobile390.png) | [Sau](after-mobile390.png) · [đầy đủ](after-mobile390-full.png) | [Có kết quả](after-mobile390-search.png) | [Bảng lọc](after-mobile390-filters.png) · [Lưới](after-mobile390-grid.png) · [0 kết quả](after-mobile390-noresult.png) | [So sánh](comparison-mobile390.png) |
| 375×812 | [Trước](before-mobile375.png) | [Sau](after-mobile375.png) · [đầy đủ](after-mobile375-full.png) | [Có kết quả](after-mobile375-search.png) | [Bảng lọc](after-mobile375-filters.png) · [Lưới](after-mobile375-grid.png) · [0 kết quả](after-mobile375-noresult.png) | [So sánh](comparison-mobile375.png) |

Tái tạo:
```sh
UI_DEMO_PASSWORD=… node scripts/ui-knowledge/fixture.mjs
UI_DEMO_PASSWORD=… node scripts/ui-knowledge/capture.cjs                         # mặc định
UI_CAPTURE_QUERY="q=l%E1%BB%87ch%20m%C3%A0u" UI_CAPTURE_SUFFIX=-search …         # tìm kiếm
UI_CAPTURE_MOBILE_ONLY=true UI_CAPTURE_OPEN_FILTERS=true UI_CAPTURE_SUFFIX=-filters …
python3 scripts/ui-knowledge/compare.py
```

## Kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| ESLint / TypeScript / Next production build | **PASS** |
| Ruff check/format, unittest `scripts/tests`, OpenAPI drift check | **PASS** |
| pytest backend (gồm 3 test mới) | **48/48 PASS** |
| Unit `knowledge-model` (URL ↔ trạng thái, lọc / sắp xếp / phân trang, trích đoạn, ảnh, nhận biết không dấu, snapshot) | **6/6 PASS** |
| Unit `document-detail-model` / `documents-model` | 7/7 · 8/8 PASS |
| UI-05 Playwright (desktop, tablet, 390, 375 × 4 kịch bản) | **16/16 PASS**, [JSON](test-results.json) |
| Regression UI-01 / UI-02 / UI-03 / UI-04 | 9/9 · 16/16 · 16/16 · 16/16 PASS ([JSON](regression-ui01-login.json), [JSON](regression-ui02-dashboard.json), [JSON](regression-ui03-documents.json), [JSON](regression-ui04-document-detail.json)) |
| E2E `smoke` + `sprint1` (desktop + mobile) | **10/10 PASS** |
| E2E `sprint01`, fixture DEMO mới `uat04` (`app.seed_uat`) | **2/2 PASS**, [JSON](regression-sprint01.json) |

Kịch bản UI-05 (`starter/apps/web/knowledge-tests/knowledge.spec.ts`), dữ liệu tạo qua workflow thật:
1. **Dữ liệu và tìm kiếm:**
   - Số bài khớp tổng `/articles` + `/incidents`.
   - Gõ từ khóa không cần Enter thì ra đúng 1 bài, có "Đã duyệt" và đúng công đoạn; URL có `q`; reload vẫn giữ.
   - Từ khóa không dấu ra 0 kết quả kèm gợi ý; có dấu thì ra kết quả.
   - Từ khóa không tồn tại hiện trạng thái không tìm thấy; xóa từ khóa trả lại danh sách. Không tràn ngang, không lỗi JS.
2. **Bộ lọc:**
   - Công đoạn + bộ phận (mobile qua bảng lọc) + loại: số khớp API, mọi card đúng công đoạn, URL có đủ tham số, nhãn "Bộ lọc (3)".
   - Xóa bộ lọc thì về tổng và URL sạch.
   - Sang trang 2, mở bài, Back: vẫn ở trang 2, cùng bài đầu tiên.
3. **Quyền:**
   - Bài nháp và chờ duyệt không hiện, detail trả 404; bài đã duyệt hiện.
   - `other` và `admin` không thấy bài, detail 404.
   - Đăng xuất rồi vào `/knowledge`: chuyển về `/login`.
4. **Trạng thái:** loading, thư viện rỗng (mock), lỗi 500 + Thử lại, 403 (mock), gõ nhanh với response cũ về muộn.

Chạy lại: `cd starter/apps/web && UI_TEST_LOCAL_CA=true UI_UAT_FIXTURES=../../../.local/uat01.json UI_DEMO_PASSWORD=… npx playwright test -c playwright.knowledge.config.ts`.

**Ghi chú regression:** lần chạy đầu, 2 bộ test cũ (UI-02 dashboard, smoke) hỏng vì đợi đúng câu "Không tìm thấy kết quả phù hợp." (có dấu chấm, giống UI-03). UI-05 đã dùng lại đúng câu đó, **không sửa test của UI đã duyệt**.

## Chưa làm / ngoài phạm vi

- Các mục backlog [DATA-11 … DATA-20](../../UI_DATA_GAPS_BACKLOG.md): tìm không dấu, tìm trong nội dung, taxonomy, thiết bị, thẻ, người duyệt, lượt xem/bình luận/lưu, Hỏi đáp, ảnh bìa, lọc phía server.
- Trang chi tiết bài tri thức `/knowledge/[id]` và tạo bài `/knowledge/new` vẫn là giao diện cũ (mockup 06 và màn chi tiết thuộc UI sau).
- Chưa thử trên điện thoại thật và chưa cài CA lên thiết bị (gate của IT).
- UI-06 chưa bắt đầu.
