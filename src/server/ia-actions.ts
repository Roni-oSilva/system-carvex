"use server";

import { z } from "zod";
import { basicClassify, basicNextSteps, basicSummary } from "@/lib/ai-basic";
import { db } from "@/lib/db";
import { aiInfo, aiMode, askLlm, clean } from "@/lib/llm";
import { renderTemplate } from "@/lib/leads";
import { log } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import type { FormState } from "./auth-actions";
import { getDashboard } from "./dashboard";
import { act, UserError } from "./guard";
import { requireUser, verifyCsrf } from "./session";

type LeadFull = Awaited<ReturnType<typeof loadLead>>;
const loadLead = (id: string) => db.lead.findUniqueOrThrow({ where: { id }, include: { niche: true } });

function leadBrief(l: LeadFull) {
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

/** Limite de uso quando há provedor externo (protege a cota gratuita). */
function guardLlm(userId: string) {
  if (aiMode() === "llm" && !rateLimit(`ai:${userId}`, 15, 60_000)) throw new UserError("Muitas solicitações à IA. Aguarde um minuto.");
}

const TAG = () => (aiMode() === "llm" ? "Sugestão de IA (revise)" : "Sugestão do modo básico (revise)");

export async function aiClassifyAction(form: FormData): Promise<void> {
  const id = String(form.get("leadId"));
  await act(form, `/crm/${id}`, async (s) => {
    guardLlm(s.userId);
    const lead = await loadLead(id);
    const niches = (await db.niche.findMany({ select: { name: true } })).map((n) => n.name);
    let out: string;
    if (aiMode() === "llm") {
      out = await askLlm(`${leadBrief(lead)}\nClassifique o nicho desta empresa. Escolha UM da lista: ${niches.join(", ")}. Se nenhum servir, sugira um nome curto novo. Responda em 1 linha: "Nicho: X — motivo curto".`, 200);
    } else {
      const r = basicClassify({ name: lead.name, category: lead.category }, niches);
      out = r ? `Nicho: ${r.niche} — ${r.reason}.` : "Não foi possível classificar pelo nome/categoria. Escolha o nicho manualmente em Editar dados.";
    }
    await db.interaction.create({ data: { leadId: id, type: "NOTE", summary: `${TAG()}: ${out}`, aiGenerated: true } });
    return { msg: "Sugestão registrada no histórico. Aplique em Editar dados, se concordar." };
  });
}

export async function aiNextStepsAction(form: FormData): Promise<void> {
  const id = String(form.get("leadId"));
  await act(form, `/crm/${id}`, async (s) => {
    guardLlm(s.userId);
    const lead = await loadLead(id);
    let out: string;
    if (aiMode() === "llm") {
      const hist = await db.interaction.findMany({ where: { leadId: id }, orderBy: { createdAt: "desc" }, take: 8 });
      out = await askLlm(`${leadBrief(lead)}\nStatus no funil: ${lead.status}\nHistórico recente:\n<dados>${hist.map((h) => `- ${clean(h.summary, 160)}`).join("\n") || "nenhum"}</dados>\nSugira de 3 a 5 próximos passos comerciais práticos e curtos.`, 500);
    } else {
      out = basicNextSteps(lead.status, lead).map((x) => `• ${x}`).join("\n");
    }
    await db.interaction.create({ data: { leadId: id, type: "NOTE", summary: `Próximos passos — ${TAG()}:\n${out}`, aiGenerated: true } });
    return { msg: "Sugestões registradas no histórico." };
  });
}

export async function aiMessageAction(form: FormData): Promise<void> {
  const id = String(form.get("leadId"));
  await act(form, `/crm/${id}#mensagens`, async (s) => {
    guardLlm(s.userId);
    const lead = await loadLead(id);
    if (aiMode() === "llm") {
      const out = await askLlm(`${leadBrief(lead)}\nEscreva uma mensagem curta de primeiro contato por WhatsApp (máx. 5 linhas), tom cordial e profissional, mencionando a oportunidade apenas se ela foi detectada. Não invente fatos sobre a empresa nem prometa preços. Não use marcadores {{ }}.`, 400);
      await db.message.create({ data: { leadId: id, body: out, aiGenerated: true } });
      return { msg: "Rascunho gerado pela IA — revise e aprove antes de enviar." };
    }
    const tpl = (lead.nicheId && (await db.messageTemplate.findFirst({ where: { nicheId: lead.nicheId, stage: "FIRST_CONTACT", active: true } }))) || (await db.messageTemplate.findFirst({ where: { nicheId: null, stage: "FIRST_CONTACT", active: true } }));
    if (!tpl) throw new UserError("Sem modelo de primeiro contato. Crie um em Mensagens ou configure a IA (LLM_API_KEY).");
    const { text } = renderTemplate(tpl.body, { empresa: lead.tradeName || lead.name, cidade: lead.city, nicho: lead.niche?.name, servico: lead.suggestedProduct, oportunidade: lead.opportunity, site: lead.website, instagram: lead.instagram ? `@${lead.instagram}` : null, telefone: lead.phone });
    await db.message.create({ data: { leadId: id, templateId: tpl.id, body: text } });
    return { msg: "Modo básico: rascunho criado a partir do seu modelo (sem IA generativa). Revise antes de enviar." };
  });
}

const askSchema = z.object({ prompt: z.string().trim().min(5, "Escreva sua pergunta.").max(2000), leadId: z.string().optional() });

/** Assistente livre (com contexto opcional de um lead). Saída é só sugestão. */
export async function aiAskAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const s = await requireUser();
    if (!verifyCsrf(s.csrfSecret, form.get("csrf"))) return { error: "Sessão expirada. Recarregue a página." };
    guardLlm(s.userId);
    const d = askSchema.safeParse({ prompt: form.get("prompt"), leadId: form.get("leadId") || undefined });
    if (!d.success) return { error: d.error.issues[0]?.message };

    if (aiMode() === "basic") {
      if (d.data.leadId && /pr[oó]xim|passo|fazer|abordar/i.test(d.data.prompt)) {
        const l = await loadLead(d.data.leadId);
        return { ok: `MODO BÁSICO (regras, sem IA generativa):\n\n${basicNextSteps(l.status, l).map((x) => `• ${x}`).join("\n")}` };
      }
      if (/resum|resultado|relat[oó]rio|desempenho|como (estou|estamos|vai)|an[aá]lis/i.test(d.data.prompt)) {
        const x = await getDashboard();
        return { ok: `MODO BÁSICO — resumo calculado dos seus números reais:\n\n${basicSummary({ revenueMonth: x.finance.month, expensesMonth: x.finance.expenses, receivable: x.finance.receivable, overdue: x.finance.overdue, leads: x.sales.leads, contacted: x.sales.contacted, replied: x.sales.replied, won: x.sales.won, projectsLate: x.ops.late, projectsActive: x.ops.inProgress + x.ops.waiting })}` };
      }
      return { error: "No modo básico a IA faz: resumo de resultados (“resuma meus resultados”), próximos passos de um lead e classificação/mensagens. Para perguntas livres, configure uma chave gratuita (LLM_API_KEY — veja o README)." };
    }

    const ctxText = d.data.leadId ? leadBrief(await loadLead(d.data.leadId)) : "";
    const out = await askLlm(`${ctxText}\nPedido do proprietário: ${d.data.prompt}`, 900);
    if (d.data.leadId) await db.interaction.create({ data: { leadId: d.data.leadId, type: "NOTE", summary: `IA (revise): ${out.slice(0, 1500)}`, aiGenerated: true } });
    return { ok: `SUGESTÃO DA IA — revise antes de usar:\n\n${out}` };
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    log.error("ai_ask_failed", { err: e });
    return { error: "A IA não respondeu agora. Tente novamente em instantes (veja “Testar conexão”)." };
  }
}

/** Verifica se a chave/provedor funcionam. */
export async function aiTestAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const s = await requireUser();
    if (!verifyCsrf(s.csrfSecret, form.get("csrf"))) return { error: "Sessão expirada. Recarregue a página." };
    if (aiMode() === "basic") return { ok: "Modo básico ativo (sem chave). Para IA de verdade, defina LLM_API_KEY." };
    const i = aiInfo();
    const out = await askLlm("Responda apenas com a palavra: OK", 20);
    return { ok: `Conexão OK com ${i.provider} (${i.model}). Resposta: ${out.slice(0, 40)}` };
  } catch (e) {
    log.error("ai_test_failed", { err: e instanceof Error ? e.message : String(e) });
    return { error: "Falha ao conectar. Confira LLM_PROVIDER, LLM_API_KEY e LLM_MODEL (um modelo descontinuado também causa erro 404)." };
  }
}

// ───────── Propostas e relatórios ─────────
const brl = (n: unknown) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Gera o texto de apresentação da proposta (rascunho editável). */
export async function aiProposalAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  await act(form, `/vendas/propostas/${id}`, async (s) => {
    guardLlm(s.userId);
    const p = await db.proposal.findUniqueOrThrow({ where: { id }, include: { client: { include: { lead: true } }, items: true } });
    if (p.status === "ACCEPTED") throw new UserError("Proposta aceita não pode ser alterada.");
    const itens = p.items.map((i) => `${i.description} (${brl(Number(i.unitPrice) * i.quantity)})`).join("; ");
    let text: string;
    if (aiMode() === "llm") {
      text = await askLlm(`<dados>\nCliente: ${clean(p.client.name)}\nCidade: ${clean(p.client.city)}\nItens: ${clean(itens, 600)}\nTotal: ${brl(p.total)}\nPrazo: ${p.deadlineDays ?? "não informado"} dias\nOportunidade detectada: ${clean(p.client.lead?.opportunity)}\n</dados>\nEscreva um texto curto (2 parágrafos) de apresentação para esta proposta comercial: foque no benefício para o cliente, cite os itens e o prazo. Não invente resultados, números nem garantias.`, 450);
    } else {
      text = `Prezado(a) ${p.client.name},\n\nApresentamos nossa proposta com ${itens}, no valor total de ${brl(p.total)}${p.deadlineDays ? `, com prazo de entrega de ${p.deadlineDays} dias` : ""}.\n\n${p.client.lead?.opportunity ? `Identificamos a oportunidade de ${p.client.lead.opportunity.toLowerCase()} para fortalecer a presença digital do seu negócio. ` : ""}Ficamos à disposição para ajustar o escopo e esclarecer qualquer dúvida.`;
    }
    await db.proposal.update({ where: { id }, data: { notes: text } });
    return { msg: aiMode() === "llm" ? "Texto gerado pela IA — revise e edite antes de enviar." : "Texto gerado pelo modo básico (modelo fixo) — revise e edite antes de enviar." };
  });
}

/** Resumo/relatório em texto dos números atuais. */
export async function aiReportAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const s = await requireUser();
    if (!verifyCsrf(s.csrfSecret, form.get("csrf"))) return { error: "Sessão expirada. Recarregue a página." };
    guardLlm(s.userId);
    const x = await getDashboard();
    const sum = { revenueMonth: x.finance.month, expensesMonth: x.finance.expenses, receivable: x.finance.receivable, overdue: x.finance.overdue, leads: x.sales.leads, contacted: x.sales.contacted, replied: x.sales.replied, won: x.sales.won, projectsLate: x.ops.late, projectsActive: x.ops.inProgress + x.ops.waiting };
    if (aiMode() === "basic") return { ok: `RESUMO (modo básico — calculado dos seus números):\n\n${basicSummary(sum)}` };
    const out = await askLlm(`<dados>${JSON.stringify(sum)}</dados>\nEscreva um relatório executivo curto em português (máx. 8 linhas) sobre estes números do mês e termine com 3 sugestões práticas. Use só os números fornecidos.`, 600);
    return { ok: `RELATÓRIO DA IA — revise antes de usar:\n\n${out}` };
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    log.error("ai_report_failed", { err: e });
    return { error: "A IA não respondeu agora. Tente novamente em instantes." };
  }
}
