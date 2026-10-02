// Funções puras de domínio comercial (sem acesso a banco): normalização, deduplicação, análise, score, oportunidades e templates.

export const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Somente dígitos, sem DDI 55. Retorna null se curto demais para ser um telefone. */
export function normalizePhone(p: string | null | undefined): string | null {
  let d = (p ?? "").replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  return d.length >= 10 && d.length <= 11 ? d : null;
}

/** Celular brasileiro (11 dígitos, 9 após o DDD): *possível* WhatsApp — não é confirmação. */
export const isMobile = (phoneNorm: string | null) => !!phoneNorm && /^\d{2}9\d{8}$/.test(phoneNorm);

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    return h.includes(".") ? h : null;
  } catch {
    return null;
  }
}

export const SOCIAL_HOSTS = /(instagram|facebook|fb|linktr|wa\.me|whatsapp|tiktok|youtube|ifood|goo\.gl|maps\.google)/i;

export const dedupeKey = (name: string, address?: string | null, city?: string | null) => {
  const n = norm(name);
  const a = norm(address) || norm(city);
  return n && a ? `${n}|${a}` : null;
};

export function instagramHandle(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = v.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const h = (m?.[1] ?? v).replace(/^@/, "").trim();
  return /^[A-Za-z0-9._]{2,30}$/.test(h) ? h : null;
}

// ───────── Regras comerciais ─────────
export type Facts = {
  name: string; niche?: string | null; city?: string | null; website?: string | null; instagram?: string | null;
  phone?: string | null; email?: string | null; rating?: number | null; reviewCount?: number | null;
};
export type Cond = { field: string; op: "missing" | "present" | "in" | "eq" | "gte" | "lte"; value?: unknown } | { all: Cond[] };
export type OppRule = { id: string; name: string; condition: unknown; opportunity: string; suggestedService: string | null; priority: number; active: boolean };
export type ScoreRule = { criterion: string; label: string; weight: number; points: number; active: boolean };

const get = (f: Facts, field: string): unknown => (f as Record<string, unknown>)[field];

export function evalCond(c: Cond, f: Facts): boolean {
  if ("all" in c) return c.all.length > 0 && c.all.every((x) => evalCond(x, f));
  const v = get(f, c.field);
  const empty = v === null || v === undefined || v === "";
  switch (c.op) {
    case "missing": return empty;
    case "present": return !empty;
    case "eq": return !empty && norm(String(v)) === norm(String(c.value));
    case "in": return !empty && Array.isArray(c.value) && c.value.some((x) => norm(String(x)) === norm(String(v)));
    case "gte": return !empty && Number(v) >= Number(c.value);
    case "lte": return !empty && Number(v) <= Number(c.value);
    default: return false;
  }
}

export function detectOpportunities(f: Facts, rules: OppRule[]) {
  return rules
    .filter((r) => r.active)
    .sort((a, b) => b.priority - a.priority)
    .filter((r) => { try { return evalCond(r.condition as Cond, f); } catch { return false; } })
    .map((r) => ({ rule: r.name, opportunity: r.opportunity, service: r.suggestedService }));
}

const SCORE_TESTS: Record<string, (f: Facts, p: string | null) => boolean> = {
  has_phone: (_f, p) => !!p,
  has_whatsapp: (_f, p) => isMobile(p),
  has_instagram: (f) => !!f.instagram,
  has_reviews: (f) => (f.reviewCount ?? 0) > 0,
  no_website: (f) => !f.website,
  has_digital_presence: (f) => !!(f.website || f.instagram || (f.reviewCount ?? 0) > 0),
};

/** Score 0–100 relativo ao máximo possível das regras ativas. Apenas priorização interna. */
export function scoreLead(f: Facts, rules: ScoreRule[]) {
  const p = normalizePhone(f.phone);
  const active = rules.filter((r) => r.active && SCORE_TESTS[r.criterion]);
  const max = active.reduce((a, r) => a + r.points * r.weight, 0);
  const hit = active.filter((r) => SCORE_TESTS[r.criterion]!(f, p));
  const sum = hit.reduce((a, r) => a + r.points * r.weight, 0);
  return { score: max ? Math.round((100 * sum) / max) : 0, matched: hit.map((r) => r.label) };
}

export function presenceLevel(f: Facts): "Nenhuma encontrada" | "Baixa" | "Média" | "Alta" {
  const n = [f.website, f.instagram, (f.reviewCount ?? 0) > 0].filter(Boolean).length;
  return n === 0 ? "Nenhuma encontrada" : n === 1 ? "Baixa" : n === 2 ? "Média" : "Alta";
}

/** Análise baseada SOMENTE nos dados encontrados; ausência é registrada como "não encontrado". */
export function analyze(f: Facts, opp: OppRule[], score: ScoreRule[]) {
  const ops = detectOpportunities(f, opp);
  const s = scoreLead(f, score);
  return {
    presence: presenceLevel(f),
    website: f.website ?? "não encontrado",
    instagram: f.instagram ?? "não encontrado",
    phone: f.phone ?? "não encontrado",
    rating: f.rating ?? "não encontrado",
    opportunities: ops,
    opportunity: ops[0]?.opportunity ?? null,
    product: ops[0]?.service ?? null,
    score: s.score,
    scoreMatched: s.matched,
    analyzedAt: new Date().toISOString(),
  };
}

// ───────── Templates de mensagem ─────────
export const TEMPLATE_VARS = ["empresa", "nome", "cidade", "nicho", "servico", "oportunidade", "site", "instagram", "telefone"] as const;

export function renderTemplate(body: string, vars: Partial<Record<(typeof TEMPLATE_VARS)[number], string | null | undefined>>) {
  const missing = new Set<string>();
  const text = body.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => {
    const v = (vars as Record<string, string | null | undefined>)[k];
    if (v) return v;
    missing.add(k);
    return m; // mantém o marcador visível para o proprietário completar
  });
  return { text, missing: [...missing] };
}
