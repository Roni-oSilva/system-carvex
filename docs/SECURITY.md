# Segurança

| Requisito | Implementação | Onde |
|---|---|---|
| Hash de senha | argon2id (m=19 MiB, t=2) + política (≥12 chars, 3 classes) | `src/lib/password.ts` |
| MFA | TOTP + códigos de recuperação (hash SHA-256, uso único); segredo AES-256-GCM | `src/lib/totp.ts`, `auth-actions.ts` |
| Sessão | token 256 bits, só hash no banco, TTL + inatividade, logout remoto, revogação ao trocar senha | `src/server/session.ts` |
| Brute force | contagem persistida por e-mail e IP (HMAC do IP) | `src/lib/rate-limit.ts` |
| Enumeração de usuários | resposta genérica + hash fictício (tempo constante aproximado) | `loginAction` |
| SQL injection | Prisma parametrizado; nenhum SQL cru | — |
| XSS | React escapa; CSP restritiva (sem scripts de terceiros), `nosniff` | `next.config.ts` |
| CSRF | SameSite=Lax + Origin check do Next + token HMAC nas ações sensíveis | `session.ts` |
| Clickjacking / headers | `X-Frame-Options: DENY`, HSTS (prod), Referrer-Policy, Permissions-Policy | `next.config.ts` |
| Autorização | `requireUser/requireOwner` no servidor em toda página/ação | `session.ts`, `(app)/layout.tsx` |
| Segredos | só variáveis de ambiente validadas por zod (`env.ts`); nada no frontend | `.env.example` |
| Auditoria | `AuditLog` (usuário, ação, resultado, IP, UA); nunca registra segredos | `src/lib/audit.ts` |
| Logs | JSON estruturado com redação de campos sensíveis; erros técnicos nunca vão à UI | `src/lib/logger.ts` |
| Alerta de login | notificação em novo IP/dispositivo | `completeLogin` |
| Backup | `pg_dump` + SHA-256 + restauração de teste automática | `scripts/backup.sh` |

## Operação em produção (obrigatório)
- Terminar TLS em proxy reverso e **sobrescrever** `X-Forwarded-For` (senão o IP pode ser forjado e afetar o rate limit por IP).
- Gerar `DATA_ENCRYPTION_KEY` e `APP_SECRET` com `openssl rand -hex 32`; guardar em secret manager. **Perder a `DATA_ENCRYPTION_KEY` torna os segredos cifrados irrecuperáveis**; a rotação exige re-cifrar (Fase 10).
- Banco sem exposição pública; usuário de aplicação sem `SUPERUSER`.
- Agendar `scripts/backup.sh` (cron diário) e copiar o arquivo para outro local/provedor.

## Limitações conhecidas (a tratar na Fase 10)
- Rate limit genérico é em memória (processo único); migrar para Redis ao escalar.
- Recuperação de senha por e-mail ainda não implementada (modelo `PasswordResetToken` pronto; depende de SMTP). Hoje: `OWNER_RESET=1 npm run owner:create`.
- CSP usa `'unsafe-inline'` (exigência do Next sem nonce); migrar para nonce via middleware.
- UI de integrações/API keys, rotação de chave de criptografia e restauração via interface.
