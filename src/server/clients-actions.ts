"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { act, opt, parse, UserError } from "./guard";

const clientSchema = z.object({
  name: z.string().trim().min(2, "informe o nome").max(160), contactName: z.string().max(120).optional(), phone: z.string().max(40).optional(),
  whatsapp: z.string().max(40).optional(), email: z.union([z.literal(""), z.string().email("e-mail inválido")]).optional(), city: z.string().max(100).optional(),
  nicheId: z.string().optional(), notes: z.string().max(4000).optional(),
});

export async function createClientAction(form: FormData): Promise<void> {
  await act(form, "/clientes", async (s) => {
    const d = parse(clientSchema, form);
    const c = await db.client.create({ data: { name: d.name, contactName: opt(d.contactName), phone: opt(d.phone), whatsapp: opt(d.whatsapp), email: opt(d.email), city: opt(d.city), nicheId: opt(d.nicheId), notes: opt(d.notes) } });
    await audit({ action: "client.create", userId: s.userId, entity: "client", entityId: c.id });
    return { to: `/clientes/${c.id}`, msg: "Cliente criado." };
  });
}

export async function updateClientAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  await act(form, `/clientes/${id}`, async (s) => {
    const d = parse(clientSchema, form);
    await db.client.update({ where: { id }, data: { name: d.name, contactName: opt(d.contactName), phone: opt(d.phone), whatsapp: opt(d.whatsapp), email: opt(d.email), city: opt(d.city), nicheId: opt(d.nicheId), notes: opt(d.notes) } });
    await audit({ action: "client.update", userId: s.userId, entity: "client", entityId: id });
    return { msg: "Cliente atualizado." };
  });
}

export async function deleteClientAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  await act(form, `/clientes/${id}`, async (s) => {
    await db.client.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ action: "client.delete", userId: s.userId, entity: "client", entityId: id });
    return { to: "/clientes", msg: "Cliente movido para a lixeira (Configurações → Dados e LGPD)." };
  });
}

const ALLOWED = new Map([["application/pdf", ".pdf"], ["image/png", ".png"], ["image/jpeg", ".jpg"], ["image/webp", ".webp"], ["text/plain", ".txt"], ["application/zip", ".zip"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"], ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"]]);

/** Os arquivos ficam no próprio banco (bytea): funciona em hospedagem gratuita sem disco persistente e entra nos backups do banco. */
export async function uploadDocumentAction(form: FormData): Promise<void> {
  const clientId = String(form.get("clientId"));
  await act(form, `/clientes/${clientId}`, async (s) => {
    const f = form.get("file");
    if (!(f instanceof File) || f.size === 0) throw new UserError("Selecione um arquivo.");
    if (f.size > 5 * 1024 * 1024) throw new UserError("Arquivo muito grande (máx. 5 MB).");
    const ext = ALLOWED.get(f.type);
    if (!ext) throw new UserError("Tipo não permitido (use PDF, imagem, DOCX, XLSX, TXT ou ZIP).");
    const name = f.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || `arquivo${ext}`;
    const doc = await db.document.create({ data: { clientId, name, storageKey: "db", data: Buffer.from(await f.arrayBuffer()), mime: f.type, sizeBytes: f.size } });
    await audit({ action: "document.upload", userId: s.userId, entity: "document", entityId: doc.id });
    return { msg: "Documento enviado." };
  });
}

export async function deleteDocumentAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  const doc = await db.document.findUniqueOrThrow({ where: { id } });
  await act(form, `/clientes/${doc.clientId}`, async (s) => {
    await db.document.update({ where: { id }, data: { deletedAt: new Date() } });
    if (doc.storageKey !== "db") await unlink(path.join(path.resolve(env().DATA_DIR, "uploads"), path.basename(doc.storageKey))).catch(() => undefined);
    await audit({ action: "document.delete", userId: s.userId, entity: "document", entityId: id });
    return { msg: "Documento excluído." };
  });
}

export async function addSubscriptionAction(form: FormData): Promise<void> {
  const clientId = String(form.get("clientId"));
  await act(form, `/clientes/${clientId}`, async (s) => {
    const d = parse(z.object({ name: z.string().trim().min(2).max(100), amount: z.coerce.number().positive("valor inválido").max(1e7), dayOfMonth: z.coerce.number().int().min(1).max(28) }), form);
    const sub = await db.subscription.create({ data: { clientId, name: d.name, amount: d.amount, dayOfMonth: d.dayOfMonth } });
    await audit({ action: "subscription.create", userId: s.userId, entity: "subscription", entityId: sub.id, category: "finance" });
    return { msg: "Cobrança recorrente criada — as parcelas são geradas automaticamente todo mês." };
  });
}
