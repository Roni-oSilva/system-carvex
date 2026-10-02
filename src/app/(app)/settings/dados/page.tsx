import { AppShell } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { SettingsTabs } from "@/components/settings-tabs";
import { Field, Flash, Form, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { dt } from "@/lib/format";
import { ctx } from "@/server/guard";
import { purgeAction, restoreAction } from "@/server/misc-actions";

export default async function DataPage({ searchParams }: { searchParams: SP }) {
  const { csrf } = await ctx();
  const [leads, clients] = await Promise.all([
    db.lead.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 100 }),
    db.client.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 100 }),
  ]);
  const Row = ({ kind, id, name, at }: { kind: string; id: string; name: string; at: Date | null }) => (
    <li className="flex items-center gap-2 p-1.5">{name} <span className="text-xs text-muted">excluído em {dt(at)}</span>
      <Form action={restoreAction} csrf={csrf} className="ml-auto"><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} /><button className="btn-ghost !min-h-[20px] !py-0">Restaurar</button></Form></li>
  );
  return (
    <AppShell current="/settings/dados" title="Configurações → Dados e LGPD">
      <SettingsTabs current="dados" />
      <Flash sp={searchParams} />
      <Win title="Exportação de dados">
        <p>Baixe uma cópia completa dos seus dados (leads, clientes, propostas, projetos, financeiro) em JSON — útil para backup lógico e para atender solicitações de titulares.</p>
        <a className="btn mt-2" href="/api/export">Exportar tudo (JSON)</a>
      </Win>
      <Win title="Lixeira">
        <p className="mb-2 text-xs text-muted">Exclusões são reversíveis. A exclusão definitiva apaga também histórico, mensagens e fontes do registro e não pode ser desfeita.</p>
        <h3 className="font-bold">Leads ({leads.length})</h3>
        {leads.length === 0 ? <p className="text-muted">Vazia.</p> : <ul className="sunken divide-y divide-[#dfdfdf]">{leads.map((l) => <Row key={l.id} kind="lead" id={l.id} name={l.name} at={l.deletedAt} />)}</ul>}
        <h3 className="mt-3 font-bold">Clientes ({clients.length})</h3>
        {clients.length === 0 ? <p className="text-muted">Vazia.</p> : <ul className="sunken divide-y divide-[#dfdfdf]">{clients.map((c) => <Row key={c.id} kind="client" id={c.id} name={c.name} at={c.deletedAt} />)}</ul>}
        {(leads.length > 0 || clients.length > 0) && (
          <Form action={purgeAction} csrf={csrf} className="mt-3 flex flex-wrap items-end gap-2">
            <Field label="Esvaziar a lixeira de…"><select name="kind" className="input"><option value="lead">Leads</option><option value="client">Clientes (e seus projetos, propostas e pagamentos)</option></select></Field>
            <Field label="Digite EXCLUIR para confirmar"><input name="confirm" className="input" autoComplete="off" /></Field>
            <ConfirmButton message="Excluir DEFINITIVAMENTE tudo da lixeira selecionada? Não há como desfazer.">Excluir definitivamente</ConfirmButton>
          </Form>
        )}
      </Win>
      <Win title="Privacidade e retenção">
        <ul className="ml-4 list-disc"><li>Coleta mínima: somente campos de contato comercial; fonte e data de coleta ficam em cada lead.</li><li>Dados ausentes aparecem como “não encontrado” — nunca são inventados.</li><li>Tentativas de login são apagadas após 30 dias; sessões expiradas após 7 dias.</li><li>Dados enviados à IA: apenas nome, categoria, cidade, site, Instagram e avaliação da empresa.</li></ul>
      </Win>
    </AppShell>
  );
}
