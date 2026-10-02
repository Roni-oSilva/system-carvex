import { AppShell } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, Flash, Form, Group, one, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { dtt, STAGE_LABEL } from "@/lib/format";
import { TEMPLATE_VARS } from "@/lib/leads";
import { ctx } from "@/server/guard";
import { createNicheAction, deleteTemplateAction, saveTemplateAction } from "@/server/messages-actions";

export default async function MessagesPage({ searchParams }: { searchParams: SP }) {
  const { csrf } = await ctx();
  const q = await searchParams;
  const nicheFilter = one(q.niche);
  const [niches, templates, recent] = await Promise.all([
    db.niche.findMany({ orderBy: { name: "asc" } }),
    db.messageTemplate.findMany({ where: nicheFilter === "generic" ? { nicheId: null } : nicheFilter ? { nicheId: nicheFilter } : {}, include: { niche: true }, orderBy: [{ nicheId: "asc" }, { stage: "asc" }] }),
    db.message.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { lead: true } }),
  ]);
  const editId = one(q.edit);
  const editing = templates.find((t) => t.id === editId);
  return (
    <AppShell current="/mensagens" title="Biblioteca de mensagens">
      <Flash sp={searchParams} />
      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <Win title="Modelos por nicho e etapa">
          <form className="mb-2 flex gap-2" action="/mensagens">
            <select name="niche" defaultValue={nicheFilter ?? ""} className="input" aria-label="Filtrar nicho"><option value="">Todos</option><option value="generic">Genéricos (sem nicho)</option>{niches.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select>
            <button className="btn">Filtrar</button>
          </form>
          {templates.length === 0 && <p className="text-muted">Nenhum modelo.</p>}
          {templates.map((t) => (
            <Group key={t.id} title={`${t.niche?.name ?? "Genérico"} · ${STAGE_LABEL[t.stage]} · ${t.name}`}>
              <p className="whitespace-pre-wrap">{t.body}</p>
              <div className="mt-2 flex gap-2">
                <a className="btn-ghost" href={`/mensagens?edit=${t.id}#form`}>Editar</a>
                <Form action={deleteTemplateAction} csrf={csrf}><input type="hidden" name="id" value={t.id} /><ConfirmButton message="Excluir este modelo?">Excluir</ConfirmButton></Form>
              </div>
            </Group>
          ))}
        </Win>

        <div className="space-y-3">
          <Win title={editing ? "Editar modelo" : "Novo modelo"}>
            <span id="form" />
            <Form action={saveTemplateAction} csrf={csrf} key={editing?.id ?? "new"}>
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <Field label="Nicho"><select name="nicheId" defaultValue={editing?.nicheId ?? ""} className="input"><option value="">Genérico (qualquer nicho)</option>{niches.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></Field>
              <Field label="Etapa"><select name="stage" defaultValue={editing?.stage ?? "FIRST_CONTACT"} className="input">{Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Nome"><input name="name" required defaultValue={editing?.name} className="input" /></Field>
              <Field label="Texto"><textarea name="body" required rows={6} defaultValue={editing?.body} className="input" /></Field>
              <p className="text-xs text-muted">Variáveis: {TEMPLATE_VARS.map((v) => `{{${v}}}`).join("  ")}</p>
              <button className="btn">Salvar modelo</button>
            </Form>
          </Win>
          <Win title="Novo nicho">
            <Form action={createNicheAction} csrf={csrf} className="flex gap-2"><input name="name" required className="input" aria-label="Nome do nicho" /><button className="btn">Criar</button></Form>
          </Win>
        </div>
      </div>
      <Win title="Histórico de mensagens">
        {recent.length === 0 ? <p className="text-muted">Nenhuma mensagem gerada ainda.</p> : <table className="tbl"><thead><tr><th>Quando</th><th>Lead</th><th>Status</th><th>Texto</th></tr></thead><tbody>{recent.map((m) => <tr key={m.id}><td>{dtt(m.createdAt)}</td><td><a href={`/crm/${m.leadId}`}>{m.lead.name}</a></td><td><span className="badge">{m.status}</span></td><td className="max-w-md truncate">{m.body}</td></tr>)}</tbody></table>}
      </Win>
    </AppShell>
  );
}
