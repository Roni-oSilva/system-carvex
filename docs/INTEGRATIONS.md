# Integrações

Todas **AGUARDANDO INTEGRAÇÃO**. Cada uma terá um adaptador em `src/server/integrations/<provider>.ts` atrás de uma interface comum, chave só por variável de ambiente (ou `ApiCredential` cifrada) e registro em `Integration` (`status`, `lastError`). Falha ⇒ `Notification INTEGRATION_FAILED`.

| Provider | Uso | Variáveis | Fase | Observações legais |
|---|---|---|---|---|
| `google_places` | Busca de empresas | `GOOGLE_PLACES_API_KEY` | 3 | API oficial; respeitar política de cache/armazenamento. |
| `llm` | Classificação, mensagens, relatórios | `LLM_API_KEY` | 9 | Só backend; saída marcada `aiGenerated`; nunca envia sem aprovação. |
| `whatsapp_cloud` | Envio oficial | `WHATSAPP_CLOUD_TOKEN` | 4 | Exige templates aprovados e opt-in; sem envio em massa frio. |
| `smtp` | E-mail/recuperação de senha | `SMTP_URL` | 10 | — |
| `s3` | Documentos/backups | `S3_*` | 6 | Bucket privado, URLs assinadas. |
| Redis | Filas/rate limit | `REDIS_URL` | 8 | — |

Scraping de plataformas que o proíbem **não** será implementado.
