import { describe, expect, it } from "vitest";
import { buildOverpassQuery, parseOverpass } from "./osm-places";

describe("OpenStreetMap", () => {
  it("monta consulta por nicho dentro da área da cidade", () => {
    const q = buildOverpassQuery({ niche: "Barbearia", area: { relationId: 123 }, limit: 20 });
    expect(q).toContain("area(3600000123)->.a;");
    expect(q).toContain('nwr["shop"="hairdresser"]["name"](area.a);');
    expect(q).toContain("out center tags 20;");
  });
  it("pizzaria combina amenity + cuisine; bbox quando não há relação", () => {
    const q = buildOverpassQuery({ niche: "Pizzarias", area: { bbox: [-5.4, -49.2, -5.3, -49.0] }, limit: 5 });
    expect(q).toContain('["amenity"="restaurant"]["cuisine"~"pizza"]["name"](-5.4,-49.2,-5.3,-49);');
  });
  it("nicho desconhecido busca pelo nome e escapa entrada hostil", () => {
    const q = buildOverpassQuery({ niche: 'x"];out;//', keyword: "a.b", limit: 999 });
    expect(q).not.toContain('"];out;//');
    expect(q).toContain("out center tags 200;");
  });
  it("lê resposta: ignora sem nome, deduplica e mantém ausentes como null", () => {
    const r = parseOverpass({ elements: [
      { type: "node", id: 1, lat: -5.3, lon: -49.1, tags: { name: "Barbearia X", shop: "hairdresser", "addr:street": "Rua A", "addr:housenumber": "10", "contact:phone": "+55 94 99123-4567", "contact:instagram": "https://instagram.com/bx" } },
      { type: "node", id: 1, tags: { name: "Duplicada" } },
      { type: "way", id: 2, center: { lat: 1, lon: 2 }, tags: { shop: "hairdresser" } },
      { type: "way", id: 3, center: { lat: 1, lon: 2 }, tags: { name: "Sem contato", amenity: "dentist" } },
    ] });
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ externalId: "node/1", address: "Rua A, 10", phone: "+55 94 99123-4567", website: null, category: "hairdresser" });
    expect(r[1]).toMatchObject({ name: "Sem contato", phone: null, website: null, email: null });
  });
});
