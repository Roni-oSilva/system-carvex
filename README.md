# Carvex — central privada de prospecção, vendas e gestão (visual Windows 98)

Sistema de uso exclusivo do proprietário: **sem cadastro público**, toda rota exige sessão validada no servidor.
Stack: Next.js 15 + TypeScript, PostgreSQL 16 + Prisma 6, Tailwind. Um único container + banco.

## Módulos (todos funcionais)
Dashboard · Prospecção (Google Places oficial + CSV, deduplicação, análise, score, oportunidades) · CRM (Kanban/lista, tags, timeline, follow-up) · Clientes (documentos, recorrência) · Mensagens (modelos por nicho, variáveis, aprovação manual) · Vendas (catálogo, propostas imprimíveis/PDF, funil) · Projetos (checklists, prazos, biblioteca) · Financeiro (receitas, despesas, lucro estimado, atrasos) · Automações (gatilho + condição + ação, rotinas agendadas) · IA (assistente; sugestões marcadas) · Relatórios · Busca global · Notificações · Configurações (segurança, regras comerciais, integrações, LGPD/lixeira/exportação, auditoria).

Integrações sem chave aparecem como **AGUARDANDO INTEGRAÇÃO** (nada é fictício). Envio de WhatsApp é **manual por design**.

## Deploy (VPS com Docker)
```bash
git clone <repo> && cd system-carvex
cp .env.example .env     # preencha (veja abaixo)
docker compose up -d --build
```
Aponte um proxy HTTPS (Caddy/Nginx/Traefik) para `127.0.0.1:3000`. Exemplo Caddy: `seu-dominio.com.br { reverse_proxy 127.0.0.1:3000 }` (Caddy já sobrescreve `X-Forwarded-For`; em Nginx use `proxy_set_header X-Forwarded-For $remote_addr;`).

No `.env`: `POSTGRES_PASSWORD`, `DATA_ENCRYPTION_KEY`, `APP_SECRET`, `CRON_SECRET` (cada um com `openssl rand -hex 32`), `OWNER_EMAIL`, `OWNER_PASSWORD` (≥12 caracteres, 3 tipos), `APP_URL`.
No primeiro boot o container aplica as migrations, semeia a configuração padrão e cria o proprietário. Entre e **ative o 2FA** em Configurações → Segurança; depois remova `OWNER_PASSWORD` do `.env`.

Outros hosts (Railway/Render/Fly): use o `Dockerfile`, um PostgreSQL gerenciado (`DATABASE_URL`), um volume em `/data` e agende `GET /api/cron` com `Authorization: Bearer $CRON_SECRET` a cada 15 min (o compose já faz isso pelo serviço `cron`).

## Desenvolvimento local
```bash
npm install
cp .env.example .env   # NODE_ENV=development, DATABASE_URL local, segredos
npx prisma migrate deploy && npm run bootstrap && npm run dev
npm test && npm run typecheck && npm run lint
```

## Operação
- **Backup:** `DATABASE_URL=... ./scripts/backup.sh ./backups 14` (pg_dump + SHA-256 + restauração de teste + retenção). Agende no cron do servidor e copie para fora da VPS. Também: Configurações → Dados e LGPD → exportar JSON. Restaurar: `pg_restore --clean --no-owner --dbname=<url> arquivo.dump`.
- **Esqueceu a senha:** defina `OWNER_RESET=1` + `OWNER_PASSWORD` no `.env`, reinicie, depois remova `OWNER_RESET`. (Perdeu o 2FA: use um código de recuperação; sem eles, apague `mfaEnabled` no banco.)
- **Rotinas:** pagamentos atrasados, recorrências, follow-ups, leads sem resposta, prazos, propostas expiradas e limpeza — rodam via `/api/cron` ou em Automações → Executar agora.
- **IA:** `LLM_API_KEY` (Anthropic) · **Busca:** `GOOGLE_PLACES_API_KEY` (campos de telefone/site usam SKUs pagos do Google; respeite os termos de armazenamento).

## Segurança (resumo)
argon2id · 2FA TOTP + códigos de recuperação (segredo AES-256-GCM) · sessão opaca com hash no banco, expiração absoluta e por inatividade, logout remoto · anti brute force · CSRF (token + Origin) · CSP/HSTS/X-Frame-Options · validação com zod · Prisma parametrizado · autorização no servidor em toda página/ação · auditoria (login, finanças, exclusões, config) · erros técnicos só no log · segredos só em variáveis de ambiente.
Limitações: rate limit genérico em memória (processo único); sem recuperação de senha por e-mail (use `OWNER_RESET`); CSP usa `'unsafe-inline'` (exigência do Next sem nonce); `DATA_ENCRYPTION_KEY` perdida = 2FA cadastrado irrecuperável.

## Estrutura
`prisma/` schema, migrations, seed · `scripts/` bootstrap, backup · `src/app/` rotas · `src/server/` ações e regras (somente servidor) · `src/lib/` funções puras e segurança · `src/components/` UI Win98 · `docker/` entrypoint.
