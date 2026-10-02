import { Field } from "./ui";

type L = { id?: string; name?: string; tradeName?: string | null; nicheId?: string | null; category?: string | null; city?: string | null; state?: string | null; address?: string | null; phone?: string | null; email?: string | null; website?: string | null; instagram?: string | null; notes?: string | null; tags?: string };

export function LeadFields({ lead, niches }: { lead?: L; niches: { id: string; name: string }[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {lead?.id && <input type="hidden" name="id" value={lead.id} />}
      <Field label="Nome da empresa *"><input name="name" required minLength={2} defaultValue={lead?.name} className="input" /></Field>
      <Field label="Nome comercial"><input name="tradeName" defaultValue={lead?.tradeName ?? ""} className="input" /></Field>
      <Field label="Nicho">
        <select name="nicheId" defaultValue={lead?.nicheId ?? ""} className="input"><option value="">— não definido —</option>{niches.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select>
      </Field>
      <Field label="Categoria"><input name="category" defaultValue={lead?.category ?? ""} className="input" /></Field>
      <Field label="Cidade"><input name="city" defaultValue={lead?.city ?? ""} className="input" /></Field>
      <Field label="UF"><input name="state" maxLength={2} defaultValue={lead?.state ?? ""} className="input uppercase" /></Field>
      <Field label="Endereço" className="sm:col-span-2"><input name="address" defaultValue={lead?.address ?? ""} className="input" /></Field>
      <Field label="Telefone / WhatsApp"><input name="phone" defaultValue={lead?.phone ?? ""} className="input" /></Field>
      <Field label="E-mail"><input name="email" type="email" defaultValue={lead?.email ?? ""} className="input" /></Field>
      <Field label="Site"><input name="website" defaultValue={lead?.website ?? ""} className="input" /></Field>
      <Field label="Instagram (@ ou link)"><input name="instagram" defaultValue={lead?.instagram ?? ""} className="input" /></Field>
      <Field label="Tags (separadas por vírgula)" className="sm:col-span-2"><input name="tags" defaultValue={lead?.tags ?? ""} className="input" /></Field>
      <Field label="Observações" className="sm:col-span-2"><textarea name="notes" defaultValue={lead?.notes ?? ""} className="input" /></Field>
    </div>
  );
}
