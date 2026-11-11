# Backlog thiếu hụt dữ liệu API cho UI (UI-03, UI-04, UI-05)

Ngày 07/11/2026, cập nhật 09/11/2026. Nguồn: [báo cáo UI-03](reports/ui-03/REPORT.md), [báo cáo UI-04](reports/ui-04/REPORT.md), [báo cáo UI-05](reports/ui-05/REPORT.md).

Mục đích: liệt kê các trường mà mockup đã duyệt (02, 03) cần hiển thị nhưng API hiện chưa trả về. UI hiện ghi rõ "Chưa cung cấp" thay vì hiển thị dữ liệu giả.

**Chưa task nào dưới đây được triển khai.** Trong UI-03/UI-04 không đổi API, schema, nghiệp vụ hay giao diện đã duyệt. Mỗi mục cần PO chốt trước khi BE làm. Thứ tự ưu tiên chỉ là đề xuất.

## Quy ước

- Mọi trường mới đi qua ACL hiện hành (`READ_ACL`, RLS). TECH_ADMIN không có quyền vượt.
- Chỉ bổ sung trường hoặc endpoint đọc; không đổi logic ban hành, giao đọc hay ACK.
- Mỗi task kèm migration có downgrade, cập nhật `api/openapi.yaml` và test quyền.

## Danh sách

| ID | Đề xuất ưu tiên | Thiếu hụt | Hiện trạng | Đề xuất kỹ thuật | Cần PO/JKC chốt |
|---|---|---|---|---|---|
| DATA-01 | P1 | **Ngày hiệu lực** (danh sách UI-03, chi tiết UI-04) | Có cột `content_versions.effective_at` nhưng `GET /documents` và `GET /documents/{id}` không trả về. Seed DEMO chưa có giá trị | Thêm `effective_at` vào `ContentView`; seed DEMO có ngày | Quy tắc "hiệu lực" so với "đã ban hành": có cho phép hiệu lực ở tương lai không, và khi đó ACK bị chặn (DB đã chặn khi `effective_at > now()`) |
| DATA-02 | P1 | **Ngày ban hành** (UI-04) | **Đã có ở API từ UI-05:** `approved_at` nay có trong `ContentView` (listing/search/detail). UI-04 chưa nối, vì UI-04 đã chốt để PO duyệt | Thêm `approved_at` vào `ContentView` | Không |
| DATA-03 | P1 | **Loại tài liệu** (tab Nội quy chung / Quy trình / An toàn / Biểu mẫu ở UI-03) | Có cột `contents.category_id` nhưng API không trả về; seed chưa có danh mục. Tab đang bị khóa | Seed danh mục, trả `category` trong listing và detail, thêm tham số lọc `categoryId` | Danh sách danh mục chính thức của JKC |
| DATA-04 | P1 | **Thứ tự mục nội dung (`sort_order`)** | `body` lưu dạng `jsonb` object, PostgreSQL không giữ thứ tự khóa. UI-04 tạm sắp theo số đầu tiêu đề ("1. Mục đích"); tài liệu cũ không đánh số thì giữ thứ tự API trả về | Phương án A: body dạng mảng `[{title, text, sort_order}]`, có migration chuyển dữ liệu. Phương án B: thêm `section_order text[]` vào phiên bản. Cả hai cần trình biên soạn hỗ trợ sắp xếp | Chọn phương án; trong thời gian chờ, quy ước đánh số tiêu đề mục cho người biên soạn |
| DATA-05 | P1 | **Lịch sử phiên bản đầy đủ** (UI-04) | Nhân viên chỉ thấy bản hiện hành và các bản mình được giao | `GET /documents/{id}/versions`: chỉ bản `APPROVED`, theo ACL; trả `version_number`, `approved_at`, `effective_at`, ghi chú thay đổi | Có cần "ghi chú thay đổi" bắt buộc khi ban hành không |
| DATA-06 | P2 | **Chủ sở hữu, bộ phận áp dụng** (UI-04) | Chỉ có `owner_department` (đang hiện là "Bộ phận phụ trách"). Mockup có "Chủ sở hữu: HCNS" và "Áp dụng: Toàn xưởng in" | Thêm trường phạm vi áp dụng; xác định chủ sở hữu là bộ phận hay vai trò HR | Mô hình chủ sở hữu và phạm vi áp dụng |
| DATA-07 | P2 | **Mô tả ngắn, thẻ liên quan** (UI-04) | Không có trong schema | Thêm `summary` và bảng thẻ | Có cần thẻ không, ai quản lý danh mục thẻ |
| DATA-08 | P2 | **Tài liệu liên quan** (UI-04) | Không có quan hệ giữa các tài liệu | Bảng quan hệ `content_relations`, lọc theo ACL người xem | Có trong phạm vi MVP không |
| DATA-09 | P3 | **"Tải tất cả" tệp đính kèm** (UI-04) | Chỉ tải được từng tệp | Endpoint tạo gói ZIP theo ACL, kiểm tra lại trạng thái quét của từng tệp | Có cần không, vì đa số tài liệu ít tệp |
| DATA-10 | P3 | **Kiểu mục "Lưu ý an toàn"** (khung cảnh báo vàng trong mockup) | Body là text tự do | Gắn thuộc tính `kind: "warning"` cho mục (đi cùng DATA-04) | Có cần không |

## Bổ sung từ UI-05 (Kho tri thức)

UI-05 đã thêm 4 trường **chỉ đọc** vào `ContentView`: `process_id`, `process_name`, `author_name`, `approved_at`. Không có migration, không đổi điều kiện ACL; có test `starter/apps/api/tests/test_knowledge_listing.py`. Các thiếu hụt còn lại:

| ID | Đề xuất ưu tiên | Thiếu hụt | Hiện trạng | Đề xuất kỹ thuật | Cần PO/JKC chốt |
|---|---|---|---|---|---|
| DATA-11 | — | **Tìm kiếm không dấu** | **Đã làm ở UI-05 vòng 2.** Bỏ dấu ngay trong câu truy vấn bằng hàm có sẵn (`normalize` NFD, bỏ dấu kết hợp, đ→d, `lower`), không cần migration. Test pytest + E2E | Còn lại: index cho quy mô lớn (xem DATA-21) | Không |
| DATA-12 | — | **Tìm trong nội dung** | **Đã làm ở UI-05 vòng 2.** Mỗi từ (tối đa 8) phải có trong tiêu đề **hoặc** nội dung của *phiên bản đã duyệt hiện hành*; bản nháp, bản chờ duyệt và phiên bản mới chưa duyệt không được tìm. Chưa có trường "mô tả" riêng | Xếp theo mức liên quan ("Liên quan nhất") vẫn chưa có | Có cần trường mô tả ngắn riêng không (đi cùng DATA-07) |
| DATA-13 | P1 | **Loại kiến thức** (Kinh nghiệm / Hướng dẫn / Checklist / FAQ) | Chỉ có `kind`: Bài tri thức (ARTICLE) / Giải pháp sự cố (INCIDENT_GUIDE). UI-05 lọc theo 2 loại này | Dùng `categories` (đi cùng DATA-03), có trường chọn loại khi biên soạn | Danh mục chính thức |
| DATA-14 | P2 | **Thiết bị / máy** | Không có trong schema. Bộ lọc **đã ẩn** (vòng 2) cho tới khi có API | Bảng thiết bị và quan hệ nội dung–thiết bị | Danh sách thiết bị, ai quản lý |
| DATA-15 | P2 | **Thẻ từ khóa** | Bảng `tags`/`content_tags` có sẵn nhưng rỗng, chưa có UI biên soạn thẻ. Bộ lọc **đã ẩn** (vòng 2) | Trả `tags` trong `ContentView`; thêm thẻ khi biên soạn | Quy tắc đặt thẻ |
| DATA-16 | — | **Người duyệt** | **Đã làm ở UI-05B:** `ContentView.approver_name` (chỉ đọc, LEFT JOIN `approved_by` của phiên bản đã duyệt hiện hành; không đổi ACL; có test). Trang chi tiết bài tri thức đã hiển thị | Còn lại: hiển thị trên card UI-05 nếu PO muốn | Có cần hiện trên card không |
| DATA-17 | P3 | **Lượt xem, bình luận, lưu bài (bookmark), "nổi bật tuần"** | Không có dữ liệu. Khung bên phải đang là "Mới được duyệt" (xếp theo thời điểm duyệt) | Bảng sự kiện xem/lưu, có chính sách riêng tư | Có cần đo lượt xem không |
| DATA-18 | P3 | **Hỏi đáp** ("Đặt câu hỏi" trong mockup) | Chưa có module/route. UI-05 thay bằng nút "Chia sẻ kiến thức" | Module Q&A riêng | Phạm vi MVP |
| DATA-19 | P3 | **Ảnh đại diện bài viết** | Card dùng ảnh minh họa DEMO theo công đoạn (có nhãn "Ảnh minh họa"), không phải ảnh của bài | Cho chọn ảnh bìa từ tệp đính kèm đã quét sạch | Có cần không |
| DATA-20 | P3 | **Lọc phía server theo loại/bộ phận** | UI tải toàn bộ kết quả trong phạm vi ACL (tối đa 2.000 bài/loại, quá thì báo lỗi) rồi lọc loại, bộ phận, sắp xếp và phân trang ở trình duyệt | Thêm tham số `kind`, `departmentId`, `sort` vào `/search`, phân trang server | Khi nào số bài vượt vài nghìn |
| DATA-21 | P2 | **Index cho tìm kiếm** | Tìm không dấu và tìm trong nội dung đang quét tuần tự (biểu thức trong câu truy vấn); ổn ở quy mô DEMO / vài nghìn bài | Migration 008: hàm `IMMUTABLE` chuẩn hóa + index GIN `pg_trgm` trên tiêu đề và nội dung phiên bản; cập nhật readiness check (`main.py` đang đòi đúng `007`), `database_drill.py`, `migration_cycle.py`, runbook | Khi nào cần (ngưỡng số bài) |

## Bổ sung từ UI-05B (Chi tiết bài tri thức, đề xuất)

| ID | Đề xuất ưu tiên | Thiếu hụt | Hiện trạng | Đề xuất kỹ thuật | Cần PO/JKC chốt |
|---|---|---|---|---|---|
| DATA-22 | P2 | **Lịch sử phiên bản bài tri thức** | `GET /articles/{id}` chỉ trả phiên bản đã duyệt hiện hành; không có danh sách phiên bản trước (DATA-05 là cho nội quy) | `GET /articles/{id}/versions`: chỉ bản `APPROVED`, theo ACL; trả `version_number`, `approved_at`, người duyệt (đi cùng DATA-16) | Nhân viên có cần xem phiên bản cũ của bài kinh nghiệm không |

| DATA-23 | P2 | **Ảnh gắn với từng mục nội dung** | Tệp gắn với phiên bản, không gắn với mục. UI-05B tạm dùng quy ước: một dòng trong mục **đúng bằng tên tệp ảnh đã quét sạch của phiên bản** (có thể thêm tiền tố "Ảnh:") thì hiện ảnh tại chỗ đó; ảnh đầu tiên chưa gắn mục là ảnh đại diện; ảnh còn lại ở "Hình ảnh khác" | Thêm `section_key` (hoặc thứ tự mục) cho tệp đính kèm, đi cùng DATA-04; trình biên soạn cho chọn ảnh theo mục | Có giữ quy ước tên tệp không, hay chờ làm DATA-04/DATA-23 |

## Bổ sung từ UI-06 (Chi tiết sự cố & giải pháp)

Trang `/incidents/[id]` hiển thị **hướng dẫn xử lý đã duyệt** (`contents.kind = INCIDENT_GUIDE`, `GET /incidents/{id}`). Dữ liệu mức độ, xác minh và tái diễn nằm ở **hồ sơ sự cố** (`incidents`, `incident_solutions`, `incident_occurrences`, `/workspace/incidents`). Cột `incident_solutions.approved_content_version_id` có trong schema nhưng chưa được ghi, nên hai bên **chưa liên kết**.

| ID | Đề xuất ưu tiên | Thiếu hụt | Hiện trạng | Đề xuất kỹ thuật | Cần PO/JKC chốt |
|---|---|---|---|---|---|
| DATA-24 | P1 | **Liên kết hướng dẫn ↔ hồ sơ sự cố** (mức độ, người/ngày báo cáo, người/ngày xác minh, nguyên nhân đã xác minh, số lần tái diễn) | Không có liên kết; UI-06 ghi "Chưa liên kết hồ sơ", không hiện mức độ hay "Đã xác minh" | Khi trưởng bộ phận xác minh giải pháp: tạo bản nháp INCIDENT_GUIDE từ hồ sơ, duyệt bình thường, rồi ghi `approved_content_version_id`. `GET /incidents/{id}` trả thêm `record_summary` chỉ đọc (mức độ, tên người xác minh, `verified_at`, số lần tái diễn theo tháng) | **Người đọc hướng dẫn ngoài bộ phận của hồ sơ có được thấy tóm tắt hồ sơ không** (hiện RLS hồ sơ chỉ cho người báo cáo và cùng bộ phận) |
| DATA-25 | P1 | **Biên soạn INCIDENT_GUIDE qua workflow** | `jkc_content_workflow` chỉ nhận DOCUMENT/ARTICLE; hướng dẫn sự cố chỉ có từ seed (UI-06 dùng `app.seed_incident_guides` cho DEMO) | Cho phép kind INCIDENT_GUIDE trong workflow (cùng luồng nháp → gửi → trưởng bộ phận duyệt), hoặc chỉ sinh từ hồ sơ đã xác minh (DATA-24) | Chọn một trong hai luồng |
| DATA-26 | P2 | **"Tôi cũng gặp lỗi này" ngay trên hướng dẫn** | API ghi tái diễn có sẵn nhưng gắn với hồ sơ (`POST /workspace/incidents/occurrences`, có khóa chống trùng). UI-06 dẫn sang "Hồ sơ / tái diễn" | Sau DATA-24: nút trên hướng dẫn gọi API tái diễn của hồ sơ liên kết, với cùng kiểm tra quyền | Ai được ghi tái diễn (mọi người đọc hay chỉ bộ phận của hồ sơ) |
| DATA-27 | P2 | **Máy/thiết bị, vật tư** (Heidelberg SM74, Giấy Couche…) | `incidents.equipment_id` có trong schema nhưng không có danh mục thiết bị (DATA-14); chưa có vật tư | Danh mục thiết bị/vật tư, liên kết từ hồ sơ sang hướng dẫn | Danh mục chính thức |
| DATA-28 | P3 | **Trao đổi & xác minh (bình luận theo dòng thời gian)** | Chưa có bảng | Bảng bình luận theo hồ sơ hoặc theo hướng dẫn, có audit và ACL | Có trong MVP không |
| DATA-29 | P3 | **In phiếu xử lý, Báo lỗi mới** (nút trong mockup) | Chưa có trang in; tạo hồ sơ có ở `/incidents/manage` | In: CSS `@media print` cho trang chi tiết (chỉ UI). Báo lỗi mới: nút dẫn tới `/incidents/manage` (chỉ UI) | Có làm ngay không |

## Bổ sung từ UI-07 (Tạo bài chia sẻ kinh nghiệm)

UI-07 dùng API biên soạn có phiên bản sẵn có: `POST/PUT /workspace/contents` (kiểm tra `revision`), `POST /workspace/contents/{submit|fork}`, `POST /content-versions/{id}/attachments` (chỉ tác giả, chỉ bản nháp, quét ClamAV đồng bộ, PNG/JPEG/PDF, tối đa `MAX_UPLOAD_BYTES` = 10 MiB). Không đổi API hay DB. Các thiếu hụt:

| ID | Đề xuất ưu tiên | Thiếu hụt | Hiện trạng | Đề xuất kỹ thuật | Cần PO/JKC chốt |
|---|---|---|---|---|---|
| DATA-30 | — | **Tên bộ phận của người dùng** | **PO quyết định (11/11/2026): giữ bộ phận tự gán theo tài khoản, không thêm ô chọn.** UI hiện "Bộ phận của tài khoản bạn" | Không làm; nếu sau này cần hiện tên thì thêm `department_name` chỉ đọc vào `/auth/me` (cần duyệt riêng vì chạm auth) | — |
| DATA-31 | **P1 (PO 11/11/2026)** | **Xóa tệp đã tải lên khỏi bản nháp** (nút × trong mockup) | Chưa có API xóa; UI không hiện nút × và ghi rõ "Chưa hỗ trợ xóa" | `DELETE /attachments/{id}`: chỉ tác giả, chỉ khi phiên bản còn DRAFT; xóa mềm, có audit, xóa tệp lưu trữ theo chính sách | Xóa cứng hay giữ để audit |
| DATA-32 | P3 | **Video MP4** (mockup ghi "JPG, PNG, MP4, PDF") | API chỉ nhận PNG/JPEG/PDF tĩnh (có chuẩn hóa và quét) | Thêm định dạng video cần kiểm tra mã độc, giới hạn dung lượng, chuyển mã, lưu trữ riêng | Có cần video trong MVP không |
| DATA-33 | — | **Danh sách "Bài viết của tôi"** | **Đã làm (UI-07, PO ưu tiên 11/11/2026):** trang `/knowledge/mine` dùng `GET /workspace/contents` có sẵn; mỗi bài một dòng (phiên bản mới nhất); lọc theo 5 trạng thái, tìm theo tiêu đề, phân trang; chỉ hiện hành động hợp lệ theo trạng thái; mở lại bản nháp qua `/knowledge/new?id=…`. Không đổi API, DB, quyền hay workflow | Còn lại: lối vào từ Kho tri thức / Tài khoản (hiện có từ trang Tạo bài) | Có thêm lối vào ở Kho tri thức hoặc menu Tài khoản không (chạm UI đã duyệt) |

Loại bài (DATA-13), thiết bị (DATA-14) và thẻ (DATA-15) **chưa hiện** trên form UI-07 vì chưa có API. Ảnh gắn theo mục dùng quy ước tên tệp (DATA-23).

## Bổ sung từ UI-08 (Đào tạo / Khóa học của tôi)

UI-08 dùng API học tập sẵn có: `GET /my/learning` (trạng thái do `jkc_training_status` tính, số bài học), `GET /my/learning/{id}` (bài học, câu hỏi **không kèm đáp án**, lịch sử làm bài), `POST …/lessons/{id}/complete`, `POST …/quiz-attempts`, `POST /quiz-attempts/{id}/submit` (chấm trong DB bằng `jkc_submit_quiz`). Không đổi API hay DB.

| ID | Đề xuất ưu tiên | Thiếu hụt | Hiện trạng | Đề xuất kỹ thuật | Cần PO/JKC chốt |
|---|---|---|---|---|---|
| DATA-34 | P2 | **Kết quả kiểm tra gần đây** (khung trong mockup) | Chưa có API riêng. UI đọc chi tiết tối đa 30 khóa (nửa khóa đã hoàn thành mới nhất, nửa khóa khác hạn xa nhất; bỏ "Chưa bắt đầu" vì theo quy tắc backend chưa có lần làm bài) | `GET /my/learning/attempts?limit=` trả các lần nộp gần nhất của chính người dùng | Có cần đủ lịch sử hay 5 lần gần nhất |
| DATA-35 | P2 | **Mô tả khóa học, bộ phận phụ trách, thời lượng, Bắt buộc/Khuyến nghị, ảnh, lĩnh vực** | `courses` chỉ có mã, tiêu đề, bộ phận sở hữu (chưa trả về). UI không hiện các trường này, không có bộ lọc "lĩnh vực" | Thêm cột vào `courses`/`course_versions` + trình biên soạn; trả về trong `/my/learning` | Danh mục lĩnh vực, ai nhập thời lượng |
| DATA-36 | P3 | **So sánh với tháng trước** ("↑1 so với tháng trước"), "Hoàn thành tháng này" | Thẻ thống kê hiện số theo trạng thái hiện tại (đủ 4 trạng thái theo yêu cầu UI-08); không hiện so sánh | Thống kê theo tháng phía server (theo `completed_at`, `assigned_at`) | Có cần chỉ số theo tháng không |
| DATA-37 | P3 | **Lịch học & nhắc việc** (giờ học, buổi kiểm tra) | Không có dữ liệu lịch; khung bên phải chỉ hiện **hạn hoàn thành thật** của khóa chưa hoàn thành | Bảng lịch đào tạo/nhắc việc, có thể nối thông báo | Có lịch học tập trung không |
| DATA-38 | P2 | **Tài liệu/video trong bài học** | Bài học chỉ có nội dung văn bản (`lessons.body`), chưa có tệp | Đính kèm cho bài học (dùng lại cơ chế upload/quét của nội dung) | Định dạng và dung lượng cho phép |
| DATA-39 | P1 | **Làm lại bài kiểm tra sau khi đã đạt** | API `POST …/quiz-attempts` vẫn mở lần mới khi đã đạt (nếu còn lượt). UI-08 **không** hiện nút làm bài khi đã đạt hoặc đã hoàn thành | Chặn ở backend khi đã đạt, hoặc cho làm lại để ôn mà không đổi kết quả hoàn thành | Quy tắc nghiệp vụ: có cho làm lại sau khi đạt không |
| DATA-40 | P3 | **Chứng nhận hoàn thành** ("Xem điểm, tiến độ và chứng nhận") | Chưa có | Sinh chứng nhận PDF có mã kiểm tra khi `completed_at` có giá trị | Mẫu chứng nhận, ai ký |

## Liên quan UI (không phải API)

- Header mobile của trang chi tiết: mockup có nút quay lại + tìm kiếm; UI-04 giữ header UI-02 đã duyệt và đặt nút quay lại ở breadcrumb. PO quyết định có làm header riêng hay không.
- UI-05 mobile có 2 ô tìm kiếm: **đã xử lý** ở UI-05 vòng 3 (PO chọn phương án A: AppFrame có prop `hideMobileSearch`, chỉ `/knowledge` bật).
- Khi DATA-01/02/03 xong, UI-03/UI-04 chỉ cần nối trường. Nhãn "Đã ban hành" có thể tách thành "Hiệu lực" và "Sắp hiệu lực".
