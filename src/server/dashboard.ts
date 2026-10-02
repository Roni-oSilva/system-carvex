import "server-only";
import { db } from "@/lib/db";

const num = (d: { toString(): string } | null | undefined) => (d ? Number(d.toString()) : 0);

export async function getDashboard() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay.getTime() - startOfDay.getDay() * 86400_000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const in7d = new Date(now.getTime() + 7 * 86400_000);

  const paidSum = (from: Date) => db.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID", deletedAt: null, paidAt: { gte: from } } });

  const [day, week, month, year, pending, overdue, expenses, ticket, leadsByStatus, leadsTotal, msgs, projects, late, soon, maint, monthly] = await Promise.all([
    paidSum(startOfDay), paidSum(startOfWeek), paidSum(startOfMonth), paidSum(startOfYear),
    db.payment.aggregate({ _sum: { amount: true }, where: { status: "PENDING", deletedAt: null, dueDate: { gte: now } } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { status: { in: ["PENDING", "OVERDUE"] }, deletedAt: null, dueDate: { lt: now } } }),
    db.expense.aggregate({ _sum: { amount: true }, where: { deletedAt: null, incurredAt: { gte: startOfMonth } } }),
    db.payment.aggregate({ _avg: { amount: true }, where: { status: "PAID", deletedAt: null, paidAt: { gte: startOfYear } } }),
    db.lead.groupBy({ by: ["status"], _count: true, where: { deletedAt: null } }),
    db.lead.count({ where: { deletedAt: null } }),
    db.message.groupBy({ by: ["status"], _count: true }),
    db.project.groupBy({ by: ["status"], _count: true, where: { deletedAt: null } }),
    db.project.count({ where: { deletedAt: null, status: { in: ["IN_PROGRESS", "WAITING_CLIENT", "REVIEW"] }, dueDate: { lt: now } } }),
    db.project.count({ where: { deletedAt: null, status: { in: ["IN_PROGRESS", "WAITING_CLIENT", "REVIEW"] }, dueDate: { gte: now, lte: in7d } } }),
    db.project.count({ where: { deletedAt: null, maintenance: true, status: { not: "CANCELED" } } }),
    db.payment.findMany({ where: { status: "PAID", deletedAt: null, paidAt: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } }, select: { amount: true, paidAt: true } }),
  ]);

  const L = Object.fromEntries(leadsByStatus.map((r) => [r.status, r._count])) as Record<string, number>;
  const M = Object.fromEntries(msgs.map((r) => [r.status, r._count])) as Record<string, number>;
  const P = Object.fromEntries(projects.map((r) => [r.status, r._count])) as Record<string, number>;
  const atLeast = (...s: string[]) => s.reduce((a, k) => a + (L[k] ?? 0), 0);

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), total: 0 };
  });
  for (const p of monthly) {
    if (!p.paidAt) continue;
    const m = months.find((x) => x.key === `${p.paidAt!.getFullYear()}-${p.paidAt!.getMonth()}`);
    if (m) m.total += num(p.amount);
  }

  const revenueMonth = num(month._sum.amount);
  const expensesMonth = num(expenses._sum.amount);
  return {
    finance: {
      day: num(day._sum.amount), week: num(week._sum.amount), month: revenueMonth, year: num(year._sum.amount),
      receivable: num(pending._sum.amount), overdue: num(overdue._sum.amount), expenses: expensesMonth,
      profit: revenueMonth - expensesMonth, ticket: num(ticket._avg.amount),
    },
    sales: {
      leads: leadsTotal,
      qualified: atLeast("ANALYZED", "MESSAGE_READY", "CONTACTED", "REPLIED", "INTERESTED", "MEETING", "PROPOSAL", "NEGOTIATION", "WON"),
      contacted: atLeast("CONTACTED", "REPLIED", "INTERESTED", "MEETING", "PROPOSAL", "NEGOTIATION", "WON"),
      prepared: M.DRAFT ?? 0, sent: M.SENT ?? 0,
      replied: atLeast("REPLIED", "INTERESTED", "MEETING", "PROPOSAL", "NEGOTIATION", "WON"),
      interested: atLeast("INTERESTED", "MEETING", "PROPOSAL", "NEGOTIATION", "WON"),
      meetings: L.MEETING ?? 0, proposals: L.PROPOSAL ?? 0, negotiation: L.NEGOTIATION ?? 0, won: L.WON ?? 0,
      conversion: leadsTotal ? ((L.WON ?? 0) / leadsTotal) * 100 : 0,
    },
    ops: { inProgress: P.IN_PROGRESS ?? 0, waiting: P.WAITING_CLIENT ?? 0, soon, late, done: P.DONE ?? 0, maintenance: maint },
    months,
  };
}
