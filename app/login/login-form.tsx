"use client";

import { useActionState, useState } from "react";
import {
  login,
  resetPassword,
  type LoginState,
  type ResetState,
} from "./actions";

export function LoginForm() {
  const [resetMode, setResetMode] = useState(false);
  const [loginState, loginAction, loginPending] = useActionState<
    LoginState,
    FormData
  >(login, null);
  const [resetState, resetAction, resetPending] = useActionState<
    ResetState,
    FormData
  >(resetPassword, null);

  if (resetMode) {
    return (
      <form action={resetAction} className="space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="reset-email"
            className="block text-sm font-medium text-zinc-300"
          >
            E-mail
          </label>
          <input
            id="reset-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-12 w-full rounded-2xl border border-white/10 bg-zinc-950/60 px-4 text-sm text-white outline-none ring-emerald-400/40 transition placeholder:text-zinc-600 focus:border-emerald-400/40 focus:ring-2"
            placeholder="vas@email.cz"
          />
        </div>

        {resetState && "error" in resetState ? (
          <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {resetState.error}
          </p>
        ) : null}

        {resetState && "success" in resetState ? (
          <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {resetState.success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={resetPending}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-emerald-500 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {resetPending ? "Odesílám…" : "Odeslat odkaz na obnovu"}
        </button>

        <button
          type="button"
          onClick={() => setResetMode(false)}
          className="w-full text-center text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          Zpět na přihlášení
        </button>
      </form>
    );
  }

  return (
    <form action={loginAction} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-zinc-300"
        >
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-12 w-full rounded-2xl border border-white/10 bg-zinc-950/60 px-4 text-sm text-white outline-none ring-emerald-400/40 transition placeholder:text-zinc-600 focus:border-emerald-400/40 focus:ring-2"
          placeholder="vas@email.cz"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-zinc-300"
        >
          Heslo
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 w-full rounded-2xl border border-white/10 bg-zinc-950/60 px-4 text-sm text-white outline-none ring-emerald-400/40 transition placeholder:text-zinc-600 focus:border-emerald-400/40 focus:ring-2"
        />
      </div>

      {loginState?.error ? (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {loginState.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loginPending}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-emerald-500 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loginPending ? "Přihlašuji…" : "Přihlásit se"}
      </button>

      <button
        type="button"
        onClick={() => setResetMode(true)}
        className="w-full text-center text-sm text-zinc-400 transition hover:text-zinc-200"
      >
        Zapomněli jste heslo?
      </button>
    </form>
  );
}
