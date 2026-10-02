"use client";

import { aiAskAction } from "@/server/ia-actions";
import { ActionForm } from "./form";

export function AiAsk({ csrf, leads, disabled }: { csrf: string; leads: { id: string; name: string }[]; disabled: boolean }) {
  return (
    <ActionForm action={aiAskAction} csrf={csrf} submit={disabled ? "IA indisponível" : "Perguntar"}>
      <div><label className="label" htmlFor="lead">Contexto (opcional)</label>
        <select id="lead" name="leadId" className="input"><option value="">Sem lead específico</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
      <div><label className="label" htmlFor="prompt">O que você quer?</label>
        <textarea id="prompt" name="prompt" required minLength={5} rows={4} className="input" placeholder="ex.: Sugira uma abordagem para este lead / resuma meus resultados / ideias de ofertas para barbearias" /></div>
    </ActionForm>
  );
}
