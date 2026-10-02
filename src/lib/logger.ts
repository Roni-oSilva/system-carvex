// Log estruturado. Erros técnicos vão para cá, nunca para o usuário. Campos sensíveis são mascarados.
const SENSITIVE = /pass|token|secret|key|authorization|cookie|hash/i;

function scrub(v: unknown, depth = 0): unknown {
  if (depth > 4 || v == null) return v;
  if (v instanceof Error) return { name: v.name, message: v.message, stack: process.env.NODE_ENV === "production" ? undefined : v.stack };
  if (Array.isArray(v)) return v.map((x) => scrub(x, depth + 1));
  if (typeof v === "object")
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SENSITIVE.test(k) ? "[redigido]" : scrub(x, depth + 1)]));
  return v;
}

function emit(level: "info" | "warn" | "error", msg: string, ctx?: Record<string, unknown>) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...(scrub(ctx) as object) });
  (level === "error" ? console.error : console.log)(line);
}

export const log = {
  info: (m: string, c?: Record<string, unknown>) => emit("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => emit("warn", m, c),
  error: (m: string, c?: Record<string, unknown>) => emit("error", m, c),
};
