import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/server/session";

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="card space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Carvex</h1>
          <p className="text-sm text-muted">Acesso restrito ao proprietário.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
