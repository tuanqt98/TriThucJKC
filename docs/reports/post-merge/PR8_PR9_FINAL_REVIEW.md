# Review cuối PR #8 (DATA-39B) và PR #9 (G-2) — chờ PO quyết định merge

Ngày 14/11/2026.

**Đã làm theo quyết định PO:**
- sửa G2-R1 trong PR #9;
- đổi base #8 và #9 sang `main`.

**Chưa merge**, không deploy, không chạy migration trên production.

## 1. Trạng thái PR

| | PR #8 DATA-39B | PR #9 G-2 |
|---|---|---|
| Base | `main` (`7ff930f`, tag `baseline-main-20261113`) | `main` |
| Head | `00833dd` (không đổi) | **`d751d48`** (thêm G2-R1 trên `4c76c88`) |
| Commit / tệp so với `main` | 1 / 13 | 2 / 17 (14 + 3 bằng chứng G2-R1) |
| Trạng thái | Draft · `CLEAN` | Draft · `CLEAN` |
| CI (foundation · postgres17 · staging-acceptance) | ✅ **chạy lại trên runner hiện tại** 14/11 (run 42973615184, lần 2) | ✅ run 43554338203, 43554341938 |
| Phạm vi | Migration 008 (thay thân 1 hàm), map lỗi 409, readiness 008, script drill, test, tài liệu | `demo_guard` (3 lớp, dấu đọc từ catalog), 3 seed, compose (bỏ ép `APP_ENV`), CI, test, runbook, tài liệu |
| Không đổi | Bảng, cột, quyền, RLS, endpoint, UI | Schema, quyền, API, UI |

**Tổ hợp sau khi merge cả hai** (`main` + #8 + #9 `d751d48`, commit tạm, không đẩy):
- **không xung đột**;
- migration `008 → 003 → 008 → base → 008` sạch;
- **pytest 103/103** trên PostgreSQL 16 sạch (`evidence/final-combined.txt`).

## 2. PR #8 — DATA-39B

| Hạng mục | Bằng chứng | Kết quả |
|---|---|---|
| Lỗi tái hiện (RED, DB 007) | `docs/reports/data-39b/red-green-rollback.txt` | Nộp lần làm cũ trả 200, score 0 |
| Sửa (GREEN, DB 008) | như trên | 409 `QUIZ_ALREADY_PASSED`; điểm, `completed_at`, câu trả lời, audit không đổi |
| Bảo mật | pytest | admin, head, other nhận 404 (kiểm tra chủ sở hữu trước, không lộ trạng thái học) |
| **Đồng thời** | `evidence/test_review_data39b_concurrency.py` (3 lần) | Nộp song song lần làm cũ: cả 4 trả 409. Đạt song song với mở lần mới: không có lần làm mới. Nộp song song một lần làm: chấm đúng 1 lần |
| **Dữ liệu staging thật** (bản sao, PostgreSQL 17) | `evidence/data39b-staging-copy-up-down.txt` | 4 lần làm cũ bị chặn ở 008; rollback 007 trở lại hành vi cũ; **mã băm lịch sử 307 lần làm không đổi** |
| Rollback | `008_down.sql`; cùng file bằng chứng | Khôi phục nguyên văn hàm 003; quyền giữ nguyên; không cần thao tác dữ liệu |
| Triển khai | — | Image API mới đòi DB ở **008**: migration chạy cùng đợt deploy, **backup trước**. **Không** chạy trên production khi chưa có G-3/G-4 |

## 3. PR #9 — G-2 (kèm G2-R1)

| Hạng mục | Bằng chứng | Kết quả |
|---|---|---|
| 3 lớp chặn trước mọi lệnh ghi (env, dấu DB, namespace) × 3 lệnh seed | `test_demo_guard.py` | Từ chối thì **0 dòng ghi** (đếm 7 bảng trước/sau) |
| **G2-R1:** `PGOPTIONS` ghi đè dấu | Trước sửa: `g2r1-bypass-before-fix.txt` (lọt, 4 tài khoản DEMO). Sau sửa: 3 test | Từ chối × 3 seed; 0 dòng ghi; 0 tài khoản DEMO |
| Dấu mức role-trong-database; dấu mâu thuẫn | 4 test | `production` luôn thắng |
| Role không superuser đọc được catalog | Kiểm tra thủ công (NOSUPERUSER, phiên bị ghi đè thành `staging`) | Đọc được `production` |
| RED/GREEN G2-R1 | `g2r1-red.txt` / `g2r1-green.txt` | 7/7 FAIL → 34/34 PASS; pytest toàn bộ 100/100 |
| CI kiểm tra guard sống | `ci.yml` (foundation) | Seed sau pytest **bị từ chối** ✅ |
| Compose | `ci.yml` + pytest | `seed` kế thừa `APP_ENV=staging`; chỉ trong profile `demo` |
| Rollback | — | Revert commit; không migration, không dữ liệu |

**Rủi ro còn lại, đã ghi vào hồ sơ (G2-R2, theo quyết định PO):**
- SQL trực tiếp bằng credential owner vượt được guard ứng dụng.
- Kiểm soát bằng: quyền truy cập, G-5, **không dùng owner cho dịch vụ và seed ở production**, và kiểm tra định kỳ không có tài khoản `DEMO-%`/`uat_%`.
- Ghi tại `docs/reports/g2-seed-guard/IMPACT_REPORT.md` §8 và runbook.

## 4. Đề xuất merge (cần PO phê duyệt riêng)

**Thứ tự:** **#8 trước, rồi #9.** Mỗi PR một merge commit; không squash/rebase/force-push/`--admin`.

**Mỗi bước:**
- bỏ Draft;
- `gh pr merge N --merge --match-head-commit <head>`;
- kiểm tra cha của merge commit = `main` trước + head;
- CI 3/3 trên merge commit;
- ghi `merge-log.md`.

**Kiểm tra riêng:**
- **Sau #8:** cây `main` = `00833dd`.
- **Sau #9:** cây `main` = cây tổ hợp đã thử (103/103). #9 không phải hậu duệ của #8, nên cây cuối là kết quả gộp chứ không trùng một head; so với tổ hợp `bff160f` đã kiểm.

Merge `main` **không** phải deploy. Production vẫn **NO-GO** (G-3, G-4, UAT).

## 5. UAT — đề xuất để PO xác nhận

| Mục | Đề xuất |
|---|---|
| Bản build | `main` **sau khi merge #8 và #9**, ghim commit và image digest. Nếu PO chưa merge, dùng tổ hợp tương đương (`7ff930f` + #8 + #9) được build riêng cho stack UAT |
| Stack | Stack UAT riêng, sạch (IT dựng theo B1–B8 nhưng ở chế độ staging) |
| Ngày bắt đầu | **Đề xuất:** N = thứ Hai sau khi IT dựng xong stack UAT và CA đã cài trên thiết bị (ước tính 3 ngày làm việc từ khi PO duyệt). Lịch N → N+6 theo `UAT_PLAN.md` §5 |

**Người tham gia (HR điền tên):**

| Vai trò | Số người | Người tham gia |
|---|---|---|
| Nhân viên xưởng (5 công đoạn) | 5–8 | Chế bản ……; In offset ……; In KTS ……; Flexo ……; Gia công sau in …… |
| Trưởng bộ phận (≥ 2 bộ phận) | 2–3 | …… |
| HR | 1–2 | …… |
| Quản trị kỹ thuật | 1 | …… |
| Điều phối / biên bản | 1 | …… |

Agent không có danh sách nhân sự thật, nên **HR cung cấp**. Tài khoản UAT tạo trong namespace `uat_` sau khi có danh sách.
