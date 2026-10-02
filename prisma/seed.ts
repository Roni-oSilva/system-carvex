/** Seed de CONFIGURAÇÃO (idempotente). Não cria leads, clientes, serviços ou valores fictícios. */
import { PrismaClient, type LeadStatus, type MessageStage } from "@prisma/client";

const STAGES: [string, LeadStatus | null][] = [
  ["Lead encontrado", "FOUND"], ["Analisado", "ANALYZED"], ["Mensagem preparada", "MESSAGE_READY"], ["Contato realizado", "CONTACTED"],
  ["Respondeu", "REPLIED"], ["Interessado", "INTERESTED"], ["Reunião", "MEETING"], ["Proposta", "PROPOSAL"],
  ["Negociação", "NEGOTIATION"], ["Venda", "WON"], ["Projeto", null], ["Concluído", null], ["Pós-venda", null],
];

const SCORE: [string, string, number][] = [
  ["has_phone", "Possui telefone", 10], ["has_whatsapp", "Celular (possível WhatsApp)", 15], ["has_instagram", "Possui Instagram", 10],
  ["has_reviews", "Possui avaliações", 10], ["no_website", "Não possui site", 25], ["has_digital_presence", "Possui presença digital", 10],
];

const RULES: [string, object, string, string, number][] = [
  ["Sem site", { field: "website", op: "missing" }, "Criar site / landing page", "Landing Page", 1],
  ["Sem agendamento", { field: "niche", op: "in", value: ["Barbearia", "Salão", "Clínica", "Dentista"] }, "Sistema de agendamento", "Sistema de Agendamento", 2],
  ["Restaurante sem cardápio próprio", { all: [{ field: "niche", op: "in", value: ["Pizzaria", "Restaurante"] }, { field: "website", op: "missing" }] }, "Cardápio digital próprio", "Cardápio digital", 3],
  ["Tem presença digital mas sem página própria", { all: [{ field: "instagram", op: "present" }, { field: "website", op: "missing" }] }, "Landing page a partir do Instagram", "Landing Page", 2],
  ["Avaliação alta e muitas avaliações", { field: "reviewCount", op: "gte", value: 100 }, "Abordagem personalizada (negócio com forte presença)", "", 1],
];

const NICHES = ["Barbearia", "Salão", "Pizzaria", "Restaurante", "Clínica", "Dentista", "Academia", "Loja de celulares", "Oficina", "Gesso", "Construção", "Imobiliária", "Hotel", "Escritório", "Profissional autônomo"];

const TEMPLATES: [MessageStage, string, string][] = [
  ["FIRST_CONTACT", "Primeiro contato", "Olá, tudo bem? Aqui é de uma agência de sites em {{cidade}}. Vi a {{empresa}} e acredito que {{oportunidade}} pode ajudar a atrair mais clientes. Posso te mostrar uma ideia rápida, sem compromisso?"],
  ["SECOND_CONTACT", "Segundo contato", "Olá! Passando para retomar minha mensagem sobre a {{empresa}}. Preparei uma sugestão de {{servico}} que pode fazer sentido. Quer que eu envie?"],
  ["FOLLOW_UP", "Follow-up", "Oi, tudo bem? Só confirmando se você chegou a ver minha mensagem sobre {{servico}} para a {{empresa}}. Fico à disposição!"],
  ["PRESENTATION", "Apresentação", "Obrigado pelo retorno! Segue a apresentação do que podemos fazer pela {{empresa}}: {{servico}}. Posso explicar os detalhes por ligação ou aqui mesmo?"],
  ["PROPOSAL", "Proposta", "Conforme conversamos, segue a proposta de {{servico}} para a {{empresa}}. Qualquer dúvida, é só me chamar. A proposta tem validade limitada."],
  ["RECOVERY", "Recuperação", "Olá! Faz um tempo que conversamos sobre {{servico}} para a {{empresa}}. Ainda faz sentido para você? Posso ajustar a proposta."],
  ["AFTER_SALE", "Pós-venda", "Olá! Passando para saber se está tudo certo com o seu projeto. Se precisar de ajustes, manutenção ou novas ideias para a {{empresa}}, conte comigo."],
];

export async function seedConfig(db: PrismaClient) {
  const pipeline = await db.pipeline.upsert({ where: { name: "Comercial" }, update: {}, create: { name: "Comercial" } });
  for (const [i, [name, leadStatus]] of STAGES.entries()) {
    await db.pipelineStage.upsert({ where: { pipelineId_position: { pipelineId: pipeline.id, position: i } }, update: { name, leadStatus }, create: { pipelineId: pipeline.id, position: i, name, leadStatus } });
  }
  for (const [criterion, label, points] of SCORE) await db.leadScoreRule.upsert({ where: { criterion }, update: { label }, create: { criterion, label, points } });
  if ((await db.businessRule.count()) === 0) {
    for (const [name, condition, opportunity, suggestedService, priority] of RULES) await db.businessRule.create({ data: { name, condition, opportunity, suggestedService: suggestedService || null, priority } });
  }
  for (const name of NICHES) await db.niche.upsert({ where: { name }, update: {}, create: { name } });
  if ((await db.messageTemplate.count()) === 0) {
    for (const [stage, name, body] of TEMPLATES) await db.messageTemplate.create({ data: { stage, name, body } });
  }
  if ((await db.automation.count()) === 0) {
    await db.automation.createMany({
      data: [
        { mode: "SEMI_AUTO", name: "Lead não respondeu → criar follow-up", trigger: "lead.no_reply", actions: [{ type: "create_followup", param: "2" }] },
        { mode: "SEMI_AUTO", name: "Proposta aceita → criar projeto", trigger: "proposal.accepted", actions: [{ type: "create_project" }] },
        { mode: "SEMI_AUTO", name: "Projeto concluído → pós-venda", trigger: "project.done", actions: [{ type: "create_aftersale" }] },
        { mode: "SEMI_AUTO", name: "Pagamento atrasado → alerta de cobrança", trigger: "payment.overdue", actions: [{ type: "notify", param: "Cobrar {{nome}}" }] },
      ],
    });
  }
}

if (process.argv[1]?.endsWith("seed.ts")) {
  const db = new PrismaClient();
  seedConfig(db).then(() => console.log("Seed de configuração concluído.")).finally(() => db.$disconnect());
}
