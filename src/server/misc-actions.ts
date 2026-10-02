"use server";

import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { act, opt, parse, UserError } from "./guard";

export async function markNotificationsAction(form: FormData): Promise<void> {
  await act(form, "/notificacoes", async (s) => {
    const id = opt(form.get("id"));
    await db.notification.updateMany({ where: { userId: s.userId, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
    return { msg: id ? "Marcada como lida." : "Todas marcadas como lidas." };
  });
}

// ───────── Regras comerciais, score, empresa ─────────
export async function saveRuleAction(form: FormData): Promise<void> {
  await act(form, "/settings/regras", async (s) => {
    const d = parse(z.object({
      name: z.string().trim().min(2).max(80), field: z.enum(["website", "instagram", "phone", "email", "niche", "city", "rating", "reviewCount"]),
      op: z.enum(["missing", "present", "in", "eq", "gte", "lte"]), value: z.string().max(200).optional(), opportunity: z.string().trim().min(2).max(120),
      suggestedService: z.string().max(100).optional(), priority: z.coerce.number().int().min(0).max(100).default(0),
    }), form);
    const needsValue = ["in", "eq", "gte", "lte"].includes(d.op);
    if (needsValue && !d.value) throw new UserError("Informe o valor da condição.");
    const value = d.op === "in" ? d.value!.split(",").map((x) => x.trim()).filter(Boolean) : ["gte", "lte"].includes(d.op) ? Number(d.value) : d.value;
    const id = opt(form.get("id"));
    const data = { name: d.name, condition: { field: d.field, op: d.op, ...(needsValue ? { value } : {}) }, opportunity: d.opportunity, suggestedService: opt(d.suggestedService), priority: d.priority };
    const r = id ? await db.businessRule.update({ where: { id }, data }) : await db.businessRule.create({ data });
    await audit({ action: "settings.rule_save", userId: s.userId, entity: "business_rule", entityId: r.id });
    return { msg: "Regra salva. Use “Reanalisar” no lead para aplicar." };
  });
}

export async function ruleOpAction(form: FormData): Promise<void> {
  await act(form, "/settings/regras", async (s) => {
    const id = String(form.get("id")), op = String(form.get("op"));
    if (op === "delete") await db.businessRule.delete({ where: { id } });
    else { const r = await db.businessRule.findUniqueOrThrow({ where: { id } }); await db.businessRule.update({ where: { id }, data: { active: !r.active } }); }
    await audit({ action: `settings.rule_${op}`, userId: s.userId, entity: "business_rule", entityId: id });
    return { msg: "Regra atualizada." };
  });
}

export async function saveScoreAction(form: FormData): Promise<void> {
  await act(form, "/settings/regras", async (s) => {
    const rules = await db.leadScoreRule.findMany();
    for (const r of rules) {
      const weight = Math.min(Math.max(Number(form.get(`w_${r.criterion}`)) || 0, 0), 10);
      const points = Math.min(Math.max(Number(form.get(`p_${r.criterion}`)) || 0, 0), 100);
      await db.leadScoreRule.update({ where: { criterion: r.criterion }, data: { weight, points, active: form.get(`a_${r.criterion}`) === "on" } });
    }
    await audit({ action: "settings.score_save", userId: s.userId });
    return { msg: "Pesos de score salvos." };
  });
}

export async function saveBusinessAction(form: FormData): Promise<void> {
  await act(form, "/settings/regras", async (s) => {
    const d = parse(z.object({ name: z.string().max(120).optional(), contact: z.string().max(240).optional() }), form);
    await db.setting.upsert({ where: { key: "business" }, update: { value: { name: d.name ?? "", contact: d.contact ?? "" } }, create: { key: "business", value: { name: d.name ?? "", contact: d.contact ?? "" } } });
    await audit({ action: "settings.business_save", userId: s.userId });
    return { msg: "Dados da empresa salvos (aparecem nas propostas)." };
  });
}

// ───────── LGPD: lixeira, restauração, exclusão definitiva ─────────
export async function restoreAction(form: FormData): Promise<void> {
  await act(form, "/settings/dados", async (s) => {
    const kind = String(form.get("kind")), id = String(form.get("id"));
    if (kind === "lead") await db.lead.update({ where: { id }, data: { deletedAt: null } });
    else if (kind === "client") await db.client.update({ where: { id }, data: { deletedAt: null } });
    else throw new UserError("Tipo inválido.");
    await audit({ action: `${kind}.restore`, userId: s.userId, entity: kind, entityId: id });
    return { msg: "Restaurado." };
  });
}

export async function purgeAction(form: FormData): Promise<void> {
  await act(form, "/settings/dados", async (s) => {
    if (String(form.get("confirm")).trim().toUpperCase() !== "EXCLUIR") throw new UserError("Digite EXCLUIR para confirmar a exclusão definitiva.");
    const kind = String(form.get("kind")), id = opt(form.get("id"));
    let n = 0;
    if (kind === "lead") n = (await db.lead.deleteMany({ where: { deletedAt: { not: null }, ...(id ? { id } : {}) } })).count;
    else if (kind === "client") {
      const doomed = await db.client.findMany({ where: { deletedAt: { not: null }, ...(id ? { id } : {}) }, select: { id: true, proposals: { select: { id: true } }, projects: { select: { id: true } }, subscriptions: { select: { id: true } } } });
      for (const c of doomed) {
        await db.payment.deleteMany({ where: { clientId: c.id } });
        await db.project.deleteMany({ where: { clientId: c.id } });
        await db.proposal.deleteMany({ where: { clientId: c.id } });
        await db.subscription.deleteMany({ where: { clientId: c.id } });
        await db.client.delete({ where: { id: c.id } });
        n++;
      }
    } else throw new UserError("Tipo inválido.");
    await audit({ action: `${kind}.purge`, userId: s.userId, entity: kind, entityId: id ?? "all", meta: { count: n } });
    return { msg: `${n} registro(s) excluído(s) definitivamente.` };
  });
}
