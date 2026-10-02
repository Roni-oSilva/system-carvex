/** Parser CSV mínimo (aspas, vírgula ou ponto-e-vírgula) para importação de leads. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const ALIASES: Record<string, string[]> = {
  name: ["nome", "empresa", "name", "razao social", "nome da empresa"],
  phone: ["telefone", "phone", "celular", "whatsapp", "fone"],
  website: ["site", "website", "url", "web"],
  instagram: ["instagram", "insta"],
  city: ["cidade", "city", "municipio"],
  state: ["estado", "uf", "state"],
  address: ["endereco", "address", "logradouro"],
  category: ["categoria", "category", "segmento"],
  niche: ["nicho", "niche"],
  email: ["email", "e-mail", "mail"],
};

export function mapCsv(rows: string[][]) {
  const [head, ...body] = rows;
  if (!head) return [];
  const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const idx: Record<string, number> = {};
  head.forEach((h, i) => { for (const [k, al] of Object.entries(ALIASES)) if (al.includes(strip(h)) && !(k in idx)) idx[k] = i; });
  if (!("name" in idx)) throw new Error("A planilha precisa de uma coluna 'nome' ou 'empresa'.");
  return body.map((r) => Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, r[i]?.trim() || null]))) as Record<string, string | null>[];
}
