import Link from "next/link";
import { ActionForm } from "@/components/form";
import { Mascot } from "@/components/mascot";
import { mailConfigured } from "@/lib/mail";
import { requestResetAction } from "@/server/reset-actions";

export const dynamic = "force-dynamic";

export default function ForgotPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-4 py-10">
      <div className="win w-full">
        <div className="win-title"><span>Esqueci minha senha</span></div>
        <div className="win-body space-y-3 text-center">
          <Mascot size={80} mood="sleep" className="mx-auto" />
          {mailConfigured() ? (
            <>
              <p className="font-bold">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
              <ActionForm action={requestResetAction} submit="Enviar link">
                <input name="email" type="email" required autoComplete="username" className="input" aria-label="E-mail" />
              </ActionForm>
            </>
          ) : (
            <p className="msg msg-err text-left">O envio de e-mail não está configurado neste servidor. Para recuperar o acesso, use a variável OWNER_RESET (veja o README).</p>
          )}
          <Link href="/login" className="underline">Voltar ao login</Link>
        </div>
      </div>
    </main>
  );
}
