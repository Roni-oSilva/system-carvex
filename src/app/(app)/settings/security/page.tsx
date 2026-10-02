import { AppShell } from "@/components/app-shell";
import { SettingsTabs } from "@/components/settings-tabs";
import { ActionForm } from "@/components/form";
import { changePasswordAction, mfaDisableAction, revokeSessionAction } from "@/server/auth-actions";
import { MfaSetupClient } from "@/components/mfa-setup";
import { db } from "@/lib/db";
import { csrfToken, requireUser } from "@/server/session";

const fmt = (d: Date | null) => (d ? d.toLocaleString("pt-BR") : "—");

export default async function SecurityPage() {
  const s = await requireUser();
  const csrf = csrfToken(s.csrfSecret);
  const [sessions, attempts, logs] = await Promise.all([
    db.session.findMany({ where: { userId: s.userId, revokedAt: null, expiresAt: { gt: new Date() }, mfaVerified: true }, orderBy: { lastSeenAt: "desc" } }),
    db.loginAttempt.findMany({ where: { email: s.user.email }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.auditLog.findMany({ where: { category: "security" }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);

  return (
    <AppShell current="/settings/security" title="Configurações → Segurança">
      <SettingsTabs current="security" />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="font-semibold">Autenticação em duas etapas (2FA)</h2>
          <p className="text-sm text-muted">Status: <span className={s.user.mfaEnabled ? "text-ok" : "text-warn"}>{s.user.mfaEnabled ? "ativo" : "desativado"}</span></p>
          {s.user.mfaEnabled ? (
            <ActionForm action={mfaDisableAction} csrf={csrf} submit="Desativar 2FA">
              <div><label className="label" htmlFor="dpw">Senha</label><input id="dpw" name="password" type="password" required className="input" autoComplete="current-password" /></div>
              <div><label className="label" htmlFor="dcode">Código atual</label><input id="dcode" name="code" required className="input" inputMode="numeric" /></div>
            </ActionForm>
          ) : (
            <MfaSetupClient csrf={csrf} />
          )}
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">Alterar senha</h2>
          <ActionForm action={changePasswordAction} csrf={csrf} submit="Alterar senha">
            <div><label className="label" htmlFor="cur">Senha atual</label><input id="cur" name="current" type="password" required className="input" autoComplete="current-password" /></div>
            <div><label className="label" htmlFor="nw">Nova senha (mín. 12 caracteres)</label><input id="nw" name="next" type="password" required className="input" autoComplete="new-password" /></div>
            <div><label className="label" htmlFor="cf">Confirmar nova senha</label><input id="cf" name="confirm" type="password" required className="input" autoComplete="new-password" /></div>
          </ActionForm>
        </section>
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">Sessões ativas</h2>
        <ul className="divide-y divide-border text-sm">
          {sessions.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p>{x.device ?? "Dispositivo"} {x.id === s.id && <span className="badge ml-2">esta sessão</span>}</p>
                <p className="text-xs text-muted">IP {x.ip ?? "—"} · iniciada {fmt(x.createdAt)} · atividade {fmt(x.lastSeenAt)}</p>
              </div>
              <form action={revokeSessionAction}>
                <input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="sessionId" value={x.id} />
                <button className="btn-ghost">Encerrar</button>
              </form>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">Último login: {fmt(s.user.lastLoginAt)} {s.user.lastLoginIp ? `(IP ${s.user.lastLoginIp})` : ""}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-2">
          <h2 className="font-semibold">Tentativas de login recentes</h2>
          {attempts.length === 0 ? <p className="text-sm text-muted">Nenhuma tentativa registrada.</p> : (
            <ul className="text-sm">{attempts.map((a) => <li key={a.id} className="flex justify-between py-1"><span className={a.success ? "text-ok" : "text-danger"}>{a.success ? "Sucesso" : "Falha"}</span><span className="text-muted">{fmt(a.createdAt)}</span></li>)}</ul>
          )}
        </section>
        <section className="card space-y-2">
          <h2 className="font-semibold">Log de segurança</h2>
          {logs.length === 0 ? <p className="text-sm text-muted">Sem eventos.</p> : (
            <ul className="text-sm">{logs.map((l) => <li key={l.id} className="flex justify-between gap-2 py-1"><span>{l.action} <span className="text-xs text-muted">({l.result.toLowerCase()})</span></span><span className="text-xs text-muted">{fmt(l.createdAt)}</span></li>)}</ul>
          )}
        </section>
      </div>

    </AppShell>
  );
}
