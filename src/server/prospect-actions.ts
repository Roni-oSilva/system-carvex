"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { parseCsv, mapCsv } from "@/lib/csv";
import { searchPlaces, placesConfigured } from "@/lib/google-places";
import { log } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { act, opt, parse, UserError } from "./guard";
import { ingestLead, loadRules } from "./leads";
import { notify } from "./notify";

const schema = z.object({
  nicheName: z.string().trim().min(2, "informe o nicho").max(80),
  city: z.string().trim().min(2, "informe a cidade").max(100),
  region: z.string().max(100).optional(), keyword: z.string().max(100).optional(),
  quantity: z.coerce.number().int().min(1).max(60).default(20),
});

async function nicheIdFor(name: string) {
  const n = await db.niche.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  return n?.id ?? null;
}

/** Busca via Google Places (API oficial). O processamento é registrado como Job (PENDENTE → PROCESSANDO → CONCLUÍDO/ERRO). */
export async function prospectSearchAction(form: FormData): Promise<void> {
  await act(form, "/prospeccao", async (s) => {
    const d = parse(schema, form);
    if (!placesConfigured()) throw new UserError("Busca automática indisponível: AGUARDANDO INTEGRAÇÃO (GOOGLE_PLACES_API_KEY). Você já pode importar uma planilha CSV ou cadastrar leads manualmente.");
    if (!rateLimit(`prospect:${s.userId}`, 6, 3600_000)) throw new UserError("Limite de buscas por hora atingido. Aguarde um pouco.");
    const query = [d.keyword, d.nicheName, "em", d.city, d.region].filter(Boolean).join(" ");
    const job = await db.job.create({ data: { type: "lead_search", status: "PROCESSING", startedAt: new Date(), payload: { query, quantity: d.quantity } } });
    try {
      const places = await searchPlaces(query, d.quantity);
      const rules = await loadRules();
      const nicheId = await nicheIdFor(d.nicheName);
      let created = 0, merged = 0;
      for (const p of places) {
        const r = await ingestLead({ name: p.name, category: p.category, nicheId, city: d.city, address: p.address, phone: p.phone, website: p.website, rating: p.rating, reviewCount: p.reviewCount, provider: "google_places", externalId: p.externalId, rawRef: { mapsUrl: p.mapsUrl } }, rules);
        if (r.result === "created") created++; else merged++;
      }
      await db.job.update({ where: { id: job.id }, data: { status: "DONE", finishedAt: new Date(), result: { found: places.length, created, merged } } });
      if (created) await notify("NEW_LEAD", `${created} novo(s) lead(s) em ${d.city}`, `Busca: ${query}`, "/crm");
      return { msg: `Busca concluída: ${places.length} resultado(s), ${created} novo(s), ${merged} já existiam (sem duplicar).` };
    } catch (e) {
      log.error("lead_search_failed", { err: e });
      await db.job.update({ where: { id: job.id }, data: { status: "ERROR", finishedAt: new Date(), error: "Falha na busca (veja o log do servidor)" } });
      await notify("INTEGRATION_FAILED", "Falha na integração Google Places", undefined, "/prospeccao", 1);
      throw new UserError("A busca falhou. Verifique a chave da API e tente novamente.");
    }
  });
}

/** Importação de CSV (planilha própria, listas autorizadas). */
export async function importCsvAction(form: FormData): Promise<void> {
  await act(form, "/prospeccao", async () => {
    const file = form.get("file");
    const pasted = opt(form.get("text"));
    let text = pasted ?? "";
    if (file instanceof File && file.size > 0) {
      if (file.size > 1_000_000) throw new UserError("Arquivo muito grande (máx. 1 MB).");
      text = await file.text();
    }
    if (!text) throw new UserError("Envie um arquivo CSV ou cole o conteúdo.");
    let rows: Record<string, string | null>[];
    try { rows = mapCsv(parseCsv(text)); } catch (e) { throw new UserError(e instanceof Error ? e.message : "CSV inválido."); }
    if (rows.length > 2000) throw new UserError("Máximo de 2000 linhas por importação.");
    const nicheDefault = opt(form.get("nicheName"));
    const rules = await loadRules();
    const niches = await db.niche.findMany();
    let created = 0, merged = 0, skipped = 0;
    for (const r of rows) {
      if (!r.name) { skipped++; continue; }
      const nm = r.niche ?? nicheDefault;
      const nicheId = nm ? niches.find((n) => n.name.toLowerCase() === nm.toLowerCase())?.id ?? null : null;
      const res = await ingestLead({ name: r.name, category: r.category, nicheId, city: r.city, state: r.state?.slice(0, 2).toUpperCase() ?? null, address: r.address, phone: r.phone, email: r.email, website: r.website, instagram: r.instagram, provider: "csv" }, rules);
      if (res.result === "created") created++; else merged++;
    }
    await db.job.create({ data: { type: "csv_import", status: "DONE", startedAt: new Date(), finishedAt: new Date(), result: { created, merged, skipped } } });
    return { msg: `Importação: ${created} novo(s), ${merged} duplicado(s) mesclado(s), ${skipped} linha(s) sem nome ignorada(s).` };
  });
}
