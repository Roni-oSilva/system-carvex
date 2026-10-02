"use server";

import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { dedupeKey, hostOf, instagramHandle, normalizePhone, renderTemplate, SOCIAL_HOSTS } from "@/lib/leads";
import { emit } from "./engine";
import { act, backOf, opt, parse, UserError } from "./guard";
import { ensureClient, ingestLead, reanalyze, setLeadStatus } from "./leads";

const STATUSES = ["FOUND", "ANALYZED", "MESSAGE_READY", "CONTACTED", "REPLIED", "INTERESTED", "MEETING", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "DISCARDED"] as const;

const leadSchema = z.object({
  name: z.string().trim().min(2, "informe o nome da empresa").max(160),
  tradeName: z.string().max(160).optional(), nicheId: z.string().optional(), category: z.string().max(120).optional(),
  city: z.string().max(100).optional(), state: z.string().max(2).optional(), address: z.string().max(240).optional(),
  phone: z.string().max(40).optional(), email: z.union([z.literal(""), z.string().email("e-mail inválido")]).optional(),
  website: z.string().max(240).optional(), instagram: z.string().max(120).optional(), notes: z.string().max(4000).optional(),
  tags: z.string().max(300).optional(),
});

const tagOps = (csv?: string | null) => {
  const names = [...new Set((csv ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
  return { set: [], connectOrCreate: names.map((name) => ({ where: { name }, create: { name } })) };
};

export async function createLeadAction(form: FormData): Promise<void> {
  await act(form, "/crm/novo", async (s) => {
    const d = parse(leadSchema, form);
    const { id, result } = await ingestLead({
      name: d.name, tradeName: opt(d.tradeName), nicheId: opt(d.nicheId), category: opt(d.category), city: opt(d.city), state: opt(d.state)?.toUpperCase() ?? null,
      address: opt(d.address), phone: opt(d.phone), email: opt(d.email), website: opt(d.website), instagram: opt(d.instagram), provider: "manual",
    });
    if (d.notes || d.tags) await db.lead.update({ where: { id }, data: { notes: opt(d.notes) ?? undefined, tags: tagOps(d.tags) } });
    await audit({ action: "lead.create", userId: s.userId, entity: "lead", entityId: id });
    return { to: `/crm/${id}`, msg: result === "merged" ? "Esta empresa já existia — dados complementados, sem duplicar." : "Lead criado e analisado." };
  });
}

export async function updateLeadAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  await act(form, `/crm/${id}`, async (s) => {
    const d = parse(leadSchema, form);
    const site = opt(d.website);
    let website = site, instagram = instagramHandle(d.instagram);
    if (site && SOCIAL_HOSTS.test(site)) { instagram ??= instagramHandle(site); website = null; }
    await db.lead.update({
      where: { id },
      data: {
        name: d.name, tradeName: opt(d.tradeName), nicheId: opt(d.nicheId), category: opt(d.category), city: opt(d.city), state: opt(d.state)?.toUpperCase() ?? null,
        address: opt(d.address), phone: opt(d.phone), phoneNorm: normalizePhone(d.phone), email: opt(d.email), website, websiteHost: hostOf(website),
        instagram, notes: opt(d.notes), dedupeKey: dedupeKey(d.name, opt(d.address), opt(d.city)), tags: tagOps(d.tags),
      },
    });
    await reanalyze(id);
    await audit({ action: "lead.update", userId: s.userId, entity: "lead", entityId: id });
    return { msg: "Lead atualizado e reanalisado." };
  });
}

export async function moveLeadAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  await act(form, backOf(form, "/crm"), async () => {
    const status = z.enum(STATUSES).parse(form.get("status"));
    await setLeadStatus(id, status);
    if (status === "WON") {
      const lead = await db.lead.findUniqueOrThrow({ where: { id }, include: { client: true } });
      await emit("lead.won", { leadId: id, clientId: lead.client?.id, name: lead.name });
    }
    return { msg: "Status atualizado." };
  });
}

export async function deleteLeadAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  await act(form, `/crm/${id}`, async (s) => {
    await db.lead.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ action: "lead.delete", userId: s.userId, entity: "lead", entityId: id });
    return { to: "/crm", msg: "Lead movido para a lixeira (Configurações → Dados e LGPD)." };
  });
}

export async function reanalyzeAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  await act(form, `/crm/${id}`, async () => { await reanalyze(id); return { msg: "Análise atualizada." }; });
}

export async function addInteractionAction(form: FormData): Promise<void> {
  const leadId = opt(form.get("leadId")), clientId = opt(form.get("clientId"));
  await act(form, backOf(form, leadId ? `/crm/${leadId}` : `/clientes/${clientId}`), async () => {
    const d = parse(z.object({ type: z.enum(["NOTE", "CALL", "WHATSAPP", "EMAIL", "MEETING"]), summary: z.string().trim().min(2, "descreva a interação").max(2000) }), form);
    await db.interaction.create({ data: { leadId, clientId, type: d.type, summary: d.summary } });
    if (leadId && d.type !== "NOTE") {
      const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
      if (["FOUND", "ANALYZED", "MESSAGE_READY"].includes(lead.status)) await db.lead.update({ where: { id: leadId }, data: { status: "CONTACTED" } });
    }
    return { msg: "Interação registrada." };
  });
}

export async function setFollowUpAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  await act(form, `/crm/${id}`, async () => {
    const d = parse(z.object({ date: z.string().optional(), nextAction: z.string().max(200).optional() }), form);
    const at = d.date ? new Date(`${d.date}T09:00:00`) : null;
    if (at && Number.isNaN(at.getTime())) throw new UserError("Data inválida.");
    await db.lead.update({ where: { id }, data: { followUpAt: at, nextAction: opt(d.nextAction), nextActionAt: at } });
    return { msg: at ? "Follow-up agendado." : "Follow-up removido." };
  });
}

export async function startClientAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  const dest = String(form.get("dest") ?? "client");
  await act(form, `/crm/${id}`, async (s) => {
    const c = await ensureClient(id);
    await audit({ action: "client.create", userId: s.userId, entity: "client", entityId: c.id });
    return { to: dest === "proposal" ? `/vendas/propostas/nova?client=${c.id}` : `/clientes/${c.id}`, msg: "Cliente pronto." };
  });
}

// ───────── Mensagens do lead ─────────
export async function generateMessageAction(form: FormData): Promise<void> {
  const leadId = String(form.get("leadId"));
  await act(form, `/crm/${leadId}#mensagens`, async () => {
    const stage = z.enum(["FIRST_CONTACT", "SECOND_CONTACT", "FOLLOW_UP", "PRESENTATION", "PROPOSAL", "RECOVERY", "AFTER_SALE"]).parse(form.get("stage"));
    const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { niche: true } });
    const tpl =
      (lead.nicheId && (await db.messageTemplate.findFirst({ where: { nicheId: lead.nicheId, stage, active: true } }))) ||
      (await db.messageTemplate.findFirst({ where: { nicheId: null, stage, active: true } }));
    if (!tpl) throw new UserError("Nenhum modelo para esta etapa. Crie um em Mensagens.");
    const contact = lead.companyId ? await db.contact.findFirst({ where: { companyId: lead.companyId, deletedAt: null } }) : null;
    const { text, missing } = renderTemplate(tpl.body, {
      empresa: lead.tradeName || lead.name, nome: contact?.name?.split(" ")[0], cidade: lead.city, nicho: lead.niche?.name,
      servico: lead.suggestedProduct, oportunidade: lead.opportunity, site: lead.website, instagram: lead.instagram ? `@${lead.instagram}` : null, telefone: lead.phone,
    });
    await db.message.create({ data: { leadId, templateId: tpl.id, body: text } });
    return { msg: missing.length ? `Rascunho criado. Complete os campos não encontrados: ${missing.join(", ")}.` : "Rascunho criado — revise antes de enviar." };
  });
}

export async function updateMessageAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  const m = await db.message.findUniqueOrThrow({ where: { id } });
  await act(form, `/crm/${m.leadId}#mensagens`, async () => {
    if (m.status === "SENT") throw new UserError("Mensagem já enviada não pode ser editada.");
    const body = parse(z.object({ body: z.string().trim().min(2).max(4000) }), form).body;
    await db.message.update({ where: { id }, data: { body, status: "DRAFT", approvedAt: null } });
    return { msg: "Rascunho salvo (precisa ser aprovado novamente)." };
  });
}

export async function approveMessageAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  const m = await db.message.findUniqueOrThrow({ where: { id } });
  await act(form, `/crm/${m.leadId}#mensagens`, async () => {
    if (/\{\{\s*\w+\s*\}\}/.test(m.body)) throw new UserError("A mensagem ainda tem campos {{…}} não preenchidos.");
    await db.message.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date() } });
    const lead = await db.lead.findUniqueOrThrow({ where: { id: m.leadId } });
    if (["FOUND", "ANALYZED"].includes(lead.status)) await db.lead.update({ where: { id: lead.id }, data: { status: "MESSAGE_READY" } });
    return { msg: "Mensagem aprovada. Envie pelo botão do WhatsApp e marque como enviada." };
  });
}

export async function markSentAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  const m = await db.message.findUniqueOrThrow({ where: { id } });
  await act(form, `/crm/${m.leadId}#mensagens`, async () => {
    if (m.status !== "APPROVED") throw new UserError("Aprove a mensagem antes de marcar como enviada.");
    await db.message.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
    await db.interaction.create({ data: { leadId: m.leadId, type: "WHATSAPP", summary: `Mensagem enviada: ${m.body.slice(0, 200)}` } });
    const lead = await db.lead.findUniqueOrThrow({ where: { id: m.leadId } });
    const data: { status?: "CONTACTED"; followUpAt?: Date; nextAction?: string } = {};
    if (["FOUND", "ANALYZED", "MESSAGE_READY"].includes(lead.status)) data.status = "CONTACTED";
    if (!lead.followUpAt) { data.followUpAt = new Date(Date.now() + 3 * 86400_000); data.nextAction = "Follow-up se não responder"; }
    await db.lead.update({ where: { id: lead.id }, data });
    return { msg: "Registrado como enviada. Follow-up em 3 dias." };
  });
}
