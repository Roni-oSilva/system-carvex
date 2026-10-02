import { db } from "./db";

const WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_PER_EMAIL = 5;
export const LOGIN_MAX_PER_IP = 20;

/** Brute force: conta falhas recentes por e-mail e por IP (persistido no banco; sobrevive a restart). */
export async function loginBlocked(email: string, ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [byEmail, byIp] = await Promise.all([
    db.loginAttempt.count({ where: { email, success: false, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { ipHash, success: false, createdAt: { gte: since } } }),
  ]);
  return byEmail >= LOGIN_MAX_PER_EMAIL || byIp >= LOGIN_MAX_PER_IP;
}

export const recordAttempt = (email: string, ipHash: string, success: boolean, reason?: string) =>
  db.loginAttempt.create({ data: { email, ipHash, success, reason } });

/** Limitador em memória para ações genéricas (processo único). Troque por Redis ao escalar horizontalmente. */
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  b.n += 1;
  return b.n <= max;
}
