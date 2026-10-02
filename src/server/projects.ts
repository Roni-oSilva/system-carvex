import "server-only";
import { db } from "@/lib/db";

export const DEFAULT_CHECKLIST = ["Briefing", "Conteúdo", "Imagens", "Design", "Desenvolvimento", "Responsividade", "Testes", "Aprovação", "Publicação", "Entrega"];

/** Cria o projeto de uma proposta aceita (idempotente: proposalId é único em Project). */
export async function createProjectFromProposal(proposalId: string) {
  const existing = await db.project.findUnique({ where: { proposalId } });
  if (existing) return existing;
  const p = await db.proposal.findUniqueOrThrow({ where: { id: proposalId }, include: { client: true, items: { include: { service: true } } } });
  const mainItem = p.items.find((i) => i.service) ?? p.items[0];
  const service = mainItem?.service ?? null;
  const tpl = service ? await db.projectTemplate.findFirst({ where: { serviceId: service.id } }) : null;
  const checklist = tpl?.checklist.length ? tpl.checklist : DEFAULT_CHECKLIST;
  const cost = p.items.reduce((a, i) => a + Number(i.service?.cost ?? 0) * i.quantity, 0);
  const deadline = p.deadlineDays ?? service?.deadlineDays;
  return db.project.create({
    data: {
      clientId: p.clientId, proposalId, name: `${service?.name ?? "Projeto"} — ${p.client.name}`,
      category: service?.name ?? null, value: p.total, cost: cost || null,
      dueDate: deadline ? new Date(Date.now() + deadline * 86400_000) : null,
      tasks: { create: checklist.map((title, position) => ({ title, position })) },
    },
  });
}
