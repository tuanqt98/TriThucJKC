# DATA-20 — Tìm kiếm, lọc và phân trang phía server cho Kho tri thức

**Trạng thái:** đặc tả, **chưa triển khai**.

PO nâng DATA-20 từ P3 lên **P1** ngày 12/11/2026. Mọi thay đổi code, migration hay quyền đều chờ PO duyệt đặc tả này, và làm trong PR riêng, không trộn vào PR #7–#10.

**Không** giải quyết bằng cách tăng timeout của test.

## 1. Hiện trạng (đo trên staging, `docs/reports/data-20/baseline.txt`)

**Cách UI-05 đang tải:**
- Mỗi lần đổi từ khóa hoặc công đoạn, UI-05 tải **toàn bộ** bài và giải pháp sự cố khớp, mỗi trang 100 bài, **lần lượt** từng trang (`loadAll`, tối đa 2.000 bài).
- Sau đó trình duyệt tự lọc theo loại và bộ phận, tự sắp xếp, tự phân trang 8 bài/trang.
- Danh sách bộ phận cũng được suy ra từ dữ liệu đã tải.

**Số đo:**

| Đo | Kết quả |
|---|---|
| Dữ liệu staging | 818 bài đã ban hành (1.639 tổng), 1.968 phiên bản |
| Trình duyệt, `q=DEMO` (817 kết quả) | 9 request nối tiếp; danh sách hiện sau **~6,7 giây** (UI-05B: 4 test vượt 5 giây, cả trên bản đã duyệt) |
| Một request `/articles?q=DEMO&pageSize=100` | ~720 ms, 84 KB (gồm cả `body`) |
| Cùng truy vấn bằng owner (không RLS) | trang **4,9 ms** + đếm **3,1 ms** |
| Cùng truy vấn bằng `jkc_runtime` (có RLS, như API) | trang **347 ms** + đếm **353 ms** |
| `GET /dashboard` (Trang chủ, gọi `listing` 4 lần = 8 truy vấn) | **~1.280 ms** mỗi lần tải |
| `GET /documents?pageSize=12` | ~210 ms |

**Kết luận:**

1. **Nhân số request.** Tải toàn bộ làm số request tăng theo số kết quả (`⌈n/100⌉`), và mỗi request chạy **cả** truy vấn trang **lẫn** truy vấn đếm.
2. **Chi phí chính là RLS, không phải tìm kiếm.**
   - Policy `version_read` gọi `jkc_version_read(id)` cho **từng dòng** `content_versions`.
   - Policy của `contents` gọi `jkc_acl_for(…)` và `jkc_review(…)` cho từng dòng.
   - Các hàm `SECURITY DEFINER` này không được planner gộp vào truy vấn, nên chi phí tăng tuyến tính theo tổng số dòng, kể cả khi chỉ lấy 1 trang.
   - Ước tính: khoảng 0,1 ms/dòng, tức khoảng **2–3 giây mỗi truy vấn** khi có 10.000 phiên bản. *Ước tính này phải được kiểm chứng bằng bộ test hiệu năng ở mục 6.*
3. **Trang chủ cũng bị ảnh hưởng.** `/dashboard` đếm tổng bằng `listing` nên mất khoảng 1,3 giây; B3 (mục 3) cải thiện cả màn này.
4. **Chỉ phân trang phía server là chưa đủ.** Làm vậy giảm còn 1 request (khoảng 0,7 giây hôm nay), nhưng vẫn tăng theo dữ liệu.

## 2. Yêu cầu

### 2.1 Chức năng (giữ nguyên hành vi đã duyệt của UI-05/UI-05B)

**Giữ nguyên:**
- **Tìm kiếm:**
  - không dấu, không phân biệt hoa/thường, `đ` = `d`;
  - tối đa 8 từ khóa, **mọi** từ phải xuất hiện trong tiêu đề hoặc nội dung của **phiên bản đang ban hành**;
  - ký tự `%` và `_` giữ nghĩa đen.
- **Bộ lọc:** công đoạn, loại (`ARTICLE` / `INCIDENT_GUIDE`), bộ phận (kể cả "Chưa có thông tin").
- **Sắp xếp:**
  - `newest`/`oldest` theo `approved_at`, nếu trống thì dùng `created_at`, rồi đến `id`;
  - `title` theo thứ tự tiếng Việt.
  - Phải khớp `applyFilters` hiện tại; truy vấn server hiện sắp theo `v.created_at`, cần thống nhất lại.
- **URL:** `q`, `processId`, `type`, `department`, `sort`, `page`, `view` không đổi; "Quay lại" (UI-05B) và link chia sẻ hoạt động như cũ.
- **Giao diện UI-05:** không đổi.
  - Số trên các bộ lọc (facet) lấy từ server.
  - Regression ảnh phải 0 pixel khác, trừ con số.

### 2.2 Bảo mật (không được nới)

- **RLS vẫn bật** trên mọi bảng nội dung; API vẫn dùng `jkc_runtime` (không BYPASSRLS). Điều kiện ACL trong câu SQL của API (`READ_ACL`) vẫn giữ làm lớp thứ hai.
- **Facet không được lộ thông tin:**
  - số lượng theo bộ phận/loại chỉ đếm bài người dùng **được xem**;
  - bộ phận người dùng không thấy bài nào thì **không xuất hiện**.
- **Không trả `body` đầy đủ trong danh sách:** server cắt sẵn đoạn trích (giới hạn ký tự), giảm payload.
- Admin kỹ thuật, trưởng bộ phận khác và HR giữ đúng phạm vi hiện tại.

### 2.3 Hiệu năng (đề xuất, PO chốt)

| Chỉ tiêu | Ngưỡng |
|---|---|
| API danh sách, role runtime, **10.000** bài đã ban hành và 20.000 phiên bản (dữ liệu tổng hợp) | p95 ≤ **300 ms**, p50 ≤ 150 ms |
| Cùng điều kiện, **50.000** bài | p95 ≤ 800 ms (để biết giới hạn; không chặn release) |
| Trình duyệt, staging hiện tại (~820 bài): từ lúc đổi bộ lọc đến khi danh sách hiện | ≤ **1,5 s** |
| Số request API danh sách mỗi lần đổi trạng thái | **1** (cộng facet nếu tách riêng: tối đa 2) |
| Payload một trang (8–12 bài) | ≤ 30 KB |

## 3. Phương án kỹ thuật (đề xuất làm theo 3 PR)

### B1 — API phân trang/lọc/sắp xếp phía server (không đổi schema)

**API**, mở rộng `GET /api/v1/search`; các endpoint hiện có giữ tương thích:

| Tham số | Giá trị |
|---|---|
| `q` | như hiện tại |
| `processId` | như hiện tại |
| `kind` | `ARTICLE`, `INCIDENT_GUIDE` (lặp được; mặc định cả hai cho Kho tri thức) |
| `departmentId` | `uuid` hoặc `unknown` |
| `sort` | `newest`, `oldest`, `title` |
| `page` | như hiện tại |
| `pageSize` | ≤ 50 |

Ghi chú về `/search`: route này hiện chưa giới hạn loại (kind = NULL nên gồm cả `DOCUMENT`). Chưa thấy màn nào dùng, cần xác nhận. Kho tri thức sẽ gửi `kind` tường minh.

**Response:**
- `items` có `excerpt` (thay cho `body`), `total`, `page`, `pageSize`;
- `facets`: `departments[{id, name, count}]`, `kinds[{kind, count}]`, chỉ trong phạm vi người dùng được xem và theo bộ lọc khác đang chọn.

**Thực thi:**
- Một truy vấn có `count(*) OVER ()` cho tổng.
- Facet bằng một truy vấn gộp (`GROUP BY`) trên cùng tập đã lọc.

**UI:** `knowledge-library.tsx` gọi một request mỗi lần đổi trạng thái; bỏ `loadAll` ở màn này; danh sách bộ phận lấy từ facet. Giao diện không đổi.

**Tác dụng:** 9 request còn 1 (khoảng 0,7 giây hôm nay), giải quyết UI-05B ở quy mô hiện tại. **Chưa** giải quyết tăng tuyến tính.

### B2 — Chỉ mục tìm kiếm không dấu (migration mới, sau 008)

- Hàm `jkc_fold(text)` `IMMUTABLE`, cùng logic với `fold()` hiện tại.
- Cột `search_text` trên `content_versions` lưu tiêu đề + nội dung đã fold.
  - Cập nhật bằng trigger khi tạo/sửa bản nháp. Workflow không sửa nội dung bản đã duyệt.
  - Backfill bằng **UPDATE theo lô trong migration**. Lưu ý: trigger `jkc_version_integrity` bỏ qua kiểm tra khi `OLD.status='APPROVED'`, và với bản chưa duyệt thì chặn đổi định danh hoặc đổi `body` lúc chuyển sang `APPROVED`. Phải xác minh trước khi viết migration rằng UPDATE chỉ cột `search_text` **không vi phạm** trigger nào, không đổi `body`/`status`, và không ghi lịch sử hay audit như sửa nội dung.
- Index `pg_trgm` GIN trên `search_text` (`pg_trgm` có sẵn trên PostgreSQL staging và là extension "trusted" từ PG13; G-5 cần xác nhận owner production được `CREATE EXTENSION`).
- Index phụ: `contents(kind, archived_at)`, `content_versions(approved_at)`.
- Sắp xếp tên: collation ICU `vi-x-icu` (staging có ICU tiếng Việt). Phương án dự phòng: `jkc_fold(title)`.

### B3 — Tối ưu RLS cho đọc danh sách (thay đổi cơ chế quyền, **cần PO duyệt riêng**)

**Mục tiêu:** cùng ngữ nghĩa quyền, nhưng planner xử lý theo tập dữ liệu thay vì gọi hàm cho từng dòng.

**Phương án:**
- (a) Viết lại policy `SELECT` của `contents` và `content_versions` thành biểu thức SQL **inline**: `jkc_user()` là `STABLE`; điều kiện ACL viết bằng `EXISTS`/join, không gọi hàm `SECURITY DEFINER`.
- (b) Hoặc thêm hàm `SECURITY DEFINER` trả về **tập** id nội dung được xem (tính một lần mỗi truy vấn), rồi để policy so khớp với tập đó.

**Đề xuất:** (a), vì dễ kiểm chứng tương đương.

**Bắt buộc:**
- **Test tương đương** (mục 6.3) chứng minh policy mới cho **cùng kết quả** với policy cũ trên mọi tổ hợp người dùng × trạng thái × phạm vi;
- review bảo mật;
- rollback (`down.sql` khôi phục policy cũ).

**Lưu ý:** B3 đụng tới cơ chế phân quyền. Theo quy tắc của PO, **không** làm nếu chưa có phê duyệt riêng.

## 4. Phạm vi

| Lớp | Thay đổi | PR |
|---|---|---|
| API | `/search` mở rộng: `kind`, `departmentId`, `sort`, facet, `excerpt`; OpenAPI cập nhật | B1 |
| Web | `knowledge-library.tsx`, `knowledge-model.ts`: một request, facet từ server; giữ URL và giao diện | B1 |
| DB | Migration: `jkc_fold`, `search_text` + trigger + backfill, index trigram/phụ, có `down.sql` | B2 |
| DB quyền | Policy `SELECT` `contents`/`content_versions` viết lại, có `down.sql` | B3 (PO duyệt riêng) |
| Không đổi | Workflow duyệt, quyền ghi, giao diện, các màn khác. Các endpoint `/documents`, `/articles`, `/incidents` (cùng dùng `listing`) giữ nguyên hợp đồng | — |

## 5. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Facet hoặc tổng lộ số bài ngoài phạm vi | Test ma trận quyền cho **facet và total**, không chỉ cho `items` |
| Kết quả mới khác kết quả cũ (bỏ sót hoặc thừa bài) | Test đối chiếu: thuật toán cũ (`loadAll` + `applyFilters`) và API mới cho cùng tập và cùng thứ tự trên fixture |
| Sắp xếp tiếng Việt khác `localeCompare('vi')` | Test các cặp có dấu; chấp nhận khác biệt đã ghi rõ nếu ICU khác trình duyệt |
| Backfill `search_text` chạm trigger bất biến | Xác minh trước; chạy trong drill DB test; không đổi `body` hay trạng thái |
| B3 thay đổi quyền ngoài ý muốn | Test tương đương toàn bộ; PO duyệt; triển khai sau B1/B2 |

## 6. Bộ test riêng

### 6.1 Chức năng và đối chiếu (pytest, PostgreSQL sạch)

- **Đối chiếu kết quả:** API mới và thuật toán cũ cho cùng tập id **và cùng thứ tự**, theo mọi tổ hợp:
  - `q`: rỗng, có dấu, không dấu, nhiều từ, ký tự `%`/`_`;
  - `processId`, `kind`, `departmentId` (kể cả `unknown`);
  - `sort` × 3.
- **Phân trang:**
  - mọi trang ghép lại bằng tập đầy đủ, không trùng;
  - trang vượt quá thì trả rỗng, `total` đúng;
  - `pageSize` > 50 trả 422.
- **Chỉ phiên bản đang ban hành:** bản nháp hoặc bản mới chưa duyệt không khớp từ khóa.

### 6.2 Bảo mật

- **Ma trận quyền:** `employee`, `head`, `other`, `admin`, HR × `COMPANY`/`DEPARTMENT`/`CROSS_DEPARTMENT`/`RESTRICTED` × `APPROVED`/`DRAFT`/`PENDING`/đã lưu trữ, kiểm tra cả `items`, `total`, `facets`.
- `admin` không thấy bài Sản xuất; không người dùng nào thấy facet của bộ phận ngoài phạm vi.
- API chạy với `jkc_runtime`, không BYPASSRLS (giữ `test_security`).

### 6.3 Tương đương RLS (chỉ cho B3)

Trên DB test có fixture đủ mọi tổ hợp, với **mỗi** người dùng: `SELECT id` qua policy cũ và qua policy mới phải trả **cùng tập** trên `contents` và `content_versions`. Chạy ở cả PostgreSQL 16 và 17 trong CI.

### 6.4 Hiệu năng (script riêng, DB `jkc_test_*`, không chạy trên staging hay production)

- **Sinh dữ liệu tổng hợp** trong namespace DEMO, có guard G-2 (`app.demo_guard`):
  - 1.000 / 10.000 / 50.000 bài đã ban hành, 2 phiên bản mỗi bài;
  - phân bố bộ phận, visibility, công đoạn.
- **Đo p50/p95** (≥ 30 lần mỗi truy vấn) bằng role runtime cho:
  - không từ khóa;
  - 1 từ phổ biến;
  - 3 từ hiếm;
  - kết hợp bộ lọc;
  - từng `sort`.
- **Lưu `EXPLAIN ANALYZE`** và kết quả JSON vào `docs/reports/data-20/`.
- **CI:** chạy cỡ 1.000 với ngưỡng nới (phát hiện quay lui); cỡ 10.000 và 50.000 chạy tay hoặc theo lịch, báo cáo cho PO.

### 6.5 Giao diện (Playwright, giữ **nguyên** timeout hiện tại)

- **UI-05 (20) và UI-05B (16) phải PASS** trên staging hiện tại (~820 bài), bao gồm 4 test đang fail.
- Bổ sung:
  - **đếm request:** mỗi lần đổi bộ lọc chỉ 1 request danh sách;
  - **đo thời gian:** ≤ 1,5 giây đến khi danh sách hiện.
- Regression ảnh UI-05 và UI-05B 4 viewport: 0 pixel khác (trừ số đếm).

## 7. Rollback

| PR | Cách rollback |
|---|---|
| B1 | Revert (không schema); UI quay về `loadAll` |
| B2 | `downgrade` bỏ cột, index, trigger, `jkc_fold`; dữ liệu nội dung không đổi |
| B3 | `downgrade` khôi phục nguyên văn policy cũ; chạy lại test tương đương |

## 8. Cần PO quyết định

1. Duyệt ngưỡng hiệu năng (mục 2.3).
2. Duyệt chia làm 3 PR B1 → B2 → B3, và thời điểm làm: sau khi hợp nhất 9 bước vào `main`, nên làm trên `main`.
3. **B3 (đổi policy RLS) cần phê duyệt riêng**, vì đụng tới cơ chế phân quyền.
4. Xác nhận sắp xếp tên theo collation ICU `vi` (chấp nhận khác biệt nhỏ so với trình duyệt nếu có).
