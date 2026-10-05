import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { Mascot } from "@/components/mascot";
import { mailConfigured } from "@/lib/mail";
import { getSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-4 py-10">
      <h1 className="hero-title text-center text-5xl text-white sm:text-7xl" style={{ textShadow: "0 5px 0 #0e1240" }}>carvex<span className="text-[#ffd23f]">.</span></h1>
      <div className="win w-full max-w-xl">
        <div className="win-title"><span>CARVEX ID · acesso restrito</span></div>
        <div className="win-body grid gap-5 sm:grid-cols-[170px_1fr]">
          <div className="sunken grid place-items-center p-3 text-center">
            <Mascot size={120} wave mood="wink" className="float" />
            <p className="mt-2 text-xs font-extrabold uppercase tracking-wide">Proprietário</p>
          </div>
          <div className="space-y-3">
            <p className="font-bold">Mostre seu crachá! Entre com e-mail e senha.</p>
            <LoginForm />
            {mailConfigured() && <p className="text-sm"><Link href="/esqueci" className="underline">Esqueci minha senha</Link></p>}
          </div>
        </div>
      </div>
    </main>
  );
}
