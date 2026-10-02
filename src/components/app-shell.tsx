import Link from "next/link";
import { LogOut, Menu, ShieldCheck } from "lucide-react";
import { logoutAction } from "@/server/auth-actions";
import { NAV } from "./nav";

function NavList({ current }: { current: string }) {
  return (
    <ul className="space-y-1">
      {NAV.map(({ label, href, icon: Icon, phase }) => {
        const active = href === "/" ? current === "/" : current.startsWith(href.split("/").slice(0, 2).join("/"));
        const base = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm";
        return (
          <li key={href}>
            {phase ? (
              <span aria-disabled="true" className={`${base} cursor-not-allowed text-muted/60`} title={`Disponível na Fase ${phase}`}>
                <Icon size={16} /> {label} <span className="badge ml-auto">Fase {phase}</span>
              </span>
            ) : (
              <Link href={href} aria-current={active ? "page" : undefined} className={`${base} ${active ? "bg-brand/10 font-medium text-brand" : "text-fg hover:bg-bg"}`}>
                <Icon size={16} /> {label}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function AppShell({ children, current, title, userName }: { children: React.ReactNode; current: string; title: string; userName: string }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-border bg-surface p-4 lg:block">
        <div className="mb-6 flex items-center gap-2 px-2 text-lg font-semibold"><ShieldCheck size={20} className="text-brand" /> Carvex</div>
        <nav aria-label="Principal"><NavList current={current} /></nav>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur">
          <details className="relative lg:hidden">
            <summary className="btn-ghost cursor-pointer list-none" aria-label="Menu"><Menu size={16} /></summary>
            <nav aria-label="Principal (mobile)" className="absolute left-0 top-11 w-64 rounded-xl border border-border bg-surface p-3 shadow-lg"><NavList current={current} /></nav>
          </details>
          <h1 className="text-base font-semibold">{title}</h1>
          <div className="ml-auto flex items-center gap-3 text-sm text-muted">
            <span className="hidden sm:inline">{userName}</span>
            <form action={logoutAction}><button className="btn-ghost" aria-label="Sair"><LogOut size={14} /> Sair</button></form>
          </div>
        </header>
        <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
