# Carvex — central privada de prospecção, vendas e gestão

Sistema de uso exclusivo do proprietário: **sem cadastro público**, toda rota exige sessão validada no servidor.
Stack: Next.js 15 + TypeScript, PostgreSQL 16 + Prisma 6, Tailwind. Tudo roda em containers (Docker).

**Módulos:** Dashboard · Prospecção (OpenStreetMap gratuito + CSV, deduplicação, análise, score, oportunidades) · CRM (Kanban/lista, tags, timeline, follow-up) · Clientes (documentos, recorrência) · Mensagens (modelos por nicho, aprovação manual) · Vendas (catálogo, propostas/PDF, funil) · Projetos (checklists, prazos) · Financeiro · Automações · IA · Relatórios · Busca global · Notificações · Configurações (segurança, regras, integrações, backups, LGPD, auditoria). O envio de WhatsApp é **manual por design**.

---

## Como colocar no ar (passo a passo)

### O que você precisa
1. **Um servidor (VPS)** Linux Ubuntu 22.04/24.04 com 2 GB de RAM (qualquer provedor: Hetzner, DigitalOcean, Contabo, Oracle Cloud etc.). Custa em torno de US$ 5/mês; confira o plano atual no provedor.
2. **Um domínio** (ex.: `crm.seudominio.com.br`) com um registro **A** apontando para o IP do servidor.

### Passos
```bash
# 1) No servidor (via SSH), instale o Docker:
curl -fsSL https://get.docker.com | sh

# 2) Baixe o projeto (branch com o código):
git clone -b claude/prompt-mestre-saas-crm-58ylp6 https://github.com/Roni-oSilva/system-carvex.git
cd system-carvex

# 3) Crie o arquivo de configuração:
cp .env.example .env
nano .env
```
No `.env` preencha:
| Variável | O que colocar |
|---|---|
| `DOMAIN` / `APP_URL` | seu domínio (`crm.seudominio.com.br` e `https://crm.seudominio.com.br`) |
| `POSTGRES_PASSWORD`, `DATA_ENCRYPTION_KEY`, `APP_SECRET`, `CRON_SECRET` | um valor diferente para cada, gerado com `openssl rand -hex 32` |
| `OWNER_EMAIL`, `OWNER_NAME`, `OWNER_PASSWORD` | seu acesso (senha com 12+ caracteres, 3 tipos) |
| `LLM_PROVIDER`, `LLM_API_KEY` | (opcional) IA gratuita — veja abaixo |

```bash
# 4) Suba tudo (a primeira vez demora alguns minutos):
docker compose up -d --build

# 5) Veja se está tudo de pé:
docker compose ps
docker compose logs app --tail 30     # deve mostrar "Proprietário criado" e "Ready"
```
6. Abra `https://crm.seudominio.com.br` (o certificado HTTPS é emitido sozinho em ~1 minuto), entre com `OWNER_EMAIL`/`OWNER_PASSWORD`.
7. Vá em **Configurações → Segurança → Configurar 2FA** e guarde os códigos de recuperação.
8. Edite o `.env`, **apague a linha `OWNER_PASSWORD`** e rode `docker compose up -d`.

### Atualizar depois
```bash
cd system-carvex && git pull && docker compose up -d --build
```

### Alternativas sem servidor próprio (Railway, Render, Fly.io)
Use o `Dockerfile`, crie um PostgreSQL gerenciado e informe `DATABASE_URL`, os segredos e `OWNER_*` como variáveis de ambiente, com `APP_URL` = URL pública. **Importante:** monte um **volume persistente em `/data`** (documentos e backups ficam lá; sem volume eles somem a cada deploy) e agende uma chamada a cada 15 min a `GET https://SEU-APP/api/cron` com o cabeçalho `Authorization: Bearer <CRON_SECRET>` (o site cron-job.org faz isso de graça). Esse caminho eu não testei de ponta a ponta; o caminho da VPS acima é o recomendado.

---

## IA
A IA tem dois modos (Configurações → **IA → Testar conexão** mostra qual está ativo):
- **Modo básico (padrão, sem chave, sem custo):** regras locais — sugere nicho pelo nome, próximos passos por etapa do funil, rascunho a partir dos seus modelos e “resuma meus resultados” calculado dos números reais. Não conversa livremente.
- **Modo IA (linguagem livre, plano gratuito):** crie uma chave grátis e coloque no `.env`:
  - **Google Gemini:** entre em <https://aistudio.google.com/apikey>, crie a chave → `LLM_PROVIDER=gemini` e `LLM_API_KEY=...`
  - **Groq:** <https://console.groq.com/keys> → `LLM_PROVIDER=groq` e `LLM_API_KEY=...`
  - (pago) **Anthropic:** `LLM_PROVIDER=anthropic`.
  Depois `docker compose up -d` e clique em **Testar conexão**. Se der erro 404, o modelo padrão pode ter sido descontinuado: defina `LLM_MODEL` com um modelo atual do provedor.

Privacidade: com chave, vão ao provedor só nome, categoria, cidade, site, Instagram e avaliação da empresa + o texto que você digitar (nunca telefones, e-mails nem financeiro). Planos gratuitos de alguns provedores podem usar os dados para melhorar seus produtos — leia os termos. Tudo que a IA gera é marcado e fica como rascunho para você revisar; nada é enviado sozinho.

## Prospecção
Busca por **OpenStreetMap** (Nominatim + Overpass): gratuita, sem chave, limitada a 6 buscas/hora no app (uso justo). A cobertura varia por cidade e telefone/site costumam faltar — complemente por **CSV** ou cadastro manual. Dados © colaboradores do OpenStreetMap (ODbL).

## Operação
- **Backup:** automático todo dia (com teste de restauração e retenção de 14 dias) e manual em Configurações → Backups (gerar, baixar, testar restauração). Ficam em `/data/backups`: **baixe cópias para fora do servidor**. Restaurar de verdade é manual: `pg_restore --clean --no-owner --dbname=<url> arquivo.dump`.
- **Esqueceu a senha:** no `.env` defina `OWNER_RESET=1` e `OWNER_PASSWORD`, rode `docker compose up -d`, depois remova `OWNER_RESET`. Perdeu o 2FA: use um código de recuperação.
- **Rotinas** (pagamentos atrasados, recorrências, follow-ups, prazos, backup diário, limpeza): rodam pelo serviço `cron` do compose ou em Automações → Executar agora.
- **Logs:** `docker compose logs -f app`. Saúde: `GET /api/health`.

## Segurança (resumo)
argon2id · 2FA TOTP + códigos de recuperação (segredo AES-256-GCM) · sessão opaca com hash no banco, expiração absoluta e por inatividade, logout remoto · anti brute force · CSRF · CSP/HSTS/X-Frame-Options · validação com zod · Prisma parametrizado · autorização no servidor · auditoria · erros técnicos só no log · segredos só em variáveis de ambiente.
Limitações: rate limit genérico em memória (um servidor); sem recuperação de senha por e-mail (use `OWNER_RESET`); CSP usa `'unsafe-inline'`; **perder a `DATA_ENCRYPTION_KEY` torna o 2FA cadastrado irrecuperável — guarde-a em local seguro**.

## Desenvolvimento
```bash
npm install && cp .env.example .env     # NODE_ENV=development, DATABASE_URL local, segredos
npx prisma migrate deploy && npm run bootstrap && npm run dev
npm test && npm run typecheck && npm run lint
```
Estrutura: `prisma/` schema, migrations, seed · `scripts/` bootstrap, backup · `src/app/` rotas · `src/server/` ações e regras · `src/lib/` lógica pura e segurança · `src/components/` UI · `docker/` entrypoint e Caddyfile.
