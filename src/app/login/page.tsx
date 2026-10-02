import { redirect } from "next/navigation";
import { PixelIcon } from "@/components/pixel-icon";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/server/session";

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return (
    <main className="mx-auto flex min-h-[90vh] max-w-sm flex-col justify-center px-3">
      <div className="win">
        <div className="win-title"><PixelIcon name="lock" /> Bem-vindo ao Carvex</div>
        <div className="win-body space-y-3">
          <p>Digite seu e-mail e senha para entrar. Acesso restrito ao proprietário.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
