"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { act, opt, parse, UserError } from "./guard";

const STAGES = ["FIRST_CONTACT", "SECOND_CONTACT", "FOLLOW_UP", "PRESENTATION", "PROPOSAL", "RECOVERY", "AFTER_SALE"] as const;

export async function createNicheAction(form: FormData): Promise<void> {
  await act(form, "/mensagens", async () => {
    const { name } = parse(z.object({ name: z.string().trim().min(2).max(60) }), form);
    if (await db.niche.findFirst({ where: { name: { equals: name, mode: "insensitive" } } })) throw new UserError("Este nicho já existe.");
    await db.niche.create({ data: { name } });
    return { msg: "Nicho criado." };
  });
}

export async function saveTemplateAction(form: FormData): Promise<void> {
  const id = opt(form.get("id"));
  await act(form, "/mensagens", async () => {
    const d = parse(z.object({ nicheId: z.string().optional(), stage: z.enum(STAGES), name: z.string().trim().min(2).max(80), body: z.string().trim().min(5).max(2000) }), form);
    const data = { nicheId: opt(d.nicheId), stage: d.stage, name: d.name, body: d.body };
    if (id) await db.messageTemplate.update({ where: { id }, data });
    else await db.messageTemplate.create({ data });
    return { msg: "Modelo salvo." };
  });
}

export async function deleteTemplateAction(form: FormData): Promise<void> {
  await act(form, "/mensagens", async () => {
    await db.messageTemplate.delete({ where: { id: String(form.get("id")) } });
    return { msg: "Modelo excluído." };
  });
}
