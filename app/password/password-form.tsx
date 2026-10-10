"use client";

import { useActionState } from "react";
import { updatePassword, type PasswordState } from "./actions";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(
    updatePassword,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-zinc-300"
        >
          Nové heslo
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-12 w-full rounded-2xl border border-white/10 bg-zinc-950/60 px-4 text-sm text-white outline-none ring-emerald-400/40 transition placeholder:text-zinc-600 focus:border-emerald-400/40 focus:ring-2"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="confirm"
          className="block text-sm font-medium text-zinc-300"
        >
          Potvrzení hesla
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-12 w-full rounded-2xl border border-white/10 bg-zinc-950/60 px-4 text-sm text-white outline-none ring-emerald-400/40 transition placeholder:text-zinc-600 focus:border-emerald-400/40 focus:ring-2"
        />
      </div>

      {state && "error" in state ? (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {state.error}
        </p>
      ) : null}

      {state && "success" in state ? (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {state.success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-emerald-500 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Ukládám…" : "Uložit heslo"}
      </button>
    </form>
  );
}
