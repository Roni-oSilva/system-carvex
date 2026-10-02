"use server";

import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { emit } from "./engine";
import { act, opt, parse } from "./guard";
import { DEFAULT_CHECKLIST } from "./projects";

const STATUS = ["WAITING_CLIENT", "IN_PROGRESS", "REVIEW", "DONE", "CANCELED"] as const;
const money = z.coerce.number().min(0).max(1e8);
const dateOrNull = (v?: string) => (v ? new Date(`${v}T12:00:00`) : null);

const projectSchema = z.object({
  name: z.string().trim().min(2, "informe o nome").max(160), category: z.string().max(60).optional(), status: z.enum(STATUS).optional(),
  value: money.optional().or(z.literal("").transform(() => undefined)), cost: money.optional().or(z.literal("").transform(() => undefined)),
  dueDate: z.string().optional(), technology: z.string().max(120).optional(), url: z.string().max(300).optional(), repoUrl: z.string().max(300).optional(),
  hosting: z.string().max(120).optional(), domain: z.string().max(120).optional(), maintenance: z.string().optional(),
});

export async function createProjectAction(form: FormData): Promise<void> {
  await act(form, "/projetos", async (s) => {
    const d = parse(projectSchema.extend({ clientId: z.string().min(1, "selecione o cliente"), templateId: z.string().optional() }), form);
    const tpl = d.templateId ? await db.projectTemplate.findUnique({ where: { id: d.templateId } }) : null;
    const checklist = tpl?.checklist.length ? tpl.checklist : DEFAULT_CHECKLIST;
    const p = await db.project.create({
      data: {
        clientId: d.clientId, name: d.name, category: opt(d.category), value: d.value ?? null, cost: d.cost ?? null, dueDate: dateOrNull(d.dueDate),
        technology: opt(d.technology), url: opt(d.url), repoUrl: opt(d.repoUrl), hosting: opt(d.hosting), domain: opt(d.domain), maintenance: d.maintenance === "on",
        tasks: { create: checklist.map((title, position) => ({ title, position })) },
      },
    });
    await audit({ action: "project.create", userId: s.userId, entity: "project", entityId: p.id });
    return { to: `/projetos/${p.id}`, msg: "Projeto criado com checklist." };
  });
}

export async function updateProjectAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  await act(form, `/projetos/${id}`, async (s) => {
    const d = parse(projectSchema, form);
    const before = await db.project.findUniqueOrThrow({ where: { id }, include: { client: true } });
    const status = d.status ?? before.status;
    await db.project.update({
      where: { id },
      data: {
        name: d.name, category: opt(d.category), status, value: d.value ?? null, cost: d.cost ?? null, dueDate: dateOrNull(d.dueDate), technology: opt(d.technology),
        url: opt(d.url), repoUrl: opt(d.repoUrl), hosting: opt(d.hosting), domain: opt(d.domain), maintenance: d.maintenance === "on",
        deliveredAt: status === "DONE" ? before.deliveredAt ?? new Date() : null,
      },
    });
    await audit({ action: "project.update", userId: s.userId, entity: "project", entityId: id });
    if (status === "DONE" && before.status !== "DONE") await emit("project.done", { projectId: id, clientId: before.clientId, name: before.client.name });
    return { msg: "Projeto atualizado." };
  });
}

export async function toggleTaskAction(form: FormData): Promise<void> {
  const projectId = String(form.get("projectId"));
  await act(form, `/projetos/${projectId}`, async () => {
    const t = await db.projectTask.findFirstOrThrow({ where: { id: String(form.get("id")), projectId } });
    await db.projectTask.update({ where: { id: t.id }, data: { done: !t.done, doneAt: t.done ? null : new Date() } });
  });
}

export async function addTaskAction(form: FormData): Promise<void> {
  const projectId = String(form.get("projectId"));
  await act(form, `/projetos/${projectId}`, async () => {
    const { title } = parse(z.object({ title: z.string().trim().min(2).max(160) }), form);
    const last = await db.projectTask.aggregate({ where: { projectId }, _max: { position: true } });
    await db.projectTask.create({ data: { projectId, title, position: (last._max.position ?? -1) + 1 } });
    return { msg: "Tarefa adicionada." };
  });
}

export async function deleteTaskAction(form: FormData): Promise<void> {
  const projectId = String(form.get("projectId"));
  await act(form, `/projetos/${projectId}`, async () => {
    await db.projectTask.deleteMany({ where: { id: String(form.get("id")), projectId } });
    return { msg: "Tarefa removida." };
  });
}

export async function deleteProjectAction(form: FormData): Promise<void> {
  const id = String(form.get("id"));
  await act(form, `/projetos/${id}`, async (s) => {
    await db.project.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ action: "project.delete", userId: s.userId, entity: "project", entityId: id });
    return { to: "/projetos", msg: "Projeto excluído." };
  });
}

export async function saveChecklistTemplateAction(form: FormData): Promise<void> {
  await act(form, "/projetos/modelos", async () => {
    const d = parse(z.object({ name: z.string().trim().min(2).max(80), serviceId: z.string().optional(), items: z.string().min(2).max(3000) }), form);
    const checklist = d.items.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 60);
    const id = opt(form.get("id"));
    const data = { name: d.name, serviceId: opt(d.serviceId), checklist };
    if (id) await db.projectTemplate.update({ where: { id }, data });
    else await db.projectTemplate.create({ data });
    return { msg: "Modelo de checklist salvo." };
  });
}

export async function deleteChecklistTemplateAction(form: FormData): Promise<void> {
  await act(form, "/projetos/modelos", async () => {
    await db.projectTemplate.delete({ where: { id: String(form.get("id")) } });
    return { msg: "Modelo excluído." };
  });
}
