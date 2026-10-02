import "server-only";
import type { NotificationType } from "@prisma/client";
import { db } from "@/lib/db";

/** Notifica todos os usuários ativos (hoje: apenas o proprietário). `dedupeHours` evita repetir o mesmo aviso. */
export async function notify(type: NotificationType, title: string, body?: string, href?: string, dedupeHours = 0) {
  const users = await db.user.findMany({ where: { active: true, deletedAt: null }, select: { id: true } });
  for (const u of users) {
    if (dedupeHours > 0) {
      const dup = await db.notification.findFirst({ where: { userId: u.id, type, title, createdAt: { gte: new Date(Date.now() - dedupeHours * 3600_000) } } });
      if (dup) continue;
    }
    await db.notification.create({ data: { userId: u.id, type, title, body, href } });
  }
}
