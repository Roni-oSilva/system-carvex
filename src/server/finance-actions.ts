"use server";

import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { act, backOf, opt, parse } from "./guard";
import { notify } from "./notify";

const amount = z.coerce.number().positive("valor inválido").max(1e8);
const day = (v: string) => new Date(`${v}T12:00:00`);

export async function addPaymentAction(form: FormData): Promise<void> {
  await act(form, "/financeiro", async (s) => {
    const d = parse(z.object({ clientId: z.string().optional(), projectId: z.string().optional(), category: z.string().min(2).max(40), description: z.string().max(200).optional(), amount, dueDate: z.string().min(8, "informe o vencimento"), paid: z.string().optional() }), form);
    const paid = d.paid === "on";
    const p = await db.payment.create({
      data: { clientId: opt(d.clientId), projectId: opt(d.projectId), category: d.category, description: opt(d.description), amount: d.amount, dueDate: day(d.dueDate), status: paid ? "PAID" : "PENDING", paidAt: paid ? new Date() : null },
    });
    await audit({ action: "payment.create", userId: s.userId, entity: "payment", entityId: p.id, category: "finance", meta: { amount: d.amount, paid } });
    return { msg: paid ? "Pagamento lançado como recebido." : "Cobrança lançada." };
  });
}

export async function payAction(form: FormData): Promise<void> {
  await act(form, backOf(form, "/financeiro"), async (s) => {
    const id = String(form.get("id"));
    const p = await db.payment.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });
    await audit({ action: "payment.paid", userId: s.userId, entity: "payment", entityId: id, category: "finance", meta: { amount: Number(p.amount) } });
    await notify("PAYMENT", "Pagamento registrado", undefined, "/financeiro");
    return { msg: "Pagamento registrado como recebido." };
  });
}

export async function cancelPaymentAction(form: FormData): Promise<void> {
  await act(form, backOf(form, "/financeiro"), async (s) => {
    const id = String(form.get("id"));
    await db.payment.update({ where: { id }, data: { status: "CANCELED" } });
    await audit({ action: "payment.cancel", userId: s.userId, entity: "payment", entityId: id, category: "finance" });
    return { msg: "Cobrança cancelada." };
  });
}

export async function deletePaymentAction(form: FormData): Promise<void> {
  await act(form, backOf(form, "/financeiro"), async (s) => {
    const id = String(form.get("id"));
    await db.payment.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ action: "payment.delete", userId: s.userId, entity: "payment", entityId: id, category: "finance" });
    return { msg: "Lançamento excluído." };
  });
}

export async function addExpenseAction(form: FormData): Promise<void> {
  await act(form, "/financeiro", async (s) => {
    const d = parse(z.object({ category: z.string().min(2).max(40), description: z.string().trim().min(2).max(200), amount, incurredAt: z.string().min(8, "informe a data") }), form);
    const e = await db.expense.create({ data: { category: d.category, description: d.description, amount: d.amount, incurredAt: day(d.incurredAt) } });
    await audit({ action: "expense.create", userId: s.userId, entity: "expense", entityId: e.id, category: "finance", meta: { amount: d.amount } });
    return { msg: "Despesa lançada." };
  });
}

export async function deleteExpenseAction(form: FormData): Promise<void> {
  await act(form, "/financeiro", async (s) => {
    const id = String(form.get("id"));
    await db.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ action: "expense.delete", userId: s.userId, entity: "expense", entityId: id, category: "finance" });
    return { msg: "Despesa excluída." };
  });
}

export async function toggleSubscriptionAction(form: FormData): Promise<void> {
  await act(form, "/financeiro", async (s) => {
    const id = String(form.get("id"));
    const sub = await db.subscription.findUniqueOrThrow({ where: { id } });
    await db.subscription.update({ where: { id }, data: { active: !sub.active, endedAt: sub.active ? new Date() : null } });
    await audit({ action: "subscription.toggle", userId: s.userId, entity: "subscription", entityId: id, category: "finance" });
    return { msg: sub.active ? "Recorrência encerrada." : "Recorrência reativada." };
  });
}
