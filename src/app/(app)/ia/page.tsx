import { AppShell } from "@/components/app-shell";
import { AiAsk } from "@/components/ai-ask";
import { Win } from "@/components/ui";
import { db } from "@/lib/db";
import { llmConfigured } from "@/lib/llm";
import { ctx } from "@/server/guard";

export default async function AiPage() {
  const { csrf } = await ctx();
  const on = llmConfigured();
  const leads = await db.lead.findMany({ where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, name: true } });
  return (
    <AppShell current="/ia" title="Assistente de IA">
      {!on && <p className="msg msg-err">AGUARDANDO INTEGRAÇÃO: defina LLM_API_KEY (e opcionalmente LLM_MODEL) no servidor para ativar a IA.</p>}
      <Win title="Assistente">
        <p className="mb-2 text-xs text-muted">A IA é uma assistente, não uma autoridade: tudo que ela gera é marcado como “IA” no histórico e precisa de revisão sua. Apenas dados públicos do lead (nome, categoria, cidade, site, Instagram, avaliação) são enviados ao provedor; nunca telefones, e-mails nem dados financeiros.</p>
        <AiAsk csrf={csrf} leads={leads} disabled={!on} />
      </Win>
      <Win title="Onde mais a IA aparece">
        <ul className="ml-4 list-disc"><li>No lead: classificar nicho, sugerir próximos passos e gerar rascunho de mensagem.</li><li>Todo conteúdo gerado entra como rascunho — nunca é enviado sozinho.</li></ul>
      </Win>
    </AppShell>
  );
}
