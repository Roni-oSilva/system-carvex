#!/bin/sh
# Aplica migrations, semeia configuração, cria o proprietário (se necessário) e inicia o app.
set -e
npx prisma migrate deploy
npx tsx scripts/bootstrap.ts
exec npx next start -p "${PORT:-3000}"
