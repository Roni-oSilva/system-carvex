"use server";

import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { act, opt, parse, UserError } from "./guard";
import { runRoutines } from "./cron";
import { ACTIONS, TRIGGERS } from "./engine";

export async function createAutomationAction(form: FormData): Promise<void> {
  await act(form, "/automacoes", async (s) => {
    const d = parse(z.object({
      name: z.string().trim().min(3).max(100), trigger: z.enum(TRIGGERS.map((t) => t.id) as [string, ...string[]]), mode: z.enum(["MANUAL", "SEMI_AUTO"]),
      action: z.enum(ACTIONS.map((a) => a.id) as [string, ...string[]]), param: z.string().max(120).optional(),
      condField: z.string().max(40).optional(), condOp: z.enum(["gte", "lte", "eq", "present", "missing"]).optional(), condValue: z.string().max(60).optional(),
    }), form);
    const conditions = d.condField ? [{ field: d.condField, op: d.condOp ?? "gte", value: Number.isNaN(Number(d.condValue)) ? d.condValue : Number(d.condValue) }] : [];
    const a = await db.automation.create({ data: { name: d.name, trigger: d.trigger, mode: d.mode, conditions, actions: [{ type: d.action, param: opt(d.param) ?? undefined }] } });
    await audit({ action: "automation.create", userId: s.userId, entity: "automation", entityId: a.id });
    return { msg: "Automação criada." };
  });
}

export async function updateAutomationAction(form: FormData): Promise<void> {
  await act(form, "/automacoes", async (s) => {
    const id = String(form.get("id"));
    const d = parse(z.object({ mode: z.enum(["MANUAL", "SEMI_AUTO"]) }), form);
    const cur = await db.automation.findUniqueOrThrow({ where: { id } });
    await db.automation.update({ where: { id }, data: { mode: d.mode, active: form.get("op") === "toggle" ? !cur.active : cur.active } });
    await audit({ action: "automation.update", userId: s.userId, entity: "automation", entityId: id });
    return { msg: "Automação atualizada." };
  });
}

export async function deleteAutomationAction(form: FormData): Promise<void> {
  await act(form, "/automacoes", async (s) => {
    const id = String(form.get("id"));
    await db.automation.delete({ where: { id } });
    await audit({ action: "automation.delete", userId: s.userId, entity: "automation", entityId: id });
    return { msg: "Automação excluída." };
  });
}

export async function runRoutinesAction(form: FormData): Promise<void> {
  await act(form, "/automacoes", async () => {
    const out = await runRoutines();
    if (Object.values(out).includes("erro")) throw new UserError("Algumas rotinas falharam — veja as notificações.");
    return { msg: `Rotinas executadas: ${Object.entries(out).map(([k, v]) => `${k}=${v}`).join(", ")}` };
  });
}
