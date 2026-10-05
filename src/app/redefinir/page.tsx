import Link from "next/link";
import { ActionForm } from "@/components/form";
import { Mascot } from "@/components/mascot";
import { one, type SP } from "@/components/ui";
import { resetPasswordAction } from "@/server/reset-actions";

export const dynamic = "force-dynamic";

export default async function ResetPage({ searchParams }: { searchParams: SP }) {
  const token = one((await searchParams).token) ?? "";
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-4 py-10">
      <div className="win w-full">
        <div className="win-title"><span>Nova senha</span></div>
        <div className="win-body space-y-3">
          <Mascot size={80} wave className="mx-auto" />
          {token.length < 20 ? <p className="msg msg-err">Link inválido. Peça um novo em “Esqueci minha senha”.</p> : (
            <ActionForm action={resetPasswordAction} submit="Redefinir senha">
              <input type="hidden" name="token" value={token} />
              <div><label className="label" htmlFor="nw">Nova senha (mín. 12 caracteres, 3 tipos)</label><input id="nw" name="next" type="password" required autoComplete="new-password" className="input" /></div>
              <div><label className="label" htmlFor="cf">Confirmar senha</label><input id="cf" name="confirm" type="password" required autoComplete="new-password" className="input" /></div>
              <div><label className="label" htmlFor="cd">Código do 2FA (se estiver ativo)</label><input id="cd" name="code" autoComplete="one-time-code" className="input" /></div>
            </ActionForm>
          )}
          <p className="text-center"><Link href="/login" className="underline">Ir para o login</Link></p>
        </div>
      </div>
    </main>
  );
}
