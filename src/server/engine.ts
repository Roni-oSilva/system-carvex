import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { evalCond, type Cond, type Facts } from "@/lib/leads";
import { log } from "@/lib/logger";
import { notify } from "./notify";
import { createProjectFromProposal } from "./projects";

export const TRIGGERS = [
  { id: "lead.no_reply", label: "Lead não respondeu (contatado há 3+ dias)" },
  { id: "proposal.accepted", label: "Proposta aceita" },
  { id: "project.done", label: "Projeto concluído" },
  { id: "payment.overdue", label: "Pagamento atrasado" },
  { id: "lead.won", label: "Venda fechada" },
] as const;

export const ACTIONS = [
  { id: "create_followup", label: "Criar follow-up (param: dias)", param: "dias" },
  { id: "create_project", label: "Criar projeto a partir da proposta", param: "" },
  { id: "create_aftersale", label: "Criar tarefa de pós-venda", param: "" },
  { id: "notify", label: "Criar alerta (param: título)", param: "título" },
] as const;

export type ActionDef = { type: string; param?: string };
type Ctx = Record<string, unknown>;

async function runAction(a: ActionDef, ctx: Ctx, autoName: string) {
  const name = String(ctx.name ?? "");
  switch (a.type) {
    case "create_followup": {
      if (!ctx.leadId) return;
      const days = Math.min(Math.max(Number(a.param) || 2, 1), 60);
      await db.lead.update({ where: { id: String(ctx.leadId) }, data: { followUpAt: new Date(Date.now() + days * 86400_000), nextAction: "Fazer follow-up" } });
      await db.interaction.create({ data: { leadId: String(ctx.leadId), type: "SYSTEM", summary: `Follow-up agendado em ${days} dia(s) (automação: ${autoName})` } });
      return;
    }
    case "create_project": {
      if (ctx.proposalId) {
        const p = await createProjectFromProposal(String(ctx.proposalId));
        await notify("PROPOSAL_ACCEPTED", `Projeto criado: ${p.name}`, undefined, `/projetos/${p.id}`);
      }
      return;
    }
    case "create_aftersale": {
      if (!ctx.clientId) return;
      const clientId = String(ctx.clientId);
      await db.interaction.create({ data: { clientId, type: "SYSTEM", summary: "Pós-venda: entrar em contato para confirmar satisfação e oferecer manutenção." } });
      await notify("FOLLOW_UP", `Pós-venda: ${name || "cliente"}`, "Projeto concluído — faça o contato de pós-venda.", `/clientes/${clientId}`);
      return;
    }
    case "notify":
      await notify("SYSTEM", (a.param || autoName).replace("{{nome}}", name), undefined, typeof ctx.href === "string" ? ctx.href : undefined);
      return;
  }
}

/** Dispara automações ativas do gatilho. MANUAL = só sugere (aprovação humana); SEMI_AUTO = executa ações seguras. */
export async function emit(trigger: string, ctx: Ctx) {
  const autos = await db.automation.findMany({ where: { trigger, active: true } });
  for (const au of autos) {
    const conds = (au.conditions as unknown as Cond[]) ?? [];
    if (!conds.every((c) => evalCond(c, ctx as unknown as Facts))) continue;
    const run = await db.automationRun.create({ data: { automationId: au.id, status: "PROCESSING", input: ctx as Prisma.InputJsonValue } });
    try {
      const actions = (au.actions as unknown as ActionDef[]) ?? [];
      if (au.mode === "MANUAL") {
        await notify("SYSTEM", `Sugestão: ${au.name}`, `Automação em modo manual — requer sua ação: ${actions.map((a) => a.type).join(", ")}`, "/automacoes", 12);
      } else {
        for (const a of actions) await runAction(a, ctx, au.name);
      }
      await db.automationRun.update({ where: { id: run.id }, data: { status: "DONE" } });
    } catch (e) {
      log.error("automation_failed", { automation: au.id, err: e });
      await db.automationRun.update({ where: { id: run.id }, data: { status: "ERROR", error: "Falha ao executar (veja o log do servidor)" } });
      await notify("AUTOMATION_FAILED", `Falha na automação: ${au.name}`, undefined, "/automacoes", 6);
    }
  }
}
