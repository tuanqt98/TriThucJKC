# Staging Sprint 1 — DEMO

Giữ các quy tắc [runbook Sprint 0.1](STAGING_RUNBOOK.md). Nhánh feature, không production. Stack Sprint 1 cô lập `jkc-staging-s1`, URL review https://localhost:18444, HTTP 18081 chỉ redirect, bind loopback. Stack Sprint 0.1 `jkc-s01` ở 18443 giữ nguyên.

Secret source: `.local/sprint1.env`; CA công khai: `.local/sprint1-ca.crt`. Restore dùng secret mới `.local/sprint1-restore.env`, cổng 28444/28081. Không in hoặc commit env, private key, dump/tar, checkpoint hay browser trace. Không tự cài CA vào trust store. IT kiểm CA đúng chain trên thiết bị thật theo [UAT thực địa](UAT_SPRINT1_FIELD.md).

```sh
docker compose --project-name jkc-staging-s1 --env-file .local/sprint1.env -f deploy/compose.yml up -d --build --wait --wait-timeout 240
.venv/bin/python scripts/staging/uat.py --project jkc-staging-s1 --env-file .local/sprint1.env --ca .local/sprint1-ca.crt --evidence-dir docs/reports/sprint1
.venv/bin/python scripts/staging/collect_evidence.py --project jkc-staging-s1 --env-file .local/sprint1.env --evidence-dir docs/reports/sprint1
```

Seed baseline trước UAT bằng profile demo theo README. Không chạy fixture seed trên DB chứa nhân viên thật. HR fixture mới không cấp HR cho account có sẵn; dữ liệu/account UAT phải giữ namespace DEMO/uat_.

Backup drill dùng set mới, không ghi đè `sprint1-drill` đã có:

```sh
.venv/bin/python scripts/staging/verify_restore.py capture --project jkc-staging-s1 --env-file .local/sprint1.env --evidence-dir docs/reports/sprint1
.venv/bin/python scripts/staging/snapshot.py backup --project jkc-staging-s1 --env-file .local/sprint1.env --set NEW_SET --evidence-dir docs/reports/sprint1
.venv/bin/python scripts/staging/snapshot.py restore --project jkc-staging-NEW-restore --env-file .local/NEW-restore.env --set NEW_SET --evidence-dir docs/reports/sprint1
```

Tên project thực tế phải chỉ chữ thường/số/dấu gạch ngang; thay placeholder NEW trước khi chạy. Project restore/volume phải chưa tồn tại; chọn cổng riêng. Copy CA của proxy restore sau khi script chờ healthy, rồi chạy verify với project/env/CA tương ứng. Fingerprint so 41 bảng (có incidents và lịch sử), trước khi login ghi session mới. Dump+private files có checksum và từng attachment khớp hash.

Đây là drill trên cùng máy, **chưa phải backup độc lập đã được IT nghiệm thu**. IT còn phải chốt đích độc lập, mã hóa, lịch/retention/alert, RPO/RTO, CA-key custody và diễn tập thực địa. Không hạ kiểm tra AV freshness để qua readiness. Không thay registry/network/trust của công ty khi chưa được duyệt.
