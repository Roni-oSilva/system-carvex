import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { IconTile } from "@/components/app-shell";
import { Mascot } from "@/components/mascot";
import { NAV } from "@/components/nav";
import { Grid, Group, Stat, Win } from "@/components/ui";
import { db } from "@/lib/db";
import { brl, dtt } from "@/lib/format";
import { getDashboard } from "@/server/dashboard";
import { ctx } from "@/server/guard";

export default async function DashboardPage() {
  const { s: session } = await ctx();
  const [d, alerts, followups] = await Promise.all([
    getDashboard(),
    db.notification.findMany({ where: { readAt: null }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.lead.findMany({ where: { deletedAt: null, followUpAt: { lte: new Date(Date.now() + 2 * 86400_000) }, status: { notIn: ["WON", "LOST", "DISCARDED"] } }, orderBy: { followUpAt: "asc" }, take: 6 }),
  ]);
  const max = Math.max(...d.months.map((m) => m.total), 1);
  const empty = d.months.every((m) => m.total === 0) && d.sales.leads === 0;

  return (
    <AppShell current="/" title="Painel">
      <section className="win">
        <div className="win-body relative grid items-center gap-4 overflow-hidden !p-6 sm:grid-cols-[1fr_auto]" style={{ background: "linear-gradient(135deg,#eaf0ff,#fff)" }}>
          <div>
            <p className="badge">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
            <h2 className="hero-title mt-2 text-4xl text-[#2f5bff] sm:text-6xl">Bora vender,<br />{session.user.name.split(" ")[0]}!</h2>
            <p className="mt-3 max-w-md font-semibold text-muted">{d.sales.leads} lead(s) no funil · {followups.length} follow-up(s) para os próximos 2 dias · {alerts.length} alerta(s) pendente(s).</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/prospeccao" className="btn">Prospectar</Link>
              <Link href="/crm/novo" className="btn-ghost">Novo lead</Link>
              <Link href="/vendas/propostas/nova" className="btn-ghost">Nova proposta</Link>
            </div>
          </div>
          <div className="relative mx-auto grid place-items-center">
            <span className="absolute h-44 w-44 rounded-full bg-[#2f5bff]" />
            <span className="float absolute -right-2 top-0 h-10 w-10 rounded-full border-[3px] border-[#0e1240] bg-[#ffd23f]" />
            <span className="float absolute -left-3 bottom-4 h-8 w-8 rotate-12 rounded-lg border-[3px] border-[#0e1240] bg-[#8a5cf6]" style={{ animationDelay: "-2s" }} />
            <Mascot size={170} wave className="relative drop-shadow-[0_6px_0_rgba(14,18,64,.25)]" />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {NAV.filter((n) => n.href !== "/").map((n) => (
          <Link key={n.href} href={n.href} className="win !rounded-2xl flex flex-col items-center gap-2 p-3 text-center text-[#0e1240] no-underline transition hover:-translate-y-1">
            <IconTile item={n} size={44} /><span className="font-extrabold">{n.label}</span>
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
                <div className="w-full bg-[#2f5bff]" style={{ height: `${(m.total / max) * 100}%`, minHeight: m.total ? 4 : 1 }} title={brl(m.total)} />
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
