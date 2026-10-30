#!/bin/sh
set -eu
umask 077
case "$BACKUP_SET" in ''|*[!A-Za-z0-9_-]*) echo 'Invalid BACKUP_SET' >&2; exit 2;; esac
root="/backups/$BACKUP_SET"
[ -f "$root/COMPLETE" ] || { echo 'Incomplete backup set' >&2; exit 2; }
(cd "$root" && sha256sum -c SHA256SUMS)
[ "$(psql -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")" = 0 ] || { echo 'Refuse restore into a non-empty database' >&2; exit 2; }
[ -z "$(ls -A /uploads)" ] || { echo 'Refuse restore into non-empty file storage' >&2; exit 2; }
tar -tzf "$root/uploads.tar.gz" | while IFS= read -r entry; do
 case "$entry" in ./) ;; ./*) key="${entry#./}"; case "$key" in *[!a-f0-9]*|'') exit 2;; esac; [ "${#key}" = 32 ] || exit 2;; *) exit 2;; esac
done
tar -tvzf "$root/uploads.tar.gz" | while IFS= read -r entry; do
 case "$entry" in d*|-*) ;; *) echo 'Refuse non-regular archive entry' >&2; exit 2;; esac
done
psql -v ON_ERROR_STOP=1 -v runtime_password="$DB_RUNTIME_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE jkc_runtime LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD %L', :'runtime_password') \gexec
SQL
pg_restore --exit-on-error --no-owner --dbname="$PGDATABASE" "$root/database.dump"
tar -C /uploads -xzf "$root/uploads.tar.gz"
psql -At -F '|' -c 'SELECT storage_key,sha256 FROM attachments' | while IFS='|' read -r key hash; do
 case "$key$hash" in *[!a-f0-9]*|'') exit 2;; esac
 [ "${#key}" = 32 ] && [ "${#hash}" = 64 ] || exit 2
 printf '%s  %s\n' "$hash" "/uploads/$key" | sha256sum -c -
done
chown -R 10001:10001 /uploads
chmod 700 /uploads
find /uploads -type f -exec chmod 600 {} \;
echo 'Database and attachment checksums restored into empty isolated volumes.'
