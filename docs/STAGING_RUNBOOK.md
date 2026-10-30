# Runbook staging Sprint 0.1

Chỉ dùng dự án/volume và dữ liệu DEMO riêng. Không production. Các script snapshot chỉ chấp nhận project bắt đầu `jkc-s01` hoặc `jkc-staging`. Không dùng `down --volumes` trên staging có dữ liệu cần giữ. Luôn dùng cùng bộ compose/env/project, không ghi secret vào command log hoặc commit.

## Khởi động và readiness

1. Sao chép deploy/.env.example thành file riêng đã Git ignore, sinh DB_PASSWORD và DB_RUNTIME_PASSWORD khác nhau/URL-safe >=20 ký tự, DEMO_PASSWORD >=12 ký tự.
2. Chọn localhost/loopback và port trống (18080/18443 đã kiểm thử). APP_ORIGIN=https://localhost:18443; không dùng hostname nội bộ thật khi chưa có IT DNS/trust/firewall.
3. `docker compose --project-name jkc-staging --env-file deploy/.env -f deploy/compose.yml up -d --build --wait --wait-timeout 240`.
4. Seed chỉ khi DB DEMO: thêm `--profile demo run --rm --no-deps seed` vào cùng bộ lệnh.
5. Copy riêng public root.crt từ proxy `/data/caddy/pki/authorities/local/root.crt` vào `.local/staging-ca.crt`; không copy root.key. Chạy healthcheck với JKC_CA_CERT. IT cài trust đúng thiết bị trước dùng thật.
6. Chỉ proxy có published ports, API/DB/scanner ở backend internal network, Caddy admin off. API readiness kiểm head 003, role không owner/superuser/BYPASSRLS, storage ghi được và ClamAV signatures <=7 ngày. `live` không phụ thuộc DB; `ready` trả 503 khi DB/storage/scanner chưa sẵn sàng.

Migration tách biệt: owner chỉ có ở migrate/seed/ops; API nhận runtime URL riêng. Provisioning `python -m app.provision_runtime` phải chạy bằng owner connection và DB_RUNTIME_USER/DB_RUNTIME_PASSWORD. Không cấp runtime role cho con người; không reuse role đang sở hữu object hoặc có role membership. Không chạy API bằng owner để bỏ qua RLS.

## Scanner và release image

Đã kiểm thử real ClamAV qua INSTREAM, ảnh CLEAN và EICAR bị chặn. Không cấu hình no-op/fake scanner trong staging. Image stable có VERSION chữ ký 28164 ngày 25/10/2026 tại lần kiểm thử; age guard sẽ khóa upload/readiness sau 7 ngày nếu không cập nhật.

IT phải chốt egress/mirror và lịch cập nhật trước shared pilot. Có override `deploy/compose.signature-updates.yml` bật freshclam daemon và network outbound riêng cho scanner, không publish inbound port:

```sh
docker compose --project-name jkc-staging --env-file deploy/.env -f deploy/compose.yml -f deploy/compose.signature-updates.yml up -d clamav
```

Override này **chưa được nghiệm thu trên mạng JKC**. Kiểm log freshclam, VERSION và signature age sau cập nhật; giữ fail-closed, không nâng age limit để bỏ qua sự cố. Pin CLAMAV_IMAGE và các release image vào digest đã duyệt ở registry nội bộ; `infrastructure.json` ghi image ID thực đã thử nhưng không phải một registry release được IT phê duyệt. ClamAV amd64 được thử qua emulation trên Apple Silicon, không suy ra capacity host sản xuất.

## Backup nhất quán DB + file

Chỉ có API ghi DB/file trong phạm vi này. Script dừng proxy/API/web, đợi request đang xử lý, tạo pg_dump custom format + tar private uploads, SHA256SUMS và COMPLETE, rồi khởi động lại. Nếu thêm worker/queue sau này, phải đưa mọi writer vào maintenance window trước khi dùng lại quy trình.

```sh
.venv/bin/python scripts/staging/verify_restore.py capture --project jkc-staging --env-file deploy/.env
.venv/bin/python scripts/staging/snapshot.py backup --project jkc-staging --env-file deploy/.env --set demo-drill-001
```

`verify_restore capture` chỉ phục vụ acceptance với fixture tổng hợp đã tạo bởi UAT runner, cần `.local/uat01.json` và report staging-probe.json. Nó lưu fingerprint 22 bảng, cùng checkpoint fixture riêng tư. Không dùng probe fixture nhân viên thật. Backup đơn thuần không bắt buộc capture.

BACKUP_ROOT mặc định deploy/backups (Git ignore); có thể cấu hình đường dẫn tuyệt đối trên ổ lưu độc lập đã được IT cho phép. Không overwrite backup set, không nhận backup partial thiếu COMPLETE. File dump chứa hash mật khẩu/session và dữ liệu nội bộ: quyền hạn chế, mã hóa/retention theo IT, không upload artifact hay commit. Thư mục cùng host đã dùng cho drill **không được tính là backup độc lập**.

## Restore vào project rỗng

Tạo env restore mới: DB/runtime password mới, cùng DEMO_PASSWORD để kiểm fixture đã khôi phục; port mới 28080/28443, APP_ORIGIN tương ứng, BACKUP_ROOT trỏ nguồn backup. Không copy secret vào báo cáo.

```sh
.venv/bin/python scripts/staging/snapshot.py restore --project jkc-staging-restore --env-file .local/restore.env --set demo-drill-001
docker cp jkc-staging-restore-proxy-1:/data/caddy/pki/authorities/local/root.crt .local/restore-ca.crt
.venv/bin/python scripts/staging/verify_restore.py verify --project jkc-staging-restore --env-file .local/restore.env --ca .local/restore-ca.crt
```

Script từ chối project đã có pg_data volume, database không rỗng hoặc uploads không rỗng. Kiểm SHA256SUMS, archive entries không traversal/symlink, từng attachment khớp checksum DB, tạo runtime login không đặc quyền, restore rồi migrate/provision lại trước API. So sánh toàn bộ fingerprint trước khi login làm phát sinh session/audit mới. Sau đó xác minh protected download, ACK và quiz history qua HTTPS. Muốn chạy lại drill phải dùng project mới và checkpoint đúng backup, không restore đè.

Caddy CA/private key không nằm trong dump/files backup. Clone dùng CA mới và đã xác minh riêng; IT cần quy trình custody/backup CA private key và secrets ngoài Git, không tự giả định mọi điện thoại đã tin CA mới sau disaster recovery.

## Migration / rollback

SQL baseline và migrations 001/002 không sửa. 003 chứa RLS/functions/history/index/constraints mới. Database cũ cần preflight: attachment content_version_id không NULL, không có nhiều open quiz attempts trên một assignment. Upgrade fail thì transaction rollback, không stamp head để che lỗi.

Đã thử clean apply, downgrade base và re-upgrade trên DB test. Sau khi đã có ACK/quiz/history cần giữ, ưu tiên restore snapshot + đúng source/image, không tự downgrade 003 (mất các cột snapshot quiz). Không chạy lệnh destructive trên DB nhân viên thật.

## Lịch và giám sát cần IT chốt

- Chọn maintenance window/RPO/RTO, lịch gọi snapshot backup, thời gian pause API, retention, mã hóa và đích sao lưu độc lập. Chưa cài scheduler hệ thống của máy người dùng.
- Theo dõi live/ready, disk uploads/backups, failures ClamAV/freshclam và checksum mismatch. Không expose monitoring/admin ra internet.
- Mỗi release lưu image digest, migration head, manifest backup và kết quả restore vào môi trường cô lập.
- Nếu scan lỗi/cũ: khóa upload, sửa mirror/daemon rồi kiểm thử CLEAN/EICAR; không sửa metadata thành CLEAN bằng tay.
- Nếu file thiếu/hash sai: API trả 503; khôi phục file từ backup đã xác minh, không đổi sha256 để làm test pass.
