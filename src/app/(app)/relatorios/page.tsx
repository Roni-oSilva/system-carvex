import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { PrintButton } from "@/components/confirm-button";
import { Grid, one, Stat, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { brl, LEAD_STATUS_LABEL, PROJECT_STATUS_LABEL } from "@/lib/format";
import { ctx } from "@/server/guard";

export default async function ReportsPage({ searchParams }: { searchParams: SP }) {
  await ctx();
  const q = await searchParams;
  const now = new Date();
  const from = one(q.from) ? new Date(`${one(q.from)}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = one(q.to) ? new Date(`${one(q.to)}T23:59:59`) : now;
  const niche = one(q.niche), city = one(q.city)?.trim(), service = one(q.service), status = one(q.status);
  const range = { gte: from, lte: to };

  const leadWhere: Prisma.LeadWhereInput = { deletedAt: null, createdAt: range, ...(niche ? { nicheId: niche } : {}), ...(city ? { city: { contains: city, mode: "insensitive" } } : {}), ...(status && status in LEAD_STATUS_LABEL ? { status: status as never } : {}) };
  const [niches, services, leads, msgs, paid, expenses, overdue, projects, proposals] = await Promise.all([
    db.niche.findMany({ orderBy: { name: "asc" } }),
    db.service.findMany({ orderBy: { name: "asc" } }),
    db.lead.findMany({ where: leadWhere, include: { niche: true } }),
    db.message.findMany({ where: { createdAt: range, lead: niche || city ? { ...(niche ? { nicheId: niche } : {}), ...(city ? { city: { contains: city, mode: "insensitive" } } : {}) } : undefined } }),
    db.payment.findMany({ where: { status: "PAID", deletedAt: null, paidAt: range, ...(service ? { category: service } : {}) }, include: { client: true } }),
    db.expense.findMany({ where: { deletedAt: null, incurredAt: range } }),
    db.payment.findMany({ where: { status: { in: ["PENDING", "OVERDUE"] }, deletedAt: null, dueDate: { lt: now } } }),
    db.project.findMany({ where: { deletedAt: null, createdAt: range, ...(service ? { category: service } : {}) } }),
    db.proposal.findMany({ where: { deletedAt: null, createdAt: range } }),
  ]);
  const n = (f: (l: (typeof leads)[number]) => boolean) => leads.filter(f).length;
  const contacted = n((l) => ["CONTACTED", "REPLIED", "INTERESTED", "MEETING", "PROPOSAL", "NEGOTIATION", "WON"].includes(l.status));
  const replied = n((l) => ["REPLIED", "INTERESTED", "MEETING", "PROPOSAL", "NEGOTIATION", "WON"].includes(l.status));
  const won = n((l) => l.status === "WON");
  const revenue = paid.reduce((a, p) => a + Number(p.amount), 0), cost = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const group = <T,>(items: T[], key: (i: T) => string) => { const m = new Map<string, number>(); for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
  const byNiche = group(leads, (l) => l.niche?.name ?? "Sem nicho");
  const byCity = group(leads, (l) => l.city ?? "Sem cidade");
  const opps = group(leads.filter((l) => l.opportunity), (l) => l.opportunity!);
  const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");
  const List = ({ data }: { data: [string, number][] }) => data.length === 0 ? <p className="text-muted">Sem dados no período.</p> : <ul>{data.slice(0, 10).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><b>{v}</b></li>)}</ul>;
  const accepted = proposals.filter((p) => p.status === "ACCEPTED");

  return (
    <AppShell current="/relatorios" title="Relatórios">
      <Win title="Filtros" actions={<PrintButton />}>
        <form action="/relatorios" className="grid gap-2 sm:grid-cols-7 no-print">
          <input type="date" name="from" defaultValue={from.toISOString().slice(0, 10)} className="input" aria-label="De" />
          <input type="date" name="to" defaultValue={to.toISOString().slice(0, 10)} className="input" aria-label="Até" />
          <select name="niche" defaultValue={niche ?? ""} className="input" aria-label="Nicho"><option value="">Todos os nichos</option>{niches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <input name="city" defaultValue={city} placeholder="Cidade" className="input" aria-label="Cidade" />
          <select name="service" defaultValue={service ?? ""} className="input" aria-label="Serviço"><option value="">Todos os serviços</option>{services.map((x) => <option key={x.id}>{x.name}</option>)}</select>
          <select name="status" defaultValue={status ?? ""} className="input" aria-label="Status"><option value="">Todos os status</option>{Object.entries(LEAD_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <button className="btn">Aplicar</button>
        </form>
        <p className="mt-1 text-xs text-muted">Período: {from.toLocaleDateString("pt-BR")} a {to.toLocaleDateString("pt-BR")}. O filtro de serviço usa a categoria do pagamento/projeto.</p>
      </Win>
      <Win title="Comercial">
        <Grid><Stat label="Leads" value={leads.length} /><Stat label="Contatos" value={contacted} /><Stat label="Respostas" value={`${replied} (${pct(replied, contacted)})`} /><Stat label="Vendas" value={won} /><Stat label="Conversão" value={pct(won, leads.length)} /><Stat label="Mensagens enviadas" value={msgs.filter((m) => m.status === "SENT").length} /><Stat label="Propostas aceitas" value={accepted.length} /><Stat label="Ticket médio" value={brl(accepted.length ? accepted.reduce((a, p) => a + Number(p.total), 0) / accepted.length : 0)} /></Grid>
      </Win>
      <Win title="Financeiro">
        <Grid cols={4}><Stat label="Receita" value={brl(revenue)} /><Stat label="Custos" value={brl(cost)} /><Stat label="Lucro estimado" value={brl(revenue - cost)} /><Stat label="Inadimplência (atual)" value={brl(overdue.reduce((a, p) => a + Number(p.amount), 0))} tone={overdue.length ? "danger" : undefined} /></Grid>
      </Win>
      <Win title="Operacional">
        <Grid cols={4}><Stat label="Projetos criados" value={projects.length} />{Object.entries(PROJECT_STATUS_LABEL).slice(0, 3).map(([k, v]) => <Stat key={k} label={v} value={projects.filter((p) => p.status === k).length} />)}<Stat label="Concluídos" value={projects.filter((p) => p.status === "DONE").length} /><Stat label="Atrasados" value={projects.filter((p) => p.dueDate && p.dueDate < now && !["DONE", "CANCELED"].includes(p.status)).length} /><Stat label="Manutenções" value={projects.filter((p) => p.maintenance).length} /></Grid>
      </Win>
      <Win title="Prospecção">
        <div className="grid gap-3 md:grid-cols-3"><div><h3 className="font-bold">Leads por nicho</h3><List data={byNiche} /></div><div><h3 className="font-bold">Leads por cidade</h3><List data={byCity} /></div><div><h3 className="font-bold">Oportunidades</h3><List data={opps} /></div></div>
      </Win>
    </AppShell>
  );
}
