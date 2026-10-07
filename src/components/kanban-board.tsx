"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { moveLeadAction } from "@/server/crm-actions";

export type KCard = { id: string; name: string; sub: string; opportunity: string | null; score: number | null; followUp: string | null };
export type KCol = { status: string; label: string; cards: KCard[] };

/** Kanban com arrastar-e-soltar (HTML5). O menu "Mover" de cada cartão continua disponível (teclado/celular). */
export function KanbanBoard({ cols, csrf, back, statuses }: { cols: KCol[]; csrf: string; back: string; statuses: { value: string; label: string }[] }) {
  const [over, setOver] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const move = (id: string, status: string) => {
    const fd = new FormData();
    fd.set("csrf", csrf); fd.set("id", id); fd.set("status", status); fd.set("back", back);
    start(() => { void moveLeadAction(fd); });
  };

  return (
    <div className={`flex gap-2 overflow-x-auto pb-2 ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      {cols.map((col) => (
        <div
          key={col.status}
          className="kan-col"
          style={over === col.status ? { background: "#e0e7ff", borderColor: "#4f46e5" } : undefined}
          onDragOver={(e) => { e.preventDefault(); setOver(col.status); }}
          onDragLeave={() => setOver((o) => (o === col.status ? null : o))}
          onDrop={(e) => {
            e.preventDefault(); setOver(null);
            const id = e.dataTransfer.getData("text/plain");
            if (id && !col.cards.some((c) => c.id === id)) move(id, col.status);
          }}
        >
          <h3 className="mb-1 flex justify-between font-extrabold"><span>{col.label}</span><span className="badge">{col.cards.length}</span></h3>
          {col.cards.map((l) => (
            <div key={l.id} className="kan-card cursor-grab active:cursor-grabbing" draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", l.id); e.dataTransfer.effectAllowed = "move"; }}>
              <Link href={`/crm/${l.id}`} className="font-extrabold">{l.name}</Link>
              <p className="text-xs text-muted">{l.sub}</p>
              {l.opportunity && <p className="text-xs">{l.opportunity}</p>}
              <p className="text-xs">{l.score != null && <span className="badge mr-1">score {l.score}</span>}{l.followUp && <span className="badge">follow-up {l.followUp}</span>}</p>
              <select aria-label={`Mover ${l.name} para`} value={col.status} className="input !mt-1 !min-h-[26px] !py-0 text-xs" onChange={(e) => move(l.id, e.target.value)}>
                {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
