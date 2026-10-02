import { AppShell } from "@/components/app-shell";
import { Empty, Field, Flash, Form, one, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { brl } from "@/lib/format";
import { createProposalAction } from "@/server/sales-actions";
import { ctx } from "@/server/guard";

export default async function NewProposal({ searchParams }: { searchParams: SP }) {
  const { csrf } = await ctx();
  const q = await searchParams;
  const clientId = one(q.client), serviceId = one(q.service);
  const [clients, services] = await Promise.all([
    db.client.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    db.service.findMany({ where: { active: true }, orderBy: { name: "asc" }, include: { extras: true } }),
  ]);
  const svc = services.find((s) => s.id === serviceId);
  return (
    <AppShell current="/vendas" title="Vendas → Nova proposta">
      <Flash sp={searchParams} />
      <Win title="1. Cliente e serviço">
        {clients.length === 0 || services.length === 0 ? <Empty>Cadastre ao menos um cliente e um serviço ativo para criar propostas.</Empty> : (
          <form action="/vendas/propostas/nova" className="flex flex-wrap items-end gap-2">
            <Field label="Cliente"><select name="client" required defaultValue={clientId ?? ""} className="input"><option value="" disabled>Selecione</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Serviço"><select name="service" required defaultValue={serviceId ?? ""} className="input"><option value="" disabled>Selecione</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name} — {brl(s.price)}</option>)}</select></Field>
            <button className="btn">Continuar</button>
          </form>
        )}
      </Win>
      {svc && clientId && (
        <Win title="2. Extras, prazo, preço e pagamento">
          <Form action={createProposalAction} csrf={csrf} className="space-y-2">
            <input type="hidden" name="clientId" value={clientId} /><input type="hidden" name="serviceId" value={svc.id} />
            {svc.extras.length > 0 && <fieldset className="group"><legend>Extras</legend>{svc.extras.map((e) => <label key={e.id} className="flex items-center gap-2"><input type="checkbox" name="extraIds" value={e.id} /> {e.name} — {brl(e.price)}</label>)}</fieldset>}
            <div className="grid gap-2 sm:grid-cols-4">
              <Field label="Preço do serviço (R$)"><input name="price" type="number" step="0.01" min="0" required defaultValue={Number(svc.price)} className="input" /></Field>
              <Field label="Desconto (R$)"><input name="discount" type="number" step="0.01" min="0" defaultValue={0} className="input" /></Field>
              <Field label="Prazo (dias)"><input name="deadlineDays" type="number" min={1} defaultValue={svc.deadlineDays ?? ""} className="input" /></Field>
              <Field label="Validade (dias)"><input name="validDays" type="number" min={1} defaultValue={7} className="input" /></Field>
            </div>
            <Field label="Condições de pagamento"><textarea name="paymentTerms" className="input" placeholder="ex.: 50% na aprovação e 50% na entrega (Pix)" /></Field>
            <button className="btn">Gerar proposta</button>
          </Form>
        </Win>
      )}
    </AppShell>
  );
}
