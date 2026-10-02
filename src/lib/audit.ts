import type { AuditResult, Prisma } from "@prisma/client";
import { db } from "./db";
import { log } from "./logger";

export type AuditInput = {
  action: string;
  userId?: string | null;
  entity?: string;
  entityId?: string;
  result?: AuditResult;
  category?: "general" | "security" | "finance";
  ip?: string | null;
  userAgent?: string | null;
  meta?: Prisma.InputJsonValue;
};

/** Nunca lança: falha de auditoria não deve derrubar a ação, mas é registrada. */
export async function audit(e: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: e.action,
        userId: e.userId ?? null,
        entity: e.entity,
        entityId: e.entityId,
        result: e.result ?? "SUCCESS",
        category: e.category ?? "general",
        ip: e.ip ?? null,
        userAgent: e.userAgent?.slice(0, 300) ?? null,
        meta: e.meta,
      },
    });
  } catch (err) {
    log.error("audit_write_failed", { action: e.action, err });
  }
}
