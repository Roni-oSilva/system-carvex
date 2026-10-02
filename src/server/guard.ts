import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import type { z } from "zod";
import { log } from "@/lib/logger";
import { csrfToken, requireUser, verifyCsrf } from "./session";

type Sess = Awaited<ReturnType<typeof requireUser>>;
export class UserError extends Error {}

/** Acrescenta ?k=v antes do #fragmento. */
const withParam = (path: string, k: string, v: string) => {
  const [base = "", hash] = path.split("#");
  return `${base}${base.includes("?") ? "&" : "?"}${k}=${encodeURIComponent(v)}${hash ? `#${hash}` : ""}`;
};

/** Destino de retorno vindo do formulário; só caminhos internos. */
export function backOf(form: FormData, fallback: string) {
  const b = String(form.get("back") ?? "");
  return b.startsWith("/") && !b.startsWith("//") ? b : fallback;
}

/** Contexto de página: sessão validada + token CSRF para os formulários. */
export async function ctx() {
  const s = await requireUser();
  return { s, csrf: csrfToken(s.csrfSecret) };
}

/**
 * Envelope de toda Server Action: autenticação, CSRF, tratamento de erros (mensagem amigável,
 * erro técnico só no log) e redirecionamento com aviso. Nunca retorna.
 */
export async function act(form: FormData, back: string, fn: (s: Sess) => Promise<{ msg?: string; to?: string } | void>): Promise<never> {
  let target = back;
  try {
    const s = await requireUser();
    if (!verifyCsrf(s.csrfSecret, form.get("csrf"))) throw new UserError("Sessão expirada. Recarregue a página e tente novamente.");
    const out = await fn(s);
    target = withParam(out?.to ?? back, "msg", out?.msg ?? "Salvo com sucesso.");
  } catch (e) {
    if (isRedirectError(e)) throw e;
    if (e instanceof UserError) target = withParam(back, "err", e.message);
    else {
      log.error("action_failed", { err: e, back });
      target = withParam(back, "err", "Não foi possível concluir a ação. Tente novamente.");
    }
  }
  revalidatePath("/", "layout");
  redirect(target);
}

export function parse<T extends z.ZodTypeAny>(schema: T, form: FormData): z.infer<T> {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") raw[k] = k in raw ? [].concat(raw[k] as never, v as never) : v;
  const r = schema.safeParse(raw);
  if (!r.success) throw new UserError(`Verifique os campos: ${r.error.issues[0]?.message ?? "dados inválidos"}.`);
  return r.data;
}

/** Valores vazios viram undefined/null para campos opcionais. */
export const opt = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
