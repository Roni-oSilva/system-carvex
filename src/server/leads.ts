import "server-only";
import type { LeadStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { analyze, dedupeKey, hostOf, instagramHandle, normalizePhone, SOCIAL_HOSTS, type Facts, type OppRule, type ScoreRule } from "@/lib/leads";

export async function loadRules() {
  const [opp, score] = await Promise.all([db.businessRule.findMany(), db.leadScoreRule.findMany()]);
  return { opp: opp as unknown as OppRule[], score: score as ScoreRule[] };
}

export type Incoming = {
  name: string; tradeName?: string | null; category?: string | null; nicheId?: string | null; city?: string | null; state?: string | null;
  address?: string | null; phone?: string | null; email?: string | null; website?: string | null; instagram?: string | null;
  rating?: number | null; reviewCount?: number | null; provider: string; externalId?: string | null; rawRef?: Prisma.InputJsonValue;
};

/** Separa "site" que na verdade é rede social e normaliza os campos de contato. */
function cleanContact(i: Incoming) {
  let website = i.website?.trim() || null;
  let instagram = instagramHandle(i.instagram);
  if (website && SOCIAL_HOSTS.test(website)) {
    if (!instagram) instagram = instagramHandle(website);
    website = null;
  }
  return { website, websiteHost: hostOf(website), instagram, phoneNorm: normalizePhone(i.phone) };
}

export async function ingestLead(i: Incoming, rules?: Awaited<ReturnType<typeof loadRules>>): Promise<{ result: "created" | "merged"; id: string }> {
  const r = rules ?? (await loadRules());
  const c = cleanContact(i);
  const key = dedupeKey(i.name, i.address, i.city);

  let existing = i.externalId ? (await db.leadSource.findUnique({ where: { provider_externalId: { provider: i.provider, externalId: i.externalId } }, include: { lead: true } }))?.lead : undefined;
  if (existing?.deletedAt) existing = undefined;
  if (!existing) {
    const or: Prisma.LeadWhereInput[] = [];
    if (c.phoneNorm) or.push({ phoneNorm: c.phoneNorm });
    if (c.websiteHost) or.push({ websiteHost: c.websiteHost });
    if (key) or.push({ dedupeKey: key });
    if (or.length) existing = (await db.lead.findFirst({ where: { deletedAt: null, OR: or } })) ?? undefined;
  }

  const source = { provider: i.provider, externalId: i.externalId ?? null, rawRef: i.rawRef };
  if (existing) {
    const known = await db.leadSource.count({ where: { leadId: existing.id, provider: i.provider, externalId: i.externalId ?? null } });
    if (!known) await db.leadSource.create({ data: { ...source, leadId: existing.id } });
    // completa apenas campos vazios; nunca sobrescreve dado existente
    const fill: Prisma.LeadUpdateInput = {};
    if (!existing.phone && i.phone) Object.assign(fill, { phone: i.phone, phoneNorm: c.phoneNorm });
    if (!existing.website && c.website) Object.assign(fill, { website: c.website, websiteHost: c.websiteHost });
    if (!existing.instagram && c.instagram) fill.instagram = c.instagram;
    if (!existing.email && i.email) fill.email = i.email;
    if (!existing.address && i.address) { fill.address = i.address; fill.dedupeKey = key; }
    if (existing.rating == null && i.rating != null) Object.assign(fill, { rating: i.rating, reviewCount: i.reviewCount });
    if (Object.keys(fill).length) {
      await db.lead.update({ where: { id: existing.id }, data: fill });
      await reanalyze(existing.id, r);
    }
    return { result: "merged", id: existing.id };
  }

  const lead = await db.lead.create({
    data: {
      name: i.name.trim(), tradeName: i.tradeName ?? null, category: i.category ?? null, nicheId: i.nicheId ?? null,
      city: i.city ?? null, state: i.state ?? null, address: i.address ?? null, phone: i.phone ?? null, phoneNorm: c.phoneNorm,
      email: i.email ?? null, website: c.website, websiteHost: c.websiteHost, instagram: c.instagram,
      rating: i.rating ?? null, reviewCount: i.reviewCount ?? null, dedupeKey: key, status: "FOUND",
      sources: { create: source },
    },
  });
  await reanalyze(lead.id, r);
  return { result: "created", id: lead.id };
}

export async function reanalyze(leadId: string, rules?: Awaited<ReturnType<typeof loadRules>>) {
  const r = rules ?? (await loadRules());
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { niche: true } });
  const facts: Facts = {
    name: lead.name, niche: lead.niche?.name, city: lead.city, website: lead.website, instagram: lead.instagram,
    phone: lead.phone, email: lead.email, rating: lead.rating, reviewCount: lead.reviewCount,
  };
  const a = analyze(facts, r.opp, r.score);
  await db.lead.update({
    where: { id: leadId },
    data: {
      analysis: a as unknown as Prisma.InputJsonValue, score: a.score, opportunity: a.opportunity, suggestedProduct: a.product,
      status: lead.status === "FOUND" ? "ANALYZED" : lead.status,
    },
  });
}

/** Garante que existe um cliente para o lead (idempotente). */
export async function ensureClient(leadId: string) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { client: true } });
  if (lead.client && !lead.client.deletedAt) return lead.client;
  if (lead.client?.deletedAt) return db.client.update({ where: { id: lead.client.id }, data: { deletedAt: null } });
  return db.client.create({
    data: { leadId, name: lead.tradeName || lead.name, phone: lead.phone, whatsapp: lead.phone, email: lead.email, city: lead.city, nicheId: lead.nicheId },
  });
}

export async function setLeadStatus(leadId: string, status: LeadStatus, note?: string) {
  const lead = await db.lead.update({ where: { id: leadId }, data: { status } });
  await db.interaction.create({ data: { leadId, type: "SYSTEM", summary: note ?? `Status alterado para ${status}` } });
  if (status === "WON") await ensureClient(leadId);
  return lead;
}
