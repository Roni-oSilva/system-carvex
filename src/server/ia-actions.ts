"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { clean, askLlm, llmConfigured } from "@/lib/llm";
import { log } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { act, UserError } from "./guard";
import type { FormState } from "./auth-actions";
import { requireUser, verifyCsrf } from "./session";

function leadBrief(l: { name: string; category: string | null; city: string | null; website: string | null; instagram: string | null; rating: number | null; reviewCount: number | null; opportunity: string | null; niche?: { name: string } | null }) {
  return `<dados>
Empresa: ${clean(l.name)}
Nicho cadastrado: ${clean(l.niche?.name)}
Categoria: ${clean(l.category)}
Cidade: ${clean(l.city)}
Site: ${clean(l.website)}
Instagram: ${clean(l.instagram)}
Avaliação: ${l.rating ?? "não encontrado"} (${l.reviewCount ?? "não encontrado"} avaliações)
Oportunidade detectada pelas regras: ${clean(l.opportunity)}
</dados>`;
}

function needAi(userId: string) {
  if (!llmConfigured()) throw new UserError("IA indisponível: AGUARDANDO INTEGRAÇÃO (defina LLM_API_KEY).");
  if (!rateLimit(`ai:${userId}`, 20, 60_000)) throw new UserError("Muitas solicitações à IA. Aguarde um minuto.");
}

const loadLead = (id: string) => db.lead.findUniqueOrThrow({ where: { id }, include: { niche: true } });

export async function aiClassifyAction(form: FormData): Promise<void> {
  const id = String(form.get("leadId"));
  await act(form, `/crm/${id}`, async (s) => {
    needAi(s.userId);
    const lead = await loadLead(id);
    const niches = await db.niche.findMany({ select: { name: true } });
    const out = await askLlm(`${leadBrief(lead)}\nClassifique o nicho desta empresa. Escolha UM da lista: ${niches.map((n) => n.name).join(", ")}. Se nenhum servir, sugira um nome curto novo. Responda em 1 linha: "Nicho: X — motivo curto".`, 200);
    await db.interaction.create({ data: { leadId: id, type: "NOTE", summary: `Sugestão de IA (revise): ${out}`, aiGenerated: true } });
    return { msg: "Sugestão da IA registrada no histórico. Aplique manualmente em Editar dados, se concordar." };
  });
}

export async function aiNextStepsAction(form: FormData): Promise<void> {
  const id = String(form.get("leadId"));
  await act(form, `/crm/${id}`, async (s) => {
    needAi(s.userId);
    const lead = await loadLead(id);
    const hist = await db.interaction.findMany({ where: { leadId: id }, orderBy: { createdAt: "desc" }, take: 8 });
    const out = await askLlm(`${leadBrief(lead)}\nStatus no funil: ${lead.status}\nHistórico recente:\n<dados>${hist.map((h) => `- ${clean(h.summary, 160)}`).join("\n") || "nenhum"}</dados>\nSugira de 3 a 5 próximos passos comerciais práticos e curtos.`, 500);
    await db.interaction.create({ data: { leadId: id, type: "NOTE", summary: `Próximos passos sugeridos pela IA (revise):\n${out}`, aiGenerated: true } });
    return { msg: "Sugestões registradas no histórico." };
  });
}

export async function aiMessageAction(form: FormData): Promise<void> {
  const id = String(form.get("leadId"));
  await act(form, `/crm/${id}#mensagens`, async (s) => {
    needAi(s.userId);
    const lead = await loadLead(id);
    const out = await askLlm(`${leadBrief(lead)}\nEscreva uma mensagem curta de primeiro contato por WhatsApp (máx. 5 linhas), tom cordial e profissional, mencionando a oportunidade apenas se ela foi detectada. Não invente fatos sobre a empresa nem prometa preços. Não use marcadores {{ }}.`, 400);
    await db.message.create({ data: { leadId: id, body: out, aiGenerated: true } });
    return { msg: "Rascunho gerado pela IA — revise e aprove antes de enviar." };
  });
}

const askSchema = z.object({ prompt: z.string().trim().min(5, "Escreva sua pergunta.").max(2000), leadId: z.string().optional() });

/** Assistente livre (com contexto opcional de um lead). Saída é só sugestão. */
export async function aiAskAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const s = await requireUser();
    if (!verifyCsrf(s.csrfSecret, form.get("csrf"))) return { error: "Sessão expirada. Recarregue a página." };
    needAi(s.userId);
    const d = askSchema.safeParse({ prompt: form.get("prompt"), leadId: form.get("leadId") || undefined });
    if (!d.success) return { error: d.error.issues[0]?.message };
    const ctxText = d.data.leadId ? leadBrief(await loadLead(d.data.leadId)) : "";
    const out = await askLlm(`${ctxText}\nPedido do proprietário: ${d.data.prompt}`, 900);
    if (d.data.leadId) await db.interaction.create({ data: { leadId: d.data.leadId, type: "NOTE", summary: `IA (revise): ${out.slice(0, 1500)}`, aiGenerated: true } });
    return { ok: `SUGESTÃO DA IA — revise antes de usar:\n\n${out}` };
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    log.error("ai_ask_failed", { err: e });
    return { error: "A IA não respondeu agora. Tente novamente em instantes." };
  }
}
