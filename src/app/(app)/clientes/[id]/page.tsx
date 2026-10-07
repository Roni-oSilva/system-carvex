import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, Flash, Form, Group, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { brl, dt, dtt, PAYMENT_STATUS_LABEL, PROJECT_STATUS_LABEL, PROPOSAL_STATUS_LABEL } from "@/lib/format";
import { addInteractionAction } from "@/server/crm-actions";
import { addSubscriptionAction, deleteClientAction, deleteDocumentAction, updateClientAction, uploadDocumentAction } from "@/server/clients-actions";
import { ctx } from "@/server/guard";

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const { csrf } = await ctx();
  const c = await db.client.findFirst({
    where: { id, deletedAt: null },
    include: {
      lead: true, proposals: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } }, projects: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      payments: { where: { deletedAt: null }, orderBy: { dueDate: "desc" }, take: 20 }, subscriptions: { orderBy: { startedAt: "desc" } },
      interactions: { orderBy: { createdAt: "desc" }, take: 40 }, documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!c) notFound();
  const niches = await db.niche.findMany({ orderBy: { name: "asc" } });
  const paid = c.payments.filter((p) => p.status === "PAID").reduce((a, p) => a + Number(p.amount), 0);
  const open = c.payments.filter((p) => p.status === "PENDING" || p.status === "OVERDUE").reduce((a, p) => a + Number(p.amount), 0);

  return (
    <AppShell current="/clientes" title={`Cliente → ${c.name}`}>
      <Flash sp={searchParams} />
      <Win title={c.name}>
        <div className="flex flex-wrap gap-2">
          <Link className="btn" href={`/vendas/propostas/nova?client=${c.id}`}>Nova proposta</Link>
          <Link className="btn" href={`/projetos?novo=${c.id}`}>Novo projeto</Link>
          {c.lead && <Link className="btn-ghost" href={`/crm/${c.lead.id}`}>Ver lead de origem</Link>}
          {c.whatsapp && <a className="btn-ghost" target="_blank" rel="noopener noreferrer" href={`https://wa.me/55${c.whatsapp.replace(/\D/g, "")}`}>WhatsApp</a>}
        </div>
        <p className="mt-2">Recebido: <b>{brl(paid)}</b> · Em aberto: <b>{brl(open)}</b></p>
        <Form action={updateClientAction} csrf={csrf} className="mt-3 space-y-2">
          <input type="hidden" name="id" value={c.id} />
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Nome / empresa"><input name="name" required defaultValue={c.name} className="input" /></Field>
            <Field label="Responsável"><input name="contactName" defaultValue={c.contactName ?? ""} className="input" /></Field>
            <Field label="Telefone"><input name="phone" defaultValue={c.phone ?? ""} className="input" /></Field>
            <Field label="WhatsApp"><input name="whatsapp" defaultValue={c.whatsapp ?? ""} className="input" /></Field>
            <Field label="E-mail"><input name="email" type="email" defaultValue={c.email ?? ""} className="input" /></Field>
            <Field label="Cidade"><input name="city" defaultValue={c.city ?? ""} className="input" /></Field>
            <Field label="Nicho"><select name="nicheId" defaultValue={c.nicheId ?? ""} className="input"><option value="">—</option>{niches.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></Field>
            <Field label="Observações" className="sm:col-span-3"><textarea name="notes" defaultValue={c.notes ?? ""} className="input" /></Field>
          </div>
          <button className="btn">Salvar</button>
        </Form>
      </Win>

      <div className="grid gap-3 lg:grid-cols-2">
        <Win title="Propostas">
          {c.proposals.length === 0 ? <p className="text-muted">Nenhuma proposta.</p> : <ul>{c.proposals.map((p) => <li key={p.id}><Link href={`/vendas/propostas/${p.id}`}>{brl(p.total)}</Link> <span className="badge">{PROPOSAL_STATUS_LABEL[p.status]}</span> <span className="text-xs text-muted">{dt(p.createdAt)}</span></li>)}</ul>}
        </Win>
        <Win title="Projetos">
          {c.projects.length === 0 ? <p className="text-muted">Nenhum projeto.</p> : <ul>{c.projects.map((p) => <li key={p.id}><Link href={`/projetos/${p.id}`}>{p.name}</Link> <span className="badge">{PROJECT_STATUS_LABEL[p.status]}</span> {p.dueDate && <span className="text-xs text-muted">prazo {dt(p.dueDate)}</span>}</li>)}</ul>}
        </Win>
        <Win title="Pagamentos e manutenção">
          {c.payments.length === 0 ? <p className="text-muted">Sem pagamentos.</p> : <ul>{c.payments.map((p) => <li key={p.id}>{brl(p.amount)} · {p.category} · vence {dt(p.dueDate)} <span className="badge">{PAYMENT_STATUS_LABEL[p.status]}</span></li>)}</ul>}
          {c.subscriptions.map((s) => <p key={s.id} className="text-xs">Recorrente: {s.name} — {brl(s.amount)} todo dia {s.dayOfMonth} {s.active ? "" : "(inativa)"}</p>)}
          <Form action={addSubscriptionAction} csrf={csrf} className="mt-2 grid grid-cols-3 gap-2">
            <input type="hidden" name="clientId" value={c.id} />
            <Field label="Cobrança recorrente"><input name="name" required placeholder="Manutenção mensal" className="input" /></Field>
            <Field label="Valor (R$)"><input name="amount" type="number" step="0.01" min="0.01" required className="input" /></Field>
            <Field label="Dia (1–28)"><input name="dayOfMonth" type="number" min={1} max={28} defaultValue={10} className="input" /></Field>
            <button className="btn-ghost col-span-3">Criar recorrência</button>
          </Form>
        </Win>
        <Win title="Documentos">
          {c.documents.length === 0 ? <p className="text-muted">Nenhum documento.</p> : (
            <ul>{c.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-2"><a href={`/api/documents/${d.id}`}>{d.name}</a><span className="text-xs text-muted">{Math.ceil(d.sizeBytes / 1024)} KB · {dt(d.createdAt)}</span>
                <Form action={deleteDocumentAction} csrf={csrf} className="ml-auto"><input type="hidden" name="id" value={d.id} /><ConfirmButton message="Excluir documento?">Excluir</ConfirmButton></Form></li>
            ))}</ul>
          )}
          <Form action={uploadDocumentAction} csrf={csrf} encType="multipart/form-data" className="mt-2 flex items-end gap-2">
            <input type="hidden" name="clientId" value={c.id} /><input type="file" name="file" required className="input" aria-label="Arquivo" /><button className="btn-ghost">Enviar</button>
          </Form>
        </Win>
      </div>

      <Win title="Histórico e follow-ups">
        <Form action={addInteractionAction} csrf={csrf} className="mb-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="clientId" value={c.id} />
          <select name="type" className="input !w-40" aria-label="Tipo"><option value="NOTE">Anotação</option><option value="CALL">Ligação</option><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">E-mail</option><option value="MEETING">Reunião</option></select>
          <input name="summary" required minLength={2} className="input !w-auto flex-1" aria-label="Resumo" placeholder="O que aconteceu?" /><button className="btn">Registrar</button>
        </Form>
        <ul className="sunken max-h-72 divide-y divide-[#e2e5f0] overflow-auto">
          {c.interactions.length === 0 && <li className="p-2 text-muted">Sem histórico.</li>}
          {c.interactions.map((i) => <li key={i.id} className="p-2"><span className="badge mr-2">{i.type}</span>{i.summary}<span className="ml-2 text-xs text-muted">{dtt(i.createdAt)}</span></li>)}
        </ul>
      </Win>

      <Group title="Zona de risco">
        <Form action={deleteClientAction} csrf={csrf}><input type="hidden" name="id" value={c.id} /><ConfirmButton message="Excluir este cliente? Ele vai para a lixeira e pode ser restaurado.">Excluir cliente</ConfirmButton></Form>
      </Group>
    </AppShell>
  );
}
