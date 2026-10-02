import { AppShell } from "@/components/app-shell";
import { AiAsk, AiTest } from "@/components/ai-ask";
import { Mascot } from "@/components/mascot";
import { Win } from "@/components/ui";
import { db } from "@/lib/db";
import { aiInfo } from "@/lib/llm";
import { ctx } from "@/server/guard";

export default async function AiPage() {
  const { csrf } = await ctx();
  const info = aiInfo();
  const leads = await db.lead.findMany({ where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, name: true } });
  return (
    <AppShell current="/ia" title="Assistente de IA">
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Win title="Assistente">
          <p className="mb-3 text-xs text-muted">A IA é uma assistente, não uma autoridade: tudo que ela gera é marcado no histórico e precisa da sua revisão. Nada é enviado sozinho.</p>
          <AiAsk csrf={csrf} leads={leads} />
        </Win>
        <div className="space-y-4">
          <Win title="Status">
            <div className="flex items-center gap-3"><Mascot size={56} mood={info.mode === "llm" ? "happy" : "wink"} />
              <div>{info.mode === "llm" ? <p><b>IA ativa</b><br /><span className="text-xs text-muted">{info.provider} · {info.model}</span></p> : <p><b>Modo básico</b><br /><span className="text-xs text-muted">sem chave: regras locais, sem custo</span></p>}</div></div>
            <AiTest csrf={csrf} />
            {info.mode === "basic" && <p className="mt-2 text-xs">Para linguagem livre grátis, crie uma chave no <b>Google AI Studio</b> (Gemini) ou no <b>Groq</b> e defina <code>LLM_API_KEY</code> (e <code>LLM_PROVIDER</code> = gemini ou groq). Passo a passo no README.</p>}
          </Win>
          <Win title="Privacidade">
            <p className="text-xs">Com chave configurada, só vão ao provedor: nome, categoria, cidade, site, Instagram, avaliação da empresa e o texto que você digitar. Nunca telefones, e-mails nem dados financeiros. Atenção: planos gratuitos de alguns provedores podem usar os dados para melhorar seus produtos — leia os termos do provedor escolhido.</p>
          </Win>
        </div>
      </div>
    </AppShell>
  );
}
