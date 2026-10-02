# Carvex — central privada de prospecção, vendas e gestão

Sistema web de uso exclusivo do proprietário: sem cadastro público, toda rota exige sessão validada no servidor. Veja [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (decisões, plano por fases), [`docs/SECURITY.md`](docs/SECURITY.md) e [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md).

## Estado atual — Fase 1 (Fundação) concluída
Funcionando e testado: autenticação (argon2id), 2FA TOTP + códigos de recuperação, sessões revogáveis, anti brute force, auditoria, alerta de login, painel **Configurações → Segurança**, dashboard com indicadores reais (zerados até haver dados), layout responsivo (dark/light automático), schema completo (42 tabelas) com migration e seed, backup com teste de restauração.
Módulos das Fases 2–10 aparecem no menu **desabilitados com o selo da fase** — não há botões falsos.

## Requisitos
Node ≥ 20, PostgreSQL ≥ 14 (testado no 16).

## Instalação
```bash
npm install
cp .env.example .env            # preencha DATABASE_URL e gere os segredos:
openssl rand -hex 32            # → DATA_ENCRYPTION_KEY
openssl rand -hex 32            # → APP_SECRET
npx prisma migrate deploy       # aplica migrations (dev: npm run db:migrate)
npm run db:seed                 # pipeline, regras de score/oportunidade, nichos (sem dados fictícios)
OWNER_EMAIL=voce@exemplo.com OWNER_NAME="Seu Nome" OWNER_PASSWORD='SenhaForte-123!' npm run owner:create
npm run dev                     # http://localhost:3000
```
Depois do primeiro login, ative o 2FA em **Configurações → Segurança**.

## Scripts
`dev` · `build` · `start` · `lint` · `typecheck` · `test` (Vitest) · `db:migrate` · `db:deploy` · `db:seed` · `owner:create`

Redefinir a senha do proprietário: `OWNER_RESET=1 OWNER_EMAIL=... OWNER_PASSWORD=... npm run owner:create`.

## Backup e restauração
```bash
DATABASE_URL=... ./scripts/backup.sh ./backups 14   # dump + SHA-256 + restauração de teste + retenção de 14 dias
pg_restore --clean --no-owner --dbname="$DATABASE_URL_SEM_SCHEMA" backups/carvex-AAAAMMDD-HHMMSS.dump
```
O backup só é reportado como OK depois de restaurado em um banco temporário e conferido. Agende via cron e copie para fora do servidor.

## Deploy
`npm run build && npm run db:deploy && npm start` atrás de proxy TLS (HTTPS). Defina `NODE_ENV=production`, os segredos no secret manager e confira a seção "Operação em produção" de `docs/SECURITY.md`.

## Próximos passos
Fase 2 (CRM). Cada fase termina com checklist: funcionalidade, responsividade, segurança, erros, validação, estados vazios/loading, logs e permissões.
