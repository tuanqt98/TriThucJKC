# Kế hoạch rollback

## 1. Rollback hợp nhất mã (`main`)

| Tình huống | Cách làm | Ghi chú |
|---|---|---|
| CI đỏ sau khi merge một PR vào `main` | Dừng merge các PR sau. `git revert -m 1 <merge-commit>` qua một PR revert, CI xanh rồi mới merge | Không force-push. Revert giữ lịch sử |
| Cần quay `main` về trước toàn bộ đợt hợp nhất | Revert lần lượt các merge commit **theo thứ tự ngược** (PR #7 → … → PR-S1) trong một PR "rollback", hoặc PR đưa cây về tag `pre-merge-main-YYYYMMDD` | Tag mốc tạo trước khi merge (`MERGE_PLAN.md` §2.1) |
| Lỗi chỉ ở một màn | Ưu tiên sửa tiến (fix forward) bằng PR nhỏ | Không revert màn giữa chuỗi: các màn sau phụ thuộc |

Merge `main` **không** tự deploy. Rollback mã không cần đụng database nếu chưa deploy.

## 2. Rollback triển khai (khi có môi trường production — chưa có)

**Thay đổi DB giữa `main` hiện tại và chuỗi UI:** thêm migration **004 → 007** (workflow, sự cố, đào tạo, tiêu đề phiên bản). API sau hợp nhất **bắt buộc** DB ở revision `007` mới báo sẵn sàng. Từ 004 đến 007 đều có tệp `00x_down.sql`.

**Trước khi deploy:**
1. **Backup đầy đủ** DB và kho tệp đính kèm bằng `scripts/staging/snapshot.py backup` (hoặc `deploy/backup.sh`).
2. **Khôi phục thử** sang stack cô lập (`snapshot.py restore` + `verify_restore.py verify`), giống bước CI `Isolated DB and attachment restore` đã PASS ở #42970185474.
3. Ghi lại **image tag** đang chạy (api, web) để có thể quay lại.

**Nếu deploy lỗi:**

| Mức | Cách làm |
|---|---|
| Lỗi ứng dụng, DB vẫn đúng | Quay về image tag trước. Lưu ý: image cũ (Sprint 0.1) đòi DB revision `003`, nên nếu đã migrate lên 007 thì phải hạ DB (dòng dưới) hoặc fix forward |
| Phải hạ schema | `alembic downgrade` từng bước 007 → 003 (dùng `00x_down.sql`) **chỉ khi chưa có dữ liệu nghiệp vụ mới** phụ thuộc bảng/cột mới |
| Dữ liệu hỏng hoặc migrate dở | **Khôi phục từ backup** trước deploy (`snapshot.py restore`) rồi chạy image cũ. Mất dữ liệu phát sinh sau backup: phải thông báo |

**Không xóa hay sửa** lịch sử phê duyệt, điểm, audit để "làm sạch". Rollback bằng restore là quay về thời điểm backup, không phải sửa từng dòng.

## 3. Kiểm chứng đã có

| Kiểm chứng | Bằng chứng |
|---|---|
| `pg_dump`/`pg_restore` + migration (drill) | CI `foundation` · "Database drill …" ✅ #42970185474 |
| Backup và restore DB + tệp sang stack cô lập, xác minh dữ liệu và tệp | CI `staging-acceptance` · "Isolated DB and attachment restore" ✅ #42970185474 |
| Migration lên/xuống | `scripts/migration_cycle.py`, `database_drill.py` (trong CI) |

**Chưa có (gate IT):** backup định kỳ ngoài máy chủ, mã hóa và lưu giữ, diễn tập restore trên **hạ tầng production thật** có đo RTO/RPO.
