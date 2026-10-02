import { AppShell } from "@/components/app-shell";
import { SettingsTabs } from "@/components/settings-tabs";
import { Win } from "@/components/ui";
import { env } from "@/lib/env";
import { ctx } from "@/server/guard";

export default async function IntegrationsPage() {
  await ctx();
  const e = env();
  const rows: [string, boolean, string, string][] = [
    ["OpenStreetMap (busca de empresas) — gratuito", true, "sem chave", "Prospecção"],
    ["IA (Anthropic)", !!e.LLM_API_KEY, "LLM_API_KEY", "IA, mensagens, classificação"],
    ["Rotinas agendadas (cron)", !!e.CRON_SECRET, "CRON_SECRET", "Follow-ups, atrasos, recorrências, prazos"],
  ];
  return (
    <AppShell current="/settings/integracoes" title="Configurações → Integrações">
      <SettingsTabs current="integracoes" />
      <Win title="Integrações e chaves">
        <p className="mb-2 text-xs text-muted">As chaves ficam apenas em variáveis de ambiente do servidor — nunca no navegador, no banco ou no código. Para alterar/revogar, edite a variável no seu provedor e reinicie.</p>
        <table className="tbl"><thead><tr><th>Integração</th><th>Status</th><th>Variável</th><th>Usada em</th></tr></thead>
          <tbody>{rows.map(([n, ok, v, u]) => <tr key={v}><td>{n}</td><td><span className="badge">{ok ? "ATIVA" : "AGUARDANDO INTEGRAÇÃO"}</span></td><td><code>{v}</code></td><td>{u}</td></tr>)}</tbody></table>
        <p className="mt-2 text-xs">Envio de WhatsApp: manual por design (você abre o link e envia). A API oficial do WhatsApp exige modelos aprovados e consentimento do contato.</p>
      </Win>
    </AppShell>
  );
}
