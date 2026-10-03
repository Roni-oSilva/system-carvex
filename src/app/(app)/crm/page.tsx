import Link from "next/link";
import type { LeadStatus, Prisma } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { KanbanBoard } from "@/components/kanban-board";
import { Empty, Flash, Form, one, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { dt, LEAD_STATUS_LABEL, PIPELINE } from "@/lib/format";
import { moveLeadAction } from "@/server/crm-actions";
import { ctx } from "@/server/guard";

export default async function CrmPage({ searchParams }: { searchParams: SP }) {
  const { csrf } = await ctx();
  const q = await searchParams;
  const view = one(q.view) === "list" ? "list" : "kanban";
  const text = one(q.q)?.trim(), status = one(q.status), niche = one(q.niche), city = one(q.city)?.trim(), tag = one(q.tag);
  const page = Math.max(1, Number(one(q.page)) || 1);

  const where: Prisma.LeadWhereInput = {
    deletedAt: null,
    ...(status && status in LEAD_STATUS_LABEL ? { status: status as LeadStatus } : {}),
    ...(niche ? { nicheId: niche } : {}),
    ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
    ...(tag ? { tags: { some: { name: tag } } } : {}),
    ...(text ? { OR: [{ name: { contains: text, mode: "insensitive" } }, { tradeName: { contains: text, mode: "insensitive" } }, { phoneNorm: { contains: text.replace(/\D/g, "") || "§" } }, { email: { contains: text, mode: "insensitive" } }, { website: { contains: text, mode: "insensitive" } }] } : {}),
  };
  const [niches, tags, total, leads] = await Promise.all([
    db.niche.findMany({ orderBy: { name: "asc" } }),
    db.tag.findMany({ orderBy: { name: "asc" } }),
    db.lead.count({ where }),
    db.lead.findMany({ where, include: { niche: true, tags: true }, orderBy: [{ score: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }], take: view === "list" ? 50 : 300, skip: view === "list" ? (page - 1) * 50 : 0 }),
  ]);
  const keep = new URLSearchParams(Object.entries(q).flatMap(([k, v]) => (typeof v === "string" && k !== "page" ? [[k, v]] : [])));
  const href = (extra: Record<string, string>) => { const p = new URLSearchParams(keep); for (const [k, v] of Object.entries(extra)) p.set(k, v); return `/crm?${p}`; };

  const MoveForm = ({ id, current }: { id: string; current: string }) => (
    <Form action={moveLeadAction} csrf={csrf} back={href({})} className="mt-1 flex gap-1">
      <input type="hidden" name="id" value={id} />
      <select name="status" defaultValue={current} aria-label="Mover para" className="input !min-h-[20px] !py-0 text-xs">{[...PIPELINE, "DISCARDED"].map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}</select>
      <button className="btn-ghost !min-h-[20px] !px-2 !py-0 text-xs">Mover</button>
    </Form>
  );

  return (
    <AppShell current="/crm" title="CRM">
      <Flash sp={searchParams} />
      <Win title={`Leads (${total})`} actions={<Link href="/crm/novo" className="btn-ghost !min-h-[18px] !py-0 text-black">Novo lead</Link>}>
        <form className="mb-3 grid gap-2 sm:grid-cols-6" action="/crm">
          <input type="hidden" name="view" value={view} />
          <input name="q" defaultValue={text} placeholder="Buscar nome, telefone, e-mail, site" className="input sm:col-span-2" aria-label="Buscar" />
          <select name="status" defaultValue={status ?? ""} className="input" aria-label="Status"><option value="">Todos os status</option>{Object.entries(LEAD_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select name="niche" defaultValue={niche ?? ""} className="input" aria-label="Nicho"><option value="">Todos os nichos</option>{niches.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select>
          <input name="city" defaultValue={city} placeholder="Cidade" className="input" aria-label="Cidade" />
          <select name="tag" defaultValue={tag ?? ""} className="input" aria-label="Tag"><option value="">Todas as tags</option>{tags.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}</select>
          <button className="btn">Filtrar</button>
          <div className="flex gap-1 sm:col-span-5 sm:justify-end">
            <Link className={`btn-ghost ${view === "kanban" ? "!font-bold" : ""}`} href={href({ view: "kanban" })}>Kanban</Link>
            <Link className={`btn-ghost ${view === "list" ? "!font-bold" : ""}`} href={href({ view: "list" })}>Lista</Link>
          </div>
        </form>

        {total === 0 ? <Empty>Nenhum lead encontrado. Use <Link href="/prospeccao">Prospecção</Link> ou <Link href="/crm/novo">cadastre um lead</Link>.</Empty> : view === "kanban" ? (
          <KanbanBoard
            csrf={csrf}
            back={href({})}
            statuses={[...PIPELINE, "DISCARDED"].map((v) => ({ value: v, label: LEAD_STATUS_LABEL[v]! }))}
            cols={PIPELINE.map((st) => ({
              status: st, label: LEAD_STATUS_LABEL[st]!,
              cards: leads.filter((l) => l.status === st).map((l) => ({ id: l.id, name: l.name, sub: [l.niche?.name, l.city].filter(Boolean).join(" · ") || "nicho/cidade não informados", opportunity: l.opportunity, score: l.score, followUp: l.followUpAt ? dt(l.followUpAt) : null })),
            }))}
          />
        ) : (
          <>
            <div className="overflow-x-auto"><table className="tbl">
              <thead><tr><th>Empresa</th><th>Nicho</th><th>Cidade</th><th>Score</th><th>Oportunidade</th><th>Próxima ação</th><th>Status</th></tr></thead>
              <tbody>{leads.map((l) => (
                <tr key={l.id}>
                  <td><Link href={`/crm/${l.id}`}>{l.name}</Link><div className="text-xs text-muted">{l.tags.map((t) => t.name).join(", ")}</div></td>
                  <td>{l.niche?.name ?? "—"}</td><td>{l.city ?? "—"}</td><td>{l.score ?? "—"}</td><td>{l.opportunity ?? "—"}</td>
                  <td>{l.nextAction ?? "—"} {l.followUpAt && <span className="badge">{dt(l.followUpAt)}</span>}</td>
                  <td><MoveForm id={l.id} current={l.status} /></td>
                </tr>
              ))}</tbody>
            </table></div>
            <div className="mt-2 flex gap-2">
              {page > 1 && <Link className="btn-ghost" href={href({ page: String(page - 1) })}>← Anterior</Link>}
              {page * 50 < total && <Link className="btn-ghost" href={href({ page: String(page + 1) })}>Próxima →</Link>}
            </div>
          </>
        )}
        <p className="mt-2 text-xs text-muted">Score é só uma ferramenta interna de priorização, não uma verdade absoluta.</p>
      </Win>
    </AppShell>
  );
}
