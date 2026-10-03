# Carvex — central privada de prospecção, vendas e gestão

Sistema de uso exclusivo do proprietário: **sem cadastro público**, toda rota exige sessão validada no servidor.
Stack: Next.js 15 + TypeScript, PostgreSQL 16 + Prisma 6, Tailwind. Tudo roda em containers (Docker).

**Módulos:** Dashboard · Prospecção (OpenStreetMap gratuito + CSV, deduplicação, análise, score, oportunidades) · CRM (Kanban/lista, tags, timeline, follow-up) · Clientes (documentos, recorrência) · Mensagens (modelos por nicho, aprovação manual) · Vendas (catálogo, propostas/PDF, funil) · Projetos (checklists, prazos) · Financeiro · Automações · IA · Relatórios · Busca global · Notificações · Configurações (segurança, regras, integrações, backups, LGPD, auditoria). O envio de WhatsApp é **manual por design**.

---

## Como colocar no ar

Há dois caminhos. **Escolha o A se não quer gastar nada.**

### Caminho A — 100% gratuito, sem servidor (Render + Neon + cron-job.org)
Tudo pelo navegador, sem terminal. Você precisa de uma conta no GitHub (onde o código já está), no **Neon**, no **Render** e no **cron-job.org**. Os planos gratuitos mudam com o tempo: confirme os limites atuais em cada site.

1. **Banco de dados grátis (Neon):** em neon.tech crie uma conta e um projeto (PostgreSQL 16). Copie a *connection string* **direta** (não a "pooled") — algo como `postgresql://usuario:senha@ep-xxx.neon.tech/neondb?sslmode=require`. Se aparecer `&channel_binding=require` no final, apague esse trecho.
2. **Gere 4 segredos** (um para cada) — em qualquer gerador de senha com 64 caracteres hexadecimais, ou no terminal `openssl rand -hex 32`: `DATA_ENCRYPTION_KEY`, `APP_SECRET`, `CRON_SECRET` (e guarde-os num lugar seguro).
3. **Aplicação grátis (Render):** em render.com → **New → Web Service** → conecte o seu GitHub, escolha o repositório `system-carvex` e a branch do código → **Runtime: Docker** → **Instance type: Free**. Em **Environment Variables** coloque:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | a connection string do Neon |
| `DATA_ENCRYPTION_KEY`, `APP_SECRET`, `CRON_SECRET` | os segredos do passo 2 |
| `APP_URL` | `https://NOME-DO-SERVICO.onrender.com` (o nome que você deu ao serviço) |
| `OWNER_EMAIL`, `OWNER_NAME`, `OWNER_PASSWORD` | seu acesso (senha com 12+ caracteres, 3 tipos) |
| `NODE_ENV` | `production` |
| `LLM_PROVIDER` / `LLM_API_KEY` | (opcional) IA gratuita — veja a seção IA |

   Em **Health Check Path** coloque `/api/health`. Clique em **Create Web Service** e aguarde o build (alguns minutos). No log deve aparecer `Proprietário criado`.
4. **Entre** em `https://NOME-DO-SERVICO.onrender.com`, faça login, ative o **2FA** (Configurações → Segurança) e, no Render, **apague a variável `OWNER_PASSWORD`**.
5. **Agendador grátis (cron-job.org):** crie duas tarefas:
   - `GET https://NOME-DO-SERVICO.onrender.com/api/health` a cada 10 minutos (mantém o site acordado);
   - `GET https://NOME-DO-SERVICO.onrender.com/api/cron` a cada 15 minutos, com o cabeçalho `Authorization: Bearer SEU_CRON_SECRET` (faz as rotinas: atrasos, follow-ups, recorrências, prazos).

**O que esperar do plano gratuito:**
- Sem tráfego o Render "dorme"; o primeiro acesso pode levar cerca de 1 minuto. O ping do passo 5 reduz isso, mas não é garantia.
- O Neon tem limite de armazenamento e pode "pausar" o banco por inatividade (acorda sozinho em segundos). Os documentos dos clientes ficam **dentro do banco** (máx. 5 MB cada) e contam nesse limite.
- Não há disco persistente: o backup pelo botão do sistema pode não funcionar (versão do `pg_dump`) e some a cada reinício. Use o histórico de restauração do Neon e **exporte seus dados em JSON** (Configurações → Dados e LGPD) com frequência.
- Eu não consegui testar este caminho de ponta a ponta (a rede do meu ambiente é restrita); o código e o build foram validados, mas se algum passo falhar, me mande o log do Render.

### Caminho B — servidor próprio (VPS), mais robusto
Serve uma VPS paga (~US$ 5/mês) ou a VM **gratuita Always Free da Oracle Cloud** (exige cartão só para verificar a identidade e, às vezes, não há vaga na sua região; o compose usa imagens multi-arquitetura, mas não testei em ARM). Domínio gratuito: crie um subdomínio em duckdns.org apontando para o IP do servidor.

```bash
curl -fsSL https://get.docker.com | sh                       # instala o Docker
git clone -b claude/prompt-mestre-saas-crm-58ylp6 https://github.com/Roni-oSilva/system-carvex.git
cd system-carvex && cp .env.example .env && nano .env        # preencha (tabela abaixo)
docker compose up -d --build                                 # sobe HTTPS + app + banco + agendador
docker compose logs app --tail 30                            # deve mostrar "Proprietário criado"
```
No `.env`: `DOMAIN` (ex.: `crm.duckdns.org`) e `APP_URL` (`https://crm.duckdns.org`), `POSTGRES_PASSWORD`, `DATA_ENCRYPTION_KEY`, `APP_SECRET`, `CRON_SECRET` (cada um com `openssl rand -hex 32`), `OWNER_EMAIL`, `OWNER_NAME`, `OWNER_PASSWORD`. O certificado HTTPS é emitido sozinho. Depois do primeiro login: ative o 2FA e apague `OWNER_PASSWORD` do `.env` (`docker compose up -d`). Atualizar: `git pull && docker compose up -d --build`. Aqui o backup diário e o botão de backup funcionam (ficam em `/data/backups`; baixe cópias para fora do servidor).

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

## E-mail (recuperação de senha)
Opcional e gratuito: crie uma **senha de app** no Gmail (Conta Google → Segurança → Verificação em duas etapas → Senhas de app) e defina `SMTP_URL=smtps://seuemail%40gmail.com:SENHA_DE_APP@smtp.gmail.com:465`. O e-mail só é enviado a endereços cadastrados e a resposta da tela é sempre a mesma (não revela quem existe).

## Prospecção
Busca por **OpenStreetMap** (com filtro opcional de raio em km) (Nominatim + Overpass): gratuita, sem chave, limitada a 6 buscas/hora no app (uso justo). A cobertura varia por cidade e telefone/site costumam faltar — complemente por **CSV** ou cadastro manual. Dados © colaboradores do OpenStreetMap (ODbL).

## Operação
- **Backup:** automático todo dia (com teste de restauração e retenção de 14 dias) e manual em Configurações → Backups (gerar, baixar, testar restauração). Ficam em `/data/backups`: **baixe cópias para fora do servidor**. Restaurar de verdade é manual: `pg_restore --clean --no-owner --dbname=<url> arquivo.dump`.
- **Esqueceu a senha:** se `SMTP_URL` estiver configurado, use **“Esqueci minha senha”** no login (link de uso único, válido por 1 hora; com 2FA ativo exige também o código). Sem e-mail configurado, no `.env` defina `OWNER_RESET=1` e `OWNER_PASSWORD`, rode `docker compose up -d`, depois remova `OWNER_RESET`. Perdeu o 2FA: use um código de recuperação.
- **Rotinas** (pagamentos atrasados, recorrências, follow-ups, prazos, backup diário, limpeza): rodam pelo serviço `cron` do compose ou em Automações → Executar agora.
- **Logs:** `docker compose logs -f app`. Saúde: `GET /api/health`.

## Segurança (resumo)
argon2id · 2FA TOTP + códigos de recuperação (segredo AES-256-GCM) · sessão opaca com hash no banco, expiração absoluta e por inatividade, logout remoto · anti brute force · CSRF · CSP/HSTS/X-Frame-Options · validação com zod · Prisma parametrizado · autorização no servidor · auditoria · erros técnicos só no log · segredos só em variáveis de ambiente.
Limitações: rate limit genérico em memória (um servidor); recuperação por e-mail depende de SMTP configurado (senão use `OWNER_RESET`); CSP usa `'unsafe-inline'`; **perder a `DATA_ENCRYPTION_KEY` torna o 2FA cadastrado irrecuperável — guarde-a em local seguro**.

## Desenvolvimento
```bash
npm install && cp .env.example .env     # NODE_ENV=development, DATABASE_URL local, segredos
npx prisma migrate deploy && npm run bootstrap && npm run dev
npm test && npm run typecheck && npm run lint
```
Estrutura: `prisma/` schema, migrations, seed · `scripts/` bootstrap, backup · `src/app/` rotas · `src/server/` ações e regras · `src/lib/` lógica pura e segurança · `src/components/` UI · `docker/` entrypoint e Caddyfile.
