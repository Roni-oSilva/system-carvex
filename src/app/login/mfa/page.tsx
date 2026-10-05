import { redirect } from "next/navigation";
import { ActionForm } from "@/components/form";
import { Mascot } from "@/components/mascot";
import { logoutAction, mfaLoginAction } from "@/server/auth-actions";
import { getPendingSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function MfaPage() {
  const s = await getPendingSession();
  if (!s) redirect("/login");
  if (s.mfaVerified) redirect("/");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-4 py-10">
      <div className="win w-full">
        <div className="win-title"><span>Verificação em duas etapas</span></div>
        <div className="win-body space-y-3 text-center">
          <Mascot size={90} mood="wink" className="float mx-auto" />
          <p className="font-bold">Digite o código de 6 dígitos do app autenticador (ou um código de recuperação).</p>
          <ActionForm action={mfaLoginAction} submit="Verificar">
            <input name="code" autoComplete="one-time-code" required autoFocus className="input text-center text-xl tracking-[.4em]" aria-label="Código" />
          </ActionForm>
          <form action={logoutAction}><button className="underline">Cancelar e voltar</button></form>
        </div>
      </div>
    </main>
  );
}
