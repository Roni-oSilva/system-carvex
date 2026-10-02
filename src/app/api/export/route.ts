import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getSession } from "@/server/session";

export const dynamic = "force-dynamic";

/** Exportação completa (apenas dono autenticado). Nunca inclui hashes, segredos ou tokens. */
export async function GET() {
  const s = await getSession();
  if (!s || s.user.role !== "OWNER") return new NextResponse("Não autorizado", { status: 401 });
  const [leads, clients, proposals, projects, payments, expenses, services, templates] = await Promise.all([
    db.lead.findMany({ include: { sources: true, tags: true, interactions: true, messages: true } }),
    db.client.findMany({ include: { interactions: true, subscriptions: true } }),
    db.proposal.findMany({ include: { items: true } }),
    db.project.findMany({ include: { tasks: true } }),
    db.payment.findMany(), db.expense.findMany(), db.service.findMany({ include: { extras: true } }), db.messageTemplate.findMany(),
  ]);
  await audit({ action: "data.export", userId: s.userId, category: "security" });
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), leads, clients, proposals, projects, payments, expenses, services, templates }, null, 2);
  return new NextResponse(body, { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="carvex-export-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" } });
}
