import { env } from "./env";

export type PlaceResult = {
  externalId: string; name: string; address: string | null; phone: string | null; website: string | null;
  rating: number | null; reviewCount: number | null; category: string | null; mapsUrl: string | null;
};

type ApiPlace = {
  id: string; displayName?: { text?: string }; formattedAddress?: string; nationalPhoneNumber?: string; internationalPhoneNumber?: string;
  websiteUri?: string; rating?: number; userRatingCount?: number; primaryTypeDisplayName?: { text?: string }; googleMapsUri?: string;
};

export const placesConfigured = () => !!env().GOOGLE_PLACES_API_KEY;

/** Google Places API (New) — Text Search. API oficial; respeite os termos de uso/armazenamento do Google. */
export async function searchPlaces(query: string, limit: number): Promise<PlaceResult[]> {
  const key = env().GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY não configurada");
  const out: PlaceResult[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3 && out.length < limit; page++) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.googleMapsUri,nextPageToken",
      },
      body: JSON.stringify({ textQuery: query, languageCode: "pt-BR", regionCode: "BR", pageSize: Math.min(20, limit - out.length), ...(pageToken ? { pageToken } : {}) }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Places API HTTP ${res.status}`);
    const data = (await res.json()) as { places?: ApiPlace[]; nextPageToken?: string };
    for (const p of data.places ?? []) {
      out.push({
        externalId: p.id, name: p.displayName?.text ?? "", address: p.formattedAddress ?? null,
        phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null, website: p.websiteUri ?? null,
        rating: p.rating ?? null, reviewCount: p.userRatingCount ?? null, category: p.primaryTypeDisplayName?.text ?? null, mapsUrl: p.googleMapsUri ?? null,
      });
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return out.filter((p) => p.name).slice(0, limit);
}
