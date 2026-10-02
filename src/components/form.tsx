"use client";

import { useActionState } from "react";
import type { FormState } from "@/server/auth-actions";

export function Feedback({ state }: { state: FormState }) {
  if (state?.error) return <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>;
  if (state?.ok) return <p role="status" className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">{state.ok}</p>;
  return null;
}

export function ActionForm({
  action, children, submit, csrf, className = "space-y-3",
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  children?: React.ReactNode | ((s: FormState) => React.ReactNode);
  submit: string; csrf?: string; className?: string;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className={className}>
      {csrf && <input type="hidden" name="csrf" value={csrf} />}
      {typeof children === "function" ? children(state) : children}
      <Feedback state={state} />
      <button className="btn" disabled={pending}>{pending ? "Aguarde…" : submit}</button>
    </form>
  );
}
