import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { Empty, Field, Flash, Form, Grid, one, Stat, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { brl, dt, EXPENSE_CATEGORIES, PAYMENT_CATEGORIES, PAYMENT_STATUS_LABEL } from "@/lib/format";
import { addExpenseAction, addPaymentAction, cancelPaymentAction, deleteExpenseAction, deletePaymentAction, payAction, toggleSubscriptionAction } from "@/server/finance-actions";
import { ctx } from "@/server/guard";

export default async function FinancePage({ searchParams }: { searchParams: SP }) {
  const { csrf } = await ctx();
  const m = one((await searchParams).m);
  const now = new Date();
  const [y, mo] = /^\d{4}-\d{2}$/.test(m ?? "") ? m!.split("-").map(Number) as [number, number] : [now.getFullYear(), now.getMonth() + 1];
  const from = new Date(y, mo - 1, 1), to = new Date(y, mo, 1);
  const ym = `${y}-${String(mo).padStart(2, "0")}`;

  const [paid, expenses, open, payments, subs, clients, projects, niches] = await Promise.all([
    db.payment.findMany({ where: { status: "PAID", deletedAt: null, paidAt: { gte: from, lt: to } }, include: { client: true } }),
    db.expense.findMany({ where: { deletedAt: null, incurredAt: { gte: from, lt: to } }, orderBy: { incurredAt: "desc" } }),
    db.payment.findMany({ where: { status: { in: ["PENDING", "OVERDUE"] }, deletedAt: null } }),
    db.payment.findMany({ where: { deletedAt: null, OR: [{ dueDate: { gte: from, lt: to } }, { status: { in: ["PENDING", "OVERDUE"] } }] }, include: { client: true }, orderBy: { dueDate: "asc" }, take: 100 }),
    db.subscription.findMany({ include: { client: true }, orderBy: { startedAt: "desc" } }),
    db.client.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    db.project.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, take: 200 }),
    db.niche.findMany(),
  ]);
  const sum = (a: { amount: unknown }[]) => a.reduce((t, x) => t + Number(x.amount), 0);
  const revenue = sum(paid), cost = sum(expenses);
  const overdue = open.filter((p) => p.status === "OVERDUE" || p.dueDate < now);
  const byCat = new Map<string, number>(), byNiche = new Map<string, number>();
  for (const p of paid) {
    byCat.set(p.category, (byCat.get(p.category) ?? 0) + Number(p.amount));
    const n = niches.find((x) => x.id === p.client?.nicheId)?.name ?? "Sem nicho";
    byNiche.set(n, (byNiche.get(n) ?? 0) + Number(p.amount));
  }
  const prev = new Date(y, mo - 2, 1), next = new Date(y, mo, 1);
  const mk = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const Bars = ({ data }: { data: Map<string, number> }) => data.size === 0 ? <p className="text-muted">Sem recebimentos no mês.</p> : <ul>{[...data].sort((a, b) => b[1] - a[1]).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><b>{brl(v)}</b></li>)}</ul>;

  return (
    <AppShell current="/financeiro" title="Financeiro">
      <Flash sp={searchParams} />
      <Win title={`Resumo — ${ym}`} actions={<><Link className="btn-ghost !min-h-[18px] !py-0 text-black" href={`/financeiro?m=${mk(prev)}`}>◄</Link><Link className="btn-ghost !min-h-[18px] !py-0 text-black" href={`/financeiro?m=${mk(next)}`}>►</Link></>}>
        <Grid>
          <Stat label="Receita (recebido)" value={brl(revenue)} />
          <Stat label="Despesas" value={brl(cost)} />
          <Stat label="Lucro estimado" value={brl(revenue - cost)} tone={revenue - cost > 0 ? "ok" : undefined} />
          <Stat label="Ticket médio" value={brl(paid.length ? revenue / paid.length : 0)} />
          <Stat label="A receber (total)" value={brl(sum(open.filter((p) => !overdue.includes(p))))} />
          <Stat label="Atrasado (total)" value={brl(sum(overdue))} tone={overdue.length ? "danger" : undefined} />
        </Grid>
        <p className="mt-1 text-xs text-muted">Lucro estimado = recebido − despesas lançadas. Não é contabilidade oficial.</p>
        <div className="mt-2 grid gap-3 md:grid-cols-2"><div><h3 className="font-bold">Receita por serviço</h3><Bars data={byCat} /></div><div><h3 className="font-bold">Receita por nicho</h3><Bars data={byNiche} /></div></div>
      </Win>

      <Win title="Recebimentos e cobranças">
        {payments.length === 0 ? <Empty>Nenhum lançamento.</Empty> : (
          <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Vencimento</th><th>Cliente</th><th>Categoria</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>{payments.map((p) => { const late = p.status === "OVERDUE" || (p.status === "PENDING" && p.dueDate < now); return (
              <tr key={p.id}><td className={late ? "font-bold text-danger" : ""}>{dt(p.dueDate)}</td><td>{p.client?.name ?? "—"}<div className="text-xs text-muted">{p.description}</div></td><td>{p.category}</td><td>{brl(p.amount)}</td><td><span className="badge">{late ? "Atrasado" : PAYMENT_STATUS_LABEL[p.status]}</span></td>
                <td><div className="flex flex-wrap gap-1">
                  {(p.status === "PENDING" || p.status === "OVERDUE") && <Form action={payAction} csrf={csrf}><input type="hidden" name="id" value={p.id} /><button className="btn-ghost !min-h-[20px] !py-0">Recebido</button></Form>}
                  {(p.status === "PENDING" || p.status === "OVERDUE") && <Form action={cancelPaymentAction} csrf={csrf}><input type="hidden" name="id" value={p.id} /><ConfirmButton message="Cancelar esta cobrança?" className="btn-ghost !min-h-[20px] !py-0">Cancelar</ConfirmButton></Form>}
                  <Form action={deletePaymentAction} csrf={csrf}><input type="hidden" name="id" value={p.id} /><ConfirmButton message="Excluir este lançamento? A ação fica registrada na auditoria." className="btn-ghost btn-danger !min-h-[20px] !py-0">Excluir</ConfirmButton></Form></div></td></tr>); })}</tbody></table></div>
        )}
        <Form action={addPaymentAction} csrf={csrf} className="mt-3 grid gap-2 sm:grid-cols-4">
          <Field label="Cliente"><select name="clientId" className="input"><option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Projeto"><select name="projectId" className="input"><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Categoria"><select name="category" className="input">{PAYMENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Valor (R$) *"><input name="amount" type="number" step="0.01" min="0.01" required className="input" /></Field>
          <Field label="Vencimento *"><input name="dueDate" type="date" required defaultValue={now.toISOString().slice(0, 10)} className="input" /></Field>
          <Field label="Descrição" className="sm:col-span-2"><input name="description" className="input" /></Field>
          <label className="flex items-end gap-2 pb-1"><input type="checkbox" name="paid" /> Já recebido</label>
          <button className="btn sm:col-span-4">Lançar</button>
        </Form>
      </Win>

      <div className="grid gap-3 lg:grid-cols-2">
        <Win title={`Despesas — ${ym}`}>
          {expenses.length === 0 ? <p className="text-muted">Sem despesas no mês.</p> : <table className="tbl"><tbody>{expenses.map((e) => <tr key={e.id}><td>{dt(e.incurredAt)}</td><td>{e.category}</td><td>{e.description}</td><td>{brl(e.amount)}</td><td><Form action={deleteExpenseAction} csrf={csrf}><input type="hidden" name="id" value={e.id} /><ConfirmButton message="Excluir despesa?" className="btn-ghost !min-h-[20px] !py-0">✕</ConfirmButton></Form></td></tr>)}</tbody></table>}
          <Form action={addExpenseAction} csrf={csrf} className="mt-3 grid grid-cols-2 gap-2">
            <Field label="Categoria"><select name="category" className="input">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Valor (R$) *"><input name="amount" type="number" step="0.01" min="0.01" required className="input" /></Field>
            <Field label="Descrição *"><input name="description" required className="input" /></Field>
            <Field label="Data *"><input name="incurredAt" type="date" required defaultValue={now.toISOString().slice(0, 10)} className="input" /></Field>
            <button className="btn col-span-2">Lançar despesa</button>
          </Form>
        </Win>
        <Win title="Cobranças recorrentes (manutenção/hospedagem)">
          {subs.length === 0 ? <p className="text-muted">Nenhuma. Crie na página do cliente.</p> : <ul>{subs.map((s) => <li key={s.id} className="flex items-center gap-2"><span>{s.client.name} — {s.name}: {brl(s.amount)} (dia {s.dayOfMonth}) {!s.active && <span className="badge">encerrada</span>}</span>
            <Form action={toggleSubscriptionAction} csrf={csrf} className="ml-auto"><input type="hidden" name="id" value={s.id} /><button className="btn-ghost !min-h-[20px] !py-0">{s.active ? "Encerrar" : "Reativar"}</button></Form></li>)}</ul>}
          <p className="mt-2 text-xs text-muted">As parcelas do mês são geradas automaticamente pela rotina diária (ou em Automações → Executar rotinas agora).</p>
        </Win>
      </div>
    </AppShell>
  );
}
