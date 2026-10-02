import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSession } from "@/server/session";

export const dynamic = "force-dynamic";

/** Download autenticado de documento (nunca servido como arquivo estático). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return new NextResponse("Não autorizado", { status: 401 });
  const { id } = await params;
  const doc = await db.document.findFirst({ where: { id, deletedAt: null } });
  if (!doc) return new NextResponse("Não encontrado", { status: 404 });
  try {
    const buf = doc.data ?? await readFile(path.join(path.resolve(env().DATA_DIR, "uploads"), path.basename(doc.storageKey)));
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": doc.mime, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" },
    });
  } catch {
    return new NextResponse("Arquivo indisponível", { status: 404 });
  }
}
