#!/usr/bin/env bash
# Backup do PostgreSQL com verificação de integridade e teste de restauração.
# Uso: DATABASE_URL=... ./scripts/backup.sh [diretório] [retenção_em_dias]
# Backup só é considerado concluído após: checksum gravado + restauração em banco temporário + contagem de tabelas conferida.
set -euo pipefail
: "${DATABASE_URL:?defina DATABASE_URL}"
DIR="${1:-./backups}"; KEEP="${2:-14}"
URL="${DATABASE_URL%%\?*}"                       # remove ?schema=public (pg_dump não aceita)
mkdir -p "$DIR"; chmod 700 "$DIR"
FILE="$DIR/carvex-$(date +%Y%m%d-%H%M%S).dump"

pg_dump --format=custom --no-owner --file="$FILE" "$URL"
sha256sum "$FILE" > "$FILE.sha256"
sha256sum -c "$FILE.sha256" >/dev/null

# Teste de restauração em banco temporário
TMP="carvex_restore_test_$$"
ADMIN="${URL%/*}/postgres"
psql "$ADMIN" -qc "CREATE DATABASE $TMP"
trap 'psql "$ADMIN" -qc "DROP DATABASE IF EXISTS $TMP" >/dev/null' EXIT
pg_restore --no-owner --dbname="${URL%/*}/$TMP" "$FILE"
SRC=$(psql "$URL" -Atc "select count(*) from information_schema.tables where table_schema='public'")
DST=$(psql "${URL%/*}/$TMP" -Atc "select count(*) from information_schema.tables where table_schema='public'")
[ "$SRC" = "$DST" ] || { echo "FALHA: tabelas origem=$SRC restauradas=$DST" >&2; exit 1; }
echo "OK: $FILE ($(du -h "$FILE" | cut -f1)), $DST tabelas restauradas e verificadas"

find "$DIR" -name 'carvex-*.dump*' -mtime +"$KEEP" -delete
