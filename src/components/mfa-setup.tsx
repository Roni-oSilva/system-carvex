"use client";

import { useActionState } from "react";
import { Feedback } from "./form";
import { mfaEnableAction, mfaSetupAction } from "@/server/auth-actions";

export function MfaSetupClient({ csrf }: { csrf: string }) {
  const [setup, start, starting] = useActionState(mfaSetupAction, undefined);
  const [enabled, enable, enabling] = useActionState(mfaEnableAction, undefined);

  if (enabled?.recoveryCodes) {
    return (
      <div className="space-y-3">
        <Feedback state={enabled} />
        <ul className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 font-mono text-sm">{enabled.recoveryCodes.map((c) => <li key={c}>{c}</li>)}</ul>
        <p className="text-xs text-muted">Cada código funciona uma única vez. Recarregue a página após guardá-los.</p>
      </div>
    );
  }
  if (!setup?.qr) {
    return (
      <form action={start} className="space-y-3">
        <input type="hidden" name="csrf" value={csrf} />
        <Feedback state={setup} />
        <button className="btn" disabled={starting}>Configurar 2FA</button>
      </form>
    );
  }
  return (
    <form action={enable} className="space-y-3">
      <input type="hidden" name="csrf" value={csrf} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={setup.qr} alt="QR code para o app autenticador" width={180} height={180} className="rounded-lg bg-white p-2" />
      <p className="break-all text-xs text-muted">Ou digite a chave: <code>{setup.secret}</code></p>
      <div><label className="label" htmlFor="ecode">Código de 6 dígitos</label><input id="ecode" name="code" required inputMode="numeric" className="input" /></div>
      <Feedback state={enabled} />
      <button className="btn" disabled={enabling}>Ativar 2FA</button>
    </form>
  );
}
