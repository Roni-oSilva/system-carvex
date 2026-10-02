"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import QRCode from "qrcode";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { decrypt, encrypt, randomToken, sha256 } from "@/lib/crypto";
import { log } from "@/lib/logger";
import { DUMMY_HASH, hashPassword, passwordPolicyError, verifyPassword } from "@/lib/password";
import { loginBlocked, recordAttempt } from "@/lib/rate-limit";
import { clientInfo } from "@/lib/request";
import { generateSecret, otpauthUrl, verifyTotp } from "@/lib/totp";
import { createSession, destroyCurrentSession, getPendingSession, requireUser, verifyCsrf } from "./session";

export type FormState = { email?: string; error?: string; ok?: string; qr?: string; secret?: string; recoveryCodes?: string[] } | undefined;

const GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos.";
const BUSY = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
const FAIL = "Não foi possível concluir a ação. Tente novamente.";

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(256) });

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const typedEmail = String(form.get("email") ?? "").slice(0, 254);
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: GENERIC_LOGIN_ERROR, email: typedEmail };
  const { email, password } = parsed.data;
  const { ip, ipHash, userAgent } = await clientInfo();

  try {
    if (await loginBlocked(email, ipHash)) {
      await audit({ action: "auth.login", result: "DENIED", category: "security", ip, userAgent, meta: { reason: "rate_limited" } });
      return { error: BUSY, email: typedEmail };
    }
    const user = await db.user.findFirst({ where: { email, deletedAt: null, active: true } });
    const ok = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, password);
    if (!user || !ok) {
      await recordAttempt(email, ipHash, false, user ? "bad_password" : "unknown_user");
      await audit({ action: "auth.login", userId: user?.id, result: "FAILURE", category: "security", ip, userAgent });
      return { error: GENERIC_LOGIN_ERROR, email: typedEmail };
    }
    await recordAttempt(email, ipHash, true);

    if (user.mfaEnabled) {
      await createSession(user.id, { mfaVerified: false });
    } else {
      await completeLogin(user.id, ip, userAgent);
    }
  } catch (err) {
    log.error("login_failed", { err });
    return { error: FAIL, email: typedEmail };
  }
  redirect(await nextAfterLogin());
}

async function nextAfterLogin() {
  const s = await getPendingSession();
  return s && !s.mfaVerified ? "/login/mfa" : "/";
}

async function completeLogin(userId: string, ip: string, userAgent: string | null) {
  const previous = await db.session.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  await createSession(userId, { mfaVerified: true });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date(), lastLoginIp: ip } });
  await audit({ action: "auth.login", userId, category: "security", ip, userAgent });
  // Alerta de login em novo IP/dispositivo
  if (previous && (previous.ip !== ip || previous.userAgent !== userAgent)) {
    await db.notification.create({
      data: { userId, type: "SECURITY", title: "Novo login detectado", body: `Acesso a partir de ${ip}. Se não foi você, encerre as sessões em Segurança.`, href: "/settings/security" },
    });
  }
}

export async function mfaLoginAction(_: FormState, form: FormData): Promise<FormState> {
  const s = await getPendingSession();
  if (!s || s.mfaVerified || !s.user.mfaSecretEnc) redirect("/login");
  const code = String(form.get("code") ?? "").replace(/\s|-/g, "");
  const { ip, ipHash, userAgent } = await clientInfo();
  const key = `mfa:${s.userId}`;
  try {
    if (await loginBlocked(key, ipHash)) return { error: BUSY };
    let valid = verifyTotp(decrypt(s.user.mfaSecretEnc), code);
    if (!valid && code.length >= 8) {
      const h = sha256(code.toLowerCase());
      if (s.user.mfaRecoveryHashes.includes(h)) {
        valid = true;
        await db.user.update({ where: { id: s.userId }, data: { mfaRecoveryHashes: s.user.mfaRecoveryHashes.filter((x) => x !== h) } });
        await audit({ action: "auth.mfa_recovery_used", userId: s.userId, category: "security", ip });
      }
    }
    await recordAttempt(key, ipHash, valid, valid ? undefined : "bad_mfa");
    if (!valid) {
      await audit({ action: "auth.mfa", userId: s.userId, result: "FAILURE", category: "security", ip, userAgent });
      return { error: "Código inválido." };
    }
    await db.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } }); // evita fixação de sessão
    await completeLogin(s.userId, ip, userAgent);
  } catch (err) {
    log.error("mfa_login_failed", { err });
    return { error: FAIL };
  }
  redirect("/");
}

export async function logoutAction() {
  const s = await getPendingSession();
  if (s) await audit({ action: "auth.logout", userId: s.userId, category: "security" });
  await destroyCurrentSession();
  redirect("/login");
}

// ───────── Ações de segurança da conta (autenticadas + CSRF) ─────────

async function guarded(form: FormData) {
  const s = await requireUser();
  if (!verifyCsrf(s.csrfSecret, form.get("csrf"))) throw new Error("csrf");
  return s;
}

const pwSchema = z.object({ current: z.string().min(1).max(256), next: z.string().max(256), confirm: z.string() });

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const s = await guarded(form);
    const p = pwSchema.safeParse(Object.fromEntries(form));
    if (!p.success) return { error: "Preencha todos os campos." };
    if (p.data.next !== p.data.confirm) return { error: "A confirmação não confere." };
    const policy = passwordPolicyError(p.data.next);
    if (policy) return { error: policy };
    if (!(await verifyPassword(s.user.passwordHash, p.data.current))) {
      await audit({ action: "auth.password_change", userId: s.userId, result: "FAILURE", category: "security" });
      return { error: "Senha atual incorreta." };
    }
    await db.user.update({ where: { id: s.userId }, data: { passwordHash: await hashPassword(p.data.next), passwordChangedAt: new Date() } });
    await db.session.updateMany({ where: { userId: s.userId, id: { not: s.id }, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit({ action: "auth.password_change", userId: s.userId, category: "security" });
    return { ok: "Senha alterada. Outras sessões foram encerradas." };
  } catch (err) {
    log.error("password_change_failed", { err });
    return { error: FAIL };
  }
}

export async function mfaSetupAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const s = await guarded(form);
    if (s.user.mfaEnabled) return { error: "2FA já está ativo." };
    const secret = generateSecret();
    await db.user.update({ where: { id: s.userId }, data: { mfaSecretEnc: encrypt(secret) } });
    const qr = await QRCode.toDataURL(otpauthUrl(secret, s.user.email), { margin: 1, width: 220 });
    return { qr, secret };
  } catch (err) {
    log.error("mfa_setup_failed", { err });
    return { error: FAIL };
  }
}

export async function mfaEnableAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const s = await guarded(form);
    if (s.user.mfaEnabled || !s.user.mfaSecretEnc) return { error: "Inicie a configuração do 2FA primeiro." };
    const code = String(form.get("code") ?? "").replace(/\s/g, "");
    if (!verifyTotp(decrypt(s.user.mfaSecretEnc), code)) return { error: "Código inválido." };
    const codes = Array.from({ length: 8 }, () => randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, "x"));
    await db.user.update({ where: { id: s.userId }, data: { mfaEnabled: true, mfaRecoveryHashes: codes.map((c) => sha256(c)) } });
    await audit({ action: "auth.mfa_enable", userId: s.userId, category: "security" });
    return { ok: "2FA ativado. Guarde os códigos de recuperação — eles não serão exibidos novamente.", recoveryCodes: codes };
  } catch (err) {
    log.error("mfa_enable_failed", { err });
    return { error: FAIL };
  }
}

export async function mfaDisableAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const s = await guarded(form);
    if (!s.user.mfaEnabled || !s.user.mfaSecretEnc) return { error: "2FA não está ativo." };
    const code = String(form.get("code") ?? "").replace(/\s/g, "");
    const pw = String(form.get("password") ?? "");
    if (!(await verifyPassword(s.user.passwordHash, pw)) || !verifyTotp(decrypt(s.user.mfaSecretEnc), code)) {
      await audit({ action: "auth.mfa_disable", userId: s.userId, result: "FAILURE", category: "security" });
      return { error: "Senha ou código inválidos." };
    }
    await db.user.update({ where: { id: s.userId }, data: { mfaEnabled: false, mfaSecretEnc: null, mfaRecoveryHashes: [] } });
    await audit({ action: "auth.mfa_disable", userId: s.userId, category: "security" });
    return { ok: "2FA desativado." };
  } catch (err) {
    log.error("mfa_disable_failed", { err });
    return { error: FAIL };
  }
}

export async function revokeSessionAction(form: FormData): Promise<void> {
  const s = await guarded(form);
  const id = String(form.get("sessionId") ?? "");
  const r = await db.session.updateMany({ where: { id, userId: s.userId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (r.count) await audit({ action: "auth.session_revoke", userId: s.userId, entity: "session", entityId: id, category: "security" });
  if (id === s.id) {
    await destroyCurrentSession();
    redirect("/login");
  }
  revalidatePath("/settings/security");
}
