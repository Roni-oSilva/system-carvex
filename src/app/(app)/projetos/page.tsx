import Link from "next/link";
import type { Prisma, ProjectStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { Empty, Field, Flash, Form, one, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { brl, dt, PROJECT_STATUS_LABEL } from "@/lib/format";
import { ctx } from "@/server/guard";
import { createProjectAction } from "@/server/projects-actions";

export default async function ProjectsPage({ searchParams }: { searchParams: SP }) {
  const { csrf } = await ctx();
  const q = await searchParams;
  const status = one(q.status), cat = one(q.cat), novo = one(q.novo);
  const where: Prisma.ProjectWhereInput = { deletedAt: null, ...(status && status in PROJECT_STATUS_LABEL ? { status: status as ProjectStatus } : {}), ...(cat ? { category: cat } : {}) };
  const [projects, cats, clients, templates] = await Promise.all([
    db.project.findMany({ where, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }], include: { client: true, tasks: true }, take: 200 }),
    db.project.findMany({ where: { deletedAt: null, category: { not: null } }, distinct: ["category"], select: { category: true } }),
    db.client.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    db.projectTemplate.findMany({ orderBy: { name: "asc" } }),
  ]);
  const now = Date.now();
  return (
    <AppShell current="/projetos" title="Meus Projetos">
      <Flash sp={searchParams} />
      <Win title={`Projetos (${projects.length})`} actions={<Link href="/projetos/modelos" className="btn-ghost !min-h-[18px] !py-0 text-black">Modelos de checklist</Link>}>
        <form action="/projetos" className="mb-2 flex flex-wrap gap-2">
          <select name="status" defaultValue={status ?? ""} className="input !w-48" aria-label="Status"><option value="">Todos os status</option>{Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select name="cat" defaultValue={cat ?? ""} className="input !w-48" aria-label="Categoria"><option value="">Todas as categorias</option>{cats.map((c) => <option key={c.category} value={c.category!}>{c.category}</option>)}</select>
          <button className="btn">Filtrar</button>
        </form>
        {projects.length === 0 ? <Empty>Nenhum projeto. Projetos nascem de propostas aceitas ou do cadastro abaixo.</Empty> : (
          <table className="tbl"><thead><tr><th>Projeto</th><th>Cliente</th><th>Status</th><th>Prazo</th><th>Checklist</th><th>Valor</th></tr></thead>
            <tbody>{projects.map((p) => { const done = p.tasks.filter((t) => t.done).length; const late = p.dueDate && p.dueDate.getTime() < now && !["DONE", "CANCELED"].includes(p.status);
              return <tr key={p.id}><td><Link href={`/projetos/${p.id}`}>{p.name}</Link></td><td>{p.client.name}</td><td><span className="badge">{PROJECT_STATUS_LABEL[p.status]}</span></td><td className={late ? "font-bold text-danger" : ""}>{dt(p.dueDate)}{late && " (atrasado)"}</td><td>{done}/{p.tasks.length}</td><td>{p.value ? brl(p.value) : "—"}</td></tr>; })}</tbody></table>
        )}
      </Win>
      <Win title="Novo projeto">
        {clients.length === 0 ? <Empty>Cadastre um cliente primeiro.</Empty> : (
          <Form action={createProjectAction} csrf={csrf}>
            <div className="grid gap-2 sm:grid-cols-4">
              <Field label="Cliente *"><select name="clientId" required defaultValue={novo ?? ""} className="input"><option value="" disabled>Selecione</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Nome *"><input name="name" required className="input" /></Field>
              <Field label="Categoria"><input name="category" list="cats" placeholder="Landing Page, Site, Cardápio…" className="input" /></Field>
              <datalist id="cats">{["Site", "Landing Page", "Cardápio", "Sistema", "Template", "Componente"].map((c) => <option key={c} value={c} />)}</datalist>
              <Field label="Checklist"><select name="templateId" className="input"><option value="">Padrão (10 etapas)</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
              <Field label="Valor (R$)"><input name="value" type="number" step="0.01" min="0" className="input" /></Field>
              <Field label="Custo (R$)"><input name="cost" type="number" step="0.01" min="0" className="input" /></Field>
              <Field label="Prazo"><input name="dueDate" type="date" className="input" /></Field>
            </div>
            <button className="btn">Criar projeto</button>
          </Form>
        )}
      </Win>
    </AppShell>
  );
}
