import Link from "next/link";
import { Bell, LogOut, Monitor, Search } from "lucide-react";
import { db } from "@/lib/db";
import { logoutAction } from "@/server/auth-actions";
import { requireUser } from "@/server/session";
import { Clock } from "./clock";
import { NAV, isActive } from "./nav";

export async function AppShell({ children, current, title }: { children: React.ReactNode; current: string; title: string }) {
  const s = await requireUser();
  const unread = await db.notification.count({ where: { userId: s.userId, readAt: null } });
  const active = NAV.find((n) => isActive(n.href, current)) ?? NAV[0]!;
  return (
    <>
      <div className="mx-auto max-w-[1400px] p-1 sm:p-3">
        <div className="win">
          <div className="win-title no-print">
            <Monitor size={14} /> <span className="truncate">Carvex — {title}</span>
            <span className="ml-auto hidden font-normal sm:inline">{s.user.name}</span>
          </div>
          <nav aria-label="Principal" className="menubar no-print">
            {NAV.map((n) => <Link key={n.href} href={n.href} aria-current={isActive(n.href, current) ? "page" : undefined}>{n.label}</Link>)}
            <form action="/busca" className="ml-auto flex items-center gap-1 pl-2">
              <Search size={13} /><input name="q" required minLength={2} placeholder="Busca global" aria-label="Busca global" className="input !min-h-[20px] !w-36 !py-0" />
            </form>
          </nav>
          <main className="space-y-3 p-2 sm:p-3">{children}</main>
          <div className="statusbar no-print"><span>Pronto</span><span className="ml-auto">Carvex 98</span></div>
        </div>
      </div>

      <div className="taskbar no-print">
        <details className="relative">
          <summary className="btn list-none"><Monitor size={14} /> Iniciar</summary>
          <div className="startmenu win">
            <div className="strip">Carvex 98</div>
            <ul>
              {NAV.map((n) => <li key={n.href}><Link href={n.href}><n.icon size={16} /> {n.label}</Link></li>)}
              <li className="my-1 border-t border-border" />
              <li><form action={logoutAction}><button><LogOut size={16} /> Sair</button></form></li>
            </ul>
          </div>
        </details>
        <Link href={active.href} className="btn-ghost !justify-start !font-bold sunken !bg-[#dfdfdf] max-w-[40vw] truncate"><active.icon size={14} /> <span className="truncate">{title}</span></Link>
        <div className="tray">
          <Link href="/notificacoes" aria-label={`Notificações: ${unread} não lidas`} className="flex items-center gap-1 text-black no-underline"><Bell size={14} />{unread > 0 && <b className="text-danger">{unread}</b>}</Link>
          <Clock />
        </div>
      </div>
    </>
  );
}
