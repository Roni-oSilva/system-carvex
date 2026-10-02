/** Seed de configuração (NÃO cria dados comerciais fictícios): pipeline, regras de score/oportunidade e nichos padrão. */
import { PrismaClient, type LeadStatus } from "@prisma/client";

const db = new PrismaClient();

const STAGES: [string, LeadStatus | null][] = [
  ["Lead encontrado", "FOUND"], ["Analisado", "ANALYZED"], ["Mensagem preparada", "MESSAGE_READY"], ["Contato realizado", "CONTACTED"],
  ["Respondeu", "REPLIED"], ["Interessado", "INTERESTED"], ["Reunião", "MEETING"], ["Proposta", "PROPOSAL"],
  ["Negociação", "NEGOTIATION"], ["Venda", "WON"], ["Projeto", null], ["Concluído", null], ["Pós-venda", null],
];

const SCORE: [string, string, number][] = [
  ["has_phone", "Possui telefone", 10], ["has_whatsapp", "Possui WhatsApp", 15], ["has_instagram", "Possui Instagram", 10],
  ["has_reviews", "Possui avaliações", 10], ["no_website", "Não possui site", 25], ["has_digital_presence", "Possui presença digital", 10],
];

const RULES: [string, object, string, string][] = [
  ["Sem site", { field: "website", op: "missing" }, "Criar site/landing page", "Landing Page"],
  ["Sem agendamento", { field: "niche", op: "in", value: ["Barbearia", "Salão", "Clínica", "Dentista"] }, "Sistema de agendamento", "Sistema de Agendamento"],
  ["Restaurante sem cardápio", { field: "niche", op: "in", value: ["Pizzaria", "Restaurante"] }, "Cardápio digital", "Cardápio digital"],
];

const NICHES = ["Barbearia", "Salão", "Pizzaria", "Restaurante", "Clínica", "Dentista", "Academia", "Loja de celulares", "Oficina", "Gesso", "Construção", "Imobiliária", "Hotel", "Escritório", "Profissional autônomo"];

async function main() {
  const pipeline = await db.pipeline.upsert({ where: { name: "Comercial" }, update: {}, create: { name: "Comercial" } });
  for (const [i, [name, leadStatus]] of STAGES.entries()) {
    await db.pipelineStage.upsert({ where: { pipelineId_position: { pipelineId: pipeline.id, position: i } }, update: { name, leadStatus }, create: { pipelineId: pipeline.id, position: i, name, leadStatus } });
  }
  for (const [criterion, label, points] of SCORE) await db.leadScoreRule.upsert({ where: { criterion }, update: {}, create: { criterion, label, points } });
  if ((await db.businessRule.count()) === 0) {
    for (const [name, condition, opportunity, suggestedService] of RULES) await db.businessRule.create({ data: { name, condition, opportunity, suggestedService } });
  }
  for (const name of NICHES) await db.niche.upsert({ where: { name }, update: {}, create: { name } });
  const providers = ["google_places", "llm", "whatsapp_cloud", "smtp", "s3"];
  for (const provider of providers) await db.integration.upsert({ where: { provider }, update: {}, create: { provider } });
  console.log("Seed de configuração concluído.");
}

main().finally(() => db.$disconnect());
