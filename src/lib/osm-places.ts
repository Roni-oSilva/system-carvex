/**
 * Busca de empresas pelo OpenStreetMap — gratuita, sem chave de API.
 *  - Nominatim (geocodifica a cidade) e Overpass (lista estabelecimentos), ambos serviços públicos com política de uso justo:
 *    identificamos o app no User-Agent, fazemos poucas requisições e respeitamos o limite de 1 req/s do Nominatim.
 *  - Dados © contribuidores do OpenStreetMap (licença ODbL): mantenha a atribuição.
 * Cobertura depende do mapeamento local: no interior do Brasil muitos negócios não estão no OSM e telefone/site costumam faltar
 * (ficam "não encontrado"). Avaliações não existem no OSM.
 */
export type PlaceResult = {
  externalId: string; name: string; address: string | null; phone: string | null; website: string | null;
  instagram: string | null; email: string | null; category: string | null; mapsUrl: string;
};

const UA = "Carvex/1.0 (prospeccao privada; contato via APP_URL)";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS = "https://overpass-api.de/api/interpreter";

/** Nicho (texto livre) → filtros de tags do OSM. Sem correspondência, busca pelo nome. */
const NICHE_TAGS: [RegExp, string[]][] = [
  [/barbear|barber/i, ['"shop"="hairdresser"', '"shop"="barber"']],
  [/sal[aã]o|beleza|cabelei|est[eé]tica|manicure/i, ['"shop"="hairdresser"', '"shop"="beauty"']],
  [/pizz/i, ['"amenity"="restaurant"]["cuisine"~"pizza"', '"amenity"="fast_food"]["cuisine"~"pizza"']],
  [/restaurante|lanchonete|hamb[uú]rguer|churrasc/i, ['"amenity"="restaurant"', '"amenity"="fast_food"', '"amenity"="cafe"']],
  [/dentist|odonto/i, ['"amenity"="dentist"', '"healthcare"="dentist"']],
  [/cl[ií]nica|m[eé]dic|consult[oó]rio/i, ['"amenity"="clinic"', '"amenity"="doctors"', '"healthcare"="clinic"']],
  [/academia|fitness|muscula/i, ['"leisure"="fitness_centre"']],
  [/celular|smartphone|assist[eê]ncia t[eé]cnica/i, ['"shop"="mobile_phone"', '"shop"="electronics"']],
  [/oficina|mec[aâ]nic|auto ?pe[cç]as/i, ['"shop"="car_repair"', '"shop"="car_parts"']],
  [/gesso|drywall/i, ['"craft"="plasterer"', '"craft"="builder"']],
  [/constru[cç][aã]o|material de constru|engenhar/i, ['"shop"="doityourself"', '"shop"="hardware"', '"craft"="builder"']],
  [/imobili[aá]ri/i, ['"office"="estate_agent"']],
  [/hotel|pousada|hostel/i, ['"tourism"="hotel"', '"tourism"="guest_house"', '"tourism"="hostel"']],
  [/escrit[oó]rio|contab|advoca/i, ['"office"~"accountant|lawyer|company|consulting"']],
  [/pet|veterin/i, ['"shop"="pet"', '"amenity"="veterinary"']],
  [/farm[aá]cia/i, ['"amenity"="pharmacy"']],
  [/mercado|supermercado/i, ['"shop"="supermarket"', '"shop"="convenience"']],
  [/padaria|confeitaria/i, ['"shop"="bakery"']],
];

const esc = (s: string) => s.replace(/[\\"]/g, "").replace(/[.*+?^${}()|[\]]/g, "\\$&").slice(0, 60);

export function buildOverpassQuery(opts: { niche: string; keyword?: string; area?: { relationId: number } | { bbox: [number, number, number, number] }; limit: number }) {
  const where = !opts.area ? "" : "relationId" in opts.area ? "(area.a)" : `(${opts.area.bbox.join(",")})`;
  const tagSets = NICHE_TAGS.find(([re]) => re.test(opts.niche))?.[1];
  const nameFilter = opts.keyword ? `["name"~"${esc(opts.keyword)}",i]` : "";
  const parts = tagSets
    ? tagSets.map((t) => `nwr[${t}]${nameFilter}["name"]${where};`)
    : [`nwr["name"~"${esc(opts.niche)}",i]["shop"]${where};`, `nwr["name"~"${esc(opts.niche)}",i]["amenity"]${where};`, `nwr["name"~"${esc(opts.niche)}",i]["office"]${where};`];
  const areaDef = opts.area && "relationId" in opts.area ? `area(${3_600_000_000 + opts.area.relationId})->.a;` : "";
  return `[out:json][timeout:25];${areaDef}(${parts.join("")});out center tags ${Math.min(Math.max(opts.limit, 1), 200)};`;
}

type OsmEl = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

export function parseOverpass(json: { elements?: OsmEl[] }): PlaceResult[] {
  const seen = new Set<string>();
  const out: PlaceResult[] = [];
  for (const el of json.elements ?? []) {
    const t = el.tags ?? {};
    const name = t.name?.trim();
    if (!name) continue;
    const externalId = `${el.type}/${el.id}`;
    if (seen.has(externalId)) continue;
    seen.add(externalId);
    const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
    const address = [street, t["addr:suburb"] ?? t["addr:neighbourhood"], t["addr:city"]].filter(Boolean).join(" - ") || null;
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    out.push({
      externalId, name, address,
      phone: t.phone ?? t["contact:phone"] ?? t["contact:mobile"] ?? t["contact:whatsapp"] ?? null,
      website: t.website ?? t["contact:website"] ?? null,
      instagram: t["contact:instagram"] ?? null,
      email: t.email ?? t["contact:email"] ?? null,
      category: t.shop ?? t.amenity ?? t.office ?? t.craft ?? t.tourism ?? t.leisure ?? null,
      mapsUrl: lat != null && lon != null ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}` : `https://www.openstreetmap.org/${externalId}`,
    });
  }
  return out;
}

async function geocode(city: string, region?: string) {
  const q = [city, region, "Brasil"].filter(Boolean).join(", ");
  const res = await fetch(`${NOMINATIM}?${new URLSearchParams({ q, format: "jsonv2", limit: "1", countrycodes: "br" })}`, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const [hit] = (await res.json()) as { osm_type: string; osm_id: number; boundingbox: string[] }[];
  if (!hit) return null;
  if (hit.osm_type === "relation") return { relationId: hit.osm_id };
  const [s, n, w, e] = hit.boundingbox.map(Number);
  return { bbox: [s!, w!, n!, e!] as [number, number, number, number] };
}

export async function searchPlaces(opts: { niche: string; city: string; region?: string; keyword?: string; limit: number }): Promise<PlaceResult[]> {
  const area = await geocode(opts.city, opts.region);
  if (!area) throw new Error("Cidade não encontrada no OpenStreetMap");
  const res = await fetch(OVERPASS, {
    method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: buildOverpassQuery({ niche: opts.niche, keyword: opts.keyword, area, limit: opts.limit }) }),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  return parseOverpass((await res.json()) as { elements?: OsmEl[] }).slice(0, opts.limit);
}
