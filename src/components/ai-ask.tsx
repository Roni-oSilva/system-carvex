"use client";

import { aiAskAction, aiTestAction } from "@/server/ia-actions";
import { ActionForm } from "./form";

export function AiAsk({ csrf, leads }: { csrf: string; leads: { id: string; name: string }[] }) {
  return (
    <ActionForm action={aiAskAction} csrf={csrf} submit="Perguntar">
      <div><label className="label" htmlFor="lead">Contexto (opcional)</label>
        <select id="lead" name="leadId" className="input"><option value="">Sem lead específico</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
      <div><label className="label" htmlFor="prompt">O que você quer?</label>
        <textarea id="prompt" name="prompt" required minLength={5} rows={4} className="input" placeholder="ex.: resuma meus resultados · quais os próximos passos deste lead? · sugira ofertas para barbearias" /></div>
    </ActionForm>
  );
}

export function AiTest({ csrf }: { csrf: string }) {
  return <ActionForm action={aiTestAction} csrf={csrf} submit="Testar conexão" className="space-y-2" />;
}
