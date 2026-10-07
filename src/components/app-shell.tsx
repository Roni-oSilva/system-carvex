import Link from "next/link";
import { LogOut, Menu, Search } from "lucide-react";
import { db } from "@/lib/db";
import { logoutAction } from "@/server/auth-actions";
import { requireUser } from "@/server/session";
import { Mascot } from "./mascot";
import { NAV, isActive } from "./nav";

export function IconTile({ item, size = 32 }: { item: (typeof NAV)[number]; size?: number }) {
  return <span className="tile" style={{ background: item.color, width: size, height: size }}><item.icon size={size * 0.55} strokeWidth={2.2} /></span>;
}

export async function AppShell({ children, current, title }: { children: React.ReactNode; current: string; title: string }) {
  const s = await requireUser();
  const unread = await db.notification.count({ where: { userId: s.userId, readAt: null } });
  return (
    <>
      <input id="menu-toggle" type="checkbox" className="peer sr-only no-print" aria-label="Abrir menu" />
      <aside className="side no-print">
        <Link href="/" className="mb-2 flex items-center gap-2 px-2 py-1" aria-label="Carvex — início">
          <Mascot size={30} />
          <span className="text-xl font-extrabold tracking-tight text-[rgb(var(--fg))]">carvex</span>
        </Link>
        <nav aria-label="Principal" className="flex flex-col gap-0.5">
          {NAV.map((n) => <Link key={n.href} href={n.href} aria-current={isActive(n.href, current) ? "page" : undefined}><IconTile item={n} size={26} />{n.label}</Link>)}
        </nav>
        <form action={logoutAction} className="mt-auto"><button className="btn-ghost w-full" aria-label="Sair"><LogOut size={14} /> Sair</button></form>
      </aside>
      <label htmlFor="menu-toggle" className="fixed inset-0 z-30 hidden bg-black/30 peer-checked:block lg:!hidden no-print" aria-hidden="true" />

      <div className="shell-main">
        <header className="topbar no-print">
          <label htmlFor="menu-toggle" className="btn-ghost cursor-pointer lg:!hidden" aria-label="Menu"><Menu size={18} /></label>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h1>
          <form action="/busca" className="relative hidden sm:block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input name="q" required minLength={2} placeholder="Buscar em tudo" aria-label="Busca global" className="input !w-52 !pl-9" />
          </form>
          <Link href="/notificacoes" aria-label={`Notificações: ${unread} não lidas`} className="btn-ghost relative">
            🔔{unread > 0 && <span className="rounded-full bg-[rgb(var(--danger))] px-1.5 text-xs font-bold text-white">{unread}</span>}
          </Link>
        </header>
        <main className="mx-auto max-w-[1280px] space-y-4 px-4 py-5 sm:px-6">{children}</main>
      </div>
    </>
  );
}
