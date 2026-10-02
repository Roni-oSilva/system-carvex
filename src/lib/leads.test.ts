import { describe, expect, it } from "vitest";
import { analyze, dedupeKey, hostOf, instagramHandle, normalizePhone, renderTemplate, scoreLead, type OppRule, type ScoreRule } from "./leads";
import { mapCsv, parseCsv } from "./csv";

const opp: OppRule[] = [
  { id: "1", name: "Sem site", condition: { field: "website", op: "missing" }, opportunity: "Criar site", suggestedService: "Landing Page", priority: 1, active: true },
  { id: "2", name: "Agendamento", condition: { all: [{ field: "niche", op: "in", value: ["Barbearia"] }, { field: "website", op: "missing" }] }, opportunity: "Agendamento", suggestedService: "Sistema de Agendamento", priority: 5, active: true },
  { id: "3", name: "Inativa", condition: { field: "name", op: "present" }, opportunity: "x", suggestedService: null, priority: 9, active: false },
];
const score: ScoreRule[] = [
  { criterion: "has_phone", label: "Telefone", weight: 1, points: 10, active: true },
  { criterion: "no_website", label: "Sem site", weight: 1, points: 30, active: true },
  { criterion: "has_instagram", label: "Instagram", weight: 1, points: 10, active: false },
];

describe("normalização e deduplicação", () => {
  it("telefone", () => {
    expect(normalizePhone("+55 (94) 99123-4567")).toBe("94991234567");
    expect(normalizePhone("123")).toBeNull();
  });
  it("host e chave", () => {
    expect(hostOf("https://www.Exemplo.com.br/x")).toBe("exemplo.com.br");
    expect(hostOf("lixo")).toBeNull();
    expect(dedupeKey("Barbearia Ação", "Rua A, 10", "Marabá")).toBe(dedupeKey("barbearia acao", "rua a 10"));
  });
  it("instagram", () => {
    expect(instagramHandle("https://instagram.com/loja.x/")).toBe("loja.x");
    expect(instagramHandle("@loja")).toBe("loja");
  });
});

describe("análise e score", () => {
  it("usa só dados reais e a regra de maior prioridade", () => {
    const a = analyze({ name: "B", niche: "Barbearia", phone: "94991234567" }, opp, score);
    expect(a.opportunity).toBe("Agendamento");
    expect(a.website).toBe("não encontrado");
    expect(a.presence).toBe("Nenhuma encontrada");
  });
  it("score relativo, ignora regras inativas", () => {
    expect(scoreLead({ name: "x", phone: "94991234567" }, score).score).toBe(100);
    expect(scoreLead({ name: "x", website: "a.com" }, score).score).toBe(0);
  });
});

describe("templates e csv", () => {
  it("mantém marcador ausente e lista faltantes", () => {
    const r = renderTemplate("Oi {{empresa}} de {{cidade}}", { empresa: "X" });
    expect(r.text).toBe("Oi X de {{cidade}}");
    expect(r.missing).toEqual(["cidade"]);
  });
  it("csv com aspas e ponto-e-vírgula", () => {
    const rows = mapCsv(parseCsv('Empresa;Telefone;Cidade\n"Loja; X";9499;Marabá\n'));
    expect(rows[0]).toMatchObject({ name: "Loja; X", phone: "9499", city: "Marabá" });
    expect(() => mapCsv(parseCsv("a,b\n1,2"))).toThrow();
  });
});
