import { AppShell } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { SettingsTabs } from "@/components/settings-tabs";
import { Field, Flash, Form, Group, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { ctx } from "@/server/guard";
import { ruleOpAction, saveBusinessAction, saveRuleAction, saveScoreAction } from "@/server/misc-actions";

const FIELDS = [["website", "Site"], ["instagram", "Instagram"], ["phone", "Telefone"], ["email", "E-mail"], ["niche", "Nicho"], ["city", "Cidade"], ["rating", "Avaliação"], ["reviewCount", "Nº de avaliações"]] as const;
const OPS = [["missing", "não possui"], ["present", "possui"], ["in", "está em (lista, separada por vírgula)"], ["eq", "é igual a"], ["gte", "≥"], ["lte", "≤"]] as const;

export default async function RulesPage({ searchParams }: { searchParams: SP }) {
  const { csrf } = await ctx();
  const [rules, score, biz] = await Promise.all([db.businessRule.findMany({ orderBy: { priority: "desc" } }), db.leadScoreRule.findMany({ orderBy: { criterion: "asc" } }), db.setting.findUnique({ where: { key: "business" } })]);
  const b = (biz?.value ?? {}) as { name?: string; contact?: string };
  return (
    <AppShell current="/settings/regras" title="Configurações → Regras comerciais">
      <SettingsTabs current="regras" />
      <Flash sp={searchParams} />
      <Win title="Detector de oportunidades">
        {rules.map((r) => { const c = r.condition as { field: string; op: string; value?: unknown }; return (
          <Group key={r.id} title={`${r.name}${r.active ? "" : " (inativa)"} · prioridade ${r.priority}`}>
            <p>SE <code>{c.field} {c.op} {Array.isArray(c.value) ? c.value.join(", ") : String(c.value ?? "")}</code> → <b>{r.opportunity}</b>{r.suggestedService && <> (serviço: {r.suggestedService})</>}</p>
            <div className="mt-1 flex gap-2">
              <Form action={ruleOpAction} csrf={csrf}><input type="hidden" name="id" value={r.id} /><button name="op" value="toggle" className="btn-ghost">{r.active ? "Desativar" : "Ativar"}</button></Form>
              <Form action={ruleOpAction} csrf={csrf}><input type="hidden" name="id" value={r.id} /><ConfirmButton message="Excluir regra?">Excluir</ConfirmButton><input type="hidden" name="op" value="delete" /></Form>
            </div>
          </Group>); })}
        <Group title="Nova regra">
          <Form action={saveRuleAction} csrf={csrf} className="grid gap-2 sm:grid-cols-3">
            <Field label="Nome"><input name="name" required className="input" /></Field>
            <Field label="Campo"><select name="field" className="input">{FIELDS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Condição"><select name="op" className="input">{OPS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Valor (se aplicável)"><input name="value" className="input" placeholder="Barbearia, Salão" /></Field>
            <Field label="Oportunidade"><input name="opportunity" required className="input" placeholder="Criar landing page" /></Field>
            <Field label="Serviço sugerido"><input name="suggestedService" className="input" /></Field>
            <Field label="Prioridade (maior vence)"><input name="priority" type="number" min={0} max={100} defaultValue={0} className="input" /></Field>
            <button className="btn sm:col-span-3">Salvar regra</button>
          </Form>
        </Group>
      </Win>

      <Win title="Score de lead (apenas priorização interna)">
        <Form action={saveScoreAction} csrf={csrf}>
          <table className="tbl"><thead><tr><th>Critério</th><th>Pontos</th><th>Peso</th><th>Ativo</th></tr></thead>
            <tbody>{score.map((r) => <tr key={r.criterion}><td>{r.label}</td><td><input name={`p_${r.criterion}`} type="number" min={0} max={100} defaultValue={r.points} className="input !w-20" aria-label={`Pontos ${r.label}`} /></td><td><input name={`w_${r.criterion}`} type="number" min={0} max={10} defaultValue={r.weight} className="input !w-20" aria-label={`Peso ${r.label}`} /></td><td><input type="checkbox" name={`a_${r.criterion}`} defaultChecked={r.active} aria-label={`Ativo ${r.label}`} /></td></tr>)}</tbody></table>
          <button className="btn mt-2">Salvar pesos</button>
        </Form>
      </Win>

      <Win title="Dados da sua empresa (aparecem nas propostas)">
        <Form action={saveBusinessAction} csrf={csrf}>
          <Field label="Nome / marca"><input name="name" defaultValue={b.name} className="input" /></Field>
          <Field label="Contato (telefone, e-mail, site)"><input name="contact" defaultValue={b.contact} className="input" /></Field>
          <button className="btn">Salvar</button>
        </Form>
      </Win>
    </AppShell>
  );
}
