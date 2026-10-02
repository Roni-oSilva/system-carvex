import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { basicClassify, basicNextSteps, basicSummary } from "./ai-basic";

describe("modo básico", () => {
  it("classifica nicho só entre os cadastrados", () => {
    expect(basicClassify({ name: "Barbearia do Zé" }, ["Barbearia", "Salão"])?.niche).toBe("Barbearia");
    expect(basicClassify({ name: "Studio Beleza & Cabelo" }, ["Barbearia", "Salão"])?.niche).toBe("Salão");
    expect(basicClassify({ name: "Barbearia do Zé" }, ["Salão"])).toBeNull();
    expect(basicClassify({ name: "Empresa XPTO" }, ["Barbearia"])).toBeNull();
  });
  it("próximos passos por etapa e alerta de telefone", () => {
    const s = basicNextSteps("CONTACTED", { phone: null, website: null, opportunity: "Landing Page" });
    expect(s.length).toBeLessThanOrEqual(5);
    expect(s.join(" ")).toMatch(/Telefone não encontrado/);
  });
  it("resumo usa os números e alerta atraso", () => {
    const t = basicSummary({ revenueMonth: 1000, expensesMonth: 300, receivable: 500, overdue: 200, leads: 10, contacted: 3, replied: 0, won: 0, projectsLate: 1, projectsActive: 2 });
    expect(t).toMatch(/700,00/); expect(t).toMatch(/em atraso/); expect(t).toMatch(/menos da metade/);
  });
});

// Servidores falsos reproduzem o formato de cada provedor.
let server: Server; let port = 0; const seen: { url?: string; headers?: Record<string, unknown>; body?: Record<string, unknown> }[] = [];
beforeAll(async () => {
  server = createServer((req, res) => {
    let b = ""; req.on("data", (d) => (b += d));
    req.on("end", () => {
      seen.push({ url: req.url, headers: req.headers, body: JSON.parse(b || "{}") });
      res.setHeader("content-type", "application/json");
      if (req.url?.startsWith("/nada")) { res.statusCode = 404; res.end("{}"); }
      else if (req.url?.includes("generateContent")) res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: "OK do Gemini" }] } }] }));
      else if (req.url?.endsWith("/chat/completions")) res.end(JSON.stringify({ choices: [{ message: { content: "OK do Groq" } }] }));
      else if (req.url?.endsWith("/messages")) res.end(JSON.stringify({ content: [{ type: "text", text: "OK da Anthropic" }] }));
      else { res.statusCode = 404; res.end("{}"); }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as { port: number }).port;
});
afterAll(() => server.close());

async function ask(provider: string) {
  vi.resetModules();
  Object.assign(process.env, { DATABASE_URL: "postgresql://x", DATA_ENCRYPTION_KEY: "ab".repeat(32), APP_SECRET: "s".repeat(40), LLM_API_KEY: "chave-teste", LLM_PROVIDER: provider, LLM_BASE_URL: `http://127.0.0.1:${port}/v1` });
  delete process.env.LLM_MODEL;
  const m = await import("./llm");
  return { text: await m.askLlm("Olá", 50), info: m.aiInfo() };
}

describe("provedores de IA (servidor falso)", () => {
  it("Gemini: chave no header, não na URL", async () => {
    const r = await ask("gemini");
    expect(r.text).toBe("OK do Gemini");
    const q = seen.at(-1)!;
    expect(q.url).not.toContain("chave-teste");
    expect(q.headers?.["x-goog-api-key"]).toBe("chave-teste");
    expect((q.body as { systemInstruction: unknown }).systemInstruction).toBeTruthy();
  });
  it("Groq (formato OpenAI)", async () => {
    expect((await ask("groq")).text).toBe("OK do Groq");
    expect(seen.at(-1)!.headers?.authorization).toBe("Bearer chave-teste");
  });
  it("Anthropic", async () => {
    expect((await ask("anthropic")).text).toBe("OK da Anthropic");
    expect(seen.at(-1)!.headers?.["x-api-key"]).toBe("chave-teste");
  });
  it("resposta vazia/erro HTTP lançam erro", async () => {
    vi.resetModules();
    Object.assign(process.env, { LLM_PROVIDER: "groq", LLM_BASE_URL: `http://127.0.0.1:${port}/nada` });
    const m = await import("./llm");
    await expect(m.askLlm("x")).rejects.toThrow(/HTTP 404/);
  });
  it("sem chave → modo básico", async () => {
    vi.resetModules(); delete process.env.LLM_API_KEY;
    const m = await import("./llm");
    expect(m.aiMode()).toBe("basic");
  });
});
