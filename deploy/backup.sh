#!/bin/sh
set -eu
umask 077
case "$BACKUP_SET" in ''|*[!A-Za-z0-9_-]*) echo 'Invalid BACKUP_SET' >&2; exit 2;; esac
root="/backups/$BACKUP_SET"
# API/mutating workers MUST be stopped by the caller for a consistent DB+file snapshot.
[ ! -e "$root" ] || { echo 'Backup set already exists; refusing overwrite' >&2; exit 2; }
mkdir -p "$root"
trap 'rm -f "$root/COMPLETE"' EXIT
pg_dump --format=custom --file="$root/database.dump"
tar -C /uploads -czf "$root/uploads.tar.gz" .
(cd "$root" && sha256sum database.dump uploads.tar.gz > SHA256SUMS)
printf 'JKC backup schema 003; database and private attachments; API writes paused\n' > "$root/COMPLETE"
trap - EXIT
