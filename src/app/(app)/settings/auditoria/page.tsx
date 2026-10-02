import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SettingsTabs } from "@/components/settings-tabs";
import { one, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { dtt } from "@/lib/format";
import { ctx } from "@/server/guard";

export default async function AuditPage({ searchParams }: { searchParams: SP }) {
  await ctx();
  const q = await searchParams;
  const cat = one(q.cat), page = Math.max(1, Number(one(q.page)) || 1);
  const where = cat ? { category: cat } : {};
  const [logs, total] = await Promise.all([db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, skip: (page - 1) * 50, include: { user: { select: { email: true } } } }), db.auditLog.count({ where })]);
  return (
    <AppShell current="/settings/auditoria" title="Configurações → Auditoria">
      <SettingsTabs current="auditoria" />
      <Win title={`Trilha de auditoria (${total})`}>
        <div className="mb-2 flex gap-1">{[["", "Todos"], ["security", "Segurança"], ["finance", "Financeiro"], ["general", "Geral"]].map(([k, l]) => <Link key={k} className="btn-ghost" href={`/settings/auditoria${k ? `?cat=${k}` : ""}`}>{l}</Link>)}</div>
        <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Resultado</th><th>IP</th><th>Entidade</th></tr></thead>
          <tbody>{logs.map((l) => <tr key={l.id}><td>{dtt(l.createdAt)}</td><td>{l.user?.email ?? "—"}</td><td>{l.action}</td><td>{l.result}</td><td>{l.ip ?? "—"}</td><td className="text-xs">{l.entity} {l.entityId?.slice(0, 8)}</td></tr>)}</tbody></table></div>
        <div className="mt-2 flex gap-2">{page > 1 && <Link className="btn-ghost" href={`/settings/auditoria?page=${page - 1}${cat ? `&cat=${cat}` : ""}`}>← Anterior</Link>}{page * 50 < total && <Link className="btn-ghost" href={`/settings/auditoria?page=${page + 1}${cat ? `&cat=${cat}` : ""}`}>Próxima →</Link>}</div>
      </Win>
    </AppShell>
  );
}
