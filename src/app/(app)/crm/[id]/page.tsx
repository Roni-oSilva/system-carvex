import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { LeadFields } from "@/components/lead-form";
import { Field, Flash, Form, Group, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { dt, dtt, LEAD_STATUS_LABEL, NF, orNF, PIPELINE, STAGE_LABEL } from "@/lib/format";
import { aiMode } from "@/lib/llm";
import { addInteractionAction, approveMessageAction, deleteLeadAction, generateMessageAction, markSentAction, moveLeadAction, reanalyzeAction, setFollowUpAction, startClientAction, updateLeadAction, updateMessageAction } from "@/server/crm-actions";
import { ctx } from "@/server/guard";
import { aiClassifyAction, aiMessageAction, aiNextStepsAction } from "@/server/ia-actions";

type Analysis = { presence?: string; opportunities?: { rule: string; opportunity: string; service: string | null }[]; scoreMatched?: string[]; score?: number };

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const { csrf } = await ctx();
  const lead = await db.lead.findFirst({
    where: { id, deletedAt: null },
    include: { niche: true, tags: true, sources: true, client: true, messages: { orderBy: { createdAt: "desc" }, take: 10 }, interactions: { orderBy: { createdAt: "desc" }, take: 40 } },
  });
  if (!lead) notFound();
  const niches = await db.niche.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const a = (lead.analysis ?? {}) as Analysis;
  const basic = aiMode() === "basic";
  const info: [string, string][] = [
    ["Nicho", orNF(lead.niche?.name)], ["Categoria", orNF(lead.category)], ["Cidade/UF", orNF([lead.city, lead.state].filter(Boolean).join("/"))], ["Endereço", orNF(lead.address)],
    ["Telefone", orNF(lead.phone)], ["E-mail", orNF(lead.email)], ["Site", orNF(lead.website)], ["Instagram", lead.instagram ? `@${lead.instagram}` : NF],
    ["Avaliação", lead.rating != null ? `${lead.rating} (${lead.reviewCount ?? NF} avaliações)` : NF], ["Fontes", lead.sources.map((s) => s.provider).join(", ") || NF], ["Coletado em", dt(lead.collectedAt)],
  ];

  return (
    <AppShell current="/crm" title={`CRM → ${lead.name}`}>
      <Flash sp={searchParams} />
      <Win title={lead.name}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-[220px] flex-1">
            <p>Oportunidade: <b>{lead.opportunity ?? "nenhuma regra aplicável"}</b>{lead.suggestedProduct && <> · Produto sugerido: <b>{lead.suggestedProduct}</b></>}</p>
            <p>Status: <b>{LEAD_STATUS_LABEL[lead.status]}</b> {lead.score != null && <span className="badge">score {lead.score}</span>}</p>
            <p>Próxima ação: <b>{lead.nextAction ?? "—"}</b> {lead.followUpAt && <span className="badge">follow-up {dt(lead.followUpAt)}</span>}</p>
            <p className="text-xs">{lead.tags.map((t) => <span key={t.id} className="badge mr-1">{t.name}</span>)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="#mensagens" className="btn">Enviar mensagem</a>
            {lead.client ? <Link href={`/clientes/${lead.client.id}`} className="btn">Ver cliente</Link> : (
              <Form action={startClientAction} csrf={csrf}><input type="hidden" name="id" value={lead.id} /><button className="btn">Converter em cliente</button></Form>
            )}
            <Form action={startClientAction} csrf={csrf}><input type="hidden" name="id" value={lead.id} /><input type="hidden" name="dest" value="proposal" /><button className="btn">Criar proposta</button></Form>
            <a href="#followup" className="btn">Agendar follow-up</a>
          </div>
        </div>
        <Form action={moveLeadAction} csrf={csrf} back={`/crm/${lead.id}`} className="mt-3 flex items-end gap-2">
          <input type="hidden" name="id" value={lead.id} />
          <Field label="Mover no funil"><select name="status" defaultValue={lead.status} className="input">{[...PIPELINE, "DISCARDED"].map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}</select></Field>
          <button className="btn">Mover</button>
        </Form>
        <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">{info.map(([k, v]) => <div key={k} className="flex gap-2"><dt className="w-28 shrink-0 text-muted">{k}:</dt><dd className={v === NF ? "text-muted" : ""}>{v}</dd></div>)}</dl>
        {lead.notes && <p className="sunken mt-3 whitespace-pre-wrap p-2">{lead.notes}</p>}
      </Win>

      <Win title="Análise automática (baseada apenas em dados encontrados)">
        <p>Presença digital: <b>{a.presence ?? "—"}</b></p>
        {a.opportunities?.length ? <ul className="ml-4 list-disc">{a.opportunities.map((o) => <li key={o.rule}>{o.opportunity}{o.service && <> → <b>{o.service}</b></>} <span className="text-xs text-muted">(regra: {o.rule})</span></li>)}</ul> : <p className="text-muted">Nenhuma oportunidade detectada pelas regras atuais.</p>}
        {a.scoreMatched?.length ? <p className="text-xs text-muted">Critérios de score atendidos: {a.scoreMatched.join(", ")}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Form action={reanalyzeAction} csrf={csrf}><input type="hidden" name="id" value={lead.id} /><button className="btn-ghost">Reanalisar</button></Form>
          <Form action={aiClassifyAction} csrf={csrf}><input type="hidden" name="leadId" value={lead.id} /><button className="btn-ghost">{basic ? "Sugerir nicho" : "IA: classificar nicho"}</button></Form>
          <Form action={aiNextStepsAction} csrf={csrf}><input type="hidden" name="leadId" value={lead.id} /><button className="btn-ghost">{basic ? "Próximos passos" : "IA: próximos passos"}</button></Form>
        </div>
      </Win>

      <Win title="Mensagens">
        <span id="mensagens" />
        <div className="flex flex-wrap gap-2">
          <Form action={generateMessageAction} csrf={csrf} className="flex items-end gap-2">
            <input type="hidden" name="leadId" value={lead.id} />
            <Field label="Gerar a partir do modelo"><select name="stage" className="input">{Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <button className="btn">Gerar rascunho</button>
          </Form>
          <Form action={aiMessageAction} csrf={csrf} className="flex items-end"><input type="hidden" name="leadId" value={lead.id} /><button className="btn-ghost">{basic ? "Gerar (modo básico)" : "Gerar com IA"}</button></Form>
        </div>
        <p className="mt-1 text-xs text-muted">Nada é enviado automaticamente: você revisa, aprova, envia pelo WhatsApp e marca como enviada.</p>
        {lead.messages.map((m) => (
          <Group key={m.id} title={`${m.status === "DRAFT" ? "Rascunho" : m.status === "APPROVED" ? "Aprovada" : m.status === "SENT" ? "Enviada" : "Falhou"}${m.aiGenerated ? " · gerada por IA" : ""} · ${dtt(m.createdAt)}`}>
            {m.status === "SENT" ? <p className="whitespace-pre-wrap">{m.body}</p> : (
              <Form action={updateMessageAction} csrf={csrf}>
                <input type="hidden" name="id" value={m.id} />
                <textarea name="body" defaultValue={m.body} className="input" rows={4} aria-label="Texto da mensagem" />
                <button className="btn-ghost">Salvar rascunho</button>
              </Form>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {m.status === "DRAFT" && <Form action={approveMessageAction} csrf={csrf}><input type="hidden" name="id" value={m.id} /><button className="btn">Aprovar</button></Form>}
              {m.status === "APPROVED" && (<>
                {lead.phoneNorm ? <a className="btn" target="_blank" rel="noopener noreferrer" href={`https://wa.me/55${lead.phoneNorm}?text=${encodeURIComponent(m.body)}`}>Abrir no WhatsApp</a> : <span className="badge">telefone não encontrado</span>}
                <Form action={markSentAction} csrf={csrf}><input type="hidden" name="id" value={m.id} /><button className="btn-ghost">Marcar como enviada</button></Form>
              </>)}
            </div>
          </Group>
        ))}
      </Win>

      <Win title="Histórico e follow-up">
        <span id="followup" />
        <div className="grid gap-3 md:grid-cols-2">
          <Form action={setFollowUpAction} csrf={csrf}>
            <input type="hidden" name="id" value={lead.id} />
            <Field label="Data do follow-up"><input type="date" name="date" defaultValue={lead.followUpAt?.toISOString().slice(0, 10)} className="input" /></Field>
            <Field label="Próxima ação"><input name="nextAction" defaultValue={lead.nextAction ?? ""} className="input" /></Field>
            <button className="btn">Salvar follow-up</button>
          </Form>
          <Form action={addInteractionAction} csrf={csrf}>
            <input type="hidden" name="leadId" value={lead.id} />
            <Field label="Registrar interação"><select name="type" className="input"><option value="NOTE">Anotação</option><option value="CALL">Ligação</option><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">E-mail</option><option value="MEETING">Reunião</option></select></Field>
            <textarea name="summary" required minLength={2} className="input" aria-label="Resumo" placeholder="O que aconteceu?" />
            <button className="btn">Registrar</button>
          </Form>
        </div>
        <ul className="sunken mt-3 max-h-80 divide-y divide-[#e4e9ff] overflow-auto">
          {lead.interactions.length === 0 && <li className="p-2 text-muted">Sem histórico ainda.</li>}
          {lead.interactions.map((i) => <li key={i.id} className="p-2"><span className="badge mr-2">{i.type}</span>{i.aiGenerated && <span className="badge mr-2">IA</span>}<span className="whitespace-pre-wrap">{i.summary}</span><span className="ml-2 text-xs text-muted">{dtt(i.createdAt)}</span></li>)}
        </ul>
      </Win>

      <Win title="Editar dados">
        <Form action={updateLeadAction} csrf={csrf}>
          <LeadFields niches={niches} lead={{ ...lead, tags: lead.tags.map((t) => t.name).join(", ") }} />
          <button className="btn">Salvar alterações</button>
        </Form>
        <Form action={deleteLeadAction} csrf={csrf} className="mt-4">
          <input type="hidden" name="id" value={lead.id} />
          <ConfirmButton message="Excluir este lead? Ele vai para a lixeira e pode ser restaurado.">Excluir lead</ConfirmButton>
        </Form>
      </Win>
    </AppShell>
  );
}
