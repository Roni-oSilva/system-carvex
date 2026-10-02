import { AppShell } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, Flash, Form, Group, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { dtt } from "@/lib/format";
import { createAutomationAction, deleteAutomationAction, runRoutinesAction, updateAutomationAction } from "@/server/automation-actions";
import { ACTIONS, TRIGGERS } from "@/server/engine";
import { ctx } from "@/server/guard";

const label = <T extends readonly { id: string; label: string }[]>(list: T, id: string) => list.find((x) => x.id === id)?.label ?? id;

export default async function AutomationsPage({ searchParams }: { searchParams: SP }) {
  const { csrf } = await ctx();
  const [autos, runs, last] = await Promise.all([
    db.automation.findMany({ orderBy: { createdAt: "asc" } }),
    db.automationRun.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { automation: true } }),
    db.setting.findUnique({ where: { key: "last_routines" } }),
  ]);
  const lastAt = (last?.value as { at?: string } | undefined)?.at;
  return (
    <AppShell current="/automacoes" title="Automações">
      <Flash sp={searchParams} />
      <Win title="Regras: GATILHO + CONDIÇÃO + AÇÃO">
        <p className="mb-2 text-xs text-muted">Modo <b>Semiautomático</b> executa ações seguras (follow-up, alerta, criar projeto/pós-venda). Modo <b>Manual</b> só gera uma sugestão para você aprovar. Nenhuma automação envia mensagens, exclui dados ou altera valores financeiros.</p>
        {autos.length === 0 && <p className="text-muted">Nenhuma automação.</p>}
        {autos.map((a) => (
          <Group key={a.id} title={`${a.name}${a.active ? "" : " (desativada)"}`}>
            <p>SE <b>{label(TRIGGERS, a.trigger)}</b>{(a.conditions as { field: string; op: string; value?: unknown }[]).map((c, i) => <span key={i}> E <code>{c.field} {c.op} {String(c.value ?? "")}</code></span>)} → {(a.actions as { type: string; param?: string }[]).map((x, i) => <b key={i}>{label(ACTIONS, x.type)}{x.param ? `: ${x.param}` : ""}</b>)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Form action={updateAutomationAction} csrf={csrf} className="flex items-center gap-2"><input type="hidden" name="id" value={a.id} />
                <select name="mode" defaultValue={a.mode} className="input !w-44" aria-label="Modo"><option value="SEMI_AUTO">Semiautomático</option><option value="MANUAL">Manual (só sugere)</option></select>
                <button className="btn-ghost">Salvar modo</button><button name="op" value="toggle" className="btn-ghost">{a.active ? "Desativar" : "Ativar"}</button></Form>
              <Form action={deleteAutomationAction} csrf={csrf}><input type="hidden" name="id" value={a.id} /><ConfirmButton message="Excluir esta automação?">Excluir</ConfirmButton></Form>
            </div>
          </Group>
        ))}
      </Win>

      <div className="grid gap-3 lg:grid-cols-2">
        <Win title="Nova automação">
          <Form action={createAutomationAction} csrf={csrf}>
            <Field label="Nome"><input name="name" required className="input" /></Field>
            <Field label="Gatilho"><select name="trigger" className="input">{TRIGGERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Condição: campo (opcional)"><input name="condField" placeholder="total, amount…" className="input" /></Field>
              <Field label="Operador"><select name="condOp" className="input"><option value="gte">≥</option><option value="lte">≤</option><option value="eq">=</option><option value="present">existe</option></select></Field>
              <Field label="Valor"><input name="condValue" className="input" /></Field>
            </div>
            <Field label="Ação"><select name="action" className="input">{ACTIONS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></Field>
            <Field label="Parâmetro da ação (dias ou título)"><input name="param" className="input" /></Field>
            <Field label="Modo"><select name="mode" className="input"><option value="SEMI_AUTO">Semiautomático</option><option value="MANUAL">Manual (só sugere)</option></select></Field>
            <button className="btn">Criar automação</button>
          </Form>
        </Win>
        <div className="space-y-3">
          <Win title="Rotinas agendadas">
            <p>Pagamentos atrasados, cobranças recorrentes, follow-ups vencidos, leads sem resposta, prazos de projetos, propostas expiradas e limpeza.</p>
            <p className="text-xs text-muted">Última execução: {lastAt ? dtt(new Date(lastAt)) : "nunca"} — agende GET /api/cron (veja o README) ou execute agora:</p>
            <Form action={runRoutinesAction} csrf={csrf}><button className="btn">Executar rotinas agora</button></Form>
          </Win>
          <Win title="Execuções recentes">
            {runs.length === 0 ? <p className="text-muted">Sem execuções.</p> : <ul>{runs.map((r) => <li key={r.id}><span className="badge">{r.status === "DONE" ? "CONCLUÍDO" : r.status === "ERROR" ? "ERRO" : r.status}</span> {r.automation.name} <span className="text-xs text-muted">{dtt(r.createdAt)} {r.error}</span></li>)}</ul>}
          </Win>
        </div>
      </div>
    </AppShell>
  );
}
