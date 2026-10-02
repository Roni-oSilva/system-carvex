import Link from "next/link";
import { LogOut, Search } from "lucide-react";
import { db } from "@/lib/db";
import { logoutAction } from "@/server/auth-actions";
import { requireUser } from "@/server/session";
import { Clock } from "./clock";
import { Mascot } from "./mascot";
import { NAV, isActive } from "./nav";

export function IconTile({ item, size = 32 }: { item: (typeof NAV)[number]; size?: number }) {
  return <span className="tile" style={{ background: item.color, width: size, height: size }}><item.icon size={size * 0.55} strokeWidth={2.4} /></span>;
}

export async function AppShell({ children, current, title }: { children: React.ReactNode; current: string; title: string }) {
  const s = await requireUser();
  const unread = await db.notification.count({ where: { userId: s.userId, readAt: null } });
  const active = NAV.find((n) => isActive(n.href, current)) ?? NAV[0]!;
  return (
    <>
      <header className="no-print mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-3 pt-4 sm:px-5">
        <Link href="/" className="flex items-center gap-2 no-underline" aria-label="Carvex — início">
          <Mascot size={44} />
          <span className="hero-title text-3xl text-white" style={{ textShadow: "0 3px 0 #0e1240", letterSpacing: "-1px" }}>carvex</span>
        </Link>
        <nav aria-label="Principal" className="nav-pill min-w-0 flex-1 basis-[420px]">
          {NAV.map((n) => <Link key={n.href} href={n.href} aria-current={isActive(n.href, current) ? "page" : undefined}>{n.label}</Link>)}
        </nav>
        <form action="/busca" className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" />
          <input name="q" required minLength={2} placeholder="Buscar em tudo" aria-label="Busca global" className="input !w-44 !rounded-full !pl-9 shadow-[0_4px_0_#0e1240]" />
        </form>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-4 px-3 py-5 sm:px-5">
        <h1 className="hero-title text-3xl text-white sm:text-4xl" style={{ textShadow: "0 3px 0 #0e1240" }}>{title}</h1>
        {children}
      </main>

      <div className="dock no-print">
        <details className="relative">
          <summary className="btn list-none !pl-2"><Mascot size={26} /> Menu</summary>
          <div className="startmenu">
            {NAV.map((n) => <Link key={n.href} href={n.href}><IconTile item={n} size={30} /> {n.label}</Link>)}
          </div>
        </details>
        <Link href={active.href} className="btn-ghost hidden min-w-0 max-w-[40vw] !justify-start truncate sm:inline-flex"><IconTile item={active} size={22} /> <span className="truncate">{title}</span></Link>
        <div className="ml-auto flex items-center gap-3 pr-2 font-bold">
          <Link href="/notificacoes" aria-label={`Notificações: ${unread} não lidas`} className="relative flex items-center gap-1 text-[#0e1240] no-underline">
            🔔{unread > 0 && <span className="rounded-full border-2 border-[#0e1240] bg-[#ff6fa5] px-1.5 text-xs">{unread}</span>}
          </Link>
          <Clock />
          <form action={logoutAction}><button className="btn-ghost !min-h-[30px]" aria-label="Sair"><LogOut size={14} /> <span className="hidden sm:inline">Sair</span></button></form>
        </div>
      </div>
    </>
  );
}
