import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Empty, Field, Flash, Form, one, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { createClientAction } from "@/server/clients-actions";
import { ctx } from "@/server/guard";

export default async function ClientsPage({ searchParams }: { searchParams: SP }) {
  const { csrf } = await ctx();
  const q = one((await searchParams).q)?.trim();
  const [clients, niches] = await Promise.all([
    db.client.findMany({ where: { deletedAt: null, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\D/g, "") || "§" } }] } : {}) }, orderBy: { name: "asc" }, take: 200, include: { projects: { where: { deletedAt: null }, select: { id: true } } } }),
    db.niche.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <AppShell current="/clientes" title="Clientes">
      <Flash sp={searchParams} />
      <Win title={`Clientes (${clients.length})`}>
        <form className="mb-2 flex gap-2" action="/clientes"><input name="q" defaultValue={q} placeholder="Buscar nome, e-mail, telefone" className="input" aria-label="Buscar" /><button className="btn">Buscar</button></form>
        {clients.length === 0 ? <Empty>Nenhum cliente. Clientes surgem de leads (botão “Converter em cliente”) ou do cadastro abaixo.</Empty> : (
          <table className="tbl"><thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Cidade</th><th>Projetos</th></tr></thead>
            <tbody>{clients.map((c) => <tr key={c.id}><td><Link href={`/clientes/${c.id}`}>{c.name}</Link></td><td>{c.phone ?? "—"}</td><td>{c.email ?? "—"}</td><td>{c.city ?? "—"}</td><td>{c.projects.length}</td></tr>)}</tbody></table>
        )}
      </Win>
      <Win title="Novo cliente">
        <Form action={createClientAction} csrf={csrf}>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Nome / empresa *"><input name="name" required className="input" /></Field>
            <Field label="Responsável"><input name="contactName" className="input" /></Field>
            <Field label="Telefone"><input name="phone" className="input" /></Field>
            <Field label="WhatsApp"><input name="whatsapp" className="input" /></Field>
            <Field label="E-mail"><input name="email" type="email" className="input" /></Field>
            <Field label="Cidade"><input name="city" className="input" /></Field>
            <Field label="Nicho"><select name="nicheId" className="input"><option value="">—</option>{niches.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></Field>
          </div>
          <button className="btn">Criar cliente</button>
        </Form>
      </Win>
    </AppShell>
  );
}
