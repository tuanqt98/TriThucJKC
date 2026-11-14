# Review hậu hợp nhất và mức sẵn sàng production

Ngày 14/11/2026.

**Phạm vi:** chỉ review, đo và đề xuất.
- Không merge PR, không đổi base PR, không deploy.
- Không xóa nhánh hay dữ liệu.
- Mọi thử nghiệm chạy trên DB test riêng hoặc **bản sao** DB staging trong container tạm; staging không bị đổi.

## 1. Baseline

| Mục | Giá trị |
|---|---|
| `main` | `7ff930f` (8 merge commit; cây = `a5b8ee8` = `47597a6`) |
| Tag baseline | **`baseline-main-20261113`** → `7ff930f` (annotated, đã đẩy) |
| CI | run 43412922799: foundation · postgres17 · staging-acceptance ✅ |
| Tag khác | `pre-merge-main-20261111` → `dc47e98`; `ui-08-approved`; `ui-09-approved` |

## 2. Phạm vi PR #8–#11 so với `main`

Cả 4 PR đều tách từ `47597a6`. Vì cây `main` = `47597a6`, phần khác biệt so với `main` **đúng bằng** thay đổi riêng của từng PR.

| PR | Nhánh @ head | Commit | Thay đổi | Đúng phạm vi |
|---|---|---|---|---|
| #8 DATA-39B | `fix/data-39b-stale-attempt` @ `00833dd` | 1 | Migration `008` (up/down), `learning.py` (map lỗi), `main.py` (readiness 008), `database_drill.py`, `migration_cycle.py`, 3 test, README, backlog, báo cáo | ✅ Không đổi bảng, quyền, RLS, UI |
| #9 G-2 | `fix/g2-demo-seed-guard` @ `4c76c88` | 1 | `demo_guard.py` (mới), 3 module seed, `compose.yml` (bỏ ép `APP_ENV`), `ci.yml` (kiểm tra guard), `conftest.py`, 27 test, runbook, README, báo cáo | ✅ Không schema/quyền/UI |
| #10 vùng chạm | `fix/touch-targets-44` @ `1e0e44a` | 2 | 5 tệp CSS, script đo và bằng chứng | ✅ Chỉ CSS |
| #11 DATA-20 | `spec/data-20-server-search` @ `cd74a57` | 1 | Đặc tả, số đo nền, backlog | ✅ Chỉ tài liệu |

**Kiểm tra gộp:**
- `#8 → #9 → #10 → #11` gộp tuần tự lên `main`: **không xung đột** (`git merge-tree`). Các tệp chung: `README.md` (#8, #9) và backlog (#8, #11), sửa ở dòng khác nhau.
- **`main` + #8 + #9:** alembic head `008`; **pytest 96/96** trên PostgreSQL 16 sạch (`evidence/combined-results.txt`).

## 3. Đề xuất đổi base PR #8 và #9 sang `main` (chưa thực hiện)

**Lệnh (chờ PO cho phép):**
```sh
gh pr edit 8 --base main
gh pr edit 9 --base main
```

**Kết quả mong đợi** (giống như với PR #1–#7):
- diff giữ nguyên: #8 có 13 tệp, #9 có 14 tệp;
- `mergeStateStatus` = `CLEAN` (CI 3/3 đã xanh trên đúng head);
- PR vẫn Draft;
- đổi base **không** chạy lại CI và **không** merge.

**Thứ tự đề xuất:**
1. Duyệt bản sửa G2-R1 (mục 5). Nếu đồng ý, thêm commit sửa vào **PR #9**; CI tự chạy lại trên head mới.
2. Đổi base #8 và #9.
3. Review code và nghiệm thu từng PR.
4. Merge #8 trước (migration 008), rồi #9 (seed guard), mỗi PR một merge commit, kiểm tra cây và CI như đợt 8 bước.

PR #10 và #11 đổi base sau, theo quyết định riêng.

## 4. Review DATA-39B (PR #8)

| Kiểm tra | Cách làm | Kết quả |
|---|---|---|
| Thay đổi tối thiểu | So `008_quiz_after_pass.sql` với `008_down.sql` | Khác đúng **1 dòng** kiểm tra và chú thích; giữ chữ ký, `SECURITY DEFINER`, `search_path`, `REVOKE … FROM PUBLIC` |
| Thứ tự kiểm tra (bảo mật) | Đọc hàm | Khóa assignment, rồi **kiểm tra chủ sở hữu (404)**, rồi mới kiểm tra "đã đạt". Người khác không suy ra được trạng thái học |
| Test của PR | pytest (#8 và tổ hợp #8 + #9) | Đúng ở RED (007) và GREEN (008); bảo mật: admin, head, other nhận 404 |
| **Nộp đồng thời** (review, ngoài PR) | `evidence/test_review_data39b_concurrency.py`, chạy 3 lần | ✅ 3/3 × 3 (chi tiết bên dưới) |
| **Dữ liệu staging thật** (bản sao) | Khôi phục bản sao vào PostgreSQL 17 tạm | Có **4** lần làm "cũ" (đang mở trong khi đã đạt); **0** lần nộp sau khi đạt |
| Lên/xuống trên bản sao | 007 → 008 → 007 → 008, gọi `jkc_submit_quiz` cho lần làm cũ | ✅ (chi tiết bên dưới) |
| Rollback | `008_down.sql` | Khôi phục nguyên văn hàm của 003; không có bước dữ liệu |

**Nộp đồng thời**, 3 tình huống:
- 4 lần nộp song song **cùng một lần làm cũ** → cả 4 trả 409 `QUIZ_ALREADY_PASSED`; lịch sử không đổi.
- Nộp bài **đạt** song song với 5 yêu cầu **mở lần mới** → mỗi yêu cầu mở hoặc nhận lại đúng lần đang mở, hoặc 409. **Không** có lần làm mới; đúng 1 lần đạt, 1 audit.
- 6 lần nộp song song cùng một lần làm đang mở → đúng 1 lần chấm (200), 5 lần 409; 1 audit, 2 câu trả lời.

**Lên/xuống trên bản sao staging:**
- Ở 007: lời gọi đi tiếp vào kiểm tra câu trả lời (`JKC_INVALID`), tức **không chặn**.
- Ở 008: **`JKC_ALREADY_PASSED`**.
- Sau rollback về 007: trở lại như cũ.
- Áp lại 008: chặn.
- **Mã băm lịch sử 307 lần làm không đổi** suốt quá trình (`evidence/data39b-staging-copy-up-down.txt`).

**Kết luận:** PR #8 đạt yêu cầu. Với dữ liệu thật, 4 lần làm cũ trên staging (và mọi lần tương tự trên production) **giữ nguyên, không nộp được**, đúng đề xuất trong báo cáo tác động.

## 5. Review G-2 (PR #9)

| Kiểm tra | Kết quả |
|---|---|
| Thay đổi đúng phạm vi; 27 test; CI kiểm tra guard từ chối sau pytest | ✅ |
| Seed bằng **owner** (superuser) trên DB đánh dấu production, `APP_ENV=staging` | ✅ **Từ chối**, 0 tài khoản DEMO |
| **Owner ghi đè dấu cho phiên**: `PGOPTIONS='-c jkc.environment=staging'` | ❌ **Lọt**: seed chạy và tạo 4 tài khoản DEMO (`evidence/g2-pgoptions-bypass.txt`) |

### Phát hiện

| ID | Mức | Phát hiện | Đề xuất |
|---|---|---|---|
| **G2-R1** | **P0** (thuộc G-2) | Guard đọc dấu bằng `current_setting()`. Giá trị này **phiên kết nối tự ghi đè được** (`PGOPTIONS`, `SET`), trong khi dấu thật ở mức database (`pg_db_role_setting`) vẫn là `production` | Đọc thêm dấu từ catalog `pg_db_role_setting` (mức database và role-trong-database; phiên không ghi đè được); nguồn nào báo `production` thì từ chối. **Đã thử nghiệm** trong worktree tạm, chưa đẩy: ghi đè bằng `PGOPTIONS` vẫn bị từ chối, 0 tài khoản DEMO (`evidence/g2-pgoptions-bypass-fixed-prototype.txt`); 31 test G-2/UI-06 vẫn PASS. Khoảng 10 dòng code, thêm 1 test. **Chờ PO cho phép thêm vào PR #9** |
| G2-R2 | P1 | Guard nằm ở **mã ứng dụng**. Người có quyền owner vẫn chèn tay dữ liệu DEMO bằng SQL được | (a) Quy trình: production chỉ DBA giữ owner; G-5 (owner không superuser). (b) Tùy chọn mạnh hơn: trigger DB từ chối `employee_code LIKE 'DEMO-%'` khi DB mang dấu production. **Đây là thay đổi schema, cần PO duyệt riêng** |
| G2-R3 | P0 (thuộc G-3) | Chưa có cấu hình compose **production** (hiện chỉ có staging) | IT/Dev tạo `compose.production.yml` **không có** service `seed`/`test` và profile `demo`/`test`, `APP_ENV=production`; thêm kiểm tra CI cho cấu hình này (`IT_CHECKLIST_G3_G4.md`) |
| G2-R4 | P2 | `deploy/backup.sh` ghi nhãn "schema 003" vào tệp `COMPLETE`, trong khi schema hiện là 007 (008 sau PR #8) | Sửa nhãn, hoặc ghi `alembic_version` thực tế vào manifest |

## 6. Việc cần PO quyết định

1. Cho phép đổi base PR #8 và #9 sang `main` (lệnh ở mục 3).
2. Cho phép thêm bản sửa **G2-R1** vào PR #9.
3. G2-R2(b), trigger DB: làm hay chỉ dựa vào quy trình và G-5.
4. Giao IT checklist G-3/G-4 (`IT_CHECKLIST_G3_G4.md`).
5. Duyệt kế hoạch UAT (`UAT_PLAN.md`), chọn người tham gia và lịch.
