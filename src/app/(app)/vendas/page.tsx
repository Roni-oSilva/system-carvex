import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Empty, Field, Flash, Form, Grid, Stat, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { brl, dt, PROPOSAL_STATUS_LABEL } from "@/lib/format";
import { ctx } from "@/server/guard";
import { saveServiceAction } from "@/server/sales-actions";

export default async function SalesPage({ searchParams }: { searchParams: SP }) {
  const { csrf } = await ctx();
  const [services, proposals, leadTotal, contacted, replied, proposalLeads, won] = await Promise.all([
    db.service.findMany({ orderBy: { name: "asc" } }),
    db.proposal.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 30, include: { client: true } }),
    db.lead.count({ where: { deletedAt: null } }),
    db.lead.count({ where: { deletedAt: null, status: { in: ["CONTACTED", "REPLIED", "INTERESTED", "MEETING", "PROPOSAL", "NEGOTIATION", "WON"] } } }),
    db.lead.count({ where: { deletedAt: null, status: { in: ["REPLIED", "INTERESTED", "MEETING", "PROPOSAL", "NEGOTIATION", "WON"] } } }),
    db.lead.count({ where: { deletedAt: null, status: { in: ["PROPOSAL", "NEGOTIATION", "WON"] } } }),
    db.lead.count({ where: { deletedAt: null, status: "WON" } }),
  ]);
  const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}%` : "—");
  const accepted = proposals.filter((p) => p.status === "ACCEPTED");
  return (
    <AppShell current="/vendas" title="Vendas">
      <Flash sp={searchParams} />
      <Win title="Funil e conversão">
        <Grid cols={4}>
          <Stat label="Leads" value={leadTotal} />
          <Stat label="Contatados" value={`${contacted} (${pct(contacted, leadTotal)})`} />
          <Stat label="Responderam" value={`${replied} (${pct(replied, contacted)})`} />
          <Stat label="Proposta+" value={`${proposalLeads} (${pct(proposalLeads, replied)})`} />
          <Stat label="Vendas" value={`${won} (${pct(won, leadTotal)})`} />
          <Stat label="Propostas aceitas" value={accepted.length} />
          <Stat label="Valor aceito (últimas 30)" value={brl(accepted.reduce((a, p) => a + Number(p.total), 0))} />
        </Grid>
      </Win>
      <div className="grid gap-3 lg:grid-cols-2">
        <Win title="Catálogo de serviços">
          {services.length === 0 ? <Empty>Nenhum serviço. Cadastre abaixo (ex.: Landing Page, Cardápio digital…).</Empty> : (
            <table className="tbl"><thead><tr><th>Serviço</th><th>Preço</th><th>Custo</th><th>Margem</th><th>Prazo</th></tr></thead>
              <tbody>{services.map((s) => { const m = Number(s.price) - Number(s.cost); return <tr key={s.id}><td><Link href={`/vendas/servicos/${s.id}`}>{s.name}</Link> {!s.active && <span className="badge">inativo</span>}</td><td>{brl(s.price)}</td><td>{brl(s.cost)}</td><td>{brl(m)}{Number(s.price) ? ` (${((m / Number(s.price)) * 100).toFixed(0)}%)` : ""}</td><td>{s.deadlineDays ? `${s.deadlineDays} d` : "—"}</td></tr>; })}</tbody></table>
          )}
          <Form action={saveServiceAction} csrf={csrf} className="mt-3 grid grid-cols-2 gap-2">
            <Field label="Nome *"><input name="name" required className="input" /></Field>
            <Field label="Preço (R$) *"><input name="price" type="number" step="0.01" min="0" required className="input" /></Field>
            <Field label="Custo (R$)"><input name="cost" type="number" step="0.01" min="0" defaultValue={0} className="input" /></Field>
            <Field label="Prazo (dias)"><input name="deadlineDays" type="number" min={1} className="input" /></Field>
            <Field label="Descrição" className="col-span-2"><input name="description" className="input" /></Field>
            <Field label="Recursos (um por linha)" className="col-span-2"><textarea name="features" className="input" /></Field>
            <button className="btn col-span-2">Cadastrar serviço</button>
          </Form>
        </Win>
        <Win title="Propostas" actions={<Link href="/vendas/propostas/nova" className="btn-ghost !min-h-[18px] !py-0 text-black">Nova proposta</Link>}>
          {proposals.length === 0 ? <Empty>Nenhuma proposta ainda.</Empty> : (
            <table className="tbl"><thead><tr><th>Cliente</th><th>Total</th><th>Status</th><th>Validade</th></tr></thead>
              <tbody>{proposals.map((p) => <tr key={p.id}><td><Link href={`/vendas/propostas/${p.id}`}>{p.client.name}</Link></td><td>{brl(p.total)}</td><td><span className="badge">{PROPOSAL_STATUS_LABEL[p.status]}</span></td><td>{dt(p.validUntil)}</td></tr>)}</tbody></table>
          )}
        </Win>
      </div>
    </AppShell>
  );
}
