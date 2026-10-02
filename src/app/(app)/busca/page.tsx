import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Empty, one, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { brl } from "@/lib/format";
import { ctx } from "@/server/guard";

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  await ctx();
  const q = (one((await searchParams).q) ?? "").trim().slice(0, 80);
  const digits = q.replace(/\D/g, "");
  const ci = (v: string) => ({ contains: v, mode: "insensitive" as const });
  const [leads, clients, projects, proposals, services] = q.length < 2 ? [[], [], [], [], []] as never[][] : await Promise.all([
    db.lead.findMany({ where: { deletedAt: null, OR: [{ name: ci(q) }, { tradeName: ci(q) }, { email: ci(q) }, { website: ci(q) }, ...(digits.length >= 4 ? [{ phoneNorm: { contains: digits } }] : [])] }, take: 10 }),
    db.client.findMany({ where: { deletedAt: null, OR: [{ name: ci(q) }, { email: ci(q) }, { contactName: ci(q) }, ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : [])] }, take: 10 }),
    db.project.findMany({ where: { deletedAt: null, OR: [{ name: ci(q) }, { domain: ci(q) }, { url: ci(q) }] }, take: 10 }),
    db.proposal.findMany({ where: { deletedAt: null, OR: [{ id: { startsWith: q } }, { client: { name: ci(q) } }] }, include: { client: true }, take: 10 }),
    db.service.findMany({ where: { name: ci(q) }, take: 10 }),
  ]);
  const total = leads.length + clients.length + projects.length + proposals.length + services.length;
  return (
    <AppShell current="/busca" title={`Busca: ${q}`}>
      {q.length < 2 ? <Empty>Digite ao menos 2 caracteres.</Empty> : total === 0 ? <Empty>Nada encontrado para “{q}”.</Empty> : (
        <>
          <Win title={`Leads (${leads.length})`}><ul>{leads.map((l: { id: string; name: string; city: string | null }) => <li key={l.id}><Link href={`/crm/${l.id}`}>{l.name}</Link> <span className="text-xs text-muted">{l.city}</span></li>)}</ul></Win>
          <Win title={`Clientes (${clients.length})`}><ul>{clients.map((c: { id: string; name: string }) => <li key={c.id}><Link href={`/clientes/${c.id}`}>{c.name}</Link></li>)}</ul></Win>
          <Win title={`Projetos (${projects.length})`}><ul>{projects.map((p: { id: string; name: string }) => <li key={p.id}><Link href={`/projetos/${p.id}`}>{p.name}</Link></li>)}</ul></Win>
          <Win title={`Propostas (${proposals.length})`}><ul>{proposals.map((p: { id: string; total: unknown; client: { name: string } }) => <li key={p.id}><Link href={`/vendas/propostas/${p.id}`}>{p.client.name} — {brl(p.total as number)}</Link></li>)}</ul></Win>
          <Win title={`Serviços (${services.length})`}><ul>{services.map((s: { id: string; name: string }) => <li key={s.id}><Link href={`/vendas/servicos/${s.id}`}>{s.name}</Link></li>)}</ul></Win>
        </>
      )}
    </AppShell>
  );
}
