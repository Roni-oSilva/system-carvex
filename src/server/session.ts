import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hmac, randomToken, safeEqual, sha256 } from "@/lib/crypto";
import { clientInfo, describeDevice } from "@/lib/request";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-carvex_session" : "carvex_session";
const PENDING_MFA_MINUTES = 10;

export async function createSession(userId: string, opts: { mfaVerified: boolean }) {
  const { ip, userAgent } = await clientInfo();
  const token = randomToken(32);
  const ttlMs = opts.mfaVerified ? env().SESSION_TTL_HOURS * 3600_000 : PENDING_MFA_MINUTES * 60_000;
  const expiresAt = new Date(Date.now() + ttlMs);
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      csrfSecret: randomToken(16),
      mfaVerified: opts.mfaVerified,
      ip,
      userAgent,
      device: describeDevice(userAgent),
      expiresAt,
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

async function load(requireMfa: boolean) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  const now = Date.now();
  if (!s || s.revokedAt || s.expiresAt.getTime() < now || !s.user.active || s.user.deletedAt) return null;
  if (requireMfa && !s.mfaVerified) return null;
  // Expiração por inatividade
  if (s.mfaVerified && now - s.lastSeenAt.getTime() > env().SESSION_IDLE_MINUTES * 60_000) {
    await db.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
    return null;
  }
  if (now - s.lastSeenAt.getTime() > 60_000) {
    await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } });
  }
  return s;
}

/** Sessão totalmente autenticada (senha + MFA se habilitado). */
export const getSession = cache(() => load(true));
/** Sessão com senha validada, aguardando MFA. */
export const getPendingSession = cache(() => load(false));

/** Use em toda página/ação protegida: a autorização é validada no backend, não só na UI. */
export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireOwner() {
  const s = await requireUser();
  if (s.user.role !== "OWNER") redirect("/");
  return s;
}

export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  store.delete(SESSION_COOKIE);
}

// CSRF explícito (defesa em profundidade além da checagem de Origin das Server Actions).
export const csrfToken = (csrfSecret: string) => hmac(`csrf:${csrfSecret}`);
export const verifyCsrf = (csrfSecret: string, token: unknown) => typeof token === "string" && safeEqual(csrfToken(csrfSecret), token);
