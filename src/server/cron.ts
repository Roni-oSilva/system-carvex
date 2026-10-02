import "server-only";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { emit } from "./engine";
import { createBackup, pruneBackups, verifyBackup } from "./backup";
import { notify } from "./notify";

/**
 * Rotinas periódicas (idempotentes; podem rodar a cada 15 min). Chamadas por GET /api/cron (Bearer CRON_SECRET)
 * ou manualmente em Automações. Cada etapa é isolada: uma falha não impede as demais.
 */
export async function runRoutines() {
  const now = new Date();
  const out: Record<string, number | string> = {};
  const step = async (name: string, fn: () => Promise<number>) => {
    try { out[name] = await fn(); } catch (e) { log.error("routine_failed", { name, err: e }); out[name] = "erro"; await notify("AUTOMATION_FAILED", `Falha na rotina: ${name}`, undefined, "/automacoes", 6); }
  };

  await step("pagamentos_atrasados", async () => {
    const late = await db.payment.findMany({ where: { status: "PENDING", deletedAt: null, dueDate: { lt: new Date(now.getTime() - 86400_000 * 0) } }, include: { client: true } });
    for (const p of late) {
      await db.payment.update({ where: { id: p.id }, data: { status: "OVERDUE" } });
      await notify("PAYMENT_OVERDUE", `Pagamento atrasado: ${p.client?.name ?? p.category}`, `Vencimento ${p.dueDate.toLocaleDateString("pt-BR")}`, "/financeiro");
      await emit("payment.overdue", { paymentId: p.id, clientId: p.clientId, name: p.client?.name ?? p.category, amount: Number(p.amount), href: "/financeiro" });
    }
    return late.length;
  });

  await step("recorrencias", async () => {
    const subs = await db.subscription.findMany({ where: { active: true } });
    const from = new Date(now.getFullYear(), now.getMonth(), 1), to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    let n = 0;
    for (const s of subs) {
      if (s.startedAt >= to) continue;
      const exists = await db.payment.count({ where: { subscriptionId: s.id, dueDate: { gte: from, lt: to } } });
      if (exists) continue;
      await db.payment.create({ data: { clientId: s.clientId, subscriptionId: s.id, category: "Manutenção", description: s.name, amount: s.amount, dueDate: new Date(now.getFullYear(), now.getMonth(), s.dayOfMonth, 12) } });
      n++;
    }
    return n;
  });

  await step("followups_vencidos", async () => {
    const leads = await db.lead.findMany({ where: { deletedAt: null, followUpAt: { lte: now }, status: { notIn: ["WON", "LOST", "DISCARDED"] } }, take: 50 });
    for (const l of leads) await notify("FOLLOW_UP", `Follow-up: ${l.name}`, l.nextAction ?? undefined, `/crm/${l.id}`, 24);
    return leads.length;
  });

  await step("leads_sem_resposta", async () => {
    const cutoff = new Date(now.getTime() - 3 * 86400_000);
    const sent = await db.message.findMany({ where: { status: "SENT", sentAt: { lt: cutoff }, lead: { deletedAt: null, status: "CONTACTED", followUpAt: null } }, include: { lead: true }, distinct: ["leadId"], take: 50 });
    for (const m of sent) await emit("lead.no_reply", { leadId: m.leadId, name: m.lead.name, href: `/crm/${m.leadId}` });
    return sent.length;
  });

  await step("prazos_de_projetos", async () => {
    const active = { notIn: ["DONE", "CANCELED"] as ("DONE" | "CANCELED")[] };
    const soon = await db.project.findMany({ where: { deletedAt: null, status: active, dueDate: { gte: now, lte: new Date(now.getTime() + 3 * 86400_000) } } });
    const late = await db.project.findMany({ where: { deletedAt: null, status: active, dueDate: { lt: now } } });
    for (const p of soon) await notify("PROJECT_DEADLINE", `Prazo próximo: ${p.name}`, undefined, `/projetos/${p.id}`, 24);
    for (const p of late) await notify("PROJECT_LATE", `Projeto atrasado: ${p.name}`, undefined, `/projetos/${p.id}`, 24);
    return soon.length + late.length;
  });

  await step("propostas_expiradas", async () => (await db.proposal.updateMany({ where: { status: "SENT", validUntil: { lt: now }, deletedAt: null }, data: { status: "EXPIRED" } })).count);

  await step("backup_diario", async () => {
    const last = await db.backupRecord.findFirst({ where: { status: "DONE" }, orderBy: { createdAt: "desc" } });
    if (last && now.getTime() - last.createdAt.getTime() < 23 * 3600_000) return 0;
    const id = await createBackup();
    await verifyBackup(id);
    await pruneBackups(14);
    return 1;
  });

  await step("limpeza", async () => {
    const a = await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 30 * 86400_000) } } });
    const b = await db.session.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(now.getTime() - 7 * 86400_000) } }, { revokedAt: { lt: new Date(now.getTime() - 7 * 86400_000) } }] } });
    const c = await db.job.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 90 * 86400_000) } } });
    return a.count + b.count + c.count;
  });

  await db.setting.upsert({ where: { key: "last_routines" }, update: { value: { at: now.toISOString(), out } }, create: { key: "last_routines", value: { at: now.toISOString(), out } } });
  return out;
}
