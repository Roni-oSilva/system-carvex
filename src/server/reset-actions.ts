"use server";

import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { decrypt, randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { mailConfigured, sendMail } from "@/lib/mail";
import { hashPassword, passwordPolicyError } from "@/lib/password";
import { loginBlocked, rateLimit, recordAttempt } from "@/lib/rate-limit";
import { clientInfo } from "@/lib/request";
import { verifyTotp } from "@/lib/totp";
import type { FormState } from "./auth-actions";

const GENERIC = "Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha (válido por 1 hora).";

/** Pede o link de redefinição. Resposta sempre igual (não revela se o e-mail existe). */
export async function requestResetAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    if (!mailConfigured()) return { error: "Envio de e-mail não configurado neste servidor (SMTP_URL). Use OWNER_RESET — veja o README." };
    const email = z.string().trim().toLowerCase().email().max(254).safeParse(form.get("email"));
    if (!email.success) return { error: "Informe um e-mail válido." };
    const { ip, ipHash } = await clientInfo();
    if (!rateLimit(`reset:${ipHash}`, 5, 15 * 60_000) || !rateLimit(`reset-mail:${email.data}`, 3, 3600_000)) return { error: "Muitas solicitações. Aguarde alguns minutos." };
    const user = await db.user.findFirst({ where: { email: email.data, active: true, deletedAt: null } });
    if (user) {
      await db.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
      const token = randomToken(32);
      await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) } });
      await sendMail(user.email, "Carvex — redefinição de senha", `Recebemos um pedido para redefinir sua senha.\n\nAbra o link (vale por 1 hora, uso único):\n${env().APP_URL}/redefinir?token=${token}\n\nSe não foi você, ignore este e-mail — sua senha continua a mesma.`);
      await audit({ action: "auth.reset_requested", userId: user.id, category: "security", ip });
    }
    return { ok: GENERIC };
  } catch (e) {
    log.error("reset_request_failed", { err: e instanceof Error ? e.message : String(e) });
    return { ok: GENERIC }; // não revela falhas de envio
  }
}

/** Define a nova senha com o token. Se houver 2FA, exige também o código. Encerra todas as sessões. */
export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const d = z.object({ token: z.string().min(20).max(100), next: z.string().max(256), confirm: z.string(), code: z.string().max(20).optional() }).safeParse(Object.fromEntries(form));
    if (!d.success) return { error: "Preencha todos os campos." };
    if (d.data.next !== d.data.confirm) return { error: "A confirmação não confere." };
    const policy = passwordPolicyError(d.data.next);
    if (policy) return { error: policy };
    const { ip, ipHash } = await clientInfo();
    if (await loginBlocked("reset-use", ipHash)) return { error: "Muitas tentativas. Aguarde alguns minutos." };

    const tk = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(d.data.token) }, include: { user: true } });
    if (!tk || tk.usedAt || tk.expiresAt < new Date() || !tk.user.active || tk.user.deletedAt) {
      await recordAttempt("reset-use", ipHash, false, "bad_token");
      return { error: "Link inválido ou expirado. Peça um novo." };
    }
    const u = tk.user;
    let recoveryUsed: string | null = null;
    if (u.mfaEnabled && u.mfaSecretEnc) {
      const code = (d.data.code ?? "").replace(/\s|-/g, "");
      const h = sha256(code.toLowerCase());
      const totpOk = verifyTotp(decrypt(u.mfaSecretEnc), code);
      const recOk = !totpOk && code.length >= 8 && u.mfaRecoveryHashes.includes(h);
      if (!totpOk && !recOk) {
        await recordAttempt("reset-use", ipHash, false, "bad_mfa");
        await audit({ action: "auth.reset_password", userId: u.id, result: "FAILURE", category: "security", ip, meta: { reason: "mfa" } });
        return { error: "Código do 2FA inválido." };
      }
      if (recOk) recoveryUsed = h;
    }
    await db.user.update({
      where: { id: u.id },
      data: { passwordHash: await hashPassword(d.data.next), passwordChangedAt: new Date(), ...(recoveryUsed ? { mfaRecoveryHashes: u.mfaRecoveryHashes.filter((x) => x !== recoveryUsed) } : {}) },
    });
    await db.passwordResetToken.update({ where: { id: tk.id }, data: { usedAt: new Date() } });
    await db.session.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit({ action: "auth.reset_password", userId: u.id, category: "security", ip });
    await db.notification.create({ data: { userId: u.id, type: "SECURITY", title: "Senha redefinida por e-mail", body: "Todas as sessões foram encerradas.", href: "/settings/security" } });
    return { ok: "Senha redefinida! Todas as sessões foram encerradas. Já pode entrar com a nova senha." };
  } catch (e) {
    log.error("reset_password_failed", { err: e instanceof Error ? e.message : String(e) });
    return { error: "Não foi possível redefinir. Tente novamente." };
  }
}
