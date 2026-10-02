# Arquitetura — Carvex

Plataforma privada (single-tenant, preparada para multiusuário) de prospecção, CRM, vendas, projetos, financeiro, automação e IA.

## Decisões técnicas

| Camada | Escolha | Motivo / alternativa considerada |
|---|---|---|
| App | **Next.js 15 (App Router) + TypeScript estrito** | Um único deploy para UI + backend (Server Actions/Route Handlers). Mantida como sugerido. |
| UI | Tailwind CSS 3 + componentes próprios, lucide-react | Sem biblioteca pesada; tokens CSS com dark mode automático (`prefers-color-scheme`). |
| Banco | **PostgreSQL 16 + Prisma 6** | Prisma 7 (rc) muda config/driver; fixado na linha 6 estável. Queries parametrizadas ⇒ sem SQL injection. |
| Auth | **Própria**: argon2id + sessão opaca no banco + TOTP | Auth.js/Lucia adicionariam dependência e menos controle sobre MFA, revogação e auditoria num sistema de dono único. Token de sessão aleatório (256 bits), só o SHA-256 vai ao banco. |
| MFA | TOTP RFC 6238 implementado com `node:crypto` (testado contra vetor RFC) + 8 códigos de recuperação (hash) | Zero dependência. Segredo cifrado com AES-256-GCM. |
| Filas | **Tabela `Job` (PENDING→PROCESSING→DONE/ERROR)** agora; BullMQ + Redis quando houver workers (Fases 3/8) | Evita Redis obrigatório na fundação; o contrato de status já existe. |
| IA | Chamada somente no backend, chave em env, saída marcada `aiGenerated` | Fase 9. |
| Storage | Object storage privado S3-compatível (`Document.storageKey`) | Fase 6. |
| Deploy | Container Node + Postgres gerenciado + proxy TLS (HTTPS/HSTS) | Ver README. |

## Pontos de conflito / decisões que exigem sua atenção

1. **"90% automação" × aprovação manual**: resolvido com `AutomationMode` (`MANUAL` / `SEMI_AUTO`) e regra: envio de mensagem, exclusão, alteração financeira e proposta ao cliente **sempre** exigem aprovação (`Message.status DRAFT→APPROVED→SENT`). Envio em massa terá limites diários e log.
2. **Prospecção "automática" × termos das plataformas**: só APIs oficiais (ex.: Google Places API) e importação manual/CSV. Sem scraping. Google Places restringe armazenamento de dados além do `place_id` — a Fase 3 deve guardar `externalId` e revalidar dados, ou aceitar o risco contratual conscientemente.
3. **Envio de WhatsApp**: a API oficial (Cloud API) exige templates aprovados e opt-in; envio frio em massa viola as regras. Plano: gerar mensagem + abrir `wa.me` para envio manual (modo manual) e integração oficial apenas para contatos com base legal.
4. **LGPD**: dados de leads são dados de pessoas jurídicas/profissionais, mas telefone/e-mail de sócios podem ser pessoais → registrar finalidade/fonte (`LeadSource`), permitir exportar e excluir (soft delete + purga), e retenção configurável.
5. **Score** é só priorização interna (nunca exibido como verdade). **Lucro** é estimado, não contábil.
6. **Tabelas `invoices`/`automation_rules`/`lead_tags`/`security_logs`**: consolidadas — nota fiscal fica fora de escopo (usa `Payment`); regras ficam em `Automation` (JSON trigger/conditions/actions); tags são M:N implícita do Prisma; log de segurança é `AuditLog.category = security`.

## Estrutura de pastas

```
prisma/            schema, migrations, seed (configuração, sem dados fictícios)
scripts/           create-owner.ts, backup.sh
src/app/           rotas (login, (app)/ área autenticada)
src/components/    UI (app-shell, forms, nav)
src/lib/           env, crypto, password, totp, rate-limit, audit, logger (puros/seguros)
src/server/        session, auth-actions, dashboard (somente servidor)
docs/              documentação
```
Regra: lógica comercial vive em `src/server/<modulo>/`; componentes não acessam o banco diretamente.

## Banco de dados
42 tabelas definidas em `prisma/schema.prisma`: identidade (User, Session, LoginAttempt, PasswordResetToken, AuditLog), CRM (Lead, LeadSource, Company, Contact, Tag, Niche, Interaction, Pipeline/Stage, Opportunity), mensagens (MessageTemplate, Message), vendas (Service, ServiceExtra, Proposal, ProposalItem, Client), projetos (Project, ProjectTask, ProjectTemplate), financeiro (Payment, Expense, Subscription), automação (Automation, AutomationRun, Job), regras (BusinessRule, LeadScoreRule), integrações (Integration, ApiCredential), infra (Setting, Notification, Document, BackupRecord).
Convenções: `cuid` como PK, `createdAt/updatedAt`, `deletedAt` (soft delete) em entidades de negócio, valores monetários `Decimal(12,2)`, índices nos filtros de listagem e deduplicação (`phoneNorm`, `websiteHost`, `dedupeKey`, `@@unique([provider, externalId])`).

## Fluxo de autenticação
1. `POST login` (Server Action) → validação zod → bloqueio por brute force (5 falhas/15 min por e-mail, 20 por IP) → argon2id (hash fictício se o e-mail não existe, resposta genérica).
2. Com 2FA: sessão **pendente** (10 min, `mfaVerified=false`) → `/login/mfa` → TOTP ou código de recuperação (limitado) → sessão pendente é revogada e outra é emitida (anti-fixação).
3. Cookie `__Host-` (prod), `HttpOnly`, `Secure`, `SameSite=Lax`; expira por TTL absoluto e por inatividade.
4. Toda página/ação protegida chama `requireUser()` no servidor; o middleware é só barreira de borda.
5. Ações sensíveis: token CSRF (HMAC) + checagem de Origin do Next + reautenticação (senha/2FA para desativar 2FA).

## Plano por fases
| Fase | Escopo | Estado |
|---|---|---|
| 1 Fundação | Projeto, schema completo + migration, auth + 2FA, sessões, auditoria, rate limit, layout, dashboard real, painel de segurança, backup verificável | **Concluída** |
| 2 CRM | Leads/empresas/clientes, Kanban, timeline, tags, busca global | Próxima |
| 3 Prospecção | Provider Google Places, import CSV, deduplicação, análise, score, regras | |
| 4 Mensagens | Biblioteca por nicho, variáveis, histórico, follow-up | |
| 5 Vendas | Catálogo, propostas + PDF, funil | |
| 6 Projetos | Checklists por template, prazos, biblioteca | |
| 7 Financeiro | Pagamentos, despesas, relatórios | |
| 8 Automações | Motor gatilho+condição+ação, worker de jobs | |
| 9 IA | Assistente, classificação, mensagens | |
| 10 Segurança avançada | Gestão de integrações/API keys, rotação, restauração via UI, revisão geral | |
