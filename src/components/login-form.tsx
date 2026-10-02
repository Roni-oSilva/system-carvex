"use client";

import { loginAction } from "@/server/auth-actions";
import { ActionForm } from "./form";

export function LoginForm() {
  return (
    <ActionForm action={loginAction} submit="Entrar">
      {(state) => (
        <>
          <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="username" required defaultValue={state?.email} className="input" /></div>
          <div><label className="label" htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete="current-password" required className="input" /></div>
        </>
      )}
    </ActionForm>
  );
}
