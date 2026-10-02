import { redirect } from "next/navigation";
import { ActionForm } from "@/components/form";
import { logoutAction, mfaLoginAction } from "@/server/auth-actions";
import { getPendingSession } from "@/server/session";

export default async function MfaPage() {
  const s = await getPendingSession();
  if (!s) redirect("/login");
  if (s.mfaVerified) redirect("/");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="card space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Verificação em duas etapas</h1>
          <p className="text-sm text-muted">Digite o código de 6 dígitos do app autenticador ou um código de recuperação.</p>
        </div>
        <ActionForm action={mfaLoginAction} submit="Verificar">
          <input name="code" inputMode="text" autoComplete="one-time-code" required autoFocus className="input tracking-widest" aria-label="Código" />
        </ActionForm>
        <form action={logoutAction}><button className="text-xs text-muted underline">Cancelar e voltar</button></form>
      </div>
    </main>
  );
}
