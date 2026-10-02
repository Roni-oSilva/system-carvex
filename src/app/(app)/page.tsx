import { AppShell } from "@/components/app-shell";
import { getDashboard } from "@/server/dashboard";
import { requireUser } from "@/server/session";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "danger" | "ok" }) {
  return (
    <div className="card">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "danger" ? "text-danger" : tone === "ok" ? "text-ok" : ""}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={title} className="space-y-3">
      <h2 id={title} className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
    </section>
  );
}

export default async function DashboardPage() {
  const session = await requireUser();
  const d = await getDashboard();
  const max = Math.max(...d.months.map((m) => m.total), 1);
  const empty = d.months.every((m) => m.total === 0) && d.sales.leads === 0;

  return (
    <AppShell current="/" title="Dashboard" userName={session.user.name}>
      {empty && (
        <div className="card border-dashed text-sm text-muted">
          <p className="font-medium text-fg">Nenhum dado ainda.</p>
          <p>Os indicadores abaixo são calculados a partir do banco de dados e aparecerão conforme os módulos de CRM, Prospecção, Projetos e Financeiro forem alimentados. Nada aqui é fictício.</p>
        </div>
      )}

      <Section title="Financeiro">
        <Stat label="Recebido hoje" value={brl(d.finance.day)} />
        <Stat label="Recebido na semana" value={brl(d.finance.week)} />
        <Stat label="Recebido no mês" value={brl(d.finance.month)} />
        <Stat label="Recebido no ano" value={brl(d.finance.year)} />
        <Stat label="A receber" value={brl(d.finance.receivable)} />
        <Stat label="Atrasado" value={brl(d.finance.overdue)} tone={d.finance.overdue > 0 ? "danger" : undefined} />
        <Stat label="Custos do mês" value={brl(d.finance.expenses)} />
        <Stat label="Lucro estimado (mês)" value={brl(d.finance.profit)} tone={d.finance.profit > 0 ? "ok" : undefined} />
      </Section>
      <p className="-mt-3 text-xs text-muted">Lucro estimado = recebido − custos lançados. Não é contabilidade oficial. Ticket médio no ano: {brl(d.finance.ticket)}.</p>

      <section className="card" aria-label="Receita dos últimos 6 meses">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Receita — últimos 6 meses</h2>
        <div className="flex h-36 items-end gap-3">
          {d.months.map((m) => (
            <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t bg-brand/80" style={{ height: `${(m.total / max) * 100}%`, minHeight: m.total ? 4 : 1 }} title={brl(m.total)} />
              <span className="text-xs text-muted">{m.label}</span>
            </div>
          ))}
        </div>
      </section>

      <Section title="Comercial">
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
      </Section>

      <Section title="Operacional">
        <Stat label="Em andamento" value={d.ops.inProgress} />
        <Stat label="Aguardando cliente" value={d.ops.waiting} />
        <Stat label="Prazo em 7 dias" value={d.ops.soon} />
        <Stat label="Atrasados" value={d.ops.late} tone={d.ops.late > 0 ? "danger" : undefined} />
        <Stat label="Concluídos" value={d.ops.done} />
        <Stat label="Manutenções ativas" value={d.ops.maintenance} />
      </Section>
    </AppShell>
  );
}
