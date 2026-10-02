import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Empty, Form, Flash, Win, type SP } from "@/components/ui";
import { db } from "@/lib/db";
import { dtt } from "@/lib/format";
import { ctx } from "@/server/guard";
import { markNotificationsAction } from "@/server/misc-actions";

export default async function NotificationsPage({ searchParams }: { searchParams: SP }) {
  const { s, csrf } = await ctx();
  const items = await db.notification.findMany({ where: { userId: s.userId }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <AppShell current="/notificacoes" title="Notificações">
      <Flash sp={searchParams} />
      <Win title="Central de notificações" actions={<Form action={markNotificationsAction} csrf={csrf} className="inline"><button className="btn-ghost !min-h-[18px] !py-0 text-black">Marcar todas como lidas</button></Form>}>
        {items.length === 0 ? <Empty>Sem notificações.</Empty> : (
          <ul className="sunken divide-y divide-[#e4e9ff]">{items.map((n) => (
            <li key={n.id} className={`flex items-start gap-2 p-2 ${n.readAt ? "text-muted" : "font-bold"}`}>
              <div className="flex-1">{n.href ? <Link href={n.href}>{n.title}</Link> : n.title}{n.body && <p className="text-xs font-normal">{n.body}</p>}<p className="text-xs font-normal text-muted">{dtt(n.createdAt)} · {n.type}</p></div>
              {!n.readAt && <Form action={markNotificationsAction} csrf={csrf}><input type="hidden" name="id" value={n.id} /><button className="btn-ghost !min-h-[20px] !py-0 font-normal">Lida</button></Form>}
            </li>))}</ul>
        )}
      </Win>
    </AppShell>
  );
}
