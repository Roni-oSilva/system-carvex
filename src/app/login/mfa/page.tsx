import { redirect } from "next/navigation";
import { PixelIcon } from "@/components/pixel-icon";
import { ActionForm } from "@/components/form";
import { logoutAction, mfaLoginAction } from "@/server/auth-actions";
import { getPendingSession } from "@/server/session";

export default async function MfaPage() {
  const s = await getPendingSession();
  if (!s) redirect("/login");
  if (s.mfaVerified) redirect("/");
  return (
    <main className="mx-auto flex min-h-[90vh] max-w-sm flex-col justify-center px-3">
      <div className="win">
        <div className="win-title"><PixelIcon name="lock" /> Verificação em duas etapas</div>
        <div className="win-body space-y-3">
          <p>Digite o código de 6 dígitos do app autenticador ou um código de recuperação.</p>
          <ActionForm action={mfaLoginAction} submit="Verificar">
            <input name="code" autoComplete="one-time-code" required autoFocus className="input tracking-widest" aria-label="Código" />
          </ActionForm>
          <form action={logoutAction}><button className="underline">Cancelar e voltar</button></form>
        </div>
      </div>
    </main>
  );
}
