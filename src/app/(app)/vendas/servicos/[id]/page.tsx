import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, Flash, Form, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { brl } from "@/lib/format";
import { ctx } from "@/server/guard";
import { addExtraAction, deleteExtraAction, saveServiceAction, toggleServiceAction } from "@/server/sales-actions";

export default async function ServicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const { csrf } = await ctx();
  const s = await db.service.findUnique({ where: { id }, include: { extras: { orderBy: { name: "asc" } } } });
  if (!s) notFound();
  return (
    <AppShell current="/vendas" title={`Serviço → ${s.name}`}>
      <Flash sp={searchParams} />
      <Win title={s.name}>
        <Form action={saveServiceAction} csrf={csrf} className="grid grid-cols-2 gap-2">
          <input type="hidden" name="id" value={s.id} />
          <Field label="Nome"><input name="name" required defaultValue={s.name} className="input" /></Field>
          <Field label="Prazo (dias)"><input name="deadlineDays" type="number" min={1} defaultValue={s.deadlineDays ?? ""} className="input" /></Field>
          <Field label="Preço (R$)"><input name="price" type="number" step="0.01" min="0" required defaultValue={Number(s.price)} className="input" /></Field>
          <Field label="Custo (R$)"><input name="cost" type="number" step="0.01" min="0" defaultValue={Number(s.cost)} className="input" /></Field>
          <Field label="Descrição" className="col-span-2"><input name="description" defaultValue={s.description ?? ""} className="input" /></Field>
          <Field label="Recursos (um por linha)" className="col-span-2"><textarea name="features" defaultValue={s.features.join("\n")} className="input" /></Field>
          <div className="col-span-2 flex gap-2"><button className="btn">Salvar</button>
            <span className="self-center text-xs text-muted">Margem: {brl(Number(s.price) - Number(s.cost))}</span></div>
        </Form>
        <Form action={toggleServiceAction} csrf={csrf} className="mt-2"><input type="hidden" name="id" value={s.id} /><button className="btn-ghost">{s.active ? "Desativar serviço" : "Ativar serviço"}</button></Form>
      </Win>
      <Win title="Extras">
        <ul>{s.extras.map((e) => <li key={e.id} className="flex items-center gap-2">{e.name} — {brl(e.price)}
          <Form action={deleteExtraAction} csrf={csrf} className="ml-auto"><input type="hidden" name="id" value={e.id} /><input type="hidden" name="serviceId" value={s.id} /><ConfirmButton message="Remover extra?">Remover</ConfirmButton></Form></li>)}
          {s.extras.length === 0 && <li className="text-muted">Nenhum extra.</li>}</ul>
        <Form action={addExtraAction} csrf={csrf} className="mt-2 flex items-end gap-2">
          <input type="hidden" name="serviceId" value={s.id} />
          <Field label="Nome do extra"><input name="name" required className="input" /></Field>
          <Field label="Preço (R$)"><input name="price" type="number" step="0.01" min="0" required className="input" /></Field>
          <button className="btn">Adicionar</button>
        </Form>
      </Win>
    </AppShell>
  );
}
