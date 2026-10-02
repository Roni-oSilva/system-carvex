// "Modo básico": sugestões por regras locais, sem provedor externo. Úteis, determinísticas e honestas sobre o que são.
import { norm } from "./leads";

const NICHE_HINTS: [RegExp, string][] = [
  [/barbear|barber/, "Barbearia"], [/sal[aã]o|cabelei|beleza|est[eé]tic|manicure/, "Salão"], [/pizz/, "Pizzaria"],
  [/restaurante|lanchonete|hamburguer|churrasc|bar e grill/, "Restaurante"], [/dentist|odonto/, "Dentista"], [/cl[ií]nica|m[eé]dic|consult[oó]rio|fisioter/, "Clínica"],
  [/academia|fitness|muscula|crossfit|pilates/, "Academia"], [/celular|smartphone|assist[eê]ncia t[eé]cnica/, "Loja de celulares"], [/oficina|mec[aâ]nic|auto ?center|funilaria/, "Oficina"],
  [/gesso|drywall/, "Gesso"], [/constru[cç]|engenhar|material de constru|reforma/, "Construção"], [/imobili[aá]ri|corretor/, "Imobiliária"],
  [/hotel|pousada|hostel/, "Hotel"], [/escrit[oó]rio|contab|advoca/, "Escritório"],
];

/** Sugere um dos nichos cadastrados a partir do nome/categoria, ou null. */
export function basicClassify(f: { name: string; category?: string | null }, niches: string[]): { niche: string; reason: string } | null {
  const text = norm(`${f.name} ${f.category ?? ""}`);
  for (const [re, niche] of NICHE_HINTS) {
    if (re.test(text) || re.test(`${f.name} ${f.category ?? ""}`.toLowerCase())) {
      const match = niches.find((n) => norm(n) === norm(niche));
      if (match) return { niche: match, reason: `o nome/categoria contém termos de “${match}”` };
    }
  }
  return null;
}

const NEXT: Record<string, string[]> = {
  FOUND: ["Revise os dados do lead e complete o que estiver como “não encontrado”.", "Gere um rascunho de primeiro contato e revise antes de enviar."],
  ANALYZED: ["Gere o rascunho de primeiro contato com o modelo do nicho.", "Se houver Instagram, observe o perfil para personalizar a abordagem."],
  MESSAGE_READY: ["Aprove e envie a mensagem pelo WhatsApp; depois marque como enviada.", "Defina a data de follow-up (2–3 dias)."],
  CONTACTED: ["Aguarde 2–3 dias e faça o follow-up com o modelo “Follow-up”.", "Se não houver resposta após 2 follow-ups, tente o modelo “Recuperação” e depois descarte."],
  REPLIED: ["Responda rápido e descubra a necessidade principal (site, agendamento, cardápio).", "Proponha uma conversa curta (ligação ou reunião) e registre no histórico."],
  INTERESTED: ["Envie a apresentação (modelo “Apresentação”) com exemplos do mesmo nicho.", "Agende reunião e prepare a proposta."],
  MEETING: ["Registre as decisões da reunião no histórico.", "Crie a proposta no mesmo dia, com prazo e condições claras."],
  PROPOSAL: ["Confirme o recebimento da proposta e tire dúvidas.", "Defina follow-up antes da validade da proposta."],
  NEGOTIATION: ["Evite desconto direto: ofereça ajuste de escopo ou parcelamento.", "Registre o limite que você aceita e prazo para decisão."],
  WON: ["Crie o projeto e peça os materiais (briefing, logos, fotos).", "Agende o pós-venda para depois da entrega."],
  LOST: ["Registre o motivo da perda para aprender.", "Reavalie em 60–90 dias com o modelo “Recuperação”."],
  DISCARDED: ["Nenhuma ação necessária."],
};

export function basicNextSteps(status: string, f: { website?: string | null; instagram?: string | null; phone?: string | null; opportunity?: string | null }): string[] {
  const steps = [...(NEXT[status] ?? NEXT.ANALYZED!)];
  if (!f.phone) steps.push("Telefone não encontrado: procure outro canal (Instagram/site) antes de abordar.");
  if (!f.website && f.opportunity) steps.push(`Use a oportunidade detectada (“${f.opportunity}”) como gancho da conversa.`);
  return steps.slice(0, 5);
}

export type Summary = { revenueMonth: number; expensesMonth: number; receivable: number; overdue: number; leads: number; contacted: number; replied: number; won: number; projectsLate: number; projectsActive: number };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}%` : "—");

/** Resumo de resultados calculado dos números reais (sem IA generativa). */
export function basicSummary(s: Summary): string {
  const out = [
    `Financeiro do mês: recebido ${brl(s.revenueMonth)}, despesas ${brl(s.expensesMonth)}, lucro estimado ${brl(s.revenueMonth - s.expensesMonth)}.`,
    `A receber: ${brl(s.receivable)}${s.overdue > 0 ? ` — ATENÇÃO: ${brl(s.overdue)} em atraso, priorize a cobrança` : ""}.`,
    `Funil: ${s.leads} lead(s); ${s.contacted} contatado(s) (${pct(s.contacted, s.leads)}); ${s.replied} responderam (${pct(s.replied, s.contacted)} dos contatados); ${s.won} venda(s) (${pct(s.won, s.leads)} dos leads).`,
    `Projetos: ${s.projectsActive} em andamento${s.projectsLate ? `, ${s.projectsLate} atrasado(s)` : ""}.`,
  ];
  if (s.leads > 0 && s.contacted / s.leads < 0.5) out.push("Sugestão: menos da metade dos leads foi contatada — gere mensagens e envie os rascunhos aprovados.");
  if (s.contacted > 0 && s.replied / s.contacted < 0.15) out.push("Sugestão: taxa de resposta baixa — teste outro modelo de primeiro contato e personalize com a oportunidade.");
  return out.join("\n");
}
