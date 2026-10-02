import { AppShell } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, Flash, Form, Group, one, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { ctx } from "@/server/guard";
import { deleteChecklistTemplateAction, saveChecklistTemplateAction } from "@/server/projects-actions";
import { DEFAULT_CHECKLIST } from "@/server/projects";

export default async function TemplatesPage({ searchParams }: { searchParams: SP }) {
  const { csrf } = await ctx();
  const edit = one((await searchParams).edit);
  const [templates, services] = await Promise.all([db.projectTemplate.findMany({ include: { service: true }, orderBy: { name: "asc" } }), db.service.findMany({ orderBy: { name: "asc" } })]);
  const cur = templates.find((t) => t.id === edit);
  return (
    <AppShell current="/projetos" title="Projetos → Modelos de checklist">
      <Flash sp={searchParams} />
      <p className="msg msg-ok">Quando um projeto nasce de uma proposta, usa o modelo ligado ao serviço; sem modelo, usa o padrão: {DEFAULT_CHECKLIST.join(", ")}.</p>
      <div className="grid gap-3 lg:grid-cols-2">
        <Win title="Modelos">
          {templates.length === 0 && <p className="text-muted">Nenhum modelo.</p>}
          {templates.map((t) => (
            <Group key={t.id} title={`${t.name}${t.service ? ` · ${t.service.name}` : ""}`}>
              <ol className="ml-5 list-decimal">{t.checklist.map((c, i) => <li key={i}>{c}</li>)}</ol>
              <div className="mt-2 flex gap-2"><a className="btn-ghost" href={`/projetos/modelos?edit=${t.id}`}>Editar</a>
                <Form action={deleteChecklistTemplateAction} csrf={csrf}><input type="hidden" name="id" value={t.id} /><ConfirmButton message="Excluir modelo?">Excluir</ConfirmButton></Form></div>
            </Group>
          ))}
        </Win>
        <Win title={cur ? "Editar modelo" : "Novo modelo"}>
          <Form action={saveChecklistTemplateAction} csrf={csrf} key={cur?.id ?? "new"}>
            {cur && <input type="hidden" name="id" value={cur.id} />}
            <Field label="Nome"><input name="name" required defaultValue={cur?.name} className="input" /></Field>
            <Field label="Serviço (opcional)"><select name="serviceId" defaultValue={cur?.serviceId ?? ""} className="input"><option value="">— nenhum —</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Etapas (uma por linha)"><textarea name="items" rows={8} required defaultValue={cur?.checklist.join("\n") ?? DEFAULT_CHECKLIST.join("\n")} className="input" /></Field>
            <button className="btn">Salvar modelo</button>
          </Form>
        </Win>
      </div>
    </AppShell>
  );
}
