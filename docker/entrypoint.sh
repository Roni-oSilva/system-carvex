#!/bin/sh
# Aplica migrations, semeia configuração, cria o proprietário (se necessário) e inicia o app.
set -e

# Bancos serverless (Neon) dormem quando ociosos e levam alguns segundos para acordar:
# dá mais tempo para conectar e tenta de novo antes de desistir.
case "$DATABASE_URL" in
  *connect_timeout=*) ;;
  *\?*) export DATABASE_URL="${DATABASE_URL}&connect_timeout=30" ;;
  *) export DATABASE_URL="${DATABASE_URL}?connect_timeout=30" ;;
esac

n=0
until npx prisma migrate deploy; do
  n=$((n + 1))
  if [ "$n" -ge 8 ]; then echo "[entrypoint] Banco inacessível após $n tentativas."; exit 1; fi
  echo "[entrypoint] Banco ainda não respondeu (tentativa $n/8). Aguardando 10s..."
  sleep 10
done

npx tsx scripts/bootstrap.ts
exec npx next start -p "${PORT:-3000}"
