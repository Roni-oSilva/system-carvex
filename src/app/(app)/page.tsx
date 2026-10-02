import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { NAV } from "@/components/nav";
import { Grid, Group, Stat, Win } from "@/components/ui";
import { db } from "@/lib/db";
import { brl, dtt } from "@/lib/format";
import { getDashboard } from "@/server/dashboard";

export default async function DashboardPage() {
  const [d, alerts, followups] = await Promise.all([
    getDashboard(),
    db.notification.findMany({ where: { readAt: null }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.lead.findMany({ where: { deletedAt: null, followUpAt: { lte: new Date(Date.now() + 2 * 86400_000) }, status: { notIn: ["WON", "LOST", "DISCARDED"] } }, orderBy: { followUpAt: "asc" }, take: 6 }),
  ]);
  const max = Math.max(...d.months.map((m) => m.total), 1);
  const empty = d.months.every((m) => m.total === 0) && d.sales.leads === 0;

  return (
    <AppShell current="/" title="Área de trabalho">
      <div className="flex flex-wrap gap-2">
        {NAV.filter((n) => n.href !== "/").map((n) => (
          <Link key={n.href} href={n.href} className="flex w-[88px] flex-col items-center gap-1 p-2 text-center text-black no-underline hover:bg-[#000080] hover:text-white">
            <n.icon size={30} strokeWidth={1.5} /><span className="text-xs">{n.label}</span>
          </Link>
        ))}
      </div>

      {empty && <p className="msg msg-ok">Nenhum dado ainda. Comece em <Link href="/prospeccao">Prospecção</Link> ou cadastre um lead em <Link href="/crm">CRM</Link>. Os números abaixo vêm do banco de dados — nada é fictício.</p>}

      <div className="grid gap-3 md:grid-cols-2">
        <Win title="Alertas">
          {alerts.length === 0 ? <p className="text-muted">Nenhum alerta pendente.</p> : <ul>{alerts.map((a) => <li key={a.id}>{a.href ? <Link href={a.href}>{a.title}</Link> : a.title} <span className="text-xs text-muted">{dtt(a.createdAt)}</span></li>)}</ul>}
        </Win>
        <Win title="Agenda de follow-ups">
          {followups.length === 0 ? <p className="text-muted">Nenhum follow-up para os próximos 2 dias.</p> : <ul>{followups.map((l) => <li key={l.id}><Link href={`/crm/${l.id}`}>{l.name}</Link> <span className="text-xs text-muted">{l.followUpAt?.toLocaleDateString("pt-BR")} · {l.nextAction ?? "follow-up"}</span></li>)}</ul>}
        </Win>
      </div>

      <Win title="Financeiro">
        <Grid>
          <Stat label="Recebido hoje" value={brl(d.finance.day)} />
          <Stat label="Recebido na semana" value={brl(d.finance.week)} />
          <Stat label="Recebido no mês" value={brl(d.finance.month)} />
          <Stat label="Recebido no ano" value={brl(d.finance.year)} />
          <Stat label="A receber" value={brl(d.finance.receivable)} />
          <Stat label="Atrasado" value={brl(d.finance.overdue)} tone={d.finance.overdue > 0 ? "danger" : undefined} />
          <Stat label="Custos do mês" value={brl(d.finance.expenses)} />
          <Stat label="Lucro estimado (mês)" value={brl(d.finance.profit)} tone={d.finance.profit > 0 ? "ok" : undefined} />
        </Grid>
        <p className="mt-2 text-xs text-muted">Lucro estimado = recebido − custos lançados (não é contabilidade oficial). Ticket médio no ano: {brl(d.finance.ticket)}.</p>
        <Group title="Receita — últimos 6 meses">
          <div className="sunken flex h-32 items-end gap-3 p-2">
            {d.months.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full bg-[#000080]" style={{ height: `${(m.total / max) * 100}%`, minHeight: m.total ? 4 : 1 }} title={brl(m.total)} />
                <span className="text-xs">{m.label}</span>
              </div>
            ))}
          </div>
        </Group>
      </Win>

      <Win title="Comercial">
        <Grid>
          <Stat label="Leads" value={d.sales.leads} />
          <Stat label="Qualificados" value={d.sales.qualified} />
          <Stat label="Contatos realizados" value={d.sales.contacted} />
          <Stat label="Mensagens preparadas" value={d.sales.prepared} />
          <Stat label="Mensagens enviadas" value={d.sales.sent} />
          <Stat label="Respostas" value={d.sales.replied} />
          <Stat label="Interessados" value={d.sales.interested} />
          <Stat label="Reuniões" value={d.sales.meetings} />
          <Stat label="Propostas" value={d.sales.proposals} />
          <Stat label="Negociações" value={d.sales.negotiation} />
          <Stat label="Vendas fechadas" value={d.sales.won} />
          <Stat label="Conversão" value={`${d.sales.conversion.toFixed(1)}%`} />
        </Grid>
      </Win>

      <Win title="Operacional">
        <Grid>
          <Stat label="Em andamento" value={d.ops.inProgress} />
          <Stat label="Aguardando cliente" value={d.ops.waiting} />
          <Stat label="Prazo em 7 dias" value={d.ops.soon} />
          <Stat label="Atrasados" value={d.ops.late} tone={d.ops.late > 0 ? "danger" : undefined} />
          <Stat label="Concluídos" value={d.ops.done} />
          <Stat label="Manutenções ativas" value={d.ops.maintenance} />
        </Grid>
      </Win>
    </AppShell>
  );
}
