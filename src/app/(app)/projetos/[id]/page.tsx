import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, Flash, Form, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { brl, dt, PROJECT_STATUS_LABEL } from "@/lib/format";
import { ctx } from "@/server/guard";
import { addTaskAction, deleteProjectAction, deleteTaskAction, toggleTaskAction, updateProjectAction } from "@/server/projects-actions";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const { csrf } = await ctx();
  const p = await db.project.findFirst({ where: { id, deletedAt: null }, include: { client: true, tasks: { orderBy: { position: "asc" } }, payments: { where: { deletedAt: null } } } });
  if (!p) notFound();
  const done = p.tasks.filter((t) => t.done).length;
  const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
  const received = p.payments.filter((x) => x.status === "PAID").reduce((a, x) => a + Number(x.amount), 0);
  return (
    <AppShell current="/projetos" title={`Projeto → ${p.name}`}>
      <Flash sp={searchParams} />
      <Win title={p.name}>
        <p>Cliente: <Link href={`/clientes/${p.clientId}`}>{p.client.name}</Link> · Valor: <b>{p.value ? brl(p.value) : "—"}</b> · Recebido: <b>{brl(received)}</b>{p.cost && <> · Custo: {brl(p.cost)}</>}</p>
        <div className="sunken my-2 h-5" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-[#2f5bff]" style={{ width: `${pct}%` }} /></div>
        <p className="text-xs">{done}/{p.tasks.length} etapas concluídas ({pct}%)</p>
        <ul className="sunken mt-2 divide-y divide-[#e4e9ff]">
          {p.tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2 p-1.5">
              <Form action={toggleTaskAction} csrf={csrf} className="contents"><input type="hidden" name="id" value={t.id} /><input type="hidden" name="projectId" value={p.id} />
                <button className="btn-ghost !min-h-[20px] !px-2 !py-0" aria-label={t.done ? "Reabrir" : "Concluir"}>{t.done ? "☑" : "☐"}</button></Form>
              <span className={t.done ? "text-muted line-through" : ""}>{t.title}</span>
              <Form action={deleteTaskAction} csrf={csrf} className="ml-auto"><input type="hidden" name="id" value={t.id} /><input type="hidden" name="projectId" value={p.id} /><button className="btn-ghost !min-h-[20px] !py-0 text-xs" aria-label="Remover tarefa">✕</button></Form>
            </li>
          ))}
        </ul>
        <Form action={addTaskAction} csrf={csrf} className="mt-2 flex gap-2"><input type="hidden" name="projectId" value={p.id} /><input name="title" required className="input" placeholder="Nova etapa" aria-label="Nova etapa" /><button className="btn">Adicionar</button></Form>
      </Win>

      <Win title="Dados do projeto">
        <Form action={updateProjectAction} csrf={csrf}>
          <input type="hidden" name="id" value={p.id} />
          <div className="grid gap-2 sm:grid-cols-4">
            <Field label="Nome"><input name="name" required defaultValue={p.name} className="input" /></Field>
            <Field label="Categoria"><input name="category" defaultValue={p.category ?? ""} className="input" /></Field>
            <Field label="Status"><select name="status" defaultValue={p.status} className="input">{Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Prazo"><input name="dueDate" type="date" defaultValue={p.dueDate?.toISOString().slice(0, 10)} className="input" /></Field>
            <Field label="Valor (R$)"><input name="value" type="number" step="0.01" min="0" defaultValue={p.value ? Number(p.value) : ""} className="input" /></Field>
            <Field label="Custo (R$)"><input name="cost" type="number" step="0.01" min="0" defaultValue={p.cost ? Number(p.cost) : ""} className="input" /></Field>
            <Field label="Tecnologia"><input name="technology" defaultValue={p.technology ?? ""} className="input" /></Field>
            <Field label="Hospedagem"><input name="hosting" defaultValue={p.hosting ?? ""} className="input" /></Field>
            <Field label="Domínio"><input name="domain" defaultValue={p.domain ?? ""} className="input" /></Field>
            <Field label="URL"><input name="url" defaultValue={p.url ?? ""} className="input" /></Field>
            <Field label="Repositório"><input name="repoUrl" defaultValue={p.repoUrl ?? ""} className="input" /></Field>
            <label className="flex items-end gap-2 pb-1"><input type="checkbox" name="maintenance" defaultChecked={p.maintenance} /> Em manutenção contratada</label>
          </div>
          <p className="text-xs text-muted">{p.deliveredAt && `Entregue em ${dt(p.deliveredAt)}. `}Concluir o projeto dispara a automação de pós-venda.</p>
          <button className="btn">Salvar</button>
        </Form>
        <Form action={deleteProjectAction} csrf={csrf} className="mt-3"><input type="hidden" name="id" value={p.id} /><ConfirmButton message="Excluir este projeto?">Excluir projeto</ConfirmButton></Form>
      </Win>
    </AppShell>
  );
}
