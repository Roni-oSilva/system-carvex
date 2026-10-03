import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConfirmButton, PrintButton } from "@/components/confirm-button";
import { Field, Flash, Form, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { brl, dt, PROPOSAL_STATUS_LABEL } from "@/lib/format";
import { ctx } from "@/server/guard";
import { aiProposalAction } from "@/server/ia-actions";
import { aiMode } from "@/lib/llm";
import { deleteProposalAction, proposalStatusAction, updateProposalAction } from "@/server/sales-actions";

export default async function ProposalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const { csrf } = await ctx();
  const [p, biz] = await Promise.all([
    db.proposal.findFirst({ where: { id, deletedAt: null }, include: { client: true, items: true, project: true } }),
    db.setting.findUnique({ where: { key: "business" } }),
  ]);
  if (!p) notFound();
  const b = (biz?.value ?? {}) as { name?: string; contact?: string };
  const subtotal = p.items.reduce((a, i) => a + Number(i.unitPrice) * i.quantity, 0);
  const locked = p.status === "ACCEPTED";
  return (
    <AppShell current="/vendas" title={`Proposta → ${p.client.name}`}>
      <Flash sp={searchParams} />
      <Win title={`Proposta comercial — ${PROPOSAL_STATUS_LABEL[p.status]}`} actions={<PrintButton />}>
        <header className="mb-3 border-b border-black pb-2"><h2 className="text-lg font-bold">{b.name || "Proposta comercial"}</h2>{b.contact && <p className="text-xs">{b.contact}</p>}</header>
        <p>Cliente: <b>{p.client.name}</b></p>
        {p.notes && <p className="my-2 whitespace-pre-wrap">{p.notes}</p>}
        <p>Emitida em {dt(p.createdAt)}{p.validUntil && <> · válida até <b>{dt(p.validUntil)}</b></>}{p.deadlineDays && <> · prazo de entrega: <b>{p.deadlineDays} dias</b></>}</p>
        <table className="tbl mt-2"><thead><tr><th>Item</th><th>Qtd</th><th>Valor</th></tr></thead>
          <tbody>{p.items.map((i) => <tr key={i.id}><td>{i.description}</td><td>{i.quantity}</td><td>{brl(Number(i.unitPrice) * i.quantity)}</td></tr>)}</tbody></table>
        <p className="mt-2 text-right">Subtotal: {brl(subtotal)}{Number(p.discount) > 0 && <> · Desconto: −{brl(p.discount)}</>}</p>
        <p className="text-right text-lg font-bold">Total: {brl(p.total)}</p>
        {p.paymentTerms && <p className="mt-2"><b>Pagamento:</b> {p.paymentTerms}</p>}
      </Win>

      <Win title="Ações">
        <div className="no-print flex flex-wrap gap-2">
          {p.status === "DRAFT" && <Form action={proposalStatusAction} csrf={csrf}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="to" value="SENT" /><button className="btn">Registrar envio</button></Form>}
          {!locked && <Form action={proposalStatusAction} csrf={csrf}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="to" value="ACCEPTED" /><button className="btn">Registrar aceite</button></Form>}
          {!locked && p.status !== "REJECTED" && <Form action={proposalStatusAction} csrf={csrf}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="to" value="REJECTED" /><button className="btn-ghost">Registrar recusa</button></Form>}
          {p.project && <a className="btn" href={`/projetos/${p.project.id}`}>Ver projeto criado</a>}
        </div>
        {p.sentAt && <p className="text-xs text-muted">Enviada em {dt(p.sentAt)}</p>}
        {p.respondedAt && <p className="text-xs text-muted">Resposta registrada em {dt(p.respondedAt)}</p>}
        {locked && !p.project && <p className="text-xs text-muted">Proposta aceita. O projeto é criado pela automação “Proposta aceita → criar projeto” (veja Automações).</p>}
      </Win>

      {!locked && (
        <Win title="Editar condições">
          <Form action={updateProposalAction} csrf={csrf} className="grid gap-2 sm:grid-cols-4">
            <input type="hidden" name="id" value={p.id} />
            <Field label="Desconto (R$)"><input name="discount" type="number" step="0.01" min="0" defaultValue={Number(p.discount)} className="input" /></Field>
            <Field label="Prazo (dias)"><input name="deadlineDays" type="number" min={1} defaultValue={p.deadlineDays ?? ""} className="input" /></Field>
            <Field label="Válida até"><input name="validUntil" type="date" defaultValue={p.validUntil?.toISOString().slice(0, 10)} className="input" /></Field>
            <Field label="Pagamento" className="sm:col-span-4"><textarea name="paymentTerms" defaultValue={p.paymentTerms ?? ""} className="input" /></Field>
            <Field label="Texto de apresentação (aparece na proposta)" className="sm:col-span-4"><textarea name="notes" rows={5} defaultValue={p.notes ?? ""} className="input" /></Field>
            <div className="flex gap-2"><button className="btn">Salvar</button></div>
          </Form>
          <Form action={aiProposalAction} csrf={csrf} className="mt-3"><input type="hidden" name="id" value={p.id} /><button className="btn-ghost">{aiMode() === "llm" ? "Gerar texto com IA" : "Gerar texto (modo básico)"}</button><span className="ml-2 text-xs text-muted">substitui o texto de apresentação atual</span></Form>
          <Form action={deleteProposalAction} csrf={csrf} className="mt-3"><input type="hidden" name="id" value={p.id} /><ConfirmButton message="Excluir esta proposta?">Excluir proposta</ConfirmButton></Form>
        </Win>
      )}
    </AppShell>
  );
}
