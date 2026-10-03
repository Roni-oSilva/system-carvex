import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  DATA_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "DATA_ENCRYPTION_KEY deve ter 64 caracteres hex (32 bytes)"),
  APP_SECRET: z.string().min(32, "APP_SECRET deve ter ao menos 32 caracteres"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  CRON_SECRET: z.string().min(24).optional(),
  DATA_DIR: z.string().default("./data"),
  LLM_API_KEY: z.string().optional(),
  LLM_PROVIDER: z.enum(["gemini", "groq", "anthropic"]).default("gemini"),
  LLM_MODEL: z.string().optional(),
  LLM_BASE_URL: z.string().url().optional(),
  SMTP_URL: z.string().optional(), // smtp(s)://usuario:senha@host:porta  (ou "log" só para desenvolvimento)
  MAIL_FROM: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Valida variáveis de ambiente na primeira leitura; falha cedo e sem vazar valores. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuração de ambiente inválida (${issues})`);
  }
  cached = parsed.data;
  return cached;
}
