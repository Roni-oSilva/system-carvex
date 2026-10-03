import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Field, Flash, Form, Group, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { dtt } from "@/lib/format";
import { ctx } from "@/server/guard";
import { importCsvAction, prospectSearchAction } from "@/server/prospect-actions";

const JOB_LABEL = { PENDING: "PENDENTE", PROCESSING: "PROCESSANDO", DONE: "CONCLUÍDO", ERROR: "ERRO" } as const;

export default async function ProspectPage({ searchParams }: { searchParams: SP }) {
  const { csrf } = await ctx();
  const [niches, jobs, recent] = await Promise.all([
    db.niche.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.job.findMany({ where: { type: { in: ["lead_search", "csv_import"] } }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.lead.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 8, include: { niche: true } }),
  ]);
  return (
    <AppShell current="/prospeccao" title="Prospecção">
      <Flash sp={searchParams} />
      <div className="grid gap-3 lg:grid-cols-2">
        <Win title="Buscar empresas (OpenStreetMap — gratuito)">
          <Form action={prospectSearchAction} csrf={csrf}>
            <Field label="Nicho *"><input name="nicheName" list="niches" required className="input" placeholder="ex.: Barbearia" /></Field>
            <datalist id="niches">{niches.map((n) => <option key={n.id} value={n.name} />)}</datalist>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Cidade *"><input name="city" required className="input" placeholder="ex.: Marabá" /></Field>
              <Field label="Região / bairro"><input name="region" className="input" /></Field>
              <Field label="Palavra-chave"><input name="keyword" className="input" /></Field>
              <Field label="Raio em km (opcional, 1–50)"><input name="radiusKm" type="number" min={1} max={50} className="input" placeholder="toda a cidade" /></Field>
              <Field label="Quantidade (máx. 60)"><input name="quantity" type="number" min={1} max={60} defaultValue={20} className="input" /></Field>
            </div>
            <button className="btn">Buscar leads</button>
            <p className="text-xs text-muted">Fonte: OpenStreetMap (sem chave, uso justo; dados © colaboradores do OSM, ODbL). Cobertura varia por cidade e telefone/site costumam faltar — ficam “não encontrado”; complemente via CSV/manual. Cada empresa é analisada, pontuada e deduplicada (telefone, site, nome+endereço). Dados ausentes ficam como “não encontrado”.</p>
          </Form>
        </Win>

        <Win title="Importar planilha (CSV)">
          <Form action={importCsvAction} csrf={csrf} encType="multipart/form-data">
            <Field label="Arquivo CSV"><input type="file" name="file" accept=".csv,text/csv" className="input" /></Field>
            <Field label="…ou cole o conteúdo"><textarea name="text" className="input" placeholder={"nome;telefone;site;cidade\nBarbearia X;(94) 99999-0000;;Marabá"} /></Field>
            <Field label="Nicho padrão (se a planilha não tiver coluna nicho)"><input name="nicheName" list="niches" className="input" /></Field>
            <button className="btn">Importar</button>
            <p className="text-xs text-muted">Colunas reconhecidas: nome/empresa, telefone, site, instagram, cidade, uf, endereço, categoria, nicho, e-mail. Use apenas listas obtidas de forma legítima (LGPD).</p>
          </Form>
        </Win>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Win title="Processamentos recentes">
          {jobs.length === 0 ? <p className="text-muted">Nenhum processamento ainda.</p> : (
            <table className="tbl"><thead><tr><th>Quando</th><th>Tipo</th><th>Status</th><th>Resultado</th></tr></thead>
              <tbody>{jobs.map((j) => <tr key={j.id}><td>{dtt(j.createdAt)}</td><td>{j.type === "csv_import" ? "CSV" : "Busca"}</td><td><span className="badge">{JOB_LABEL[j.status]}</span></td><td className="text-xs">{j.error ?? JSON.stringify(j.result)}</td></tr>)}</tbody></table>
          )}
        </Win>
        <Win title="Últimos leads">
          <Group title="mais recentes">
            {recent.length === 0 ? <p className="text-muted">Sem leads ainda.</p> : <ul>{recent.map((l) => <li key={l.id}><Link href={`/crm/${l.id}`}>{l.name}</Link> <span className="text-xs text-muted">{[l.niche?.name, l.city].filter(Boolean).join(" · ")} {l.score != null && `· score ${l.score}`}</span></li>)}</ul>}
          </Group>
        </Win>
      </div>
    </AppShell>
  );
}
