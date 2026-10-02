export const brl = (n: number | string | { toString(): string } | null | undefined) =>
  Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dt = (d: Date | null | undefined) => (d ? d.toLocaleDateString("pt-BR") : "—");
export const dtt = (d: Date | null | undefined) => (d ? d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
export const NF = "não encontrado";
export const orNF = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? NF : String(v));

export const LEAD_STATUS_LABEL: Record<string, string> = {
  FOUND: "Lead encontrado", ANALYZED: "Analisado", MESSAGE_READY: "Mensagem preparada", CONTACTED: "Contato realizado",
  REPLIED: "Respondeu", INTERESTED: "Interessado", MEETING: "Reunião", PROPOSAL: "Proposta", NEGOTIATION: "Negociação",
  WON: "Venda", LOST: "Perdido", DISCARDED: "Descartado",
};
export const PIPELINE = ["FOUND", "ANALYZED", "MESSAGE_READY", "CONTACTED", "REPLIED", "INTERESTED", "MEETING", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;
export const PROJECT_STATUS_LABEL: Record<string, string> = { WAITING_CLIENT: "Aguardando cliente", IN_PROGRESS: "Em andamento", REVIEW: "Em aprovação", DONE: "Concluído", CANCELED: "Cancelado" };
export const PROPOSAL_STATUS_LABEL: Record<string, string> = { DRAFT: "Rascunho", SENT: "Enviada", ACCEPTED: "Aceita", REJECTED: "Recusada", EXPIRED: "Expirada" };
export const PAYMENT_STATUS_LABEL: Record<string, string> = { PENDING: "Pendente", PAID: "Pago", OVERDUE: "Atrasado", CANCELED: "Cancelado" };
export const STAGE_LABEL: Record<string, string> = {
  FIRST_CONTACT: "Primeiro contato", SECOND_CONTACT: "Segundo contato", FOLLOW_UP: "Follow-up", PRESENTATION: "Apresentação",
  PROPOSAL: "Proposta", RECOVERY: "Recuperação", AFTER_SALE: "Pós-venda",
};
export const PAYMENT_CATEGORIES = ["Site", "Landing Page", "Sistema", "Cardápio", "Manutenção", "Hospedagem", "Outros"];
export const EXPENSE_CATEGORIES = ["Hospedagem", "Domínios", "APIs", "Ferramentas", "Serviços", "Operacional"];
