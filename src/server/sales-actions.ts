"use server";

import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { emit } from "./engine";
import { act, opt, parse, UserError } from "./guard";
import { setLeadStatus } from "./leads";

const money = z.coerce.number().min(0, "valor inválido").max(1e8);

const serviceSchema = z.object({
  name: z.string().trim().min(2, "informe o nome").max(100), description: z.string().max(1000).optional(), price: money, cost: money.default(0),
  deadlineDays: z.coerce.number().int().min(1).max(365).optional().or(z.literal("").transform(() => undefined)), features: z.string().max(2000).optional(),
});

export async function saveServiceAction(form: FormData): Promise<void> {
  const id = opt(form.get("id"));
  await act(form, id ? `/vendas/servicos/${id}` : "/vendas", async (s) => {
    const d = parse(serviceSchema, form);
    const data = { name: d.name, description: opt(d.description), price: d.price, cost: d.cost, deadlineDays: d.deadlineDays ?? null, features: (d.features ?? "").split("\n").map((x) => x.trim()).filter(Boolean) };
    if (!id && (await db.service.findUnique({ where: { name: d.name } }))) throw new UserError("Já existe um serviço com este nome.");
    const svc = id ? await db.service.update({ where: { id }, data }) : await db.service.create({ data });
    await audit({ action: id ? "service.update" : "service.create", userId: s.userId, entity: "service", entityId: svc.id, category: "finance" });
    return { to: `/vendas/servicos/${svc.id}`, msg: "Serviço salvo." };
  });
}

export async function toggleServiceAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  await act(form, `/vendas/servicos/${id}`, async () => {
    const s = await db.service.findUniqueOrThrow({ where: { id } });
    await db.service.update({ where: { id }, data: { active: !s.active } });
    return { msg: s.active ? "Serviço desativado." : "Serviço ativado." };
  });
}

export async function addExtraAction(form: FormData): Promise<void> {
  const serviceId = String(form.get("serviceId"));
  await act(form, `/vendas/servicos/${serviceId}`, async () => {
    const d = parse(z.object({ name: z.string().trim().min(2).max(100), price: money }), form);
    await db.serviceExtra.create({ data: { serviceId, name: d.name, price: d.price } });
    return { msg: "Extra adicionado." };
  });
}

export async function deleteExtraAction(form: FormData): Promise<void> {
  const serviceId = String(form.get("serviceId"));
  await act(form, `/vendas/servicos/${serviceId}`, async () => {
    await db.serviceExtra.delete({ where: { id: String(form.get("id")) } });
    return { msg: "Extra removido." };
  });
}

const arr = (v: unknown) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export async function createProposalAction(form: FormData): Promise<void> {
  const clientId = String(form.get("clientId"));
  await act(form, `/vendas/propostas/nova?client=${clientId}&service=${String(form.get("serviceId"))}`, async (s) => {
    const d = parse(z.object({
      clientId: z.string().min(1), serviceId: z.string().min(1), price: money, discount: money.default(0), deadlineDays: z.coerce.number().int().min(1).max(365).optional().or(z.literal("").transform(() => undefined)),
      paymentTerms: z.string().max(500).optional(), validDays: z.coerce.number().int().min(1).max(180).default(7), extraIds: z.preprocess(arr, z.array(z.string())).default([]),
    }), form);
    const svc = await db.service.findUniqueOrThrow({ where: { id: d.serviceId }, include: { extras: { where: { id: { in: d.extraIds } } } } });
    const items = [{ serviceId: svc.id, description: svc.name, quantity: 1, unitPrice: d.price }, ...svc.extras.map((e) => ({ serviceId: null, description: `Extra: ${e.name}`, quantity: 1, unitPrice: Number(e.price) }))];
    const sum = items.reduce((a, i) => a + i.unitPrice * i.quantity, 0);
    if (d.discount > sum) throw new UserError("O desconto não pode ser maior que o total.");
    const p = await db.proposal.create({
      data: { clientId: d.clientId, total: sum - d.discount, discount: d.discount, deadlineDays: d.deadlineDays ?? svc.deadlineDays, paymentTerms: opt(d.paymentTerms), validUntil: new Date(Date.now() + d.validDays * 86400_000), items: { create: items } },
    });
    await audit({ action: "proposal.create", userId: s.userId, entity: "proposal", entityId: p.id, category: "finance" });
    return { to: `/vendas/propostas/${p.id}`, msg: "Proposta criada." };
  });
}

export async function updateProposalAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  await act(form, `/vendas/propostas/${id}`, async (s) => {
    const d = parse(z.object({ discount: money.default(0), deadlineDays: z.coerce.number().int().min(1).max(365).optional().or(z.literal("").transform(() => undefined)), paymentTerms: z.string().max(500).optional(), validUntil: z.string().optional() }), form);
    const p = await db.proposal.findUniqueOrThrow({ where: { id }, include: { items: true } });
    if (p.status === "ACCEPTED") throw new UserError("Proposta aceita não pode ser alterada.");
    const sum = p.items.reduce((a, i) => a + Number(i.unitPrice) * i.quantity, 0);
    if (d.discount > sum) throw new UserError("O desconto não pode ser maior que o total.");
    await db.proposal.update({ where: { id }, data: { discount: d.discount, total: sum - d.discount, deadlineDays: d.deadlineDays ?? null, paymentTerms: opt(d.paymentTerms), validUntil: d.validUntil ? new Date(`${d.validUntil}T23:59:59`) : null } });
    await audit({ action: "proposal.update", userId: s.userId, entity: "proposal", entityId: id, category: "finance" });
    return { msg: "Proposta atualizada." };
  });
}

export async function proposalStatusAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  await act(form, `/vendas/propostas/${id}`, async (s) => {
    const to = z.enum(["SENT", "ACCEPTED", "REJECTED"]).parse(form.get("to"));
    const p = await db.proposal.findUniqueOrThrow({ where: { id }, include: { client: true } });
    if (p.status === "ACCEPTED") throw new UserError("Proposta já aceita.");
    await db.proposal.update({ where: { id }, data: { status: to, ...(to === "SENT" ? { sentAt: new Date() } : { respondedAt: new Date() }) } });
    await audit({ action: `proposal.${to.toLowerCase()}`, userId: s.userId, entity: "proposal", entityId: id, category: "finance" });
    if (p.client.leadId) {
      const lead = await db.lead.findUnique({ where: { id: p.client.leadId } });
      if (lead && to === "SENT" && ["FOUND", "ANALYZED", "MESSAGE_READY", "CONTACTED", "REPLIED", "INTERESTED", "MEETING"].includes(lead.status)) await setLeadStatus(lead.id, "PROPOSAL", "Proposta enviada");
      if (lead && to === "ACCEPTED") await setLeadStatus(lead.id, "WON", "Proposta aceita");
      if (lead && to === "REJECTED") await setLeadStatus(lead.id, "LOST", "Proposta recusada");
    }
    if (to === "ACCEPTED") await emit("proposal.accepted", { proposalId: id, clientId: p.clientId, name: p.client.name, total: Number(p.total) });
    return { msg: to === "SENT" ? "Envio registrado." : to === "ACCEPTED" ? "Aceite registrado." : "Recusa registrada." };
  });
}

export async function deleteProposalAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  await act(form, `/vendas/propostas/${id}`, async (s) => {
    const p = await db.proposal.findUniqueOrThrow({ where: { id } });
    if (p.status === "ACCEPTED") throw new UserError("Proposta aceita não pode ser excluída.");
    await db.proposal.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ action: "proposal.delete", userId: s.userId, entity: "proposal", entityId: id, category: "finance" });
    return { to: "/vendas", msg: "Proposta excluída." };
  });
}
