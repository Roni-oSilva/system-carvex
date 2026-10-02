import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";

export type SP = Promise<Record<string, string | string[] | undefined>>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function Win({ title, children, className = "", actions }: { title: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`win ${className}`}>
      <div className="win-title"><span className="truncate">{title}</span><span className="ml-auto flex gap-1 font-normal">{actions}</span></div>
      <div className="win-body">{children}</div>
    </section>
  );
}

export function Group({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return <fieldset className={`group ${className}`}><legend>{title}</legend>{children}</fieldset>;
}

export async function Flash({ sp }: { sp: SP }) {
  const q = await sp;
  const err = one(q.err), msg = one(q.msg);
  if (!err && !msg) return null;
  return (
    <div role={err ? "alert" : "status"} className={`msg ${err ? "msg-err" : "msg-ok"}`}>
      {err ? <AlertTriangle size={18} /> : <Info size={18} />}<span>{err ?? msg}</span>
    </div>
  );
}

export function Form({ action, csrf, children, className = "space-y-2", back, encType }: { action: (f: FormData) => Promise<void>; csrf: string; children: ReactNode; className?: string; back?: string; encType?: string }) {
  return (
    <form action={action} className={className} encType={encType}>
      <input type="hidden" name="csrf" value={csrf} />
      {back && <input type="hidden" name="back" value={back} />}
      {children}
    </form>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="label">{label}</span>{children}</label>;
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="sunken p-4 text-center text-muted">{children}</p>;

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "danger" | "ok" }) {
  return (
    <div className="sunken p-2">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${tone === "danger" ? "text-danger" : tone === "ok" ? "text-ok" : ""}`}>{value}</p>
    </div>
  );
}

export const Grid = ({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) => (
  <div className={`grid grid-cols-2 gap-2 ${cols === 4 ? "md:grid-cols-4" : cols === 3 ? "md:grid-cols-3" : ""}`}>{children}</div>
);

