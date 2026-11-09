# UI-05 — Kho tri thức & Tìm kiếm Tri Thức JKC

Ngày 09/11/2026. Nhánh `feature/ui-knowledge-library`, tách từ `feature/ui-document-detail` tại `ed0d9ea` (chứa UI-01 → UI-04; `main` mới có Sprint 0.1). Bản DEMO review: https://localhost:18444/knowledge (staging `jkc-staging-s1`).

**Đã triển khai trang Kho tri thức & Tìm kiếm theo mockup 04 và hoàn thiện vòng 2 (tìm không dấu, tìm trong nội dung, ẩn bộ lọc chưa có API) và vòng 3 (PO chọn phương án A: mobile chỉ còn ô tìm của Kho tri thức); kiểm thử local đạt. Đang chờ PO duyệt lần cuối. Có một thay đổi API nhỏ, chỉ đọc (mục "Thay đổi backend"). Nhiều thành phần trong mockup chưa có dữ liệu (loại kiến thức, thiết bị, thẻ, lượt xem, hỏi đáp…); UI ẩn đi hoặc ghi rõ, không dùng dữ liệu giả. Dừng ở UI-05, chưa làm UI-06.**

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
| Bộ lọc | Chỉ có Công đoạn | Chip loại (Tất cả / Bài tri thức / Giải pháp sự cố); Công đoạn, Bộ phận; Xóa bộ lọc; sắp xếp; mobile dùng bảng lọc trượt từ dưới lên. Thiết bị/Thẻ **ẩn** cho tới khi có API (vòng 2) |
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

- **Không đổi điều kiện ACL (`READ_ACL`, `APPROVED`), không có migration, không đổi auth/session/CSRF/RBAC/RLS, phê duyệt hay xác nhận đọc.** Vòng 2 chỉ đổi phần so khớp từ khóa (xem "Vòng hoàn thiện 2"). Các join là LEFT JOIN/LATERAL 1 dòng nên không thể sinh thêm dòng. Trường mới là tùy chọn, các màn hình cũ bỏ qua được.
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
- **Tìm kiếm tiếng Việt (vòng 2):** không phân biệt dấu và hoa/thường ("lech mau" = "lệch màu" = "LỆCH MÀU"; nhận cả kiểu gõ tổ hợp NFD). Tìm **theo từng từ**: tối đa 8 từ, mọi từ phải xuất hiện, thứ tự tùy ý. Mỗi từ khớp **tiêu đề hoặc nội dung** của *phiên bản đã duyệt hiện hành*. Ký tự `%` và `_` vẫn được hiểu là chữ thường, không phải ký tự đại diện. Xem mục "Vòng hoàn thiện 2".
- Không có dữ liệu giả: mọi con số, tiêu đề, tác giả, ngày đều từ API. Ảnh card là ảnh minh họa DEMO theo công đoạn của UI-02, có nhãn "Ảnh minh họa", không phải ảnh của bài.
- **Quyền:** chỉ hiện bài `APPROVED` theo `READ_ACL`. Bài nháp và chờ duyệt của chính tác giả không xuất hiện; bài DEPARTMENT của Sản xuất không hiện với `other` (Kỹ thuật) và `admin` (TECH_ADMIN không có quyền vượt). Đã kiểm bằng E2E.

### Trạng thái

| Trạng thái | Hiển thị |
|---|---|
| Đang tải | Skeleton, `role=status`, `aria-busy` |
| Chưa có bài | "Chưa có bài tri thức được duyệt" + giải thích + nút chia sẻ (nếu có quyền) |
| Không tìm thấy | "Không tìm thấy kết quả phù hợp." + hướng dẫn tìm theo từng từ (có dấu hoặc không) + Xóa bộ lọc |
| Không có quyền (403) | Icon khóa, "Bạn không có quyền xem kho tri thức" |
| Lỗi kết nối | "Không thể tải kho tri thức" + Thử lại |
| 401 | Chuyển về `/login` |
| Có kết quả | "Tìm thấy N kết quả cho “…”" hoặc "N bài đã duyệt"; đọc qua `aria-live` |

**Accessibility:** ô tìm `role=search` có nhãn riêng (không trùng ô tìm trên header). Chip loại và nút chuyển kiểu hiển thị dùng `aria-pressed`. Bảng lọc mobile là `dialog` `aria-modal`: Escape để đóng, focus trả về nút "Bộ lọc". Vùng chạm trên mobile ≥ 44 px; ô tìm mobile cỡ chữ 16 px để iOS không tự phóng to.

## Sai khác còn tồn tại so với mockup

| Mockup | UI-05 | Lý do / backlog |
|---|---|---|
| Tab Kinh nghiệm / Hướng dẫn / Checklist / FAQ | Tất cả / Bài tri thức / Giải pháp sự cố | Chưa có taxonomy, DATA-13 |
| Bộ lọc Thiết bị, Tag | **Ẩn** (vòng 2) | DATA-14, DATA-15 |
| Thẻ trên card (Heidelberg, Bao bì…) | Chip loại / công đoạn / bộ phận | DATA-15 |
| Người duyệt, lượt xem, bình luận, bookmark, menu "…" | Không hiện | DATA-16, DATA-17 |
| Sắp xếp "Liên quan nhất" | Mới duyệt nhất / Cũ nhất / Tên A–Z | Chưa có điểm liên quan (DATA-12 còn phần xếp hạng) |
| "Tri thức nổi bật tuần này" | "Mới được duyệt" (theo thời điểm duyệt) | Không có lượt xem, DATA-17 |
| "Không tìm thấy? Hãy đặt câu hỏi" / nút "Đặt câu hỏi" mobile | "Không tìm thấy?" + "Chia sẻ kiến thức" | Chưa có Hỏi đáp, DATA-18 |
| Ảnh riêng từng bài | Ảnh minh họa DEMO theo công đoạn | DATA-19 |
| Mobile chỉ 1 ô tìm | **1 ô** (ô của Kho tri thức); ô header ẩn chỉ trên mobile ở `/knowledge` | Đã xử lý ở vòng 3 (PO chọn phương án A) |
| Bottom nav: Trang chủ / Tìm kiếm / Hỏi đáp / Thông báo / Cá nhân | Giữ bottom nav UI-02 đã duyệt ("Tra cứu" sáng khi ở trang này) | Không sửa UI-02 |

Dữ liệu DEMO cho ảnh chụp tạo bằng `node scripts/ui-knowledge/fixture.mjs`: 5 bài, mỗi công đoạn một bài, đi qua workflow thật (tác giả `employee` → `head` duyệt). Nội dung ghi rõ DEMO, không có thông số vận hành. Tiêu đề có kèm thời điểm tạo. Staging còn nhiều bài "DEMO · Duyệt độc lập…" và "Tra cứu ui05…" do các bộ test sinh ra, vì xác nhận/duyệt không hoàn tác được.

## Screenshot

Ảnh chụp bằng Chromium đúng kích thước viewport, tài khoản `employee`. Before là trang `/knowledge` cũ. `*-full.png` là toàn trang; thanh cố định nằm ở vị trí viewport tại thời điểm chụp. Ảnh so sánh crop vùng ứng dụng trong mockup, giữ nguyên tỷ lệ.

| Viewport | Before | After | Tìm "lệch màu" | Khác | Mockup / Before / After |
|---|---|---|---|---|---|
| 1440×900 | [Trước](before-desktop.png) | [Sau](after-desktop.png) · [đầy đủ](after-desktop-full.png) | [Có kết quả](after-desktop-search.png) | [Không dấu "lech mau"](after-desktop-unaccented.png) · [Lưới](after-desktop-grid.png) · [0 kết quả](after-desktop-noresult.png) | [So sánh](comparison-desktop.png) |
| 768×1024 | [Trước](before-tablet.png) | [Sau](after-tablet.png) · [đầy đủ](after-tablet-full.png) | [Có kết quả](after-tablet-search.png) | [Lưới](after-tablet-grid.png) | [So sánh với mẫu desktop](comparison-tablet.png) |
| 390×844 | [Trước](before-mobile390.png) | [Sau](after-mobile390.png) · [đầy đủ](after-mobile390-full.png) | [Có kết quả](after-mobile390-search.png) | [Không dấu](after-mobile390-unaccented.png) · [Bảng lọc](after-mobile390-filters.png) · [Lưới](after-mobile390-grid.png) · [0 kết quả](after-mobile390-noresult.png) | [So sánh](comparison-mobile390.png) |
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
| pytest backend (gồm 12 test mới, kể cả vòng 2) | **57/57 PASS** trên DB sạch |
| Unit `knowledge-model` (URL ↔ trạng thái, lọc / sắp xếp / phân trang, trích đoạn, ảnh, snapshot) | **5/5 PASS** |
| Unit `document-detail-model` / `documents-model` | 7/7 · 8/8 PASS |
| UI-05 Playwright (desktop, tablet, 390, 375 × 5 kịch bản, gồm kịch bản vòng 3) | **20/20 PASS**, [JSON](test-results.json) |
| Regression UI-01 / UI-02 / UI-03 / UI-04 | 9/9 · 16/16 · 16/16 · 16/16 PASS ([JSON](regression-ui01-login.json), [JSON](regression-ui02-dashboard.json), [JSON](regression-ui03-documents.json), [JSON](regression-ui04-document-detail.json)) |
| E2E `smoke` + `sprint1` (desktop + mobile) | **10/10 PASS** |
| E2E `sprint01`, fixture DEMO mới `uat05` (`app.seed_uat`) | **2/2 PASS**, [JSON](regression-sprint01.json) |

Kịch bản UI-05 (`starter/apps/web/knowledge-tests/knowledge.spec.ts`), dữ liệu tạo qua workflow thật:
1. **Dữ liệu và tìm kiếm:**
   - Số bài khớp tổng `/articles` + `/incidents`.
   - Gõ từ khóa không cần Enter thì ra đúng 1 bài, có "Đã duyệt" và đúng công đoạn; URL có `q`; reload vẫn giữ.
   - Không dấu, chữ hoa, đảo thứ tự từ, và một từ chỉ có trong nội dung: đều ra đúng 1 bài.
   - Bộ lọc Thiết bị/Thẻ không còn hiện.
   - Từ khóa không tồn tại hiện trạng thái không tìm thấy; xóa từ khóa trả lại danh sách. Không tràn ngang, không lỗi JS.
2. **Bộ lọc:**
   - Công đoạn + bộ phận (mobile qua bảng lọc) + loại: số khớp API, mọi card đúng công đoạn, URL có đủ tham số, nhãn "Bộ lọc (3)".
   - Xóa bộ lọc thì về tổng và URL sạch.
   - Sang trang 2, mở bài, Back: vẫn ở trang 2, cùng bài đầu tiên.
3. **Quyền:**
   - Bài nháp và chờ duyệt không hiện, detail trả 404; bài đã duyệt hiện.
   - Một từ có trong nội dung của cả bài đã duyệt, bài nháp và bài chờ duyệt chỉ ra bài đã duyệt; tìm từ riêng của bản chờ duyệt ra 0.
   - `other` và `admin` không thấy bài, kể cả khi tìm theo nội dung; detail 404.
   - Đăng xuất rồi vào `/knowledge`: chuyển về `/login`.
4. **Trạng thái:** loading, thư viện rỗng (mock), lỗi 500 + Thử lại, 403 (mock), gõ nhanh với response cũ về muộn.
5. **Ô tìm Header (vòng 3):** trên mobile ở `/knowledge` ô header bị ẩn và chỉ còn đúng 1 ô nhập tìm kiếm; desktop/tablet vẫn hiện ô header; ở `/` và `/documents` ô header hiện trên cả 4 viewport; gửi từ khóa từ ô header vẫn chuyển sang `/knowledge?q=…` và điền sẵn vào ô của trang.

Chạy lại: `cd starter/apps/web && UI_TEST_LOCAL_CA=true UI_UAT_FIXTURES=../../../.local/uat01.json UI_DEMO_PASSWORD=… npx playwright test -c playwright.knowledge.config.ts`.

**Ghi chú regression:** lần chạy đầu, 2 bộ test cũ (UI-02 dashboard, smoke) hỏng vì đợi đúng câu "Không tìm thấy kết quả phù hợp." (có dấu chấm, giống UI-03). UI-05 đã dùng lại đúng câu đó, **không sửa test của UI đã duyệt**.

## Vòng hoàn thiện 2 (09/11/2026)

### Tìm kiếm không dấu, theo từng từ, trong tiêu đề và nội dung

Sửa `listing()` trong `starter/apps/api/app/content.py`, dùng chung cho `/articles`, `/incidents`, `/documents` và `/search`:

- **Chuẩn hóa:** `lower(translate(regexp_replace(normalize(x, NFD), '[\u0300-\u036f]', '', 'g'), 'đĐ', 'dD'))`, áp dụng cho cả cột và từ khóa. Chỉ dùng hàm có sẵn của PostgreSQL 13+; **không có migration, không đổi schema hay OpenAPI**; đã kiểm `export_openapi.py --check`.
- **Phạm vi tìm:** `coalesce(v.title, c.title)` và nội dung text của `v.body`, với `v` là **phiên bản đã duyệt hiện hành** (join qua `current_published_version_id`). Điều kiện `BASE` (`APPROVED` + `READ_ACL`) giữ nguyên. Vì vậy bản nháp, bản chờ duyệt và phiên bản mới chưa duyệt **không bao giờ** được tìm; người ngoài phạm vi không tìm được nội dung của bài họ không có quyền.
- **Cách khớp:** tách từ theo khoảng trắng (tối đa 8 từ); mọi từ phải khớp tiêu đề hoặc nội dung. Ký tự `%`, `_`, `\` vẫn được escape như cũ.
- **"Mô tả":** chưa có trường mô tả riêng; các mục trong nội dung bài đóng vai trò mô tả.
- **Hiệu năng:** biểu thức chạy trong truy vấn nên quét tuần tự; ổn ở quy mô DEMO / vài nghìn bài. Index: backlog DATA-21.

Test backend mới trong `test_knowledge_listing.py`, chạy bằng **role runtime thật có RLS**:

| Test | Kiểm tra |
|---|---|
| `test_title_search_ignores_accents_and_case` | 5 dạng: có dấu, không dấu, HOA có dấu, HOA không dấu, NFD |
| `test_words_match_anywhere_in_title_or_body` | Đảo thứ tự từ; từ ở tiêu đề + từ ở nội dung; một từ không có thì loại bài |
| `test_body_search_is_accent_insensitive_but_only_published_and_in_scope` | Tác giả tạo phiên bản nháp v2 chứa cụm bí mật: không ai tìm được (kể cả tác giả); nội dung v1 đã duyệt chỉ employee/head tìm được, other/admin không |
| `test_pending_and_out_of_scope_bodies_are_not_searchable` | Bài chờ duyệt không ai tìm được |
| `test_wildcards_stay_literal_after_folding` | `%` và `_` không thành ký tự đại diện |

Thêm fixture dọn dữ liệu (archive nội dung do test tạo, giữ audit/phiên bản) vào `test_knowledge_listing.py` và **`test_security.py`**. Lý do: `test_approval_scope_self_conflict_and_audit` để lại một bài đã duyệt có nội dung "DEMO"; khi tìm cả nội dung, từ lần chạy pytest thứ 2 trên cùng DB, `test_acl_search_count_detail` (tìm "DEMO") đếm thừa. **Không đổi assertion nào** của test bảo mật, chỉ bổ sung phần dọn dẹp giống `test_sprint01.py`.

**Lỗi có sẵn (không do UI-05):** `test_sprint1_features.py::test_course_authoring_assignment_new_version_and_grading` hỏng từ lần chạy pytest thứ 2 trên cùng DB (trạng thái `FAILED` thay vì `NOT_STARTED`). Đã kiểm trên code gốc (cất thay đổi UI-05): hỏng y hệt từ lần 2. CI dùng DB mới nên không gặp. Thuộc phần Đào tạo, ngoài phạm vi UI-05, chưa sửa.

### Ẩn bộ lọc chưa có API

Bộ lọc Thiết bị và Thẻ được bỏ khỏi giao diện (desktop và bảng lọc mobile), không còn ô khóa "Chưa có". Lưới bộ lọc desktop còn 2 cột. Câu gợi ý "gõ có dấu" cũng bỏ, vì tìm không dấu đã chạy được.

### Đề xuất hai ô tìm kiếm trên mobile (PO đã chọn A, xem vòng 3)

Hiện tại: header UI-02 đã duyệt luôn có ô "Tìm lỗi, quy trình, kinh nghiệm…" (gửi từ khóa vào trang này), và trang có ô tìm riêng (tự tìm khi gõ, có nút xóa, giữ từ khóa). Mockup 04 mobile chỉ có 1 ô.

| Phương án | Cách làm | Ảnh hưởng UI-02 | Đề xuất |
|---|---|---|---|
| **A. Thêm tùy chọn cho AppFrame** | Thêm prop tùy chọn, ví dụ `hideMobileSearch`, mặc định `false`. Chỉ `/knowledge` bật để ẩn ô header **trên mobile**; desktop giữ nguyên | Không đổi giao diện màn nào khác (prop mặc định giữ hành vi cũ); vẫn chạm vào file `app-frame.tsx` nên cần chạy lại regression UI-01→04 | **Khuyến nghị**: đúng mockup, phạm vi nhỏ, kiểm chứng được |
| B. Header là ô tìm duy nhất | Ẩn ô của trang trên mobile; AppFrame nhận `value/onChange` để ô header hiển thị và điều khiển từ khóa | Đổi cách ô header hoạt động trên mọi trang (debounce, nút xóa) | Không khuyến nghị: thay đổi hành vi đã duyệt |
| C. Giữ nguyên 2 ô | Không sửa gì; ô header dùng tìm nhanh toàn cổng, ô trang dùng lọc trong kho | Không | Chấp nhận được nếu PO ưu tiên giữ UI-02 tuyệt đối |

### Ảnh Before / After vòng 2 (`round2/`)

| Màn | Before (UI-05 vòng 1) | After (vòng 2) |
|---|---|---|
| Desktop | [Trước](round2/before-desktop.png) | [Sau](round2/after-desktop.png) |
| Desktop, tìm "lech mau" | [Trước: 0 kết quả + gợi ý gõ có dấu](round2/before-desktop-noresult.png) | [Sau: tìm thấy các bài "lệch màu"](round2/after-desktop-unaccented.png) |
| Mobile 390, tìm "lech mau" | [Trước](round2/before-mobile390-noresult.png) | [Sau](round2/after-mobile390-unaccented.png) |
| Mobile 390, bảng lọc | [Trước: có Thiết bị/Thẻ khóa](round2/before-mobile390-filters.png) | [Sau: chỉ Công đoạn, Bộ phận](round2/after-mobile390-filters.png) |
| Mobile 375, bảng lọc | [Trước](round2/before-mobile375-filters.png) | [Sau](round2/after-mobile375-filters.png) |
| Tablet | [Trước](round2/before-tablet.png) | [Sau](round2/after-tablet.png) |

Ảnh After chính và các bảng so sánh với mockup hiện là bản chụp sau vòng 3.

## CI

- `3bb6da9` (UI-05 vòng 1) và `527a6b6` (vòng 2): `staging-acceptance` ✅, `postgres17` ✅, `foundation` ❌ ở bước `scripts/database_drill.py`. Xem [Run 42552101803](https://github.com/tuanqt98/TriThucJKC/actions/runs/42552101803) và [Run 42553588933](https://github.com/tuanqt98/TriThucJKC/actions/runs/42553588933).
- **Nguyên nhân (đã tái hiện ở local):** runner `ubuntu-latest` (đang chuyển sang Ubuntu 26) có thể có `pg_dump` 17+. Từ bản 17, `pg_dump` ghi `SET transaction_timeout = 0`, mà PostgreSQL 16 (service của job `foundation`) không hiểu, nên `pg_restore --exit-on-error` dừng. Trên cùng một DB sau pytest:
  - client 18: hỏng đúng lỗi `unrecognized configuration parameter "transaction_timeout"`;
  - client 16: drill pass.
  - Log CI cần đăng nhập nên chưa đọc trực tiếp; kết luận dựa trên tái hiện. **Không do code UI-05**: bước drill chỉ dump/restore và chạy migration, UI-05 không đổi migration.
- **Sửa:** trong `.github/workflows/ci.yml`, bước drill của job `foundation` đặt `pg_dump`/`pg_restore` bản 16 (chạy qua image `postgres:16`) lên đầu `PATH`, khớp major với service. Không đổi `database_drill.py` hay các job khác.
- Bản sửa `ci.yml` đã được đưa sang nhánh UI-03 (`30aaf53`) rồi merge xuôi sang UI-04 (`5348aff`) và UI-05 (`5626504`); cả 7 lượt CI sau đó đều xanh.

## Vòng 3 (09/11/2026): một ô tìm trên mobile — PO chọn phương án A

**Thay đổi (3 file web, không đổi API/DB):**
- `components/app-frame.tsx`: thêm prop tùy chọn `hideMobileSearch` (mặc định `false`). Khi bật, form tìm của header có thêm class `searchDesktopOnly`.
- `components/app-frame.module.css`: `.searchDesktopOnly { display: none }` **chỉ trong** `@media (max-width: 767px)`. Desktop và tablet (≥ 768px) giữ nguyên ô header.
- `components/knowledge-library.tsx`: chỉ trang `/knowledge` truyền `hideMobileSearch`.

**Không đổi:** các trang khác không truyền prop nên Header UI-02 giữ nguyên hành vi và giao diện; tìm kiếm, bộ lọc, phân trang, trạng thái URL của UI-05 không đổi; auth/session/CSRF/RBAC/RLS/phê duyệt/xác nhận đọc không đổi.

**Kiểm thử vòng 3 (staging HTTPS, sau khi build lại web):**

| Kiểm tra | Kết quả |
|---|---|
| ESLint / TypeScript | PASS |
| UI-05 Playwright (4 viewport × 5 kịch bản, thêm kịch bản ô tìm Header) | **20/20 PASS** |
| Regression UI-01 / UI-02 / UI-03 / UI-04 (desktop, tablet, 390, 375) | **9/9 · 16/16 · 16/16 · 16/16 PASS** |
| E2E `smoke` + `sprint1` (desktop + mobile, fixture `uat01`) | **10/10 PASS** |

Ảnh chụp chính ở mục Screenshot và 4 bảng so sánh đã được chụp lại. Dữ liệu DEMO cho ảnh tạo lại bằng `scripts/ui-knowledge/fixture.mjs` (5 bài DEMO qua workflow thật), vì các bộ regression vừa tạo nhiều bài "Duyệt độc lập…" mới lên đầu danh sách.

| Màn | Before (vòng 2: 2 ô tìm) | After (vòng 3: 1 ô tìm) |
|---|---|---|
| Mobile 390 | [Trước](round3/before-mobile390.png) | [Sau](round3/after-mobile390.png) |
| Mobile 390, tìm "lech mau" | [Trước](round3/before-mobile390-unaccented.png) | [Sau](round3/after-mobile390-unaccented.png) |
| Mobile 375 | [Trước](round3/before-mobile375.png) | [Sau](round3/after-mobile375.png) |
| Mobile 375, tìm "lệch màu" | [Trước](round3/before-mobile375-search.png) | [Sau](round3/after-mobile375-search.png) |
| Tablet 768 (giữ ô header) | [Trước](round3/before-tablet.png) | [Sau](round3/after-tablet.png) |
| Desktop 1440 (giữ ô header) | [Trước](round3/before-desktop.png) | [Sau](round3/after-desktop.png) |

## Chưa làm / ngoài phạm vi

- Các mục backlog [DATA-12 (xếp hạng liên quan) … DATA-21](../../UI_DATA_GAPS_BACKLOG.md): taxonomy, thiết bị, thẻ, người duyệt, lượt xem/bình luận/lưu, Hỏi đáp, ảnh bìa, lọc phía server, index tìm kiếm. DATA-11 (tìm không dấu) và phần tìm trong nội dung của DATA-12 đã xong ở vòng 2.
- Trang chi tiết bài tri thức `/knowledge/[id]` và tạo bài `/knowledge/new` vẫn là giao diện cũ (mockup 06 và màn chi tiết thuộc UI sau).
- Chưa thử trên điện thoại thật và chưa cài CA lên thiết bị (gate của IT).
- UI-06 chưa bắt đầu.
