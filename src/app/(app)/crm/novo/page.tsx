import { AppShell } from "@/components/app-shell";
import { LeadFields } from "@/components/lead-form";
import { Flash, Form, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { createLeadAction } from "@/server/crm-actions";
import { ctx } from "@/server/guard";

export default async function NewLead({ searchParams }: { searchParams: SP }) {
  const { csrf } = await ctx();
  const niches = await db.niche.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return (
    <AppShell current="/crm" title="CRM → Novo lead">
      <Flash sp={searchParams} />
      <Win title="Novo lead">
        <Form action={createLeadAction} csrf={csrf}>
          <LeadFields niches={niches} />
          <p className="text-xs text-muted">Se a empresa já existir (telefone, site ou nome+endereço), os dados são complementados sem duplicar.</p>
          <button className="btn">Salvar lead</button>
        </Form>
      </Win>
    </AppShell>
  );
}
