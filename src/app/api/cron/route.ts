import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runRoutines } from "@/server/cron";

export const dynamic = "force-dynamic";

/** GET /api/cron com `Authorization: Bearer $CRON_SECRET`. Sem CRON_SECRET configurado, o endpoint fica desativado. */
export async function GET(req: Request) {
  const secret = env().CRON_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, result: await runRoutines() });
}
